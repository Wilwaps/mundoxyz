const express = require('express');
const router = express.Router();
const { query, transaction } = require('../../db');
const { verifyToken, optionalAuth } = require('../../middleware/auth');
const logger = require('../../utils/logger');
const { v4: uuidv4 } = require('uuid');
const ubicacionService = require('../../services/ubicacion/ubicacionService');

// POST /api/store/order/create
// Nota: usa optionalAuth para permitir pedidos del StoreFront sin sesión,
// pero sigue exigiendo autenticación para POS / flujos internos.
router.post('/create', optionalAuth, async (req, res) => {
    try {
        const {
            store_id,
            items,
            type,
            table_number,
            payment_method,
            delivery_info,
            currency_snapshot,
            customer_id,
            change_to_fires
        } = req.body;
        const source = payment_method && typeof payment_method === 'object' ? payment_method.source : null;
        const isStorefront = source === 'storefront';

        // Para pedidos POS / internos, requerir autenticación fuerte.
        if (!req.user && !isStorefront) {
            return res.status(401).json({ error: 'Autenticación requerida para crear este pedido' });
        }

        // En StoreFront invitado, userId puede ser null.
        const userId = req.user ? req.user.id : null;

        // 1. Calculate Totals & preparar datos para inventario
        let subtotal_usdt = 0;
        const orderItemsData = [];

        // Agrupar cantidades por producto y por modificador para control de stock
        const inventoryAdjustmentsMap = new Map();

        for (const item of items) {
            const productResult = await query(
                'SELECT * FROM products WHERE id = $1',
                [item.product_id]
            );
            if (productResult.rows.length === 0) throw new Error(`Product ${item.product_id} not found`);
            const product = productResult.rows[0];

            let basePriceRaw = parseFloat(product.price_usdt);
            const basePrice = Number.isFinite(basePriceRaw) && basePriceRaw >= 0 ? basePriceRaw : 0;

            let modifiersExtra = 0;
            if (Array.isArray(item.modifiers) && item.modifiers.length > 0) {
                for (const mod of item.modifiers) {
                    if (!mod) continue;
                    const extraRaw =
                        mod.price_adjustment_usdt != null
                            ? Number(mod.price_adjustment_usdt)
                            : mod.price_adjustment != null
                            ? Number(mod.price_adjustment)
                            : 0;
                    if (Number.isFinite(extraRaw)) {
                        modifiersExtra += extraRaw;
                    }
                }
            }

            const itemPrice = basePrice + modifiersExtra;

            const quantityNumber = Number(item.quantity) || 0;

            subtotal_usdt += itemPrice * quantityNumber;

            orderItemsData.push({
                product_id: product.id,
                quantity: quantityNumber,
                price_at_time_usdt: itemPrice,
                modifiers: Array.isArray(item.modifiers) ? item.modifiers : []
            });

            // Preparar ajustes de inventario
            if (product.id && quantityNumber > 0) {
                let entry = inventoryAdjustmentsMap.get(product.id);
                if (!entry) {
                    entry = {
                        product_id: product.id,
                        totalQty: 0,
                        modifierQtyMap: new Map()
                    };
                    inventoryAdjustmentsMap.set(product.id, entry);
                }

                entry.totalQty += quantityNumber;

                if (Array.isArray(item.modifiers)) {
                    for (const mod of item.modifiers) {
                        if (!mod || !mod.id) continue;
                        const modId = mod.id;
                        const current = entry.modifierQtyMap.get(modId) || 0;
                        entry.modifierQtyMap.set(modId, current + quantityNumber);
                    }
                }
            }
        }

        const inventoryAdjustments = Array.from(inventoryAdjustmentsMap.values()).map((entry) => ({
            product_id: entry.product_id,
            totalQty: entry.totalQty,
            modifierQty: Array.from(entry.modifierQtyMap.entries()) // [modifierId, qty]
        }));

        // 1.b Configuración de tienda: impuestos, comisión y monedas permitidas
        const storeSettingsResult = await query(
            'SELECT settings, commission_percentage, allowed_currencies FROM stores WHERE id = $1',
            [store_id]
        );

        if (storeSettingsResult.rows.length === 0) {
            return res.status(400).json({ error: 'Tienda no encontrada para crear el pedido' });
        }

        const storeRow = storeSettingsResult.rows[0];
        const settings = storeRow.settings || {};

        // Normalizar comisión de tienda (0-100)
        const rawCommission = storeRow.commission_percentage;
        let commission_percentage = Number(rawCommission);
        if (!Number.isFinite(commission_percentage) || commission_percentage < 0) commission_percentage = 0;
        if (commission_percentage > 100) commission_percentage = 100;

        // Normalizar monedas permitidas
        const baseCurrencies = ['coins', 'fires', 'usdt', 'ves'];
        let allowedCurrencies = Array.isArray(storeRow.allowed_currencies)
            ? storeRow.allowed_currencies
                  .map((c) => (c != null ? String(c).toLowerCase() : ''))
                  .filter((c) => baseCurrencies.includes(c))
            : null;

        if (!allowedCurrencies || allowedCurrencies.length === 0) {
            allowedCurrencies = baseCurrencies;
        }

        // Validar monedas usadas en el pago contra allowed_currencies de la tienda
        const pm = payment_method && typeof payment_method === 'object' ? payment_method : {};

        const usedCurrencyAmounts = {
            usdt: 0,
            ves: 0,
            fires: 0,
            coins: 0
        };

        const addAmount = (currency, value) => {
            const n = value != null ? Number(value) : 0;
            if (Number.isFinite(n) && n > 0) {
                usedCurrencyAmounts[currency] += n;
            }
        };

        // POS: cash_usdt, zelle, bs, fires
        // StoreFront: cash_usdt, zelle, bs, bs_cash, bs_transfer, fires
        addAmount('usdt', pm.cash_usdt);
        addAmount('usdt', pm.zelle);
        addAmount('ves', pm.bs);
        addAmount('ves', pm.bs_cash);
        addAmount('ves', pm.bs_transfer);
        addAmount('fires', pm.fires);

        const usedCurrencies = Object.entries(usedCurrencyAmounts)
            .filter(([, amount]) => amount > 0)
            .map(([currency]) => currency);

        const notAllowed = usedCurrencies.filter((c) => !allowedCurrencies.includes(c));
        if (notAllowed.length > 0) {
            return res.status(400).json({
                error: 'Método de pago no permitido para esta tienda',
                details: {
                    notAllowed,
                    allowed: allowedCurrencies
                }
            });
        }

        const tax_usdt = subtotal_usdt * (settings.tax_rate || 0);
        const service_fee = subtotal_usdt * (settings.service_fee || 0);
        const delivery_fee_usdt = await ubicacionService.calculateDeliveryFee({
            storeId: store_id,
            type,
            subtotalUsdt: subtotal_usdt,
            deliveryInfo: delivery_info
        }); // Fixed for now, dynamic later

        const total_usdt = subtotal_usdt + tax_usdt + service_fee + delivery_fee_usdt;

        // Calcular comisión de plataforma (solo reporting, sin mover wallets en esta fase)
        const platform_commission_usdt = total_usdt * (commission_percentage / 100);

        // 3. Create Order Transaction
        const result = await transaction(async (client) => {
            // Generate per-store invoice number atomically
            const counterResult = await client.query(
                `INSERT INTO store_counters (store_id, last_invoice_number)
         VALUES ($1, 1)
         ON CONFLICT (store_id)
         DO UPDATE SET last_invoice_number = store_counters.last_invoice_number + 1,
                       updated_at = NOW()
         RETURNING last_invoice_number`,
                [store_id]
            );

            const invoiceNumber = counterResult.rows[0].last_invoice_number;

            // Create Order
            const orderCode = Math.random().toString(36).substring(2, 8).toUpperCase();

            const orderResult = await client.query(
                `INSERT INTO orders 
         (store_id, user_id, customer_id, code, invoice_number, type, status, 
          payment_status, payment_method, currency_snapshot,
          subtotal_usdt, tax_usdt, delivery_fee_usdt, total_usdt,
          table_number, delivery_info)
         VALUES ($1, $2, $3, $4, $5, $6, 'pending', 
                 'unpaid', $7, $8, 
                 $9, $10, $11, $12,
                 $13, $14)
         RETURNING *`,
                [
                    store_id,
                    userId,
                    customer_id || null,
                    orderCode,
                    invoiceNumber,
                    type,
                    JSON.stringify(payment_method || {}),
                    JSON.stringify(currency_snapshot || {}),
                    subtotal_usdt,
                    tax_usdt,
                    delivery_fee_usdt,
                    total_usdt,
                    table_number,
                    JSON.stringify(delivery_info || null)
                ]
            );

            const order = orderResult.rows[0];

            // Persistir comisión calculada en la orden (reporting)
            try {
                await client.query(
                    `UPDATE orders
             SET commission_percentage = $1,
                 platform_commission_usdt = $2
             WHERE id = $3`,
                    [commission_percentage, platform_commission_usdt, order.id]
                );

                order.commission_percentage = commission_percentage;
                order.platform_commission_usdt = platform_commission_usdt;
            } catch (err) {
                logger.error('Error al guardar comisión de orden:', err);
            }

            // Create Order Items
            for (const item of orderItemsData) {
                await client.query(
                    `INSERT INTO order_items 
           (order_id, product_id, quantity, price_at_time_usdt, modifiers)
           VALUES ($1, $2, $3, $4, $5)`,
                    [order.id, item.product_id, item.quantity, item.price_at_time_usdt, JSON.stringify(item.modifiers)]
                );
            }

            // Ajuste de stock por producto y por modificador (si aplica)
            for (const adj of inventoryAdjustments) {
                // Bloquear y validar stock del producto
                const prodRes = await client.query(
                    'SELECT stock FROM products WHERE id = $1 AND store_id = $2 FOR UPDATE',
                    [adj.product_id, store_id]
                );

                if (prodRes.rows.length === 0) {
                    throw new Error('Producto no encontrado para ajuste de inventario');
                }

                const currentStockRaw = prodRes.rows[0].stock;
                const currentStock = Number(currentStockRaw ?? 0);

                if (Number.isFinite(currentStock) && currentStock < adj.totalQty) {
                    throw new Error('Stock insuficiente para uno de los productos');
                }

                await client.query(
                    `UPDATE products 
             SET stock = GREATEST(0, stock - $1), updated_at = NOW()
             WHERE id = $2 AND store_id = $3`,
                    [adj.totalQty, adj.product_id, store_id]
                );

                // Bloquear y ajustar stock por modificador solo si existe configuración en product_modifier_stock
                if (Array.isArray(adj.modifierQty) && adj.modifierQty.length > 0) {
                    for (const [modifierId, qty] of adj.modifierQty) {
                        if (!modifierId || !Number.isFinite(qty) || qty <= 0) continue;

                        const modRes = await client.query(
                            `SELECT stock FROM product_modifier_stock 
                     WHERE store_id = $1 AND product_id = $2 AND modifier_id = $3 
                     FOR UPDATE`,
                            [store_id, adj.product_id, modifierId]
                        );

                        if (modRes.rows.length === 0) {
                            // Si no hay configuración de stock por modificador, no controlamos inventario a ese nivel
                            continue;
                        }

                        const currentModStockRaw = modRes.rows[0].stock;
                        const currentModStock = Number(currentModStockRaw ?? 0);

                        if (Number.isFinite(currentModStock) && currentModStock < qty) {
                            throw new Error('Stock insuficiente para una variante de producto');
                        }

                        await client.query(
                            `UPDATE product_modifier_stock 
                     SET stock = GREATEST(0, stock - $1), updated_at = NOW()
                     WHERE store_id = $2 AND product_id = $3 AND modifier_id = $4`,
                            [qty, store_id, adj.product_id, modifierId]
                        );
                    }
                }
            }

            // Opcional: acreditar cambio en Fires al cliente si está habilitado
            if (change_to_fires && change_to_fires.enabled && customer_id && change_to_fires.change_fires) {
                const firesAmountRaw = Number(change_to_fires.change_fires);
                const firesAmount = Number.isFinite(firesAmountRaw) && firesAmountRaw > 0 ? firesAmountRaw : 0;

                if (firesAmount > 0) {
                    // Asegurar que exista wallet para el cliente
                    let walletRes = await client.query(
                        'SELECT id, fires_balance FROM wallets WHERE user_id = $1 FOR UPDATE',
                        [customer_id]
                    );

                    if (walletRes.rows.length === 0) {
                        await client.query(
                            `INSERT INTO wallets (user_id, coins_balance, fires_balance, created_at, updated_at)
                     VALUES ($1, 0, 0, NOW(), NOW())
                     ON CONFLICT (user_id) DO NOTHING`,
                            [customer_id]
                        );

                        walletRes = await client.query(
                            'SELECT id, fires_balance FROM wallets WHERE user_id = $1 FOR UPDATE',
                            [customer_id]
                        );
                    }

                    if (walletRes.rows.length > 0) {
                        const wallet = walletRes.rows[0];
                        const beforeRaw = parseFloat(wallet.fires_balance);
                        const balanceBefore = Number.isFinite(beforeRaw) ? beforeRaw : 0;
                        const balanceAfter = balanceBefore + firesAmount;

                        await client.query(
                            `UPDATE wallets 
                     SET fires_balance = fires_balance + $1,
                         total_fires_earned = total_fires_earned + $1,
                         updated_at = NOW()
                     WHERE id = $2`,
                            [firesAmount, wallet.id]
                        );

                        await client.query(
                            `INSERT INTO wallet_transactions 
                     (wallet_id, type, currency, amount, balance_before, balance_after, description, reference, metadata)
                     VALUES ($1, 'pos_change_to_fires', 'fires', $2, $3, $4, $5, $6, $7)`,
                            [
                                wallet.id,
                                firesAmount,
                                balanceBefore,
                                balanceAfter,
                                `Cambio en Fires por compra en tienda ${store_id}`,
                                `store_order_${order.id}`,
                                JSON.stringify({
                                    store_id,
                                    order_id: order.id,
                                    invoice_number: order.invoice_number,
                                    change_usdt: change_to_fires.change_usdt || null,
                                    rate_fires: currency_snapshot && currency_snapshot.fires != null ? currency_snapshot.fires : null
                                })
                            ]
                        );
                    }
                }
            }

            // Para pedidos del POS y StoreFront, crear ticket de cocina y notificar al KDS.
            // Diferencia clave: en StoreFront, el origen se marca en payment_method.source = 'storefront'.
            if (true) {
                await client.query(
                    `INSERT INTO kitchen_tickets (order_id, station, status)
         VALUES ($1, 'main', 'pending')`,
                    [order.id]
                );

                if (req.io) {
                    req.io.to(`store:${store_id}:kitchen`).emit('store:new-order', { order });
                }
            }

            return order;
        });

        res.json({ success: true, order: result });
    } catch (error) {
        logger.error('Error creating order:', error);
        res.status(400).json({ error: error.message });
    }
});

// GET /api/store/order/:storeId/orders/history
// Lista de órdenes recientes de una tienda (para historial / facturación)
router.get('/:storeId/orders/history', verifyToken, async (req, res) => {
    try {
        const { storeId } = req.params;
        const limit = Math.min(parseInt(req.query.limit, 10) || 50, 200);
        const offset = Math.max(parseInt(req.query.offset, 10) || 0, 0);

        const result = await query(
            `SELECT 
                o.id,
                o.store_id,
                o.code,
                o.invoice_number,
                o.status,
                o.payment_status,
                o.type,
                o.table_number,
                o.total_usdt,
                o.created_at,
                u.display_name AS customer_name,
                u.ci_full AS customer_ci,
                u.phone AS customer_phone,
                su.id AS seller_id,
                su.username AS seller_username,
                su.display_name AS seller_display_name
           FROM orders o
           JOIN stores s ON s.id = o.store_id
           LEFT JOIN users u ON u.id = o.customer_id
           LEFT JOIN users su ON su.id = o.user_id
           WHERE o.store_id = $1
           ORDER BY o.created_at DESC
           LIMIT $2 OFFSET $3`,
            [storeId, limit, offset]
        );

        res.json(result.rows);
    } catch (error) {
        logger.error('Error fetching store order history:', error);
        res.status(400).json({ error: error.message });
    }
});

// GET /api/store/order/:storeId/invoice/:invoiceNumber
// Obtiene el detalle completo de una factura (orden + ítems)
router.get('/:storeId/invoice/:invoiceNumber', optionalAuth, async (req, res) => {
    try {
        const { storeId, invoiceNumber } = req.params;

        const result = await query(
            `SELECT 
                o.id,
                o.store_id,
                s.name AS store_name,
                o.user_id,
                o.customer_id,
                o.code,
                o.invoice_number,
                o.type,
                o.status,
                o.payment_status,
                o.payment_method,
                o.currency_snapshot,
                o.subtotal_usdt,
                o.tax_usdt,
                o.delivery_fee_usdt,
                o.discount_usdt,
                o.total_usdt,
                o.table_number,
                o.notes,
                o.delivery_info,
                o.created_at,
                o.updated_at,
                u.display_name AS customer_name,
                u.ci_full AS customer_ci,
                u.phone AS customer_phone,
                u.email AS customer_email,
                su.id AS seller_id,
                su.username AS seller_username,
                su.display_name AS seller_display_name,
                COALESCE(
                    json_agg(
                        json_build_object(
                            'product_id', p.id,
                            'product_name', p.name,
                            'quantity', oi.quantity,
                            'price_usdt', oi.price_at_time_usdt,
                            'modifiers', oi.modifiers
                        )
                    ) FILTER (WHERE oi.id IS NOT NULL),
                    '[]'::json
                ) AS items
           FROM orders o
           JOIN stores s ON s.id = o.store_id
           LEFT JOIN users u ON u.id = o.customer_id
           LEFT JOIN users su ON su.id = o.user_id
           LEFT JOIN order_items oi ON oi.order_id = o.id
           LEFT JOIN products p ON p.id = oi.product_id
           WHERE o.store_id = $1
             AND o.invoice_number = $2
           GROUP BY 
                o.id,
                s.name,
                u.display_name,
                u.ci_full,
                u.phone,
                u.email,
                su.id,
                su.username,
                su.display_name`,
            [storeId, invoiceNumber]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Factura no encontrada' });
        }

        const row = result.rows[0];

        const order = {
            id: row.id,
            store_id: row.store_id,
            store_name: row.store_name,
            user_id: row.user_id,
            customer_id: row.customer_id,
            code: row.code,
            invoice_number: row.invoice_number,
            type: row.type,
            status: row.status,
            payment_status: row.payment_status,
            payment_method: row.payment_method || {},
            currency_snapshot: row.currency_snapshot || {},
            subtotal_usdt: Number(row.subtotal_usdt || 0),
            tax_usdt: Number(row.tax_usdt || 0),
            delivery_fee_usdt: Number(row.delivery_fee_usdt || 0),
            discount_usdt: Number(row.discount_usdt || 0),
            total_usdt: Number(row.total_usdt || 0),
            table_number: row.table_number,
            notes: row.notes,
            delivery_info: row.delivery_info || null,
            created_at: row.created_at,
            updated_at: row.updated_at,
            customer: {
                name: row.customer_name || null,
                ci: row.customer_ci || null,
                phone: row.customer_phone || null,
                email: row.customer_email || null
            },
            items: Array.isArray(row.items) ? row.items : [],
            seller: {
                id: row.seller_id || null,
                username: row.seller_username || null,
                name: row.seller_display_name || row.seller_username || null
            }
        };

        res.json({ order });
    } catch (error) {
        logger.error('Error fetching invoice detail:', error);
        res.status(400).json({ error: error.message });
    }
});

// GET /api/store/:storeId/orders/active (For KDS)
router.get('/:storeId/orders/active', verifyToken, async (req, res) => {
    try {
        const { storeId } = req.params;

        const result = await query(
            `SELECT o.*, 
              json_agg(json_build_object(
                'name', p.name, 
                'quantity', oi.quantity,
                'modifiers', oi.modifiers
              )) as items
       FROM orders o
       JOIN order_items oi ON o.id = oi.order_id
       JOIN products p ON oi.product_id = p.id
       WHERE o.store_id = $1 
         AND o.status IN ('pending', 'confirmed', 'preparing', 'ready')
       GROUP BY o.id
       ORDER BY o.created_at ASC`,
            [storeId]
        );

        res.json(result.rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// POST /api/store/order/:orderId/status (For KDS/Driver)
router.post('/:orderId/status', verifyToken, async (req, res) => {
    try {
        const { orderId } = req.params;
        const { status } = req.body;

        const result = await query(
            `UPDATE orders SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *`,
            [status, orderId]
        );

        const order = result.rows[0];

        // Notify Customer
        if (req.io) {
            req.io.to(`user:${order.user_id}`).emit('store:order-update', {
                orderId, status, code: order.code
            });
        }

        res.json(order);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

module.exports = router;

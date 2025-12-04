const express = require('express');
const router = express.Router();
const { query, transaction } = require('../../db');
const { verifyToken, optionalAuth, requireWalletAccess } = require('../../middleware/auth');
const logger = require('../../utils/logger');
const { v4: uuidv4 } = require('uuid');
const ubicacionService = require('../../services/ubicacion/ubicacionService');
const { distributeCommissions } = require('../../services/referralService');
const { isStoreRentalActive } = require('../../helpers/storeHelpers');

async function userCanAccessStoreOrders(user, storeId) {
    if (!user || !storeId) return false;

    const roles = Array.isArray(user.roles) ? user.roles : [];
    const isGlobalAdmin = roles.includes('tote') || roles.includes('admin');

    // Admins globales siempre pueden ver/gestionar pedidos de cualquier tienda
    if (isGlobalAdmin) return true;

    // 1) Intentar resolver permisos desde store_staff activo
    const staffResult = await query(
        `SELECT role FROM store_staff WHERE user_id = $1 AND store_id = $2 AND is_active = TRUE LIMIT 1`,
        [user.id, storeId]
    );

    if (staffResult.rows.length > 0) {
        const staffRole = staffResult.rows[0].role;
        const allowedRoles = ['owner', 'admin', 'manager', 'seller', 'marketing', 'mesonero', 'delivery'];
        return allowedRoles.includes(staffRole);
    }

    // 2) Fallback: si el usuario es el dueño (owner_id) de la tienda, permitir acceso completo
    const ownerResult = await query(
        `SELECT owner_id FROM stores WHERE id = $1 LIMIT 1`,
        [storeId]
    );

    if (ownerResult.rows.length > 0) {
        const ownerId = ownerResult.rows[0].owner_id;
        if (String(ownerId) === String(user.id)) {
            return true;
        }
    }

    return false;
}

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
        let fires_eligible_subtotal_usdt = 0;
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

            // Acumular subtotal elegible para pago con Fuegos (solo productos que lo permiten)
            if (product.accepts_fires === true) {
                fires_eligible_subtotal_usdt += itemPrice * quantityNumber;
            }

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

        // Validación específica para flujos POS QR con Fuegos solamente
        if (source === 'pos_qr') {
            const epsilon = 0.01;
            if (fires_eligible_subtotal_usdt + epsilon < subtotal_usdt) {
                return res.status(400).json({
                    error:
                        'Este pedido no puede pagarse 100% con Fuegos. Verifica que todos los productos acepten Fuegos.',
                    details: {
                        subtotal_usdt,
                        fires_eligible_subtotal_usdt
                    }
                });
            }
        }

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

        // POS: cash_usdt, usdt_tron, bs, bs_cash, fires
        // StoreFront: cash_usdt, usdt_tron, bs, bs_cash, bs_transfer, fires
        addAmount('usdt', pm.cash_usdt);
        addAmount('usdt', pm.usdt_tron);
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

        // Validar que el monto en Fuegos no exceda lo permitido por los productos que aceptan Fuegos
        const firesRateRaw = currency_snapshot && currency_snapshot.fires;
        const firesRate = Number(firesRateRaw);
        const firesAmountRaw = pm.fires != null ? Number(pm.fires) : 0;
        const firesAmount = Number.isFinite(firesAmountRaw) && firesAmountRaw > 0 ? firesAmountRaw : 0;

        if (firesAmount > 0) {
            if (!Number.isFinite(firesRate) || firesRate <= 0) {
                return res.status(400).json({ error: 'No hay tasa de Fuegos configurada para esta tienda' });
            }

            const maxFiresTokens = Math.floor(fires_eligible_subtotal_usdt * firesRate);

            if (maxFiresTokens <= 0) {
                return res.status(400).json({ error: 'Ningún producto de este pedido permite pago con Fuegos' });
            }

            if (firesAmount > maxFiresTokens) {
                return res.status(400).json({
                    error: 'El monto en Fuegos excede el máximo permitido para este pedido',
                    details: {
                        max_fires: maxFiresTokens,
                        fires_attempted: firesAmount
                    }
                });
            }
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

        let initialStatus = 'pending';
        let initialPaymentStatus = 'unpaid';
        if (!isStorefront) {
            initialStatus = 'confirmed';
            // Para pagos POS con QR, la orden comienza como no pagada y se liquidará
            // cuando el cliente complete el pago con fuegos desde su billetera.
            initialPaymentStatus = pm.source === 'pos_qr' ? 'unpaid' : 'paid';
        }

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
         VALUES ($1, $2, $3, $4, $5, $6, $7, 
                 $8, $9, $10, 
                 $11, $12, $13, $14,
                 $15, $16)
         RETURNING *`,
                [
                    store_id,
                    userId,
                    customer_id || null,
                    orderCode,
                    invoiceNumber,
                    type,
                    initialStatus,
                    initialPaymentStatus,
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
                    'SELECT stock, min_stock_alert FROM products WHERE id = $1 AND store_id = $2 FOR UPDATE',
                    [adj.product_id, store_id]
                );

                if (prodRes.rows.length === 0) {
                    throw new Error('Producto no encontrado para ajuste de inventario');
                }

                const row = prodRes.rows[0];
                const currentStockRaw = row.stock;
                const currentStock = Number(currentStockRaw ?? 0);
                const minStockRaw = row.min_stock_alert;
                const minStock = Number(minStockRaw ?? 0);

                if (Number.isFinite(currentStock) && currentStock < adj.totalQty) {
                    throw new Error('Stock insuficiente para uno de los productos');
                }

                const newStock = Math.max(0, currentStock - adj.totalQty);

                await client.query(
                    `UPDATE products 
             SET stock = GREATEST(0, stock - $1), updated_at = NOW()
             WHERE id = $2 AND store_id = $3`,
                    [adj.totalQty, adj.product_id, store_id]
                );

                // Registrar alertas de stock cuando se alcanza el umbral configurado o se agota
                if (newStock === 0 && currentStock > 0) {
                    await client.query(
                        `INSERT INTO product_stock_alerts (store_id, product_id, event_type, stock)
                 VALUES ($1, $2, 'out_of_stock', $3)`,
                        [store_id, adj.product_id, newStock]
                    );
                } else if (minStock > 0 && newStock <= minStock && currentStock > minStock) {
                    await client.query(
                        `INSERT INTO product_stock_alerts (store_id, product_id, event_type, stock)
                 VALUES ($1, $2, 'low_stock', $3)`,
                        [store_id, adj.product_id, newStock]
                    );
                }

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

            // Hook de sistema de referidos: comisiones por orden de tienda (solo log, sin tocar wallets)
            try {
                const actorUserId = customer_id || userId || null;
                const firesRateRaw = currency_snapshot && currency_snapshot.fires;
                const firesRate = Number(firesRateRaw);
                const hasFiresRate = Number.isFinite(firesRate) && firesRate > 0;

                if (actorUserId && hasFiresRate && platform_commission_usdt > 0) {
                    const baseFires = platform_commission_usdt * firesRate;

                    await distributeCommissions({
                        client,
                        source: 'store',
                        actorUserId,
                        baseAmount: baseFires,
                        currency: 'fires',
                        operationType: 'store_order',
                        operationId: order.id,
                        metadata: {
                            store_id,
                            order_id: order.id,
                            invoice_number: order.invoice_number
                        }
                    });
                }
            } catch (err) {
                logger.error('[Referrals] Error distributing store order commissions', {
                    store_id,
                    error: err?.message || err
                });
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

// GET /api/store/order/my
// Lista de órdenes recientes asociadas al usuario (cliente POS o usuario que creó la orden)
router.get('/my', verifyToken, async (req, res) => {
    try {
        const userId = req.user.id;
        const limit = Math.min(parseInt(req.query.limit, 10) || 50, 200);
        const offset = Math.max(parseInt(req.query.offset, 10) || 0, 0);

        const result = await query(
            `SELECT 
                o.id,
                o.store_id,
                o.invoice_number,
                s.name AS store_name,
                s.slug AS store_slug,
                o.code,
                o.invoice_number,
                o.status,
                o.payment_status,
                o.type,
                o.table_number,
                o.total_usdt,
                o.created_at
           FROM orders o
           JOIN stores s ON s.id = o.store_id
           WHERE (o.user_id = $1 OR o.customer_id = $1)
           ORDER BY o.created_at DESC
           LIMIT $2 OFFSET $3`,
            [userId, limit, offset]
        );

        res.json({
            orders: result.rows,
            limit,
            offset
        });
    } catch (error) {
        logger.error('Error fetching user orders:', error);
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

        const rentalActive = await isStoreRentalActive(storeId);
        if (!rentalActive) {
            return res.status(403).json({ error: 'Store Rental Expired' });
        }

        const canAccess = await userCanAccessStoreOrders(req.user, storeId);
        if (!canAccess) {
            return res.status(403).json({ error: 'No autorizado para ver el historial de pedidos de esta tienda' });
        }

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
                o.qr_session_id,
                o.qr_expires_at,
                o.total_fires,
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
             AND (
                 o.status NOT IN ('pending', 'confirmed', 'preparing', 'ready')
                 OR (o.payment_status = 'unpaid' AND o.qr_session_id IS NOT NULL)
             )
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
                o.qr_session_id,
                o.qr_expires_at,
                o.total_fires,
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

        const rentalActive = await isStoreRentalActive(storeId);
        if (!rentalActive) {
            return res.status(403).json({ error: 'Store Rental Expired' });
        }

        const canAccess = await userCanAccessStoreOrders(req.user, storeId);
        if (!canAccess) {
            return res.status(403).json({ error: 'No autorizado para ver los pedidos activos de esta tienda' });
        }

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

        const existingOrderResult = await query(
            `SELECT id, store_id, user_id, code FROM orders WHERE id = $1`,
            [orderId]
        );

        if (existingOrderResult.rows.length === 0) {
            return res.status(404).json({ error: 'Orden no encontrada' });
        }

        const existingOrder = existingOrderResult.rows[0];

        const canAccess = await userCanAccessStoreOrders(req.user, existingOrder.store_id);
        if (!canAccess) {
            return res.status(403).json({ error: 'No autorizado para actualizar pedidos de esta tienda' });
        }

        const result = await query(
            `UPDATE orders SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *`,
            [status, orderId]
        );

        const order = result.rows[0];

        // Notify Customer
        if (req.io && order.user_id) {
            req.io.to(`user:${order.user_id}`).emit('store:order-update', {
                orderId,
                status,
                code: order.code
            });
        }

        res.json(order);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// POST /api/store/order/qr/start
// Crea o renueva una sesión de pago QR para una orden existente y no pagada
router.post('/qr/start', verifyToken, async (req, res) => {
    try {
        const { order_id, total_fires, expires_in_seconds } = req.body || {};

        if (!order_id) {
            return res.status(400).json({ error: 'order_id es requerido' });
        }

        const orderResult = await query(
            `SELECT id, store_id, payment_status
             FROM orders
             WHERE id = $1`,
            [order_id]
        );

        if (orderResult.rows.length === 0) {
            return res.status(404).json({ error: 'Orden no encontrada' });
        }

        const order = orderResult.rows[0];

        // Verificar alquiler activo
        const rentalActive = await isStoreRentalActive(order.store_id);
        if (!rentalActive) {
            return res.status(403).json({ error: 'Store Rental Expired' });
        }

        // Verificar permisos POS sobre la tienda
        const canAccess = await userCanAccessStoreOrders(req.user, order.store_id);
        if (!canAccess) {
            return res.status(403).json({ error: 'No autorizado para gestionar pagos QR en esta tienda' });
        }

        if (order.payment_status !== 'unpaid') {
            return res.status(400).json({ error: 'Solo se pueden generar sesiones QR para órdenes no pagadas' });
        }

        const amountFiresRaw = total_fires != null ? Number(total_fires) : NaN;
        if (!Number.isFinite(amountFiresRaw) || amountFiresRaw <= 0) {
            return res.status(400).json({ error: 'total_fires debe ser un número positivo' });
        }

        const ttlSecondsRaw = expires_in_seconds != null ? Number(expires_in_seconds) : NaN;
        let ttlSeconds = Number.isFinite(ttlSecondsRaw) ? ttlSecondsRaw : 300; // 5 minutos por defecto
        if (ttlSeconds < 60) ttlSeconds = 60;
        if (ttlSeconds > 1800) ttlSeconds = 1800; // Máx 30 minutos

        const qrSessionId = uuidv4();
        const expiresAt = new Date(Date.now() + ttlSeconds * 1000);

        const updateResult = await query(
            `UPDATE orders
             SET qr_session_id = $1,
                 qr_expires_at = $2,
                 total_fires = $3,
                 updated_at = NOW()
             WHERE id = $4
             RETURNING id, store_id, qr_session_id, qr_expires_at, total_fires`,
            [qrSessionId, expiresAt.toISOString(), amountFiresRaw, order_id]
        );

        const updated = updateResult.rows[0];

        res.json({
            success: true,
            order_id: updated.id,
            store_id: updated.store_id,
            qr_session_id: updated.qr_session_id,
            qr_expires_at: updated.qr_expires_at,
            total_fires: Number(updated.total_fires || 0)
        });
    } catch (error) {
        logger.error('[Store][QR] Error creando sesión QR', error);
        res.status(400).json({ error: error.message || 'Error al crear sesión QR' });
    }
});

// GET /api/store/order/qr/:qrSessionId
// Devuelve datos públicos de una sesión de pago QR para que el cliente pueda mostrar el pago
router.get('/qr/:qrSessionId', optionalAuth, async (req, res) => {
    try {
        const { qrSessionId } = req.params;

        const result = await query(
            `SELECT 
                o.id,
                o.store_id,
                o.qr_session_id,
                o.qr_expires_at,
                o.total_fires,
                o.payment_status,
                o.total_usdt,
                s.slug AS store_slug,
                s.name AS store_name,
                s.logo_url
             FROM orders o
             JOIN stores s ON s.id = o.store_id
             WHERE o.qr_session_id = $1`,
            [qrSessionId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Sesión de pago QR no encontrada' });
        }

        const row = result.rows[0];

        const now = new Date();
        const expiresAt = row.qr_expires_at ? new Date(row.qr_expires_at) : null;
        const isExpired = !!expiresAt && expiresAt.getTime() < now.getTime();

        res.json({
            order_id: row.id,
            store_id: row.store_id,
            store_slug: row.store_slug,
            store_name: row.store_name,
            store_logo_url: row.logo_url,
            qr_session_id: row.qr_session_id,
            qr_expires_at: row.qr_expires_at,
            is_expired: isExpired,
            payment_status: row.payment_status,
            total_fires: Number(row.total_fires || 0),
            total_usdt: Number(row.total_usdt || 0),
            invoice_number: row.invoice_number
        });
    } catch (error) {
        logger.error('[Store][QR] Error obteniendo sesión QR', error);
        res.status(400).json({ error: error.message || 'Error al obtener sesión QR' });
    }
});

// POST /api/store/order/qr/:qrSessionId/pay
// El cliente paga la orden con Fuegos de su billetera, acreditando a la billetera de la tienda
router.post('/qr/:qrSessionId/pay', verifyToken, requireWalletAccess, async (req, res) => {
    try {
        const { qrSessionId } = req.params;
        const userId = req.user.id;

        const result = await transaction(async (client) => {
            // Bloquear orden y tienda asociada
            const orderRes = await client.query(
                `SELECT 
                    o.*, 
                    s.fires_wallet_balance AS store_fires_balance,
                    s.id AS store_id
                 FROM orders o
                 JOIN stores s ON s.id = o.store_id
                 WHERE o.qr_session_id = $1
                 FOR UPDATE`,
                [qrSessionId]
            );

            if (orderRes.rows.length === 0) {
                throw new Error('Sesión de pago QR no encontrada');
            }

            const order = orderRes.rows[0];

            // Si la orden tiene un cliente asociado, solo ese usuario puede completar el pago QR
            if (order.customer_id && String(order.customer_id) !== String(userId)) {
                throw new Error('Este pago QR está asociado a otro cliente');
            }

            const now = new Date();
            const expiresAt = order.qr_expires_at ? new Date(order.qr_expires_at) : null;
            if (expiresAt && expiresAt.getTime() < now.getTime()) {
                throw new Error('La sesión de pago QR ha expirado');
            }

            if (order.payment_status !== 'unpaid') {
                throw new Error('Esta orden ya fue pagada o cancelada');
            }

            const amountFiresRaw = order.total_fires != null ? Number(order.total_fires) : NaN;
            if (!Number.isFinite(amountFiresRaw) || amountFiresRaw <= 0) {
                throw new Error('Monto de Fuegos inválido para esta orden');
            }

            // Obtener wallet del usuario
            const walletRes = await client.query(
                'SELECT * FROM wallets WHERE user_id = $1 FOR UPDATE',
                [userId]
            );

            if (walletRes.rows.length === 0) {
                throw new Error('Wallet del usuario no encontrada');
            }

            const wallet = walletRes.rows[0];
            const firesBalanceRaw = wallet.fires_balance != null ? Number(wallet.fires_balance) : 0;
            const firesBalance = Number.isFinite(firesBalanceRaw) ? firesBalanceRaw : 0;

            if (firesBalance < amountFiresRaw) {
                throw new Error('Saldo de Fuegos insuficiente para completar el pago');
            }

            const userBalanceBefore = firesBalance;
            const userBalanceAfter = firesBalance - amountFiresRaw;

            // Debitar Fuegos del usuario
            await client.query(
                `UPDATE wallets
                 SET fires_balance = fires_balance - $1,
                     total_fires_spent = total_fires_spent + $1,
                     updated_at = NOW()
                 WHERE id = $2`,
                [amountFiresRaw, wallet.id]
            );

            // Registrar transacción en wallet del usuario
            await client.query(
                `INSERT INTO wallet_transactions
                 (wallet_id, type, currency, amount, balance_before, balance_after, description, reference)
                 VALUES ($1, 'store_qr_payment', 'fires', $2, $3, $4, $5, $6)`,
                [
                    wallet.id,
                    amountFiresRaw,
                    userBalanceBefore,
                    userBalanceAfter,
                    `Pago QR en tienda ${order.store_id}`,
                    `store_order_${order.id}`
                ]
            );

            // Acreditar a billetera de la tienda
            const storeBalanceRaw = order.store_fires_balance != null ? Number(order.store_fires_balance) : 0;
            const storeBalanceBefore = Number.isFinite(storeBalanceRaw) ? storeBalanceRaw : 0;
            const storeBalanceAfter = storeBalanceBefore + amountFiresRaw;

            await client.query(
                `UPDATE stores
                 SET fires_wallet_balance = fires_wallet_balance + $1,
                     updated_at = NOW()
                 WHERE id = $2`,
                [amountFiresRaw, order.store_id]
            );

            await client.query(
                `INSERT INTO store_wallet_transactions
                 (store_id, user_id, order_id, type, amount_fires, balance_after, metadata)
                 VALUES ($1, $2, $3, $4, $5, $6, $7)`,
                [
                    order.store_id,
                    userId,
                    order.id,
                    'qr_payment_in',
                    amountFiresRaw,
                    storeBalanceAfter,
                    JSON.stringify({ qr_session_id: qrSessionId })
                ]
            );

            // Actualizar estado de pago de la orden
            let paymentMethod = order.payment_method || {};
            if (typeof paymentMethod === 'string') {
                try {
                    paymentMethod = JSON.parse(paymentMethod);
                } catch (e) {
                    paymentMethod = {};
                }
            }

            paymentMethod.qr_fires = (paymentMethod.qr_fires != null
                ? Number(paymentMethod.qr_fires) || 0
                : 0) + amountFiresRaw;

            const updatedOrderRes = await client.query(
                `UPDATE orders
                 SET payment_status = 'paid',
                     payment_method = $1,
                     updated_at = NOW()
                 WHERE id = $2
                 RETURNING id, store_id, invoice_number, payment_status, payment_method`,
                [JSON.stringify(paymentMethod), order.id]
            );

            const updatedOrder = updatedOrderRes.rows[0];

            return {
                order: updatedOrder,
                amountFires: amountFiresRaw,
                userBalanceAfter,
                storeBalanceAfter
            };
        });

        // Notificar al POS / tienda vía Socket.IO si está disponible
        if (req.io && result.order && result.order.store_id) {
            try {
                req.io.to(`store:${result.order.store_id}:orders`).emit('store:order-paid', {
                    orderId: result.order.id,
                    paymentStatus: result.order.payment_status,
                    method: 'qr_fires'
                });
            } catch (e) {
                logger.warn('[Store][QR] Error emitiendo evento store:order-paid', {
                    storeId: result.order.store_id,
                    orderId: result.order.id,
                    error: e?.message
                });
            }
        }

        res.json({
            success: true,
            order_id: result.order.id,
            store_id: result.order.store_id,
            invoice_number: result.order.invoice_number,
            amount_fires: result.amountFires,
            user_balance_after: result.userBalanceAfter,
            store_balance_after: result.storeBalanceAfter
        });
    } catch (error) {
        logger.error('[Store][QR] Error procesando pago QR', error);
        res.status(400).json({ error: error.message || 'Error al procesar pago QR' });
    }
});

module.exports = router;

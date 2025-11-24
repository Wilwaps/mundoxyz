const express = require('express');
const router = express.Router();
const { query, transaction } = require('../../db');
const { verifyToken } = require('../../middleware/auth');
const logger = require('../../utils/logger');
const { v4: uuidv4 } = require('uuid');

// POST /api/store/order/create
router.post('/create', verifyToken, async (req, res) => {
    try {
        const {
            store_id,
            items,
            type,
            table_number,
            payment_method,
            delivery_info,
            currency_snapshot,
            customer_id
        } = req.body;
        const userId = req.user.id;

        // 1. Calculate Totals & Validate Stock (Simplified for now)
        let subtotal_usdt = 0;
        const orderItemsData = [];

        for (const item of items) {
            const productResult = await query(
                'SELECT * FROM products WHERE id = $1',
                [item.product_id]
            );
            if (productResult.rows.length === 0) throw new Error(`Product ${item.product_id} not found`);
            const product = productResult.rows[0];

            let itemPrice = parseFloat(product.price_usdt);

            // Add modifiers cost
            if (item.modifiers && item.modifiers.length > 0) {
                // ... logic to fetch modifier prices and add to itemPrice
            }

            subtotal_usdt += itemPrice * item.quantity;

            orderItemsData.push({
                product_id: product.id,
                quantity: item.quantity,
                price_at_time_usdt: itemPrice,
                modifiers: item.modifiers || []
            });
        }

        // 2. Calculate Fees/Tax
        const storeSettingsResult = await query('SELECT settings FROM stores WHERE id = $1', [store_id]);
        const settings = storeSettingsResult.rows[0].settings;

        const tax_usdt = subtotal_usdt * (settings.tax_rate || 0);
        const service_fee = subtotal_usdt * (settings.service_fee || 0);
        const delivery_fee_usdt = type === 'delivery' ? 5.00 : 0; // Fixed for now, dynamic later

        const total_usdt = subtotal_usdt + tax_usdt + service_fee + delivery_fee_usdt;

        // 3. Create Order Transaction
        const result = await transaction(async (client) => {
            // Create Order
            const orderCode = Math.random().toString(36).substring(2, 8).toUpperCase();

            const orderResult = await client.query(
                `INSERT INTO orders 
         (store_id, user_id, customer_id, code, type, status, 
          payment_status, payment_method, currency_snapshot,
          subtotal_usdt, tax_usdt, delivery_fee_usdt, total_usdt,
          table_number, delivery_info)
         VALUES ($1, $2, $3, $4, $5, 'pending', 
                 'unpaid', $6, $7, 
                 $8, $9, $10, $11,
                 $12, $13)
         RETURNING *`,
                [
                    store_id,
                    userId,
                    customer_id || null,
                    orderCode,
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

            // Create Order Items
            for (const item of orderItemsData) {
                await client.query(
                    `INSERT INTO order_items 
           (order_id, product_id, quantity, price_at_time_usdt, modifiers)
           VALUES ($1, $2, $3, $4, $5)`,
                    [order.id, item.product_id, item.quantity, item.price_at_time_usdt, JSON.stringify(item.modifiers)]
                );
            }

            // Create Kitchen Ticket
            await client.query(
                `INSERT INTO kitchen_tickets (order_id, station, status)
         VALUES ($1, 'main', 'pending')`,
                [order.id]
            );

            // Notify KDS via Socket
            if (req.io) {
                req.io.to(`store:${store_id}:kitchen`).emit('store:new-order', { order });
            }

            return order;
        });

        res.json({ success: true, order: result });
    } catch (error) {
        logger.error('Error creating order:', error);
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
       WHERE o.store_id = $1 AND o.status IN ('pending', 'confirmed', 'preparing', 'ready')
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

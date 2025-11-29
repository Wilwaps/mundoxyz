const express = require('express');
const router = express.Router();
const { query, transaction } = require('../../db');
const { verifyToken } = require('../../middleware/auth');
const logger = require('../../utils/logger');

// GET /api/store/inventory/:storeId/ingredients
router.get('/:storeId/ingredients', verifyToken, async (req, res) => {
    try {
        const { storeId } = req.params;

        const result = await query(
            `SELECT * FROM ingredients WHERE store_id = $1 ORDER BY name ASC`,
            [storeId]
        );

        res.json(result.rows);
    } catch (error) {
        logger.error('Error fetching ingredients:', error);
        res.status(400).json({ error: error.message });
    }
});

// POST /api/store/:storeId/ingredient
router.post('/:storeId/ingredient', verifyToken, async (req, res) => {
    try {
        const { storeId } = req.params;
        const { name, unit, cost_per_unit_usdt, current_stock, min_stock_alert } = req.body;

        const result = await query(
            `INSERT INTO ingredients 
       (store_id, name, unit, cost_per_unit_usdt, current_stock, min_stock_alert)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
            [storeId, name, unit, cost_per_unit_usdt, current_stock, min_stock_alert]
        );

        res.json(result.rows[0]);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// POST /api/store/product/:productId/recipe
router.post('/product/:productId/recipe', verifyToken, async (req, res) => {
    try {
        const { productId } = req.params;
        const { ingredient_id, quantity_required } = req.body;

        const result = await transaction(async (client) => {
            // Add recipe item
            const recipeResult = await client.query(
                `INSERT INTO recipes (product_id, ingredient_id, quantity_required)
         VALUES ($1, $2, $3)
         RETURNING *`,
                [productId, ingredient_id, quantity_required]
            );

            // Recalculate Product Cost (Escandallo)
            await client.query(
                `UPDATE products 
         SET cost_usdt = (
           SELECT SUM(r.quantity_required * i.cost_per_unit_usdt)
           FROM recipes r
           JOIN ingredients i ON r.ingredient_id = i.id
           WHERE r.product_id = $1
         )
         WHERE id = $1`,
                [productId]
            );

            return recipeResult.rows[0];
        });

        res.json(result);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// POST /api/store/:storeId/waste
router.post('/:storeId/waste', verifyToken, async (req, res) => {
    try {
        const { storeId } = req.params;
        const { ingredient_id, quantity, reason } = req.body;
        const userId = req.user.id;

        const result = await transaction(async (client) => {
            // Deduct stock
            await client.query(
                `UPDATE ingredients 
         SET current_stock = current_stock - $1, updated_at = NOW()
         WHERE id = $2`,
                [quantity, ingredient_id]
            );

            // Log waste
            const logResult = await client.query(
                `INSERT INTO waste_logs 
         (store_id, ingredient_id, quantity, reason, logged_by)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING *`,
                [storeId, ingredient_id, quantity, reason, userId]
            );

            return logResult.rows[0];
        });

        res.json(result);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// ==============================
// PRODUCCIÓN: RECETAS
// ==============================

// GET /api/store/inventory/:storeId/production/recipes
router.get('/:storeId/production/recipes', verifyToken, async (req, res) => {
    try {
        const { storeId } = req.params;

        const result = await query(
            `SELECT pr.*, p.name AS target_product_name
       FROM production_recipes pr
       LEFT JOIN products p ON pr.target_product_id = p.id
       WHERE pr.store_id = $1
       ORDER BY pr.name ASC`,
            [storeId]
        );

        res.json(result.rows);
    } catch (error) {
        logger.error('Error fetching production recipes:', error);
        res.status(400).json({ error: error.message });
    }
});

// GET /api/store/inventory/:storeId/production/recipes/:recipeId
router.get('/:storeId/production/recipes/:recipeId', verifyToken, async (req, res) => {
    try {
        const { storeId, recipeId } = req.params;

        const recipeResult = await query(
            `SELECT pr.*, p.name AS target_product_name
       FROM production_recipes pr
       LEFT JOIN products p ON pr.target_product_id = p.id
       WHERE pr.store_id = $1 AND pr.id = $2`,
            [storeId, recipeId]
        );

        if (recipeResult.rows.length === 0) {
            return res.status(404).json({ error: 'Receta no encontrada' });
        }

        const itemsResult = await query(
            `SELECT *
       FROM production_recipe_items
       WHERE recipe_id = $1
       ORDER BY position ASC, created_at ASC`,
            [recipeId]
        );

        res.json({
            recipe: recipeResult.rows[0],
            items: itemsResult.rows
        });
    } catch (error) {
        logger.error('Error fetching production recipe detail:', error);
        res.status(400).json({ error: error.message });
    }
});

// POST /api/store/inventory/:storeId/production/recipes
router.post('/:storeId/production/recipes', verifyToken, async (req, res) => {
    try {
        const { storeId } = req.params;
        const {
            target_product_id,
            name,
            description,
            yields_quantity,
            yields_unit,
            items,
            metadata
        } = req.body || {};

        if (!name || !yields_quantity || !yields_unit) {
            return res.status(400).json({ error: 'name, yields_quantity y yields_unit son obligatorios' });
        }

        if (!Array.isArray(items) || items.length === 0) {
            return res.status(400).json({ error: 'La receta debe tener al menos un componente' });
        }

        const userId = req.user.id;
        const safeMetadata = metadata && typeof metadata === 'object' ? metadata : {};

        const result = await transaction(async (client) => {
            const qty = Number(yields_quantity);
            if (!Number.isFinite(qty) || qty <= 0) {
                throw new Error('Cantidad de producción inválida (yields_quantity)');
            }

            const insertRecipe = await client.query(
                `INSERT INTO production_recipes
         (store_id, target_product_id, name, description, yields_quantity, yields_unit,
          total_cost_usdt, is_active, metadata, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, 0, TRUE, $7, $8)
         RETURNING *`,
                [
                    storeId,
                    target_product_id || null,
                    name,
                    description || null,
                    qty,
                    yields_unit,
                    safeMetadata,
                    userId
                ]
            );

            const recipe = insertRecipe.rows[0];
            let totalCost = 0;
            let position = 0;

            for (const raw of items) {
                if (!raw) continue;

                const componentType = raw.component_type;
                const ingredientId = raw.ingredient_id || null;
                const productId = raw.product_id || null;
                const quantity = Number(raw.quantity);
                const unit = raw.unit || '';

                if (!componentType || !['ingredient', 'product'].includes(componentType)) {
                    throw new Error('component_type inválido en uno de los componentes');
                }

                if (!Number.isFinite(quantity) || quantity <= 0) {
                    throw new Error('Cantidad inválida en uno de los componentes');
                }

                if (componentType === 'ingredient') {
                    if (!ingredientId || productId) {
                        throw new Error('Componente ingrediente debe tener solo ingredient_id');
                    }
                } else {
                    if (!productId || ingredientId) {
                        throw new Error('Componente producto debe tener solo product_id');
                    }
                }

                let unitCost = 0;

                if (componentType === 'ingredient') {
                    const costRes = await client.query(
                        `SELECT cost_per_unit_usdt
               FROM ingredients
               WHERE id = $1 AND store_id = $2`,
                        [ingredientId, storeId]
                    );
                    if (costRes.rows.length === 0) {
                        throw new Error('Ingrediente no encontrado para uno de los componentes');
                    }
                    unitCost = Number(costRes.rows[0].cost_per_unit_usdt || 0);
                } else {
                    const costRes = await client.query(
                        `SELECT cost_usdt
               FROM products
               WHERE id = $1 AND store_id = $2`,
                        [productId, storeId]
                    );
                    if (costRes.rows.length === 0) {
                        throw new Error('Producto no encontrado para uno de los componentes');
                    }
                    unitCost = Number(costRes.rows[0].cost_usdt || 0);
                }

                const lineCost = quantity * unitCost;
                totalCost += lineCost;
                position += 1;

                await client.query(
                    `INSERT INTO production_recipe_items
           (recipe_id, component_type, ingredient_id, product_id,
            quantity, unit, cost_usdt, position)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
                    [
                        recipe.id,
                        componentType,
                        ingredientId,
                        productId,
                        quantity,
                        unit,
                        lineCost,
                        position
                    ]
                );
            }

            const updateRecipe = await client.query(
                `UPDATE production_recipes
         SET total_cost_usdt = $2,
             updated_at = NOW()
         WHERE id = $1
         RETURNING *`,
                [recipe.id, totalCost]
            );

            const updatedRecipe = updateRecipe.rows[0];

            if (updatedRecipe.target_product_id && qty > 0) {
                const costPerUnit = totalCost / qty;
                await client.query(
                    `UPDATE products
             SET cost_usdt = $2,
                 updated_at = NOW()
             WHERE id = $1 AND store_id = $3`,
                    [updatedRecipe.target_product_id, costPerUnit, storeId]
                );
            }

            const itemsRes = await client.query(
                `SELECT *
         FROM production_recipe_items
         WHERE recipe_id = $1
         ORDER BY position ASC, created_at ASC`,
                [updatedRecipe.id]
            );

            return {
                recipe: updatedRecipe,
                items: itemsRes.rows
            };
        });

        res.json(result);
    } catch (error) {
        logger.error('Error creating production recipe:', error);
        res.status(400).json({ error: error.message });
    }
});

// PUT /api/store/inventory/:storeId/production/recipes/:recipeId
router.put('/:storeId/production/recipes/:recipeId', verifyToken, async (req, res) => {
    try {
        const { storeId, recipeId } = req.params;
        const {
            target_product_id,
            name,
            description,
            yields_quantity,
            yields_unit,
            items,
            metadata
        } = req.body || {};

        if (!name || !yields_quantity || !yields_unit) {
            return res.status(400).json({ error: 'name, yields_quantity y yields_unit son obligatorios' });
        }

        if (!Array.isArray(items) || items.length === 0) {
            return res.status(400).json({ error: 'La receta debe tener al menos un componente' });
        }

        const result = await transaction(async (client) => {
            const qty = Number(yields_quantity);
            if (!Number.isFinite(qty) || qty <= 0) {
                throw new Error('Cantidad de producción inválida (yields_quantity)');
            }

            const existing = await client.query(
                `SELECT *
         FROM production_recipes
         WHERE id = $1 AND store_id = $2`,
                [recipeId, storeId]
            );

            if (existing.rows.length === 0) {
                throw new Error('Receta no encontrada');
            }

            await client.query(
                `UPDATE production_recipes
         SET target_product_id = $2,
             name = $3,
             description = $4,
             yields_quantity = $5,
             yields_unit = $6,
             metadata = $7,
             updated_at = NOW()
         WHERE id = $1`,
                [
                    recipeId,
                    target_product_id || null,
                    name,
                    description || null,
                    qty,
                    yields_unit,
                    safeMetadata
                ]
            );

            await client.query(
                `DELETE FROM production_recipe_items
         WHERE recipe_id = $1`,
                [recipeId]
            );

            let totalCost = 0;
            let position = 0;

            for (const raw of items) {
                if (!raw) continue;

                const componentType = raw.component_type;
                const ingredientId = raw.ingredient_id || null;
                const productId = raw.product_id || null;
                const quantity = Number(raw.quantity);
                const unit = raw.unit || '';

                if (!componentType || !['ingredient', 'product'].includes(componentType)) {
                    throw new Error('component_type inválido en uno de los componentes');
                }

                if (!Number.isFinite(quantity) || quantity <= 0) {
                    throw new Error('Cantidad inválida en uno de los componentes');
                }

                if (componentType === 'ingredient') {
                    if (!ingredientId || productId) {
                        throw new Error('Componente ingrediente debe tener solo ingredient_id');
                    }
                } else {
                    if (!productId || ingredientId) {
                        throw new Error('Componente producto debe tener solo product_id');
                    }
                }

                let unitCost = 0;

                if (componentType === 'ingredient') {
                    const costRes = await client.query(
                        `SELECT cost_per_unit_usdt
               FROM ingredients
               WHERE id = $1 AND store_id = $2`,
                        [ingredientId, storeId]
                    );
                    if (costRes.rows.length === 0) {
                        throw new Error('Ingrediente no encontrado para uno de los componentes');
                    }
                    unitCost = Number(costRes.rows[0].cost_per_unit_usdt || 0);
                } else {
                    const costRes = await client.query(
                        `SELECT cost_usdt
               FROM products
               WHERE id = $1 AND store_id = $2`,
                        [productId, storeId]
                    );
                    if (costRes.rows.length === 0) {
                        throw new Error('Producto no encontrado para uno de los componentes');
                    }
                    unitCost = Number(costRes.rows[0].cost_usdt || 0);
                }

                const lineCost = quantity * unitCost;
                totalCost += lineCost;
                position += 1;

                await client.query(
                    `INSERT INTO production_recipe_items
           (recipe_id, component_type, ingredient_id, product_id,
            quantity, unit, cost_usdt, position)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
                    [
                        recipeId,
                        componentType,
                        ingredientId,
                        productId,
                        quantity,
                        unit,
                        lineCost,
                        position
                    ]
                );
            }

            const updateRecipe = await client.query(
                `UPDATE production_recipes
         SET total_cost_usdt = $2,
             updated_at = NOW()
         WHERE id = $1
         RETURNING *`,
                [recipeId, totalCost]
            );

            const updatedRecipe = updateRecipe.rows[0];

            if (updatedRecipe.target_product_id && qty > 0) {
                const costPerUnit = totalCost / qty;
                await client.query(
                    `UPDATE products
             SET cost_usdt = $2,
                 updated_at = NOW()
             WHERE id = $1 AND store_id = $3`,
                    [updatedRecipe.target_product_id, costPerUnit, storeId]
                );
            }

            const itemsRes = await client.query(
                `SELECT *
         FROM production_recipe_items
         WHERE recipe_id = $1
         ORDER BY position ASC, created_at ASC`,
                [updatedRecipe.id]
            );

            return {
                recipe: updatedRecipe,
                items: itemsRes.rows
            };
        });

        res.json(result);
    } catch (error) {
        logger.error('Error updating production recipe:', error);
        res.status(400).json({ error: error.message });
    }
});

// DELETE /api/store/inventory/:storeId/production/recipes/:recipeId
router.delete('/:storeId/production/recipes/:recipeId', verifyToken, async (req, res) => {
    try {
        const { storeId, recipeId } = req.params;

        const result = await query(
            `UPDATE production_recipes
       SET is_active = FALSE,
           updated_at = NOW()
       WHERE id = $1 AND store_id = $2
       RETURNING *`,
            [recipeId, storeId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Receta no encontrada' });
        }

        res.json(result.rows[0]);
    } catch (error) {
        logger.error('Error deleting production recipe:', error);
        res.status(400).json({ error: error.message });
    }
});

// ==============================
// PRODUCCIÓN: LOTES / EJECUCIÓN
// ==============================

// GET /api/store/inventory/:storeId/production/batches
router.get('/:storeId/production/batches', verifyToken, async (req, res) => {
    try {
        const { storeId } = req.params;
        const { status } = req.query || {};

        const params = [storeId];
        let sql = `SELECT b.*, r.name AS recipe_name, r.yields_unit, r.yields_quantity,
       p.name AS target_product_name,
       agg.total_cost_usdt
  FROM production_batches b
  JOIN production_recipes r ON b.recipe_id = r.id
  LEFT JOIN products p ON r.target_product_id = p.id
  LEFT JOIN LATERAL (
    SELECT SUM(cost_usdt) AS total_cost_usdt
    FROM production_batch_consumptions c
    WHERE c.batch_id = b.id
  ) agg ON TRUE
  WHERE b.store_id = $1`;

        if (status) {
            sql += ' AND b.status = $2';
            params.push(status);
        }

        sql += ' ORDER BY b.created_at DESC LIMIT 50';

        const result = await query(sql, params);
        res.json(result.rows);
    } catch (error) {
        logger.error('Error fetching production batches:', error);
        res.status(400).json({ error: error.message });
    }
});

// POST /api/store/inventory/:storeId/production/batches
router.post('/:storeId/production/batches', verifyToken, async (req, res) => {
    try {
        const { storeId } = req.params;
        const { recipe_id, planned_quantity, notes } = req.body || {};

        if (!recipe_id) {
            return res.status(400).json({ error: 'recipe_id es obligatorio' });
        }

        const qty = Number(planned_quantity);
        if (!Number.isFinite(qty) || qty <= 0) {
            return res.status(400).json({ error: 'Cantidad de producción inválida (planned_quantity)' });
        }

        const userId = req.user.id;

        const result = await transaction(async (client) => {
            const recipeRes = await client.query(
                `SELECT *
         FROM production_recipes
         WHERE id = $1 AND store_id = $2 AND is_active = TRUE`,
                [recipe_id, storeId]
            );

            if (recipeRes.rows.length === 0) {
                throw new Error('Receta no encontrada o inactiva');
            }

            const recipe = recipeRes.rows[0];
            const baseYield = Number(recipe.yields_quantity);
            if (!Number.isFinite(baseYield) || baseYield <= 0) {
                throw new Error('Datos de rendimiento inválidos en la receta (yields_quantity)');
            }

            const itemsRes = await client.query(
                `SELECT *
         FROM production_recipe_items
         WHERE recipe_id = $1
         ORDER BY position ASC, created_at ASC`,
                [recipe_id]
            );

            if (itemsRes.rows.length === 0) {
                throw new Error('La receta no tiene componentes configurados');
            }

            const factor = qty / baseYield;
            if (!Number.isFinite(factor) || factor <= 0) {
                throw new Error('Factor de producción inválido');
            }

            const batchInsert = await client.query(
                `INSERT INTO production_batches
         (store_id, recipe_id, batch_code, planned_quantity, actual_quantity, unit,
          status, notes, created_by, started_at, completed_at)
         VALUES ($1, $2, $3, $4, NULL, $5,
                 'planned', $6, $7, NULL, NULL)
         RETURNING *`,
                [
                    storeId,
                    recipe_id,
                    null,
                    qty,
                    recipe.yields_unit,
                    notes || null,
                    userId
                ]
            );

            let batch = batchInsert.rows[0];
            let totalCost = 0;

            for (const item of itemsRes.rows) {
                if (!item) continue;

                const componentType = item.component_type;
                const ingredientId = item.ingredient_id || null;
                const productId = item.product_id || null;
                const baseQty = Number(item.quantity);
                const unit = item.unit || '';

                if (!componentType || !['ingredient', 'product'].includes(componentType)) {
                    throw new Error('component_type inválido en uno de los componentes de la receta');
                }

                if (!Number.isFinite(baseQty) || baseQty <= 0) {
                    throw new Error('Cantidad inválida en uno de los componentes de la receta');
                }

                const requiredQty = baseQty * factor;
                if (!Number.isFinite(requiredQty) || requiredQty <= 0) {
                    throw new Error('Cantidad requerida inválida para un componente');
                }

                let unitCost = 0;
                let currentStock = 0;
                let nameLabel = '';

                if (componentType === 'ingredient') {
                    if (!ingredientId || productId) {
                        throw new Error('Componente ingrediente debe tener solo ingredient_id');
                    }

                    const costRes = await client.query(
                        `SELECT name, current_stock, cost_per_unit_usdt
               FROM ingredients
               WHERE id = $1 AND store_id = $2`,
                        [ingredientId, storeId]
                    );

                    if (costRes.rows.length === 0) {
                        throw new Error('Ingrediente no encontrado para uno de los componentes');
                    }

                    const row = costRes.rows[0];
                    nameLabel = row.name || '';
                    currentStock = Number(row.current_stock || 0);
                    unitCost = Number(row.cost_per_unit_usdt || 0);

                    if (currentStock < requiredQty) {
                        throw new Error(
                            `Stock insuficiente del ingrediente "${nameLabel}". Disponible: ${currentStock}, requerido: ${requiredQty}`
                        );
                    }

                    await client.query(
                        `UPDATE ingredients
               SET current_stock = current_stock - $3,
                   updated_at = NOW()
               WHERE id = $1 AND store_id = $2`,
                        [ingredientId, storeId, requiredQty]
                    );
                } else {
                    if (!productId || ingredientId) {
                        throw new Error('Componente producto debe tener solo product_id');
                    }

                    const costRes = await client.query(
                        `SELECT name, stock, cost_usdt
               FROM products
               WHERE id = $1 AND store_id = $2`,
                        [productId, storeId]
                    );

                    if (costRes.rows.length === 0) {
                        throw new Error('Producto no encontrado para uno de los componentes');
                    }

                    const row = costRes.rows[0];
                    nameLabel = row.name || '';
                    currentStock = Number(row.stock || 0);
                    unitCost = Number(row.cost_usdt || 0);

                    if (currentStock < requiredQty) {
                        throw new Error(
                            `Stock insuficiente del producto "${nameLabel}". Disponible: ${currentStock}, requerido: ${requiredQty}`
                        );
                    }

                    await client.query(
                        `UPDATE products
               SET stock = COALESCE(stock, 0) - $3,
                   updated_at = NOW()
               WHERE id = $1 AND store_id = $2`,
                        [productId, storeId, requiredQty]
                    );
                }

                const lineCost = requiredQty * unitCost;
                totalCost += lineCost;

                await client.query(
                    `INSERT INTO production_batch_consumptions
           (batch_id, component_type, ingredient_id, product_id,
            planned_quantity, actual_quantity, unit, cost_usdt)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
                    [
                        batch.id,
                        componentType,
                        ingredientId,
                        productId,
                        requiredQty,
                        requiredQty,
                        unit,
                        lineCost
                    ]
                );
            }

            // Marcar lote como completado y, si aplica, aumentar stock del producto final
            const batchUpdate = await client.query(
                `UPDATE production_batches
         SET actual_quantity = $2,
             status = 'completed',
             started_at = COALESCE(started_at, NOW()),
             completed_at = NOW()
         WHERE id = $1
         RETURNING *`,
                [batch.id, qty]
            );

            batch = batchUpdate.rows[0];

            if (recipe.target_product_id) {
                await client.query(
                    `UPDATE products
             SET stock = COALESCE(stock, 0) + $2,
                 updated_at = NOW()
             WHERE id = $1 AND store_id = $3`,
                    [recipe.target_product_id, qty, storeId]
                );
            }

            return {
                batch,
                recipe,
                total_cost_usdt: totalCost
            };
        });

        res.json(result);
    } catch (error) {
        logger.error('Error ejecutando lote de producción:', error);
        res.status(400).json({ error: error.message });
    }
});

module.exports = router;

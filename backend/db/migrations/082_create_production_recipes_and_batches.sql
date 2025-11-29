-- 082_create_production_recipes_and_batches.sql
-- Sistema de producción y recetas para tiendas (restaurantes)

BEGIN;

-- Recetas de producción (fórmulas)
CREATE TABLE IF NOT EXISTS production_recipes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  target_product_id UUID REFERENCES products(id) ON DELETE SET NULL,
  name VARCHAR(200) NOT NULL,
  description TEXT,
  yields_quantity DECIMAL(20,4) NOT NULL,
  yields_unit VARCHAR(50) NOT NULL,
  total_cost_usdt DECIMAL(20,4) NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Componentes de cada receta (pueden ser ingredientes o productos compuestos)
CREATE TABLE IF NOT EXISTS production_recipe_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  recipe_id UUID NOT NULL REFERENCES production_recipes(id) ON DELETE CASCADE,
  component_type VARCHAR(20) NOT NULL CHECK (component_type IN ('ingredient','product')),
  ingredient_id UUID REFERENCES ingredients(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id) ON DELETE CASCADE,
  quantity DECIMAL(20,4) NOT NULL,
  unit VARCHAR(50) NOT NULL,
  cost_usdt DECIMAL(20,4) NOT NULL DEFAULT 0,
  position INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT valid_production_component_ref CHECK (
    (component_type = 'ingredient' AND ingredient_id IS NOT NULL AND product_id IS NULL) OR
    (component_type = 'product' AND product_id IS NOT NULL AND ingredient_id IS NULL)
  )
);

-- Lotes de producción (ejecución de recetas)
CREATE TABLE IF NOT EXISTS production_batches (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  recipe_id UUID NOT NULL REFERENCES production_recipes(id) ON DELETE CASCADE,
  batch_code VARCHAR(50),
  planned_quantity DECIMAL(20,4) NOT NULL,
  actual_quantity DECIMAL(20,4),
  unit VARCHAR(50) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'planned'
    CHECK (status IN ('planned','in_progress','completed','cancelled')),
  notes TEXT,
  created_by UUID REFERENCES users(id),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Consumos reales por lote (para trazabilidad y ajustes)
CREATE TABLE IF NOT EXISTS production_batch_consumptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  batch_id UUID NOT NULL REFERENCES production_batches(id) ON DELETE CASCADE,
  component_type VARCHAR(20) NOT NULL CHECK (component_type IN ('ingredient','product')),
  ingredient_id UUID REFERENCES ingredients(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id) ON DELETE CASCADE,
  planned_quantity DECIMAL(20,4) NOT NULL,
  actual_quantity DECIMAL(20,4) NOT NULL,
  unit VARCHAR(50) NOT NULL,
  cost_usdt DECIMAL(20,4) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT valid_batch_component_ref CHECK (
    (component_type = 'ingredient' AND ingredient_id IS NOT NULL AND product_id IS NULL) OR
    (component_type = 'product' AND product_id IS NOT NULL AND ingredient_id IS NULL)
  )
);

-- Historial de costos por receta (para análisis en el tiempo)
CREATE TABLE IF NOT EXISTS recipe_cost_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  recipe_id UUID NOT NULL REFERENCES production_recipes(id) ON DELETE CASCADE,
  total_cost_usdt DECIMAL(20,4) NOT NULL,
  cost_per_unit_usdt DECIMAL(20,4) NOT NULL,
  calculated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para rendimiento
CREATE INDEX IF NOT EXISTS idx_production_recipes_store
  ON production_recipes(store_id);

CREATE INDEX IF NOT EXISTS idx_production_recipes_product
  ON production_recipes(target_product_id)
  WHERE target_product_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_production_recipe_items_recipe
  ON production_recipe_items(recipe_id);

CREATE INDEX IF NOT EXISTS idx_production_batches_store
  ON production_batches(store_id);

CREATE INDEX IF NOT EXISTS idx_production_batches_recipe
  ON production_batches(recipe_id);

CREATE INDEX IF NOT EXISTS idx_production_batches_status
  ON production_batches(status);

CREATE INDEX IF NOT EXISTS idx_production_batch_consumptions_batch
  ON production_batch_consumptions(batch_id);

CREATE INDEX IF NOT EXISTS idx_recipe_cost_history_recipe
  ON recipe_cost_history(recipe_id);

COMMIT;

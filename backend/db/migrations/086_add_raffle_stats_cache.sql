-- 086_add_raffle_stats_cache.sql
-- Cachear estadísticas de rifas para evitar COUNT repetidos en cada listado

BEGIN;

-- Añadir columnas de caché a raffles
ALTER TABLE raffles 
ADD COLUMN IF NOT EXISTS numbers_sold INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS numbers_reserved INTEGER DEFAULT 0;

-- Crear índices para las nuevas columnas
CREATE INDEX IF NOT EXISTS idx_raffles_numbers_sold
  ON raffles(numbers_sold DESC) WHERE numbers_sold > 0;

-- Disparador para mantener caché sincronizada
CREATE OR REPLACE FUNCTION update_raffle_stats_cache()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
    -- Actualizar estadísticas para una rifa específica
    UPDATE raffles 
    SET 
      numbers_sold = (
        SELECT COUNT(*) 
        FROM raffle_numbers 
        WHERE raffle_id = COALESCE(NEW.raffle_id, OLD.raffle_id) 
        AND state = 'sold'
      ),
      numbers_reserved = (
        SELECT COUNT(*) 
        FROM raffle_numbers 
        WHERE raffle_id = COALESCE(NEW.raffle_id, OLD.raffle_id) 
        AND state = 'reserved'
      ),
      updated_at = NOW()
    WHERE id = COALESCE(NEW.raffle_id, OLD.raffle_id);
    
    RETURN COALESCE(NEW, OLD);
  ELSIF TG_OP = 'DELETE' THEN
    -- Actualizar estadísticas cuando se elimina un número
    UPDATE raffles 
    SET 
      numbers_sold = (
        SELECT COUNT(*) 
        FROM raffle_numbers 
        WHERE raffle_id = OLD.raffle_id 
        AND state = 'sold'
      ),
      numbers_reserved = (
        SELECT COUNT(*) 
        FROM raffle_numbers 
        WHERE raffle_id = OLD.raffle_id 
        AND state = 'reserved'
      ),
      updated_at = NOW()
    WHERE id = OLD.raffle_id;
    
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Crear trigger para actualizar caché automáticamente
DROP TRIGGER IF EXISTS trigger_update_raffle_stats_cache ON raffle_numbers;
CREATE TRIGGER trigger_update_raffle_stats_cache
  AFTER INSERT OR UPDATE OR DELETE ON raffle_numbers
  FOR EACH ROW
  EXECUTE FUNCTION update_raffle_stats_cache();

-- Población inicial de caché para rifas existentes
UPDATE raffles 
SET 
  numbers_sold = (
    SELECT COUNT(*) 
    FROM raffle_numbers rn 
    WHERE rn.raffle_id = raffles.id 
    AND rn.state = 'sold'
  ),
  numbers_reserved = (
    SELECT COUNT(*) 
    FROM raffle_numbers rn 
    WHERE rn.raffle_id = raffles.id 
    AND rn.state = 'reserved'
  );

COMMIT;

-- Migración 027: Agregar columnas para imágenes de rifas
-- Almacena imágenes directamente en PostgreSQL (sin AWS S3)

BEGIN;

-- Agregar columnas para almacenar imágenes en Base64
ALTER TABLE raffles 
ADD COLUMN IF NOT EXISTS prize_image TEXT,
ADD COLUMN IF NOT EXISTS prize_image_mime VARCHAR(50),
ADD COLUMN IF NOT EXISTS company_logo TEXT,
ADD COLUMN IF NOT EXISTS company_logo_mime VARCHAR(50);

-- Comentarios para documentación
COMMENT ON COLUMN raffles.prize_image IS 'Imagen del premio en Base64 (alternativa a S3)';
COMMENT ON COLUMN raffles.prize_image_mime IS 'MIME type de la imagen del premio (image/jpeg, image/png, etc.)';
COMMENT ON COLUMN raffles.company_logo IS 'Logo de empresa en Base64 (modo empresa)';
COMMENT ON COLUMN raffles.company_logo_mime IS 'MIME type del logo de empresa';

COMMIT;

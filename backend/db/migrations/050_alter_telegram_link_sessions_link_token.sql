-- 050_alter_telegram_link_sessions_link_token.sql
-- Ajusta la longitud de link_token para soportar tokens de 64 caracteres

BEGIN;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'telegram_link_sessions'
      AND column_name = 'link_token'
  ) THEN
    ALTER TABLE telegram_link_sessions
      ALTER COLUMN link_token TYPE VARCHAR(64);
  END IF;
END $$;

COMMIT;

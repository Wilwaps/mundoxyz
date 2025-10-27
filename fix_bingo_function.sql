-- FIX PARA AMBIGÜEDAD DE COLUMNA CODE
-- Actualizar la función generate_unique_bingo_room_code para evitar ambigüedad

DROP FUNCTION IF EXISTS generate_unique_bingo_room_code();

CREATE OR REPLACE FUNCTION generate_unique_bingo_room_code()
RETURNS VARCHAR(6) AS $$
DECLARE
    chars VARCHAR := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    code VARCHAR(6) := '';
    i INTEGER;
    max_attempts INTEGER := 100;
    attempt_count INTEGER := 0;
    room_exists BOOLEAN;
BEGIN
    LOOP
        code := '';
        FOR i IN 1..6 LOOP
            code := code || substr(chars, floor(random() * length(chars) + 1)::int, 1);
        END LOOP;
        
        -- Usar EXISTS con subconsulta explícita para evitar ambigüedad
        SELECT EXISTS(SELECT 1 FROM bingo_rooms WHERE code = code) INTO room_exists;
        
        IF NOT room_exists THEN
            RETURN code;
        END IF;
        
        attempt_count := attempt_count + 1;
        IF attempt_count >= max_attempts THEN
            RAISE EXCEPTION 'No se pudo generar un código único después de % intentos', max_attempts;
        END IF;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Verificar que la función se creó correctamente
SELECT proname FROM pg_proc WHERE proname = 'generate_unique_bingo_room_code';

-- FIX PARA AMBIGÜEDAD DE COLUMNA CODE
-- Actualizar la función generate_unique_bingo_room_code para evitar ambigüedad
-- Genera códigos de 6 dígitos numéricos (000000-999999) para facilitar acceso

DROP FUNCTION IF EXISTS generate_unique_bingo_room_code();

CREATE OR REPLACE FUNCTION generate_unique_bingo_room_code()
RETURNS VARCHAR(6) AS $$
DECLARE
    new_code VARCHAR(6);
    max_attempts INTEGER := 100;
    attempt_count INTEGER := 0;
    room_exists BOOLEAN;
BEGIN
    LOOP
        -- Generar código de 6 dígitos (000000 a 999999)
        new_code := LPAD(floor(random() * 1000000)::text, 6, '0');
        
        -- Verificar si el código ya existe
        -- Sin ambigüedad: new_code es variable local, code es columna de tabla
        SELECT EXISTS(
            SELECT 1 FROM bingo_rooms WHERE code = new_code
        ) INTO room_exists;
        
        IF NOT room_exists THEN
            RETURN new_code;
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

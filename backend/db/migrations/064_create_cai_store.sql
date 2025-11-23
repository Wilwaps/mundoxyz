BEGIN;

DO $$
DECLARE
    v_store_id UUID;
    v_currency_config JSONB := '{"base": "USDT", "accepted": ["USDT", "Fires", "BS"], "rates_source": "manual"}';

    v_cat_papeleria UUID;
    v_cat_impresion UUID;
    v_cat_tramites UUID;
    v_cat_servicios UUID;

    v_prod_copia_bn UUID;
    v_prod_copia_color UUID;
    v_prod_impresion_foto UUID;
    v_prod_plast_carnet UUID;
    v_prod_plast_carta UUID;
    v_prod_plast_oficio UUID;
    v_prod_investigacion UUID;
    v_prod_tramite_saime UUID;
BEGIN
    -- Ensure CAI store exists
    SELECT id INTO v_store_id FROM stores WHERE slug = 'cai-store';

    IF v_store_id IS NULL THEN
        INSERT INTO stores (slug, name, description, currency_config)
        VALUES (
            'cai-store',
            'CAI Centro de Asistencia Integral',
            'Centro de Asistencia Integral (CAI) - Papelería, impresiones, trámites y servicios.',
            v_currency_config
        )
        RETURNING id INTO v_store_id;
    END IF;

    -- Categories
    SELECT id INTO v_cat_papeleria FROM categories WHERE store_id = v_store_id AND name = 'Papelería';
    IF v_cat_papeleria IS NULL THEN
        INSERT INTO categories (store_id, name, sort_order)
        VALUES (v_store_id, 'Papelería', 10)
        RETURNING id INTO v_cat_papeleria;
    END IF;

    SELECT id INTO v_cat_impresion FROM categories WHERE store_id = v_store_id AND name = 'Impresión y Copias';
    IF v_cat_impresion IS NULL THEN
        INSERT INTO categories (store_id, name, sort_order)
        VALUES (v_store_id, 'Impresión y Copias', 20)
        RETURNING id INTO v_cat_impresion;
    END IF;

    SELECT id INTO v_cat_tramites FROM categories WHERE store_id = v_store_id AND name = 'Trámites en Línea';
    IF v_cat_tramites IS NULL THEN
        INSERT INTO categories (store_id, name, sort_order)
        VALUES (v_store_id, 'Trámites en Línea', 30)
        RETURNING id INTO v_cat_tramites;
    END IF;

    SELECT id INTO v_cat_servicios FROM categories WHERE store_id = v_store_id AND name = 'Servicios Especiales';
    IF v_cat_servicios IS NULL THEN
        INSERT INTO categories (store_id, name, sort_order)
        VALUES (v_store_id, 'Servicios Especiales', 40)
        RETURNING id INTO v_cat_servicios;
    END IF;

    -- Products (base price in USDT)
    SELECT id INTO v_prod_copia_bn FROM products WHERE store_id = v_store_id AND name = 'Copia B/N';
    IF v_prod_copia_bn IS NULL THEN
        INSERT INTO products (store_id, category_id, name, description, price_usdt, is_menu_item, has_modifiers)
        VALUES (
            v_store_id,
            v_cat_impresion,
            'Copia B/N',
            'Copia en blanco y negro por página.',
            0.10,
            TRUE,
            TRUE
        )
        RETURNING id INTO v_prod_copia_bn;
    END IF;

    SELECT id INTO v_prod_copia_color FROM products WHERE store_id = v_store_id AND name = 'Copia Color';
    IF v_prod_copia_color IS NULL THEN
        INSERT INTO products (store_id, category_id, name, description, price_usdt, is_menu_item, has_modifiers)
        VALUES (
            v_store_id,
            v_cat_impresion,
            'Copia Color',
            'Copia a color por página.',
            0.25,
            TRUE,
            TRUE
        )
        RETURNING id INTO v_prod_copia_color;
    END IF;

    SELECT id INTO v_prod_impresion_foto FROM products WHERE store_id = v_store_id AND name = 'Impresión Foto';
    IF v_prod_impresion_foto IS NULL THEN
        INSERT INTO products (store_id, category_id, name, description, price_usdt, is_menu_item, has_modifiers)
        VALUES (
            v_store_id,
            v_cat_impresion,
            'Impresión Foto',
            'Impresión fotográfica de alta calidad.',
            0.50,
            TRUE,
            TRUE
        )
        RETURNING id INTO v_prod_impresion_foto;
    END IF;

    SELECT id INTO v_prod_plast_carnet FROM products WHERE store_id = v_store_id AND name = 'Plastificación Carnet';
    IF v_prod_plast_carnet IS NULL THEN
        INSERT INTO products (store_id, category_id, name, description, price_usdt, is_menu_item, has_modifiers)
        VALUES (
            v_store_id,
            v_cat_impresion,
            'Plastificación Carnet',
            'Plastificación de credenciales y carnets.',
            0.50,
            TRUE,
            TRUE
        )
        RETURNING id INTO v_prod_plast_carnet;
    END IF;

    SELECT id INTO v_prod_plast_carta FROM products WHERE store_id = v_store_id AND name = 'Plastificación Carta';
    IF v_prod_plast_carta IS NULL THEN
        INSERT INTO products (store_id, category_id, name, description, price_usdt, is_menu_item, has_modifiers)
        VALUES (
            v_store_id,
            v_cat_impresion,
            'Plastificación Carta',
            'Plastificación tamaño carta.',
            0.75,
            TRUE,
            TRUE
        )
        RETURNING id INTO v_prod_plast_carta;
    END IF;

    SELECT id INTO v_prod_plast_oficio FROM products WHERE store_id = v_store_id AND name = 'Plastificación Oficio';
    IF v_prod_plast_oficio IS NULL THEN
        INSERT INTO products (store_id, category_id, name, description, price_usdt, is_menu_item, has_modifiers)
        VALUES (
            v_store_id,
            v_cat_impresion,
            'Plastificación Oficio',
            'Plastificación tamaño oficio.',
            1.00,
            TRUE,
            TRUE
        )
        RETURNING id INTO v_prod_plast_oficio;
    END IF;

    SELECT id INTO v_prod_investigacion FROM products WHERE store_id = v_store_id AND name = 'Investigación Internet (hora)';
    IF v_prod_investigacion IS NULL THEN
        INSERT INTO products (store_id, category_id, name, description, price_usdt, is_menu_item, has_modifiers)
        VALUES (
            v_store_id,
            v_cat_servicios,
            'Investigación Internet (hora)',
            'Investigación y consultas por Internet por hora.',
            1.50,
            TRUE,
            FALSE
        )
        RETURNING id INTO v_prod_investigacion;
    END IF;

    SELECT id INTO v_prod_tramite_saime FROM products WHERE store_id = v_store_id AND name = 'Trámite SAIME / INTT';
    IF v_prod_tramite_saime IS NULL THEN
        INSERT INTO products (store_id, category_id, name, description, price_usdt, is_menu_item, has_modifiers)
        VALUES (
            v_store_id,
            v_cat_tramites,
            'Trámite SAIME / INTT',
            'Gestión de trámites SAIME o INTT.',
            5.00,
            TRUE,
            FALSE
        )
        RETURNING id INTO v_prod_tramite_saime;
    END IF;

    -- Modifiers for copies and photo printing
    IF v_prod_copia_bn IS NOT NULL THEN
        PERFORM 1 FROM product_modifiers WHERE product_id = v_prod_copia_bn AND group_name = 'Tipo de Papel' AND name = 'Bond';
        IF NOT FOUND THEN
            INSERT INTO product_modifiers (product_id, group_name, name, price_adjustment_usdt, max_selection, is_required)
            VALUES (v_prod_copia_bn, 'Tipo de Papel', 'Bond', 0, 1, TRUE);
        END IF;

        PERFORM 1 FROM product_modifiers WHERE product_id = v_prod_copia_bn AND group_name = 'Tipo de Papel' AND name = 'Glase';
        IF NOT FOUND THEN
            INSERT INTO product_modifiers (product_id, group_name, name, price_adjustment_usdt, max_selection, is_required)
            VALUES (v_prod_copia_bn, 'Tipo de Papel', 'Glase', 0.10, 1, FALSE);
        END IF;

        PERFORM 1 FROM product_modifiers WHERE product_id = v_prod_copia_bn AND group_name = 'Tipo de Papel' AND name = 'Fotografico';
        IF NOT FOUND THEN
            INSERT INTO product_modifiers (product_id, group_name, name, price_adjustment_usdt, max_selection, is_required)
            VALUES (v_prod_copia_bn, 'Tipo de Papel', 'Fotografico', 0.15, 1, FALSE);
        END IF;

        PERFORM 1 FROM product_modifiers WHERE product_id = v_prod_copia_bn AND group_name = 'Tamano' AND name = 'Carta';
        IF NOT FOUND THEN
            INSERT INTO product_modifiers (product_id, group_name, name, price_adjustment_usdt, max_selection, is_required)
            VALUES (v_prod_copia_bn, 'Tamano', 'Carta', 0, 1, TRUE);
        END IF;

        PERFORM 1 FROM product_modifiers WHERE product_id = v_prod_copia_bn AND group_name = 'Tamano' AND name = 'Oficio';
        IF NOT FOUND THEN
            INSERT INTO product_modifiers (product_id, group_name, name, price_adjustment_usdt, max_selection, is_required)
            VALUES (v_prod_copia_bn, 'Tamano', 'Oficio', 0.05, 1, FALSE);
        END IF;
    END IF;

    IF v_prod_copia_color IS NOT NULL THEN
        PERFORM 1 FROM product_modifiers WHERE product_id = v_prod_copia_color AND group_name = 'Tipo de Papel' AND name = 'Bond';
        IF NOT FOUND THEN
            INSERT INTO product_modifiers (product_id, group_name, name, price_adjustment_usdt, max_selection, is_required)
            VALUES (v_prod_copia_color, 'Tipo de Papel', 'Bond', 0, 1, TRUE);
        END IF;

        PERFORM 1 FROM product_modifiers WHERE product_id = v_prod_copia_color AND group_name = 'Tipo de Papel' AND name = 'Glase';
        IF NOT FOUND THEN
            INSERT INTO product_modifiers (product_id, group_name, name, price_adjustment_usdt, max_selection, is_required)
            VALUES (v_prod_copia_color, 'Tipo de Papel', 'Glase', 0.10, 1, FALSE);
        END IF;

        PERFORM 1 FROM product_modifiers WHERE product_id = v_prod_copia_color AND group_name = 'Tipo de Papel' AND name = 'Fotografico';
        IF NOT FOUND THEN
            INSERT INTO product_modifiers (product_id, group_name, name, price_adjustment_usdt, max_selection, is_required)
            VALUES (v_prod_copia_color, 'Tipo de Papel', 'Fotografico', 0.15, 1, FALSE);
        END IF;

        PERFORM 1 FROM product_modifiers WHERE product_id = v_prod_copia_color AND group_name = 'Tamano' AND name = 'Carta';
        IF NOT FOUND THEN
            INSERT INTO product_modifiers (product_id, group_name, name, price_adjustment_usdt, max_selection, is_required)
            VALUES (v_prod_copia_color, 'Tamano', 'Carta', 0, 1, TRUE);
        END IF;

        PERFORM 1 FROM product_modifiers WHERE product_id = v_prod_copia_color AND group_name = 'Tamano' AND name = 'Oficio';
        IF NOT FOUND THEN
            INSERT INTO product_modifiers (product_id, group_name, name, price_adjustment_usdt, max_selection, is_required)
            VALUES (v_prod_copia_color, 'Tamano', 'Oficio', 0.05, 1, FALSE);
        END IF;
    END IF;

    IF v_prod_impresion_foto IS NOT NULL THEN
        PERFORM 1 FROM product_modifiers WHERE product_id = v_prod_impresion_foto AND group_name = 'Tipo de Papel' AND name = 'Fotografico';
        IF NOT FOUND THEN
            INSERT INTO product_modifiers (product_id, group_name, name, price_adjustment_usdt, max_selection, is_required)
            VALUES (v_prod_impresion_foto, 'Tipo de Papel', 'Fotografico', 0, 1, TRUE);
        END IF;

        PERFORM 1 FROM product_modifiers WHERE product_id = v_prod_impresion_foto AND group_name = 'Tamano' AND name = 'Carta';
        IF NOT FOUND THEN
            INSERT INTO product_modifiers (product_id, group_name, name, price_adjustment_usdt, max_selection, is_required)
            VALUES (v_prod_impresion_foto, 'Tamano', 'Carta', 0, 1, TRUE);
        END IF;

        PERFORM 1 FROM product_modifiers WHERE product_id = v_prod_impresion_foto AND group_name = 'Tamano' AND name = 'Oficio';
        IF NOT FOUND THEN
            INSERT INTO product_modifiers (product_id, group_name, name, price_adjustment_usdt, max_selection, is_required)
            VALUES (v_prod_impresion_foto, 'Tamano', 'Oficio', 0.10, 1, FALSE);
        END IF;
    END IF;

END;
$$;

COMMIT;

# Análisis de Respuesta del API vs Código RaffleRoom

## Respuesta del API (Rifa 951840)
```json
{
  "success": true,
  "data": {
    "id": 9,
    "code": "951840",
    "name": "rifa1",
    "host_id": "4c64bf14-0074-4fba-98d2-cd121948d01f",
    "description": null,  // ❌ NULL
    "mode": "prize",
    "type": "public",
    "entry_price_fire": "0.00",
    "entry_price_coin": "0.00",
    "entry_price_fiat": "0.00",
    "numbers_range": 100,
    "visibility": "public",
    "status": "cancelled",
    "is_company_mode": false,
    "company_cost": "0.00",
    "close_type": "auto_full",
    "scheduled_close_at": null,  // ❌ NULL
    "terms_conditions": null,  // ❌ NULL
    "prize_meta": {...}
  }
}
```

## Propiedades que el componente espera PERO que NO están en el API:

1. **raffle.host_username** - No existe en API
2. **raffle.logo_url** - No existe en API
3. **raffle.company_name** - No existe en API
4. **raffle.primary_color** - No existe en API
5. **raffle.secondary_color** - No existe en API
6. **raffle.created_at** - No existe en API
7. **raffle.view_count** - No existe en API
8. **raffle.cost_per_number** - No existe en API
9. **raffle.pot_fires** - No existe en API
10. **raffle.pot_coins** - No existe en API
11. **raffle.purchased_count** - No existe en API
12. **raffle.total_numbers** - No existe en API (tiene `numbers_range` en su lugar)
13. **raffle.pending_requests** - No existe en API

## **PROBLEMA IDENTIFICADO:**

El componente RaffleRoom.js está intentando acceder a propiedades que **NO existen** en la respuesta del API. Aunque agregamos optional chaining (`?.`), eso solo previene el crash al acceder, pero luego intenta usar esos valores `undefined` en lugares donde NO se puede usar undefined (como en style attributes).

## **Solución:**

Necesitamos que el BACKEND devuelva TODAS las propiedades que el frontend espera, o el frontend debe manejar correctamente cuando estas propiedades faltan.

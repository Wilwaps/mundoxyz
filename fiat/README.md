# Plan FIAT – Integración USD / VES / Token 300:1

## 1. Contexto y objetivos

Este documento define un plan de implementación para integrar información FIAT (USD/VES) en el ecosistema de MundoXYZ, aprovechando las capacidades probadas del proyecto **Analicer** (especialmente `telegram_bot_standalone.py`) y respetando el peg económico de:

- **300 tokens internos = 1 USDT** (paridad fija del protocolo)
- Entorno venezolano con **dos realidades**:
  - Tasa **oficial BCV** (referencia regulatoria)
  - Tasa **de mercado real** (Binance P2P / bancos / P2P local)

**Principio central:**

> La estabilidad del token la da el compromiso de la plataforma de honrar siempre **300 tokens = 1 USDT**, no la tasa del Bolívar.

El sistema FIAT debe:

1. Proveer tasas confiables USD/VES (BCV y Binance) para mostrar y cotizar.
2. Mantener el peg 300:1 contra USDT, independientemente de la volatilidad del VES.
3. Preparar la infraestructura para **mint & redeem** (emisión/quema) contra USDT.
4. Integrarse con el sistema actual de wallets, coins y fires sin romper la economía.

---

## 2. Lecciones de Analicer / `telegram_bot_standalone.py`

### 2.1. Scraper BCV

`StandaloneBot.scrape_bcv()` hace:

- Usa **Selenium + ChromeDriver** con opciones:
  - `--headless`, `--no-sandbox`, `--disable-dev-shm-usage`, `--log-level=3`.
  - `user-agent` configurable desde `config`.
- Abre `https://www.bcv.org.ve/`.
- Espera hasta encontrar el elemento con `id="dolar"`.
- Extrae el texto crudo (contenido donde está la tasa USD/BCV).
- Devuelve `{ success, text, source: 'BCV' }` con logging estructurado.

### 2.2. Scraper Binance P2P

`StandaloneBot.scrape_binance_api(trade_type)`:

- Usa **selenium-wire** para interceptar la llamada XHR de Binance P2P:
  - URL visitada: `https://p2p.binance.com/es/trade/{trade_type}/USDT?fiat=VES`.
  - Espera la request a `/bapi/c2c/v2/friendly/c2c/adv/search`.
- Si la respuesta está `gzip` comprimida la descomprime y la decodifica.
- Parsea el JSON y devuelve `{ success, data: [...], source: 'Binance P2P {trade_type}' }`.
- Maneja errores y timeouts con logs claros.

### 2.3. Cálculo de tasa de mercado (Binance) robusta

`process_bcv_enhanced()` (y equivalentes en `telegram_bot_dynamic.py`) aplican varias ideas clave:

- Scrapean BCV y extraen la tasa numérica `bcv_rate`.
- Scrapean Binance P2P (modo `sell` para ver precios de compradores de USDT en VES).
- Filtran **solo anuncios con `monthOrderCount >= 100`** para evitar vendedores poco confiables.
- Para evitar precios **inflados por anuncios promocionados**:
  - Si hay **≥2 anuncios relevantes**, toman el **segundo anuncio (índice 1)**.
  - Si solo hay 1, lo usan como fallback.
- Resultado: `binance_rate` que refleja mejor el **precio real P2P**.

### 2.4. Promedio BCV–Binance

`process_bcv_enhanced()` calcula:

- `average_rate = (bcv_rate + binance_rate) / 2`.
- Construye un mensaje tipo:

  - BCV: Bs X,XX
  - Binance: Bs Y,YY (2do anuncio)
  - Promedio: Bs Z,ZZ (media entre ambos)

Esta **media** es útil como referencia analítica, pero NO debemos usarla de forma ciega para definir el valor del token. El peg del token viene de USDT, no de un promedio BCV/Binance.

---

## 3. Fuentes de datos en MundoXYZ

### 3.1. BCV (tasa oficial)

- Uso principal: **referencia / reportes / comunicación**, no para pagar a comercios.
- Implementación recomendada (Node.js):
  - Intentar evitar Selenium en producción (Railway/contenerizadores) por peso y fragilidad.
  - Preferir:
    - `node-fetch` + `cheerio` para parsear HTML de BCV.
    - O un pequeño microservicio Python reutilizando el scraper ya probado, llamado vía HTTP interno.
- BCV se guarda como **fuente secundaria**.

### 3.2. Binance P2P (tasa de mercado real)

- Uso principal: **tasa operativa USD/VES**.
- Modelo a seguir: mismo flujo que `scrape_binance_api` pero en entorno Node:
  - Llamar directamente al endpoint `bapi/c2c/v2/friendly/c2c/adv/search` (evitar Selenium si es posible, replicando la request que hoy se intercepta).
  - Filtrar por `monthOrderCount >= 100`.
  - Tomar el **2do anuncio** como tasa base; fallback a primero si solo hay uno.
- Esta es la tasa que se usará para:
  - Mostrar valor estimado del token/fichas en VES.
  - Calcular depósitos/retiros en VES (cuando exista esa funcionalidad).

### 3.3. Promedio y otros derivados

El sistema puede calcular derivados:

- `usd_ves_bcv`: tasa BCV.
- `usd_ves_binance`: tasa P2P de mercado (2do anuncio).
- `usd_ves_avg`: media de ambas (solo visible como referencia).
- `override_manual`: tasa manual definida por admin para casos de emergencia.

---

## 4. Diseño técnico propuesto para MundoXYZ

### 4.1. Tablas de base de datos (plan a nivel de esquema)

> Nota: esto es un plan; la implementación real requerirá migraciones y actualización del **schema maestro**.

1. **`fiat_exchange_rates`**

   - `id` (uuid)
   - `source` (text / enum): `bcv`, `binance`, `average`, `manual`.
   - `pair` (text): por ejemplo `USD_VES`.
   - `rate` (numeric): VES por 1 USD.
   - `collected_at` (timestamp): cuándo se obtuvo/definió.
   - `metadata` (jsonb): detalles (id anuncio, lado buy/sell, recuento de órdenes, notas).
   - `is_current` (bool): marca del último valor vigente por (source, pair).

2. **`fiat_reserves`** (visión futura)

   - `id` (uuid).
   - `asset` (text): `USDT_TRON`, `USDT_ERC20`, etc.
   - `on_chain_balance` (numeric): lectura más reciente detectada on-chain.
   - `off_chain_liabilities` (numeric): obligaciones contra tokens emitidos.
   - `updated_at` (timestamp).
   - `metadata` (jsonb): direcciones, notas operativas.

3. **`fiat_operations`** (registro de mint/redeem planificado)

   - `id` (uuid).
   - `user_id` (uuid).
   - `type` (enum): `mint_from_usdt`, `redeem_to_usdt`, `cash_in_ves`, `cash_out_ves`.
   - `tokens_amount` (numeric): cantidad de tokens internos.
   - `usdt_amount` (numeric).
   - `ves_amount` (numeric, opcional).
   - `rate_used` (numeric): usd/ves usado.
   - `status` (enum): `pending`, `processing`, `completed`, `cancelled`.
   - `created_at`, `updated_at`.
   - `metadata` (jsonb): hash de tx on-chain, banco usado, etc.

### 4.2. Servicios backend (Node)

Propuesta de módulo interno en `backend/services/fiatRateService.js` (nombre orientativo):

- **Responsabilidades:**
  - Obtener tasas actuales desde fuentes externas (BCV/Binance).
  - Aplicar lógica de filtrado y selección del 2do anuncio para Binance.
  - Guardar en `fiat_exchange_rates` y marcar `is_current`.
  - Exponer funciones:
    - `getCurrentRates()` → `{ bcv, binance, average, updatedAt }`.
    - `convertUsdToVes(amountUsd)` usando tasa operativa (Binance).
    - `convertTokensToVes(tokens)` usando peg 300:1 + tasa Binance.

Posteriormente, otro servicio **`fiatArbitrageService`** podría:

- Manejar operaciones de **mint** (usuario envía USDT → recibe tokens).
- Manejar **redeem** (usuario envía tokens → recibe USDT).
- Registrar todos los movimientos en `fiat_operations` y `wallet_transactions`.

### 4.3. Endpoints API propuestos

1. **GET `/api/fiat/rates`**

   - Devuelve algo como:

   ```json
   {
     "success": true,
     "data": {
       "usd_ves_bcv": 240.12,
       "usd_ves_binance": 320.45,
       "usd_ves_average": 280.29,
       "updated_at": "2025-10-01T12:34:56Z"
     }
   }
   ```

2. **POST `/api/fiat/refresh`** (solo admin)

   - Fuerza una actualización de tasas desde BCV/Binance.

3. **Futuro – POST `/api/fiat/mint-from-usdt`**

   - Registra una solicitud de acreditación de tokens contra un depósito en USDT.

4. **Futuro – POST `/api/fiat/redeem-to-usdt`**

   - Registra el deseo de canjear tokens por USDT.

### 4.4. Integraciones Frontend

- Mostrar en el **perfil / wallet**:
  - Saldo de tokens y/o coins.
  - Valor aproximado en **USDT** (peg 300:1).
  - Valor estimado en **VES** usando `usd_ves_binance`.
- En vistas de economía (tienda, retiros, futuros cash-ins):
  - Mostrar conversores:
    - `tokens → USDT → VES`.
    - `VES → USDT → tokens`.
  - Mostrar advertencias del tipo: "Tasas de referencia basadas en Binance P2P, pueden variar".

### 4.5. Jobs y cron

- Tarea programada (cron) en backend o en un worker separado:
  - Cada 5–10 minutos: refrescar **Binance**.
  - Cada 1–2 horas: refrescar **BCV**.
- Uso de logs y alertas si:
  - No se puede actualizar Binance por X intentos seguidos.
  - La variación respecto a la última tasa válida es > cierto umbral (ej. 10–15%).

### 4.6. Seguridad y robustez

- No bloquear la app si Binance/BCV fallan:
  - Usar **última tasa válida**.
  - Marcar estado `is_stale` en la respuesta para avisar a frontend.
- Prever manualmente una tasa `override_manual` que pueda aplicarse en emergencias.

---

## 5. Estrategia económica: peg 300:1 y uso de tasas

### 5.1. Peg esencial: 300 tokens = 1 USDT

- Regla de oro: **esta paridad es fija dentro del protocolo**.
- El valor en VES se deriva siempre vía USDT y la tasa de mercado (Binance), no al revés.

Ejemplo (números ilustrativos, no hard-coded):

- Si Binance da: `1 USDT = 320 VES`.
- Entonces `300 tokens` (1 USDT) ≈ `320 VES`.
- El usuario ve su saldo en:
  - Tokens (unidad interna).
  - USDT equivalente.
  - VES estimados.

### 5.2. Uso de BCV y Binance

- **Binance P2P (tasa mercado)**:
  - Es la tasa operativa para **cotizar en VES**.
  - Se usa para:
    - Mostrar valor de tokens en VES.
    - Calcular equivalencias VES↔tokens en flujos locales.
- **BCV (tasa oficial)**:
  - No debe forzar el valor del token.
  - Se utiliza para:
    - Reportes internos.
    - Comparaciones regulatorias.
    - Mostrar al usuario transparencia entre oficial vs mercado.
- **Promedio (BCV + Binance)/2**:
  - Solo referencia informativa.
  - NO se usa para cambiar el peg 300:1.

### 5.3. Flujos de arbitraje primario

#### 5.3.1. Mint – entrada desde USDT

1. Usuario o arbitrajista envía `X USDT` a la **wallet de reserva** de la plataforma.
2. El sistema (o un admin al inicio) registra el depósito.
3. Se emiten `X * 300` tokens internos y se acreditan a la wallet MundoXYZ del usuario.
4. La relación **300:1** se mantiene.

#### 5.3.2. Redeem – salida hacia USDT

1. Usuario envía `Y` tokens al **contrato/protocolo** o solicita retiro.
2. El sistema verifica que `Y` es múltiplo de 300 (o define reglas para fracciones).
3. Quema esos tokens (o los bloquea y descuenta del saldo) y envía `Y/300 USDT` a la dirección que el usuario especifique.
4. Se registra la operación en `fiat_operations` y `wallet_transactions`.

### 5.4. Interacción con VES (comercios / usuarios locales)

- Para pagos en comercios venezolanos:
  - Se usa la tasa **Binance P2P (2do anuncio)** como `usd_ves_mercado`.
  - El comercio recibe un monto en VES calculado a partir de tokens → USDT → VES.
- Se pueden definir **spreads/márgenes** para cubrir riesgo:
  - Tasa cliente: ligeramente peor que la tasa pura de Binance (ej. +1–2%).
  - Beneficio: protege contra movimientos rápidos y costos de conversión.

Ejemplo:

- Binance: `1 USDT = 320 VES`.
- Tasa operativa al cliente: `1 USDT = 315 VES`.
- Usuario paga 300 tokens:
  - Internamente: 1 USDT.
  - Comercio: 315 VES (equivalente en el banco / pasarela local).

---

## 6. Riesgos y salvaguardas

1. **Scraping inestable**:
   - Binance/BCV pueden cambiar HTML o endpoints.
   - Mitigar con:
     - Tests periódicos.
     - Logs claros y alertas.
     - Posibilidad de forzar `override_manual`.

2. **Diferencias extremas BCV–Binance**:
   - No usar promedio como verdad económica.
   - Mantener siempre el peg 300:1 en USDT.

3. **Liquidez insuficiente en USDT**:
   - No aceptar retiros superiores al `on_chain_balance`.
   - Eventualmente, implementar colas y prioridades.

4. **Regulación / cumplimiento**:
   - Mantener registro detallado en `fiat_operations`.
   - Facilitar exportación de datos para auditoría.

---

## 7. Roadmap de implementación por fases

### Fase 1 – Lectura y exposición de tasas (sin movimientos de dinero)

- Implementar `fiat_exchange_rates` y migración correspondiente.
- Implementar `fiatRateService` en backend Node:
  - Scraper BCV (simple) + Binance (HTTP directo o microservicio Python).
  - Persistencia de tasas y `is_current`.
- Exponer `GET /api/fiat/rates`.
- Frontend: mostrar tasas y valor aproximado de tokens en VES/USDT.

### Fase 2 – Integración con economía interna

- Añadir conversiones internas:
  - Helpers para tokens↔USDT↔VES.
  - Usar VES solo para mostrar y cotizar.
- Integrar en:
  - Pantalla de perfil / wallet.
  - Potenciales secciones de depósitos/retiros (modo manual inicialmente).

### Fase 3 – Mint/Redeem con USDT real

- Implementar tablas `fiat_reserves` y `fiat_operations`.
- Diseñar flujo de **depósito USDT → emisión tokens**.
- Diseñar flujo de **quema de tokens → retiro USDT**.
- Integrar con wallets on-chain de la plataforma.

### Fase 4 – Optimización y automatización

- Monitorización avanzada.
- Ajuste de spreads/márgenes.
- Integración con notificaciones (Telegram, buzón) para:
  - Confirmación de depósitos/retiros.
  - Avisos de cambios bruscos de tasa.

---

## 8. Notas finales

- Este plan **no cambia** la economía de coins/fires existente, sino que añade una capa FIAT encima.
- Todas las decisiones de precio en VES se basan en **Binance P2P (tasa de mercado)**, mientras que BCV se mantiene solo como referencia.
- El peg **300 tokens = 1 USDT** es la piedra angular: todo el diseño gira alrededor de proteger esa paridad.

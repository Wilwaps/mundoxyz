# 🎮 MUNDOXYZ

**Plataforma de juegos multijugador con economía dual integrada a Telegram**

[![Railway Deploy](https://img.shields.io/badge/Railway-Deployed-success)](https://mundoxyz-production.up.railway.app)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-14+-blue)](https://www.postgresql.org/)
[![Node.js](https://img.shields.io/badge/Node.js-18+-green)](https://nodejs.org/)
[![React](https://img.shields.io/badge/React-18+-blue)](https://reactjs.org/)

---

## 🌟 Características Principales

### 🎲 Juegos Multijugador
- **Bingo V2** - Sistema completo con 75/90 bolas, múltiples patrones, chat en tiempo real
- **Rifas** - Modo fires (reparto de pot) y modo premio (físico)
- **TicTacToe** - Sistema de revanchas y puntuación

### 💰 Economía Dual
- **Coins** 🪙 - Moneda suave para juegos y premios
- **Fires** 🔥 - Moneda premium con supply controlado

### 🔐 Autenticación Multi-Provider
- Login con Telegram
- Login con Email/Password
- Sistema de recuperación de cuentas

### 🎁 Sistema de Fidelización
- Eventos de bienvenida configurables
- Regalos directos segmentados
- Analíticas y ROI tracking

---

## 🚀 Inicio Rápido

### Requisitos

- **Node.js** v18+
- **PostgreSQL** 14+
- **Telegram Bot Token** ([crear bot](https://t.me/BotFather))

### Instalación

```bash
# Clonar repositorio
git clone https://github.com/Wilwaps/mundoxyz.git
cd mundoxyz

# Instalar dependencias
npm install

# Configurar variables
cp .env.example .env
# Editar .env con tus datos

# Inicializar base de datos
psql -U postgres -d mundoxyz < DATABASE_SCHEMA_MASTER.sql

# Iniciar desarrollo
npm run dev
```

---

## 📁 Estructura del Proyecto

```
mundoxyz/
├── backend/                    # Servidor Node.js/Express
│   ├── routes/                 # Endpoints API
│   ├── services/               # Lógica de negocio
│   ├── socket/                 # WebSocket handlers
│   ├── middleware/             # Auth, rate limiting, etc.
│   ├── db/                     # Conexión y queries
│   └── bot/                    # Telegram Bot
├── frontend/                   # React SPA
│   ├── src/
│   │   ├── pages/              # Páginas principales
│   │   ├── components/         # Componentes reutilizables
│   │   ├── contexts/           # React Contexts
│   │   └── services/           # API calls
│   └── public/
├── DATABASE_SCHEMA_MASTER.sql  # Schema completo actualizado
├── .env.example                # Variables de entorno template
├── package.json
└── README.md
```

---

## 🗄️ Base de Datos

### Schema Maestro

El archivo **`DATABASE_SCHEMA_MASTER.sql`** contiene el schema completo y actualizado con:

- ✅ 25 tablas principales
- ✅ Índices optimizados
- ✅ Funciones PostgreSQL
- ✅ Constraints y validaciones
- ✅ Comentarios de documentación

### Tablas Principales

| Tabla | Descripción |
|-------|-------------|
| `users` | Usuarios del sistema |
| `auth_identities` | Multi-provider authentication |
| `wallets` | Balances de coins y fires |
| `bingo_v2_*` | Sistema Bingo V2 completo |
| `raffles` | Rifas y números |
| `tictactoe_*` | TicTacToe rooms y moves |
| `direct_gifts` | Sistema de regalos |
| `welcome_events` | Eventos de fidelización |

---

## 🔧 Configuración

### Variables de Entorno

Copia `.env.example` y configura:

```env
# Database
DATABASE_URL=postgresql://user:pass@host:5432/db

# Telegram Bot
TELEGRAM_BOT_TOKEN=tu_token_aquí
TELEGRAM_BOT_USERNAME=tu_bot_username
PUBLIC_WEBAPP_URL=https://tu-dominio.com

# Server
PORT=3000
NODE_ENV=production
FRONTEND_URL=https://tu-dominio.com

# Security
JWT_SECRET=tu_secret_jwt
SESSION_SECRET=tu_secret_session
```

### Telegram Bot Webhook

```bash
# Configurar webhook en producción
node backend/scripts/setup-telegram-webhook.js
```

---

## 🚀 Despliegue Railway

### Variables Requeridas

1. Ve a **Railway Dashboard → Variables**
2. Agrega las siguientes:

```env
DATABASE_URL=postgresql://... (auto por Railway)
TELEGRAM_BOT_TOKEN=tu_token
TELEGRAM_BOT_USERNAME=tu_bot
PUBLIC_WEBAPP_URL=https://tu-app.up.railway.app
NODE_ENV=production
JWT_SECRET=secreto-fuerte
SESSION_SECRET=secreto-fuerte
```

### Auto-Deploy

```bash
git add .
git commit -m "Actualización"
git push
# Railway despliega automáticamente
```

---

## 🎮 Juegos

### Bingo V2

- **Modos:** 75 y 90 bolas
- **Patrones:** Línea, Esquinas, Cartón completo
- **Características:**
  - Chat en tiempo real
  - Auto-canto con XP 400+
  - Hasta 10 cartones por jugador
  - Distribución premios 70/20/10

### Rifas

- **Modo Fires:** Reparto de pot entre ganadores
- **Modo Premio:** Premio físico definido por host
- **Características:**
  - Códigos numéricos únicos
  - Selección aleatoria de ganador
  - Auditoría completa

### TicTacToe

- **Características:**
  - Sistema de revanchas
  - Puntuación acumulada
  - Modo coins o fires
  - XP por victoria

---

## 🔐 Seguridad

- ✅ Rate limiting (500 req/min global, 300 por usuario)
- ✅ JWT con expiración 7 días
- ✅ Bcrypt para passwords
- ✅ CORS configurado
- ✅ Helmet.js para headers
- ✅ Input sanitization

---

## 📊 Analíticas

Sistema de tracking incluye:

- 📈 Eventos de usuario
- 💰 Transacciones de wallet
- 🎮 Estadísticas de juegos
- 🎁 ROI de regalos y eventos

---

## 🤝 Contribuir

Este es un proyecto privado. Para consultas contacta a:

**Telegram:** [@tote](https://t.me/tote) (ID: 1417856820)

---

## 📄 Documentación Adicional

Los archivos de documentación histórica están en:
```
no es fundamental/
```

**NO usar** archivos de esa carpeta para producción.

---

## 🐛 Troubleshooting

### Bot no responde

1. Verificar webhook: `curl https://api.telegram.org/bot[TOKEN]/getWebhookInfo`
2. Re-configurar: `node backend/scripts/setup-telegram-webhook.js`

### Error de migraciones

1. Verificar schema: `\dt` en psql
2. Ejecutar schema maestro si es necesario

### Balance no actualiza

1. Verificar tabla `wallets` existe
2. Revisar logs de transacciones

---

## 📝 Licencia

**MIT License** - Ver archivo LICENSE para detalles

---

## 👨‍💻 Autor

**Tote** - Super Admin MundoXYZ  
Telegram: @tote (ID: 1417856820)

---

**🚀 Versión Actual:** Production 4 Nov 2025  
**📍 Deploy:** https://mundoxyz-production.up.railway.app  
**🤖 Bot:** [@mundoxyz_bot](https://t.me/mundoxyz_bot)

# MUNDOXYZ 🎮

MiniApp de Telegram con juegos, economía dual (Coins/Fires), PostgreSQL y Redis.

## 🚀 Características

- **Backend**: Node.js/Express con autenticación Telegram
- **Frontend**: React con diseño futurista
- **Base de Datos**: PostgreSQL + Redis
- **Economía Dual**: Coins (soft) y Fires (moneda dura)
- **Juegos**: Bingo, Raffles y TicTacToe
- **Telegram Integration**: Bot y WebApp

## 📋 Requisitos

- Node.js v18+
- Docker (para desarrollo local)
- PostgreSQL 
- Redis
- Telegram Bot Token

## 🛠️ Instalación

1. Clonar el repositorio:
```bash
git clone https://github.com/alejodriguez/mundoxyz.git
cd mundoxyz
```

2. Instalar dependencias:
```bash
npm install
```

3. Configurar variables de entorno:
```bash
cp .env.example .env
# Editar .env con tus configuraciones
```

4. Iniciar servicios con Docker (desarrollo):
```bash
docker-compose up -d
```

5. Ejecutar migraciones:
```bash
npm run migrate
```

6. Iniciar servidor:
```bash
npm run dev
```

## 🚀 Despliegue en Railway

El proyecto está configurado para despliegue automático en Railway con PostgreSQL y Redis.

## 📁 Estructura

```
mundoxyz/
├── backend/         # Servidor Express
├── frontend/        # Aplicación React
├── migrations/      # Migraciones DB
├── docker-compose.yml
├── package.json
└── README.md
```

## 🎮 Juegos Disponibles

- **Bingo**: Modalidades Amistoso, Fuego y Monedas
- **Raffles**: Sistema de rifas con premios
- **TicTacToe**: La vieja clásica

## 💰 Sistema Económico

- **Coins**: Moneda suave para premios y UI
- **Fires 🔥**: Moneda dura con supply auditable

## 📄 Licencia

MIT

---
Creado con ❤️ por Tote

<!-- Rebuild: 2025-10-25 13:33:09 -->

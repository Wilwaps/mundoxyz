# 📋 PARTE 2: Endpoints API

**Proyecto:** MundoXYZ - Sistema Multi-Ecosistema  
**Fecha:** 2025-11-05

---

## 🔧 ENDPOINTS API

### **1. Crear Ecosistema**

#### `POST /api/ecosystems/create`
**Auth:** Token de usuario creador  

**Body:**
```json
{
  "name": "MundoXYZ",
  "slug": "mundoxyz",
  "slogan": "Tu comunidad de juegos favorita",
  "logo_file": "base64_encoded_image",
  "admin": {
    "username": "admin_mundoxyz",
    "email": "admin@mundoxyz.com",
    "phone": "+58 412-1234567",
    "password": "SecurePass123"
  },
  "economy": {
    "fire_name": "Fuego",
    "fire_symbol": "🔥",
    "coin_name": "Moneda",
    "coin_symbol": "🪙",
    "max_supply": 1000000,
    "transfer_commission_percentage": 5.0,
    "withdrawal_commission_percentage": 5.0
  },
  "games": {
    "bingo": {
      "winner_percentage": 70.0,
      "host_percentage": 20.0,
      "platform_percentage": 10.0
    },
    "raffle": {
      "winner_percentage": 70.0,
      "host_percentage": 20.0,
      "platform_percentage": 10.0,
      "cost_prize_mode": 300.0,
      "cost_normal_mode": 3000.0
    },
    "host_limits": {
      "commission_min": 1.0,
      "commission_max": 20.0
    }
  },
  "market": {
    "min_withdrawal": 100.0,
    "withdrawal_commission_percentage": 5.0
  },
  "status": "draft"
}
```

**Response:**
```json
{
  "success": true,
  "ecosystem": {
    "id": "uuid...",
    "slug": "mundoxyz",
    "name": "MundoXYZ",
    "status": "draft"
  }
}
```

---

### **2. Guardar Borrador**

#### `PUT /api/ecosystems/:id/draft`
**Auth:** Token del creador  
**Descripción:** Guardar progreso del wizard

**Body:** Mismo que create pero parcial

---

### **3. Publicar Ecosistema**

#### `POST /api/ecosystems/:id/publish`
**Auth:** Token del admin  
**Descripción:** Cambiar status de draft a active

**Response:**
```json
{
  "success": true,
  "ecosystem": {
    "id": "uuid...",
    "status": "active"
  }
}
```

---

### **4. Obtener Configuración**

#### `GET /api/ecosystems/:slug`
**Auth:** Token del admin  
**Descripción:** Obtener configuración completa

**Response:**
```json
{
  "id": "uuid...",
  "name": "MundoXYZ",
  "slug": "mundoxyz",
  "slogan": "...",
  "logo_url": "...",
  "economy": {
    "fire_name": "Fuego",
    "fire_symbol": "🔥",
    "max_supply": 1000000
  },
  "games": {
    "bingo": {
      "winner_percentage": 70,
      "host_percentage": 20,
      "platform_percentage": 10
    }
  }
}
```

---

### **5. Actualizar Configuración**

#### `PUT /api/ecosystems/:id/config`
**Auth:** Token del admin  
**Descripción:** Actualizar desde dashboard

**Body:**
```json
{
  "section": "games.bingo",
  "data": {
    "winner_percentage": 75.0,
    "host_percentage": 15.0,
    "platform_percentage": 10.0
  }
}
```

**Validaciones:**
- No modificar max_supply
- Suma porcentajes = 100%
- Límites numéricos respetados

---

### **6. Login Admin**

#### `POST /api/ecosystems/admin/login`
**Descripción:** Login específico para admin de ecosistema

**Body:**
```json
{
  "ecosystem_slug": "mundoxyz",
  "username": "admin_mundoxyz",
  "password": "SecurePass123"
}
```

**Response:**
```json
{
  "success": true,
  "token": "jwt...",
  "user": {
    "id": "uuid...",
    "username": "admin_mundoxyz",
    "is_ecosystem_admin": true,
    "ecosystem": {
      "id": "uuid...",
      "name": "MundoXYZ",
      "slug": "mundoxyz"
    }
  }
}
```

---

### **7. Subir Logo**

#### `POST /api/ecosystems/:id/upload-logo`
**Auth:** Token del admin  
**Content-Type:** multipart/form-data

**Response:**
```json
{
  "success": true,
  "logo_url": "https://cdn.../mundoxyz-logo.png"
}
```

---

## 🔒 MIDDLEWARE

### `verifyEcosystemAdmin.js`

```javascript
const verifyEcosystemAdmin = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    
    const ecosystem = await query(
      'SELECT admin_user_id FROM ecosystems WHERE id = $1',
      [id]
    );
    
    if (ecosystem.rows[0].admin_user_id !== userId) {
      return res.status(403).json({ 
        error: 'No autorizado - Solo admin del ecosistema' 
      });
    }
    
    next();
  } catch (error) {
    res.status(500).json({ error: 'Error verificando permisos' });
  }
};
```

---

## 📝 VALIDACIONES

### Crear/Actualizar Ecosistema

1. **Nombre único**
   - No repetir nombres de ecosistemas

2. **Slug único**
   - Formato: solo letras, números, guiones
   - Reservados: admin, api, static, assets

3. **Porcentajes**
   - Suma total = 100%
   - Valores entre 0 y 100

4. **Max Supply**
   - Solo al crear (no editable)
   - Mayor a 0

5. **Email/Username único**
   - Admin no puede ser username existente

6. **Logo**
   - Formatos: PNG, JPG, WEBP
   - Tamaño máx: 2MB
   - Dimensiones recomendadas: 512x512px

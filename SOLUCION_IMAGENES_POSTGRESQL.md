# 🖼️ SOLUCIÓN: Almacenamiento de Imágenes en PostgreSQL

**Fecha:** 2025-11-05 16:18pm UTC-4  
**Problema:** Error al subir imágenes de rifas (falta AWS S3 configurado)  
**Solución:** Usar PostgreSQL para almacenar imágenes en Base64  
**Status:** 📝 DOCUMENTADO - Pendiente implementación  

---

## 🚨 PROBLEMA ORIGINAL

### **Error:**
```
Error uploading prize image: MissingRequiredParameter: 
Missing required key 'Bucket' in params
```

### **Causa:**
El código intenta subir imágenes a AWS S3, pero:
- ❌ No hay variables de entorno configuradas (`AWS_S3_BUCKET`, `AWS_ACCESS_KEY_ID`, etc.)
- ❌ No se tiene cuenta/servicio de AWS S3
- ❌ Las imágenes son críticas: deben persistir días/semanas/meses

---

## ✅ SOLUCIÓN PROPUESTA

### **Usar PostgreSQL** (ya disponible en Railway)

**Ventajas:**
✅ No requiere servicios externos  
✅ Persistencia garantizada (mismo tiempo que la BD)  
✅ Consistencia total con los datos de las rifas  
✅ Sin costos adicionales  
✅ Imágenes ligadas a la vida útil de la rifa  

---

## 📋 IMPLEMENTACIÓN

### **PASO 1: Agregar columnas a tabla `raffles`**

**Archivo:** `backend/db/migrations/027_add_raffle_images.sql`

```sql
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
```

**✅ YA CREADO:** Este archivo ya existe en el proyecto.

---

### **PASO 2: Modificar endpoints en `backend/routes/raffles.js`**

#### **🔴 PROBLEMA ACTUAL:**
El archivo `raffles.js` tiene **código duplicado** (2 veces cada endpoint).

#### **📝 CAMBIOS NECESARIOS:**

**A. Eliminar imports de AWS:**
```javascript
// ❌ ELIMINAR
const AWS = require('aws-sdk');

const s3 = new AWS.S3({
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    region: process.env.AWS_REGION
});
```

**B. Reemplazar endpoint `/upload-logo`:**

**ANTES (AWS S3):**
```javascript
router.post('/upload-logo', verifyToken, upload.single('logo'), async (req, res) => {
    // ... código AWS S3 con Bucket, Key, etc.
    const uploadResult = await s3.upload(params).promise();
    res.json({ success: true, data: { logo_url: uploadResult.Location }});
});
```

**DESPUÉS (PostgreSQL Base64):**
```javascript
router.post('/upload-logo', verifyToken, upload.single('logo'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({
                success: false,
                error: 'No se proporcionó archivo de imagen'
            });
        }

        // Convertir imagen a Base64
        const base64Image = req.file.buffer.toString('base64');
        const imageData = `data:${req.file.mimetype};base64,${base64Image}`;
        
        res.json({
            success: true,
            data: {
                logo_url: imageData,
                mime_type: req.file.mimetype
            },
            message: 'Logo procesado exitosamente'
        });
    } catch (error) {
        console.error('Error uploading logo:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});
```

**C. Reemplazar endpoint `/upload-prize-image`:**

**ANTES (AWS S3):**
```javascript
router.post('/upload-prize-image', verifyToken, upload.single('prize_image'), async (req, res) => {
    // ... código AWS S3
    const uploadResult = await s3.upload(params).promise();
    res.json({ success: true, data: { image_url: uploadResult.Location }});
});
```

**DESPUÉS (PostgreSQL Base64):**
```javascript
router.post('/upload-prize-image', verifyToken, upload.single('prize_image'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({
                success: false,
                error: 'No se proporcionó archivo de imagen del premio'
            });
        }

        // Convertir imagen a Base64
        const base64Image = req.file.buffer.toString('base64');
        const imageData = `data:${req.file.mimetype};base64,${base64Image}`;
        
        res.json({
            success: true,
            data: {
                image_url: imageData,
                mime_type: req.file.mimetype
            },
            message: 'Imagen del premio procesada exitosamente'
        });
    } catch (error) {
        console.error('Error uploading prize image:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});
```

---

### **PASO 3: Eliminar código duplicado**

El archivo `backend/routes/raffles.js` tiene estas rutas **2 VECES**:
- Línea 389-427: `/upload-logo` (primera vez)
- Línea 430-468: `/upload-prize-image` (primera vez)
- Línea 634-672: `/upload-logo` (segunda vez - **DUPLICADO**)
- Línea 675-713: `/upload-prize-image` (segunda vez - **DUPLICADO**)

**Acción:** Eliminar las líneas 634-713 (segunda aparición de ambos endpoints).

---

## 🔧 CÓMO FUNCIONA

### **Flujo de Subida:**

1. **Frontend** envía imagen al endpoint `/api/raffles/upload-prize-image`
2. **Multer** recibe el archivo en memoria (buffer)
3. **Backend** convierte buffer a Base64:
   ```javascript
   const base64Image = req.file.buffer.toString('base64');
   const imageData = `data:${req.file.mimetype};base64,${base64Image}`;
   ```
4. **Backend** devuelve el data URI completo al frontend
5. **Frontend** guarda ese data URI en el estado de la rifa
6. **Cuando se crea la rifa**, el data URI se guarda en la columna `prize_image` de la tabla `raffles`

### **Flujo de Visualización:**

1. **Backend** consulta la tabla `raffles`
2. Obtiene el campo `prize_image` (que contiene el data URI)
3. **Frontend** recibe: `data:image/jpeg;base64,/9j/4AAQSkZJRg...`
4. **Frontend** lo muestra directamente en `<img src={prize_image} />`

---

## 📊 TAMAÑO DE IMÁGENES

### **Límites:**

**Multer configurado:** 5 MB por archivo
```javascript
limits: { fileSize: 5 * 1024 * 1024 }
```

**PostgreSQL TEXT:** Sin límite práctico
- Una imagen de 5 MB en Base64 ≈ 6.67 MB de texto
- PostgreSQL TEXT soporta hasta 1 GB
- ✅ Más que suficiente para imágenes de rifas

### **Optimización recomendada:**

Si las imágenes son muy grandes, el frontend puede redimensionarlas antes de enviarlas:

```javascript
// Ejemplo de redimensionamiento en frontend
const resizeImage = (file, maxWidth = 800, maxHeight = 800) => {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;
        
        if (width > height) {
          if (width > maxWidth) {
            height *= maxWidth / width;
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width *= maxHeight / height;
            height = maxHeight;
          }
        }
        
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        
        canvas.toBlob(resolve, 'image/jpeg', 0.85);
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
};
```

---

## 🚀 PASOS PARA IMPLEMENTAR

### **1. Ejecutar migración 027:**
```bash
# Ya está creada, se ejecutará automáticamente en el próximo deploy
```

### **2. Modificar `backend/routes/raffles.js`:**

**Opción A - Manual:**
1. Abrir `backend/routes/raffles.js`
2. Eliminar imports de AWS (líneas 10-18)
3. Eliminar código duplicado (líneas 634-713)
4. Reemplazar endpoints (líneas 388-468) con código nuevo

**Opción B - Script automatizado:**
```bash
# Crear backup
cp backend/routes/raffles.js backend/routes/raffles.js.backup

# Ejecutar script de reemplazo (crear script si necesario)
```

### **3. Test local:**
```bash
npm run migrate  # Aplicar migración 027
npm start        # Iniciar servidor
# Probar subida de imagen en frontend
```

### **4. Deploy:**
```bash
git add backend/db/migrations/027_add_raffle_images.sql
git add backend/routes/raffles.js
git commit -m "fix: almacenar imágenes de rifas en PostgreSQL (sin AWS)"
git push
```

---

## ✅ VERIFICACIÓN POST-DEPLOY

### **Checklist:**
- [ ] Migración 027 ejecutada correctamente
- [ ] Columnas `prize_image` y `company_logo` existen en tabla `raffles`
- [ ] Endpoint `/upload-prize-image` funciona sin error de Bucket
- [ ] Endpoint `/upload-logo` funciona sin error de Bucket
- [ ] Frontend puede crear rifas con imágenes
- [ ] Imágenes se muestran correctamente en la vista de rifas
- [ ] No hay errores en logs de Railway

### **SQL de verificación:**
```sql
-- Verificar columnas nuevas
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'raffles' 
AND column_name IN ('prize_image', 'prize_image_mime', 'company_logo', 'company_logo_mime');

-- Verificar rifas con imágenes
SELECT id, code, name, 
       CASE WHEN prize_image IS NOT NULL THEN 'Sí' ELSE 'No' END as tiene_imagen,
       LENGTH(prize_image) as tamaño_imagen_bytes
FROM raffles 
WHERE created_at > NOW() - INTERVAL '1 day';
```

---

## 🎯 VENTAJAS DE ESTA SOLUCIÓN

### **Consistencia:**
✅ Imagen vive en la misma BD que la rifa  
✅ Si se borra la rifa, se borra la imagen  
✅ Transacciones atómicas (rifa + imagen)  

### **Persistencia:**
✅ Mientras exista la BD, existen las imágenes  
✅ No depende de servicios externos  
✅ Backups de BD incluyen las imágenes  

### **Simplicidad:**
✅ No require configuración externa  
✅ No require credenciales de terceros  
✅ Código más simple (sin SDK de AWS)  

### **Costo:**
✅ Sin costos adicionales  
✅ Ya tienes PostgreSQL en Railway  
✅ Almacenamiento incluido en plan actual  

---

## 📝 NOTAS IMPORTANTES

### **1. Rendimiento:**
- Base64 aumenta el tamaño ~33%
- Ejemplo: 3 MB imagen → 4 MB Base64
- PostgreSQL maneja esto sin problema
- Queries de rifas incluirán las imágenes

### **2. Cache:**
- Considerar cache en frontend para imágenes frecuentes
- React Query ya hace cache automático
- No recargar imágenes en cada render

### **3. Migración de datos existentes:**
- Esta solución es para rifas nuevas
- Rifas antiguas sin columnas de imagen seguirán funcionando
- `prize_image` y `company_logo` son opcionales (NULL por defecto)

---

## 🔮 ALTERNATIVAS FUTURAS

Si en el futuro decides usar almacenamiento externo:

### **Opción 1: Cloudinary**
- Gratis hasta 25 GB
- API simple
- Optimización automática

### **Opción 2: Railway Volumes**
- Almacenar archivos en volumen persistente
- Servir con endpoint dedicado
- Más complejo pero más eficiente

### **Opción 3: Supabase Storage**
- Integrado con PostgreSQL
- Gratis hasta 1 GB
- S3-compatible API

**Por ahora:** PostgreSQL Base64 es la mejor opción por simplicidad y costo $0.

---

## 🎊 RESUMEN EJECUTIVO

**PROBLEMA:** ❌ Falta AWS S3, no se pueden subir imágenes  
**SOLUCIÓN:** ✅ Almacenar en PostgreSQL como Base64  
**MIGRACIÓN:** 027_add_raffle_images.sql (ya creada)  
**CÓDIGO:** Modificar `backend/routes/raffles.js`  
**COSTO:** $0 adicionales  
**PERSISTENCIA:** Garantizada (misma vida que la BD)  
**IMPLEMENTACIÓN:** ~15 minutos  

---

**Solución propuesta con amor y pragmatismo** 💙✨  
**Fecha:** 2025-11-05 16:18pm UTC-4  
**Status:** 📝 DOCUMENTADO - Listo para implementar

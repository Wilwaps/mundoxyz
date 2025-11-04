# 📦 NO ES FUNDAMENTAL

Esta carpeta contiene archivos de documentación, fixes históricos, scripts de prueba y otros archivos que **NO son fundamentales** para el funcionamiento del sistema.

## 📋 Contenido

### 📄 Documentación de Fixes
- Todos los archivos `.md` con documentación de correcciones pasadas
- Análisis de problemas históricos
- Reportes de testing y debugging

### 🔧 Scripts de Prueba y Debug
- Archivos `.js` de testing
- Scripts `.ps1` de PowerShell
- Archivos `.sql` de fixes puntuales

### 📁 Carpetas Archivadas
- `propuesta/` - Propuestas y diseños preliminares
- `scripts/` - Scripts utilitarios antiguos
- `migrations/` - Migraciones viejas (referencia histórica)

### 📝 Logs y Notas
- Archivos `.txt` con capturas y notas
- Logs de Railway históricos

---

## ⚠️ IMPORTANTE

**Estos archivos NO deben modificarse ni utilizarse en producción.**

Son mantenidos únicamente como:
- 📚 Referencia histórica
- 🐛 Debug de problemas antiguos
- 📖 Documentación de decisiones técnicas

---

## ✅ Archivos Fundamentales (en raíz)

Los únicos archivos importantes están en la raíz del proyecto:

### Configuración
- `package.json` - Dependencias
- `.env` y `.env.example` - Variables de entorno
- `.gitignore` - Ignorados de Git
- `railway.json` - Configuración Railway
- `docker-compose.yml` - Docker (si aplica)

### Código Fuente
- `backend/` - Código del servidor
- `frontend/` - Código del cliente

### Documentación Vigente
- `README.md` - Documentación principal
- `DATABASE_SCHEMA_MASTER.sql` - **Schema maestro actualizado**

---

## 🗄️ Base de Datos

Para inicializar la base de datos desde cero, usar:

```bash
# Conectar a PostgreSQL
psql -h [HOST] -U [USER] -d [DATABASE]

# Ejecutar schema maestro
\i DATABASE_SCHEMA_MASTER.sql
```

**NO usar** archivos de migraciones individuales de esta carpeta.

---

**Fecha de organización:** 4 Noviembre 2025  
**Organizado por:** Limpieza masiva del repositorio

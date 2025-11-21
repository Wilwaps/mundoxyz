# Sistema de Roles MundoXYZ

> Documento conceptual (no técnico) para diseñar los roles y beneficios dentro del ecosistema MundoXYZ.
> Iteraremos este archivo a medida que surjan nuevas ideas.

---

## 1. Objetivos del sistema de roles

- **Recompensar a quienes aportan valor** (patrocinantes, líderes de comunidad, creadores de contenido, etc.).
- **Compartir parte de la economía de la plataforma** con la comunidad de forma transparente y sostenible.
- **Incentivar la construcción de comunidades sanas y activas** dentro de MundoXYZ.
- **Mantener siempre la coherencia** con la economía interna (fuegos, monedas, rifas, juegos, retiros y envíos).

---

## 2. Rol: Patrocinante

### 2.1. Perfil e intención

- Persona o entidad que hace un **pago o aporte inicial** a MundoXYZ.
- A cambio, recibe beneficios permanentes o por un período determinado.

### 2.2. Beneficios base (idea inicial)

- **No paga el valor de las rifas** en las que quiera participar, o tiene un cupo especial de rifas sin costo.
  - Opciones a definir más adelante (técnico/económico):
    - Cupo mensual de rifas gratuitas (ej: hasta X rifas al mes sin costo).
    - Descuento del 100% hasta cierto volumen de participación.
    - Rango de rifas específicas (promociones, campañas especiales, etc.).
- Acceso preferencial a **nuevas funciones** o eventos especiales de la plataforma.
- Posibilidad de figurar como **“Patrocinante Oficial”** dentro de ciertas secciones (lobby, rifas, landing públicas).

### 2.3. Consideraciones de equilibrio

- Debe existir un **acuerdo económico claro** entre el patrocinante y la plataforma (pago inicial, duración, tope de beneficios).
- Hay que proteger la economía de jugadores normales:
  - Evitar que un patrocinante abuse del beneficio y distorsione sorteos/juegos.
  - Posible límite por rifa o por día/semana.

---

## 3. Rol: Líder de Comunidad

### 3.1. Perfil e intención

- Usuario con rol especial que **construye y gestiona una comunidad** dentro de MundoXYZ.
- Puede invitar a otros usuarios para que formen parte de su comunidad.
- La plataforma comparte **un porcentaje de la economía** de los miembros con el líder y con un fondo común.

### 3.2. Mecanismo de comunidad (idea conceptual)

- Cada líder de comunidad tiene un **código / enlace de invitación**.
- Cuando un usuario acepta, pasa a ser **miembro de esa comunidad**.
- Un usuario puede pertenecer, en principio, a **una sola comunidad principal** (a definir si se permiten múltiples).

### 3.3. Flujo económico propuesto

Cuando un miembro de la comunidad realiza ciertas acciones económicas:

- **Retiros (fuegos → Bs/USDT u otras salidas)**.
- **Envíos a otros usuarios** (transferencias internas de la plataforma).

Se aplica la siguiente lógica conceptual (números iniciales, ajustables):

1. **3% para el Líder de Comunidad**
   - El 3% del monto de la operación se asigna al líder de esa comunidad.
   - Es un ingreso pasivo por los movimientos de sus miembros.

2. **1% para el Pote de Comunidad**
   - El 1% se destina a un **fondo común de la comunidad**.
   - Este pote se va acumulando con cada retiro o envío de los miembros.

3. **Distribución del Pote de Comunidad**
   - Cada **3 días** se reparte el pote entre **todos los miembros de la comunidad**, **excluyendo al líder**.
   - Reglas a definir (ideas iniciales):
     - Reparto igualitario entre todos los miembros activos.
     - O ponderado por nivel de actividad (número de juegos, rifas, compras, etc.).

4. **La plataforma conserva el resto**
   - La plataforma sigue quedándose con su comisión base.
   - El 3% + 1% salen de una fracción definida de la comisión de la plataforma, o se suman como comisión adicional (esto hay que diseñarlo con cuidado).

### 3.4. Beneficios concretos para cada actor

- **Líder de Comunidad**
  - Ingreso recurrente del **3% de los retiros/envíos** de su comunidad.
  - Motivación fuerte para atraer y cuidar a sus miembros.
  - Posibilidad de liderar eventos, rifas y torneos exclusivos para su comunidad.

- **Miembros de la Comunidad**
  - Acceso a un **pote comunitario** que se reparte cada 3 días.
  - Beneficio pasivo por estar en una comunidad activa.
  - Posibles ventajas adicionales: rifas internas, misiones de comunidad, recompensas por objetivos colectivos.

- **Plataforma MundoXYZ**
  - Crea una **estructura de afiliados / comunidades** muy potente.
  - Comparte parte de su economía para aumentar retención, actividad y efecto red.

### 3.5. Reglas y protecciones a definir

- Límites para evitar abusos:
  - Evitar comunidades creadas solo para farmear retiros pequeños.
  - Posible mínimo de actividad para que una operación genere 3% + 1%.
- Criterios para considerar un **miembro activo** (para repartir el pote):
  - Debe haber entrado al menos X veces en los últimos N días.
  - O debe haber hecho al menos una acción económica mínima.
- Mecanismos de transparencia:
  - Panel donde el líder vea:
    - Lista de miembros.
    - Movimientos que generaron comisiones.
    - Total ganado por 3%.
  - Panel donde los miembros vean:
    - Historial del pote de comunidad.
    - Cómo se repartió el 1%.

---

## 4. Ideas futuras de roles (borrador)

> Estas ideas son solo semillas. Las iremos detallando y aprobando contigo antes de pasar a diseño técnico.

- **Rol: Creador de Contenido / Host Premium**
  - Gana un % de las rifas o juegos que organice.
  - Acceso a herramientas avanzadas: estadísticas, plantillas, promoción interna.

- **Rol: Embajador / Partner Global**
  - Nivel por encima del líder de comunidad.
  - Agrupa varias comunidades o regiones.
  - Recibe % adicional de la actividad que gestionan sus líderes asociados.

- **Rol: Moderador / Guardián de la Comunidad**
  - Poderes para moderar chats, reportar abusos, marcar rifas sospechosas.
  - Recompensas por mantener el ecosistema sano.

---

## 5. Próximos pasos

1. **Validar contigo las ideas de Patrocinante y Líder de Comunidad** (porcentajes, condiciones, límites).
2. Definir qué acciones exactas generan el 3% + 1% (solo retiros y envíos, o también compras de rifas / juegos).
3. Diseñar el **modelo económico detallado** para asegurar que todo es sostenible.
4. Pasar a diseño técnico:
   - Campos nuevos en base de datos (roles, comunidades, potes, historiales).
   - Lógica en backend para registrar operaciones y distribuir comisiones.
   - Interfaces en frontend (paneles de líder, paneles de miembro, estadísticas).

Este archivo se irá ampliando con todas las nuevas ideas de roles y beneficios que vayas proponiendo, siempre manteniendo la coherencia con la economía de MundoXYZ.

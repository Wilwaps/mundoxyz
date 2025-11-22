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

## 4. Rol: Vendedor y Sistema de Tiendas

### 4.1. Perfil e intención

- Usuario asociado a una **tienda** (comercio físico o digital) dentro de MundoXYZ.
- Su objetivo es **vender productos y servicios** usando la economía interna (fuegos, coins, rifas, juegos, canjes).

### 4.2. Tiendas y catálogo de productos

- Cada tienda tiene:
  - Nombre, logo, datos de contacto, dirección y horario.
  - Configuración de comisiones/porcentajes con MundoXYZ.
  - Opciones de entrega (retiro en tienda, delivery, etc. a definir).
- Productos:
  - Pueden ser **productos físicos** (pizzas, bebidas, ropa) o **servicios**.
  - Atributos principales:
    - Nombre, descripción corta.
    - Precio base (en fuegos, coins o moneda fiat de referencia).
    - Categoría (ej. Pizzas, Bebidas, Postres).
    - Etiqueta opcional **"menú"** para aparecer en el menú principal de la tienda.
  - Opciones configurables por producto (tipo "ingredientes"):
    - Ejemplo Pizza Primavera:
      - Ingredientes por defecto: jamón, maíz, tocineta.
      - El cliente puede **desmarcar** cualquiera de esos ingredientes antes de confirmar el pedido.
    - Conceptualmente: lista de opciones con checkboxes (incluido por defecto, precio extra opcional).

### 4.3. Punto de Venta (POS) para vendedores

- Interfaz de **Punto de Venta** dentro de MundoXYZ:
  - El vendedor busca al cliente (usuario de MundoXYZ) o registra un **cliente invitado**.
  - Agrega productos al pedido, ajusta cantidades y opciones (ej. quitar maíz de la pizza).
  - El pedido entra en un **carrito POS** con:
    - Subtotal, impuestos, descuentos, total.
    - Método de pago: fuegos, coins, efectivo externo, transferencia, etc. (a definir técnicamente).
  - Al confirmar el pedido:
    - Se crea una **orden de venta** ligada a la tienda y al usuario (si está logueado).
    - Se descuenta inventario y se actualizan métricas de la tienda.

### 4.4. Carrito para clientes online

- Clientes que no están físicamente en la tienda pueden:
  - Abrir el **menú** de la tienda (con los productos marcados como "menú").
  - Seleccionar productos, configurar opciones (toppings, extras, ingredientes a quitar).
  - Agregar al carrito y confirmar el pedido.
- El flujo de pago puede usar:
  - Fuegos / coins.
  - Métodos externos (ej. pago móvil, efectivo) registrados como referencia.

### 4.5. Inventario y facturación

- Inventario por tienda:
  - Stock por producto y, si aplica, por variante.
  - Ajustes manuales de stock (entradas de mercancía, pérdidas, promociones, etc.).
- Facturación:
  - Cada pedido confirmado genera un **documento de venta** (factura o comprobante interno).
  - Futuro: exportar reportes en CSV/PDF para contabilidad.

### 4.6. Reportes de la tienda

- Reportes que la tienda puede consultar:
  - Ventas **diarias, semanales, mensuales o por rango de fechas**.
  - Productos más vendidos y tickets promedio.
  - Opcional: margen estimado por producto/categoría.
- Estos reportes se integran con el sistema de roles para potencialmente:
  - Recompensar a tiendas/vendedores con mejor desempeño.
  - Conectar tiendas con líderes de comunidad o patrocinantes.

### 4.7. Propietario de tienda vs. Vendedor

- **Propietario de tienda**:
  - Crea y configura la tienda.
  - Administra catálogo, precios, inventario y comisiones.
  - Otorga y revoca permisos de **vendedor**.
- **Vendedor**:
  - Usa el POS para registrar pedidos.
  - Ve un panel con sus ventas personales (cantidad de pedidos atendidos, volumen, etc.).
  - No puede modificar configuraciones críticas de la tienda.

---

## 5. Sistema de seguimiento de referidos

### 5.1. Objetivo

- Permitir que cada usuario genere **links de invitación** rastreables.
- Medir cuántas personas interactúan con esos links y recompensar a quien los comparte.

### 5.2. Tokens de rastreo

- Cada vez que un usuario comparte un link (rifa, sala de juego, landing, tienda, etc.),
  el sistema genera un **token de rastreo** único.
- El link compartido incluye ese token (ej. `?ref=TOKENXYZ`).
- Conceptualmente se registran dos niveles:
  - **Toques al link**: cuántas veces se abrió el enlace.
  - **Activaciones**: cuántos usuarios se loguearon/registraron y realizaron alguna acción después de entrar por ese enlace.

### 5.3. Puntos de participación

- Cada toque/activación suma **puntos de participación** al usuario dueño del token.
- Estos puntos no son monedas; sirven para:
  - Aumentar la **probabilidad de ganar premios** en sorteos especiales.
  - Desbloquear logros o niveles dentro del sistema de roles.
- Idea conceptual de ponderación (ajustable):
  - 1 punto por cada toque único.
  - Puntos extra si el referido se registra, juega, compra o crea rifas.

### 5.4. Transparencia y paneles

- Panel para el usuario que comparte:
  - Lista de links activos y su token.
  - Toques, activaciones y puntos generados por cada link.
- A nivel de plataforma:
  - Métricas agregadas de referidos para campañas de crecimiento.

---

## 6. Ideas futuras de roles (borrador)

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

## 7. Próximos pasos

1. **Validar contigo las ideas de Patrocinante y Líder de Comunidad** (porcentajes, condiciones, límites).
2. Definir qué acciones exactas generan el 3% + 1% (solo retiros y envíos, o también compras de rifas / juegos).
3. Diseñar el **modelo económico detallado** para asegurar que todo es sostenible.
4. Pasar a diseño técnico:
   - Campos nuevos en base de datos (roles, comunidades, potes, historiales).
   - Lógica en backend para registrar operaciones y distribuir comisiones.
   - Interfaces en frontend (paneles de líder, paneles de miembro, estadísticas).

Este archivo se irá ampliando con todas las nuevas ideas de roles y beneficios que vayas proponiendo, siempre manteniendo la coherencia con la economía de MundoXYZ.

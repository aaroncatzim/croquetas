# Mascotlan POS 🐾

Punto de venta para tienda de mascotas. HTML + CSS + JavaScript vanilla,
empaquetado como app de escritorio para macOS con Electron.

## Cómo usarlo

- **App de escritorio**: abre `dist/Mascotlan POS-darwin-arm64/Mascotlan POS.app`
  (puedes arrastrarla a Aplicaciones). Para regenerarla: `npm run dist`.
- **Navegador**: abre `index.html` directamente — sin servidor ni instalación.
- **Web (GitHub Pages)**: <https://aaroncatzim.github.io/croquetas/> — los datos
  se guardan en el navegador; el catálogo se sincroniza vía Supabase.
- **Catálogo público para clientes**:
  <https://aaroncatzim.github.io/croquetas/catalogo.html> — sin login; muestra
  los productos y los botones de contacto (WhatsApp, teléfono, Facebook e
  Instagram). El contacto se edita en el **Panel del dueño** y los productos
  salen de Supabase, así que siempre está actualizado.
- **Desarrollo**: `npm start` lanza la app de escritorio sin empaquetar.

Verificación automática del flujo completo (41 pruebas):
`index.html?smoke=1` en el navegador, o `npm run smoke` en Electron.

## Dónde se guardan los datos

En la app de escritorio todo se guarda en archivos JSON:

| Archivo | Contenido |
|---|---|
| `productos.json` | catálogo e inventario |
| `ventas/ventas-AAAA-MM-DD.json` | ventas del día — **un archivo nuevo por día** |
| `config.json` | folio consecutivo y contacto del negocio |
| `supabase.json` | conexión opcional a Supabase |

Carpeta de datos: `~/Documents/Mascotlan POS` (app empaquetada) o `data/` en el
proyecto (desarrollo). La ruta aparece al pie de la pantalla de Inventario.
En navegador se usa `localStorage` (clave `mascotlan-pos-v1`, una entrada de
ventas por día).

## Pantallas

- **Login** — sin Supabase: dos cuentas locales (*Aarón · Dueño* con acceso
  completo y *Mostrador 1 · Cajero*). Con Supabase configurado: correo y
  contraseña.
- **Cobrar** — catálogo con búsqueda y filtros, venta por pieza y a granel,
  pago en efectivo con montos rápidos y cambio. El buscador acepta lector de
  código de barras (dígitos + Enter).
- **Inventario** — estado de stock, indicadores y (solo dueño) alta, edición
  y borrado de productos con confirmación; validación visible y decimales con
  coma. Borrar un producto no altera las ventas ya cobradas. Cada producto
  puede tener **foto** (se recorta y comprime a miniatura automáticamente) y
  se muestra en el catálogo de cobro, el ticket, el inventario y el panel.
- **Ventas** — tickets del día con hora, artículos y quién cobró. Botón
  **Revertir** con confirmación: el stock regresa al inventario y la venta se
  descuenta del corte (queda marcada como revertida, no se borra).
- **Panel del dueño** — todo con **datos reales**: KPIs del día, comparación
  contra ayer, gráfica de los últimos 7 días (leída de los archivos de
  ventas), corte de caja y productos más vendidos de hoy. También se editan
  ahí los **datos de contacto** que muestra el catálogo público.
- **Catálogo público** (`catalogo.html`) — página para clientes, sin login:
  productos con foto, precio y disponibilidad (vista `catalogo` de Supabase,
  sin stock exacto ni códigos), búsqueda, filtro por categoría y botones de
  contacto del negocio (tabla `negocio`).
- **Ticket** — recibo al cobrar, envío por WhatsApp y descarga en PDF.

## Supabase (opcional)

Con Supabase el login es con usuarios reales y el catálogo de productos se
sincroniza en la nube (varias cajas comparten inventario):

1. Crea un proyecto en [supabase.com](https://supabase.com) y ejecuta
   `supabase-schema.sql` en el SQL Editor.
2. Crea los usuarios en Authentication → Users e inserta su fila en la tabla
   `perfiles` (rol `dueno` o `cajero`) — las instrucciones están en el mismo
   archivo SQL.
3. Copia la URL del proyecto y la llave *anon public* (Settings → API) en:
   - escritorio: `supabase.json` en la carpeta de datos,
   - navegador: `supabase-config.js`.

Sin conexión la app sigue funcionando con el catálogo local y avisa con un
banner. Las ventas del día siempre se guardan en los archivos locales.

## Estructura del código

El código vive en `js/`, un módulo por tema (se cargan en orden desde
`index.html`, sin build):

| Archivo | Contenido |
|---|---|
| `js/config.js` | configuración, categorías (`CATS`) y catálogo inicial |
| `js/helpers.js` | fechas, formato de dinero, cálculos del carrito, imágenes |
| `js/state.js` | el objeto `state` con todo el estado de la app |
| `js/icons.js` | iconos SVG |
| `js/supabase.js` | cliente de Supabase (login y catálogo) |
| `js/store.js` | guardado en archivos / localStorage y sincronización |
| `js/views.js` | HTML de cada pantalla y modal |
| `js/actions.js` | lógica de negocio: cobrar, revertir, productos, login |
| `js/main.js` | render, eventos globales y arranque |
| `js/catalogo.js` | página pública de catálogo (`catalogo.html`) |
| `js/smoke.js` | auto-prueba del flujo completo |

`electron-main.js` y `preload.js` son el proceso principal de Electron
(ventana + lectura/escritura de archivos).

## Configuración rápida

`js/config.js` → `CONFIG`: nombre de la marca, pantalla inicial, umbral de
stock bajo y fondo de caja para el corte (`cashFund`). Las categorías de
producto se editan en el mismo archivo (`CATS`).

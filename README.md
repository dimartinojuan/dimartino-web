# Di Martino Propiedades

Web basada en el diseño original `dimartino_v2.html`, con fichas HTML generadas para GitHub Pages y buscador interactivo. El sitio no requiere un servidor de aplicación ni credenciales en el navegador.

## Desarrollo

Requiere Node.js 20 o superior (producción: Node.js 22).

1. `npm ci --ignore-scripts`
2. `npm run build`
3. `npm test`
4. `npm run preview`

La compilación sin credenciales usa el último catálogo público normalizado de `data/catalog.json`. Con `TOKKO_API_KEY` en el entorno actualiza el catálogo completo antes de generar. Nunca poner el valor en archivos versionados.

## Publicación y actualización

GitHub Pages usa GitHub Actions. El workflow publica al actualizar `master`, manualmente y aproximadamente cada seis horas. `TOKKO_API_KEY` debe estar en Settings → Secrets and variables → Actions. Los cambios de Tokko se ven después de un despliegue correcto. Una falla al descargar o validar el catálogo cancela la publicación y mantiene la versión anterior.

El snapshot público solo contiene campos elegidos para la web. No incluye notas internas, dirección real separada, datos de sucursal ni datos privados del responsable. La integración se concentra en `scripts/build.mjs`; un futuro proveedor puede entregar el mismo contrato público sin modificar buscador ni diseño.

## Estructura

- `src/template.html`: estructura y estilos de referencia del diseño original, sin credenciales.
- `src/search.js`: interpretación natural, selección de operaciones y filtrado, compartidos entre generación y navegador.
- `src/overrides.js`: mejoras funcionales y accesibles conservando las galerías originales.
- `src/upgrades.css`: ajustes visuales y móviles.
- `scripts/build.mjs`: normalización, renderizado estático, metadatos, sitemap y catálogo.
- `dist/`: salida publicable; no editar manualmente.
- `tests/`: regresiones de búsqueda, precios, enlaces y HTML indexable.

## SEO

Cada propiedad tiene URL persistente, título, descripción, canonical, imagen Open Graph/Twitter, JSON-LD y fotos en el HTML inicial. El sitemap incluye páginas de categoría, paginación y fotos. Los enlaces antiguos `dimartino_v2.html?prop=ID` resuelven al nuevo enlace mediante un mapa local, sin consultar Tokko.

En Search Console se debe verificar la propiedad de prefijo `https://dimartinojuan.github.io/dimartino-web/` y enviar `sitemap.xml`. Google decide cuándo indexar y qué imagen o miniatura mostrar. El archivo robots del proyecto no sustituye al robots del origen `dimartinojuan.github.io`, que GitHub sirve desde la raíz del dominio.

## Consultas

Los formularios validan los datos y abren un mensaje dirigido a WhatsApp de la inmobiliaria. El visitante confirma el envío allí. No se anuncia un envío de email que no haya ocurrido. La futura integración de recepción por email o CRM requiere configurar su servicio de entrega.

## Recuperación

El diseño anterior y el historial permanecen en Git. Para volver a una versión anterior, revertir el commit correspondiente y ejecutar el workflow. No es necesario reescribir el historial.

La credencial que aparecía en versiones históricas del repositorio debe rotarse en Tokko y actualizarse en el secreto de GitHub; eliminarla del archivo actual no la elimina de Git.

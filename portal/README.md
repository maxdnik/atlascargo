# Atlas Cargo · Centro de operaciones

Demostración interactiva desarrollada el 30/10/2026 a partir de la referencia visual de Atlas Cargo y la revisión del ERP existente en este repositorio. Conserva el ERP Next.js/Prisma sin migrar ni modificar su base SQLite.

## Ejecutar

```sh
cd portal
npm ci
npm test
npm run build
```

Servir `dist/` como sitio estático. En Vercel: root directory `portal`, framework Other, build `npm run build`, output `dist`, Node 22.

## Alcance verificado

- Panel y navegación responsive con identidad Atlas Cargo.
- Creación y edición de expedientes de importación/exportación, filtros y búsqueda.
- Estados de transporte separados de estado aduanero, canal y liberación.
- Secuencias distintas: exportación requiere liberación de origen antes de salida internacional.
- ETD/ETA estimadas independientes de ATD/ATA reales; validación de fechas.
- Cut-off de terminal, VGM y shipping instructions; vencimientos de contenedor y terminal separados.
- Checklist documental por modalidad y dirección; recibido y verificado son estados distintos.
- Archivos de prueba de hasta 5 MB en IndexedDB, descarga y actualización manual del estado.
- Tareas, cotizaciones convertibles a embarques y costos estimados en USD.
- Exportación CSV con protección contra fórmulas y respaldo JSON de metadatos.
- Historial local, validación del dígito verificador de CUIT y comprobaciones de Incoterm/modalidad al crear un embarque.

## Límite explícito de esta publicación

Es una **demo**, no el ERP de producción. Usa datos ficticios, fecha de referencia fija 30/10/2026, localStorage para metadatos e IndexedDB para archivos. No sincroniza entre usuarios o dispositivos. La barra superior, pie, configuración y formularios indican este alcance. No tiene login propio, integración ARCA/SIM, tracking automático, envío de correos ni liquidación tributaria. Los estados verificados iniciales son ilustrativos y no contienen archivos.

La creación de un proyecto Neon separado fue rechazada por el proveedor: la organización está administrada por Vercel. No se reutilizó la base de DePerritos ni se conectó una base ajena. La conexión y el aprovisionamiento del almacenamiento de producción quedan pendientes.

## Usuarios y permisos de demostración · 31/10/2026

La barra **Vista demo** presenta Administrador, Freight Forwarder y Cliente. El selector secundario elige un usuario de ejemplo. **No es un login ni una barrera de seguridad de producción.** Los perfiles, permisos, operaciones y archivos continúan en localStorage/IndexedDB. No se envían invitaciones, no se piden contraseñas y los datos no se sincronizan entre navegadores.

- **Administrador:** alta, edición y desactivación de usuarios; empresa asociada; permisos por módulo; registro de facturas ya emitidas. Se validan emails duplicados, empresa existente y conservación de un administrador activo.
- **Freight Forwarder:** únicamente Operaciones, Documentación y Facturas emitidas. Operaciones/documentos admiten Sin acceso, Consulta o Gestión. Facturas admiten Sin acceso o Consulta. No se muestran cotizaciones, costos, márgenes, tareas, clientes ni administración. El detalle y las acciones se ajustan a los permisos, con comprobación adicional en la función de actualización.
- **Cliente:** un solo perfil para importaciones y exportaciones de la misma empresa, vinculadas por `customerId`, nunca por nombre. Filtros visibles Todos / Importación / Exportación. Sólo consulta y descarga de documentación publicada, y consulta de facturas compartidas de su empresa; no puede modificar operaciones ni crear usuarios.
- **Facturas emitidas:** separadas de la factura comercial del checklist. El administrador registra un comprobante ya emitido, su embarque, fecha, moneda, importe, PDF opcional y visibilidad. El registro no emite comprobantes fiscales ni conecta ARCA. Los borradores no aparecen en la consulta y la descarga vuelve a comprobar los permisos y la empresa.
- La migración es aditiva: mantiene operaciones, adjuntos, perfiles editados, estados y asociaciones. `?vista=importador` y `?vista=exportador` se conservan como aliases de los dos clientes de ejemplo; la UI no tiene esos perfiles. Nuevas URLs usan `?vista=cliente`, `?vista=ff` o `?vista=admin`, con `perfil` opcional.

El portal de clientes recibe una proyección explícita de datos públicos. La vista FF excluye costos, historial financiero y campos privados no declarados. Estas proyecciones mejoran la separación del prototipo, **no protegen los datos ficticios del bundle ni del almacenamiento local**. El selector puede volver al administrador en la demo.

Los archivos nuevos o reemplazados quedan internos hasta compartirlos expresamente. La migración no publica adjuntos anteriores. Las descargas de clientes comprueban empresa, embarque y publicación.

Para habilitar usuarios reales, el servidor debe autenticar la sesión, derivar rol/permisos/customerId desde la base y aplicar las mismas restricciones en cada lectura, modificación y descarga privada. Eliminar el selector en esa versión, conectar almacenamiento privado y probar revocación, sesiones, concurrencia y recuperación de cuentas.

### Infraestructura pendiente

La publicación Vercel `atlas-cargo-operaciones` no tiene variables de entorno de base o autenticación configuradas. El 31/10/2026 el conector Vercel rechazó la consulta de integraciones con HTTP 403. No hay CLI Vercel autenticada disponible en este entorno. Neon sólo expone `deperritos-production`; no se reutilizó esa base de otro proyecto. El aprovisionamiento anterior de una base independiente también fue rechazado por tratarse de una organización administrada por Vercel.

### Verificación de perfiles

`profiles.test.mjs` verifica permisos máximos por rol, sólo consulta, usuarios inactivos, aislamiento entre empresas incluyendo ambos sentidos de operación, rechazo de cambios financieros desde FF, alta exclusiva de administradores, email único, protección del último administrador, migración y alcance de facturas. La revisión de navegador comprueba altas, permisos de consulta, creación de una exportación para un cliente con importaciones y visibilidad de facturas por empresa. Los registros QA sólo existen en la vista previa del navegador.

## Correspondencia con el ERP revisado

| Portal | Modelo existente | Trabajo pendiente para producción |
|---|---|---|
| Expediente | Shipment | Persistir con permisos y companyId del servidor |
| Cliente / CUIT | Customer | Validación y relación real de cliente |
| Transporte y fechas | Shipment / ShipmentMilestone | Integrar hitos con fechas confirmadas |
| Registro aduanero | Campos nuevos relacionados con Shipment | Destinación, canal, NCM, liberación y auditoría |
| Documentación | ShipmentDocument | Almacenamiento privado durable y permisos de descarga |
| Tareas | Task | Asignaciones a User, notificaciones y vencimientos reales |
| Cotizaciones | Quote / QuoteCharge | Conversión transaccional a Shipment |
| Costos | ShipmentCost / Revenue / Expense | Moneda, tipo de cambio, impuestos y conciliación |

Antes de habilitar operaciones reales: provisionar una base exclusiva desde Vercel, migrar con respaldo y compatibilidad de Prisma, conectar los endpoints autenticados existentes, eliminar el login/seed con credenciales de muestra, aplicar permisos por empresa/rol en servidor, almacenar documentos en un servicio privado y probar concurrencia, recuperación y auditoría. El portal **no** presenta roles visuales como controles de autorización.

## Criterios operativos

Las fechas de días libres son contractuales, no plazos legales universales. El canal verde no implica automáticamente liberación. La clasificación NCM, las intervenciones, los documentos condicionales y los tributos requieren validación por mercadería y régimen. No se calcula una tasa aduanera genérica.

Fuentes oficiales consultadas el 30/10/2026:

- https://serviciosweb.afip.gob.ar/genericos/guiadetramites/VerGuia.aspx?tr=59
- https://www.argentina.gob.ar/node/41412
- https://www.argentina.gob.ar/normativa/nacional/norma-164919/texto

## Validación

`npm test` prueba secuencia de importación/exportación, bloqueos de transición sin liberación/arribo, plazos, cierre independiente de almacenaje y devolución de vacío, documentos por modalidad, CSV y CUIT. La revisión visual y de interacción usa la vista previa de Sites.


## Rediseño UX/UI y referencias de transporte · 30/10/2026

- Tarjetas como vista inicial, lista opcional, filtros por estado/dirección/modalidad y búsqueda tolerante a acentos por booking, master, house, contenedor o referencia del cliente. Exportación CSV de la vista filtrada para Atlas.
- Booking separado de MBL/HBL marítimos, MAWB/AWB y HAWB aéreos y CRT terrestre. Números editables en creación/detalle, copiables y consultables en el portal de clientes.
- Expediente agrupado en Resumen, Seguimiento, Aduana, Documentos, Costos y Actividad para Atlas; el cliente conserva sólo Resumen, Seguimiento y Documentos.
- Documentos en tarjetas con número, estado, archivo y visibilidad; carga global pide primero el embarque. Documentos master y house separados. House es condicional, no un requisito universal.
- Formularios por modalidad, plazos secundarios desplegables, tipografía y contraste mayores, botones accesibles, tarjetas móviles sin desplazamiento horizontal y guía de siglas para clientes.
- Migración aditiva: conserva IDs, números existentes (incluso vacíos intencionales), decisiones de publicación y adjuntos anteriores. No reclasifica automáticamente un BL/AWB anterior como master o house; agrega nuevas categorías internas pendientes. Los valores iniciales con prefijo DEMO son ficticios.

Se revisaron páginas oficiales públicas; los patrones se adaptaron a Atlas, sin reproducir software ni prometer integraciones de proveedores:

| Referencia | Criterio adaptado |
|---|---|
| [GoFreight · List views](https://gofreight.com/knowledge/how-to-use-list-views-in-gofreight) y [Doc Center](https://gofreight.com/knowledge/how-to-manage-shipment-documents) | Separación master/house, filtros y centro documental |
| [CargoWise Neo](https://www.cargowise.com/solutions/cargowise-neo/) | Seguimiento por embarque y filtros orientados al usuario |
| [Magaya Digital Freight Portal](https://www.magaya.com/digital-freight-portal/) | Información y documentos reunidos en el portal de clientes |
| [Logixboard Portal](https://www.logixboard.com/products/portal) | Hitos y detalle de operación consultables en un solo lugar |

Validación adicional: 18 pruebas de dominio/proyección/migración/búsqueda aprobadas, build estático, búsqueda HBL, cambio tarjetas/lista, copia de número, edición y persistencia de booking/MAWB/HAWB, revisión visual de portal, documentos y ancho móvil de 390 px. No se modificó el esquema del ERP ni se habilitó autenticación real.

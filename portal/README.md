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
- Estados de transporte separados de estado aduanero, canal y libramiento.
- Secuencias distintas: exportación requiere libramiento de origen antes de salida internacional.
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

## Correspondencia con el ERP revisado

| Portal | Modelo existente | Trabajo pendiente para producción |
|---|---|---|
| Expediente | Shipment | Persistir con permisos y companyId del servidor |
| Cliente / CUIT | Customer | Validación y relación real de cliente |
| Transporte y fechas | Shipment / ShipmentMilestone | Integrar hitos con fechas confirmadas |
| Registro aduanero | Campos nuevos relacionados con Shipment | Destinación, canal, NCM, libramiento y auditoría |
| Documentación | ShipmentDocument | Almacenamiento privado durable y permisos de descarga |
| Tareas | Task | Asignaciones a User, notificaciones y vencimientos reales |
| Cotizaciones | Quote / QuoteCharge | Conversión transaccional a Shipment |
| Costos | ShipmentCost / Revenue / Expense | Moneda, tipo de cambio, impuestos y conciliación |

Antes de habilitar operaciones reales: provisionar una base exclusiva desde Vercel, migrar con respaldo y compatibilidad de Prisma, conectar los endpoints autenticados existentes, eliminar el login/seed con credenciales de muestra, aplicar permisos por empresa/rol en servidor, almacenar documentos en un servicio privado y probar concurrencia, recuperación y auditoría. El portal **no** presenta roles visuales como controles de autorización.

## Criterios operativos

Las fechas de días libres son contractuales, no plazos legales universales. El canal verde no implica automáticamente libramiento. La clasificación NCM, las intervenciones, los documentos condicionales y los tributos requieren validación por mercadería y régimen. No se calcula una tasa aduanera genérica.

Fuentes oficiales consultadas el 30/10/2026:

- https://serviciosweb.afip.gob.ar/genericos/guiadetramites/VerGuia.aspx?tr=59
- https://www.argentina.gob.ar/node/41412
- https://www.argentina.gob.ar/normativa/nacional/norma-164919/texto

## Validación

`npm test` prueba secuencia de importación/exportación, bloqueos de transición sin libramiento/arribo, plazos, cierre independiente de almacenaje y devolución de vacío, documentos por modalidad, CSV y CUIT. La revisión visual y de interacción usa la vista previa de Sites.

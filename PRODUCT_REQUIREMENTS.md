# Freight Forwarding Management Platform (FFMP)

## 1) Visión del producto

Construir una plataforma integral para operadores freight forwarder que unifique **comercial + operaciones + documentación + finanzas + reporting + tracking** en una sola fuente de verdad, con trazabilidad total de cada embarque (shipment/file) y control de rentabilidad por operación.

El sistema está orientado a equipos reales de forwarding:
- Sales / Pricing
- Operaciones
- Customer service
- Administración y finanzas
- Gerencia
- Cliente externo (portal)

## 2) Objetivos de negocio

1. Reducir tiempos de ciclo desde cotización a cierre de operación.
2. Aumentar visibilidad de estado operativo por hitos.
3. Garantizar control de márgenes y desvíos por shipment.
4. Disminuir errores documentales y retrabajo.
5. Centralizar información comercial, operativa y financiera.
6. Proveer reporting gerencial accionable y exportable.

## 3) Alcance funcional (módulos y submódulos)

### A. Dashboard Ejecutivo
- KPIs operativos: operaciones abiertas, demoradas, próximos ETD/ETA.
- KPIs comerciales: cotizaciones enviadas, win rate, pipeline.
- KPIs financieros: ingresos, egresos, margen estimado, CxC/CxP.
- Alertas: tareas vencidas, hitos críticos atrasados, documentos faltantes.

### B. CRM / Comercial
- Prospectos, clientes, contactos.
- Oportunidades por pipeline (stages configurables).
- Actividades (llamadas, emails, reuniones), tareas y recordatorios.
- Conversión prospecto → cliente.
- Vinculación de oportunidad con cotizaciones y shipments.

### C. Cotizaciones / Pricing
- Cotización por modo (air/ocean/road/special) y dirección (import/export).
- Carga de costos de compra, recargos, márgenes y moneda.
- Versionado de cotizaciones.
- Flujo de estado: draft, sent, approved, rejected, expired.
- Conversión de cotización aprobada en shipment.

### D. Operaciones (Core Shipment)
- Apertura manual o desde quote.
- Datos operativos: shipper, consignee, notify, agent origen/destino, carrier.
- Tráfico: POL/POD, aeropuerto origen/destino, ETD/ETA/ATD/ATA.
- Datos de carga: bultos, peso, volumen, contenedores, commodity.
- House/Master refs (HBL/MBL/HAWB/MAWB).
- Responsables internos, observaciones y tareas operativas.

### E. Hitos / Workflow
- Timeline por shipment con fecha esperada y real.
- Plantillas por tipo de operación (air import, ocean export, etc.).
- Alertas por vencimiento de hitos críticos.
- Estados: pending, in_progress, completed, delayed, cancelled.

### F. Gestión Documental
- Centro documental por shipment.
- Tipos: invoice, packing list, BL/AWB, certificados, permisos, POD.
- Metadata + versionado + comentarios + control de faltantes.
- Preparado para storage desacoplado (S3/R2).

### G. Administración y Finanzas
- Ingresos y egresos imputables a shipment.
- CxC clientes y CxP proveedores.
- Vencimientos, pagos y cobranzas.
- Facturas de venta/compra, notas de crédito (fase evolutiva).
- Multimoneda (USD/EUR/ARS) + tipo de cambio.
- Rentabilidad estimada/real por operación.

### H. Reportes
- Rentabilidad por shipment y cliente.
- Ventas por ejecutivo, win/loss quotes.
- Aging CxC/CxP.
- Tráfico por modo y estado.
- Demoras operativas.
- Exportable a CSV/XLSX (fase inicial CSV).

### I. Configuración y Seguridad
- Empresas, sucursales, usuarios, roles y permisos.
- Catálogos maestros: incoterms, monedas, tipos de documento, estados.
- Acceso por sucursal y visibilidad financiera por rol.
- Auditoría de acciones críticas.

### J. Portal Cliente (fase posterior)
- Tracking externo de shipments.
- Hitos y documentos publicados.
- Referencias, ETD/ETA y observaciones.
- Notificaciones de eventos relevantes.

## 4) Tipos de usuario y permisos

### Roles base
- **Super Admin**: administración global.
- **Director/Gerencia**: acceso transversal y KPIs de negocio.
- **Sales Executive**: CRM, quotes, clientes, shipments de su cartera.
- **Pricing**: costos/tarifas, cotizaciones, aprobaciones de pricing.
- **Operations**: gestión operativa completa de shipments e hitos.
- **Customer Service**: seguimiento, comunicación y documentación.
- **Admin/Finance**: ingresos/egresos, CxC/CxP, pagos/cobranzas.
- **Branch User**: visibilidad restringida por sucursal.
- **Customer Portal User**: acceso solo a sus operaciones publicadas.

### Política de acceso
- RBAC + restricciones por sucursal.
- Permisos de acción: `read/create/update/delete/approve/view_margin/view_finance`.
- Regla crítica: finanzas y margen no visibles para todos los perfiles.

## 5) Entidades principales y relaciones (alto nivel)

- `Company` 1..n `Branch`
- `Branch` 1..n `UserBranchAccess`
- `User` n..m `Role` (simplificado inicialmente como rol principal + permisos derivados)
- `Customer` 1..n `Contact`, 1..n `Quote`, 1..n `Shipment`
- `Quote` 1..n `QuoteItem` / `QuoteCharge`, 0..1 `Shipment`
- `Shipment` 1..n `ShipmentLeg`, 1..n `ShipmentMilestone`, 1..n `ShipmentDocument`
- `Shipment` 1..n `Revenue`, 1..n `Expense`
- `Shipment` n..m `Party` (shipper/consignee/notify/agent)
- `Shipment` 1..n `Task`, 1..n `Note`, 1..n `ActivityLog`

## 6) Flujos clave entre áreas

1. **Comercial**
   - Prospect → oportunidad → quote → envío al cliente.
2. **Pre-operativo**
   - Quote approved → create shipment/file → asignación responsable.
3. **Operación**
   - Carga datos de tráfico + hitos + documentación + incidencias.
4. **Finanzas**
   - Registro de revenue/expense + imputación shipment + seguimiento CxC/CxP.
5. **Cierre**
   - Entrega final + facturación emitida + margen final + cierre operativo.

## 7) Reglas de negocio críticas

1. Solo `Quote` en estado `APPROVED` puede generar shipment automáticamente.
2. `Shipment` no puede cerrarse si tiene hitos críticos pendientes.
3. Cada `Revenue/Expense` debe estar vinculado a moneda y fecha contable.
4. Rentabilidad por shipment = sum(revenues base) - sum(expenses base).
5. Documentos obligatorios dependen de tipo de tráfico/modo.
6. Toda acción crítica genera `ActivityLog` (quién, qué, cuándo).
7. Acceso a operación puede limitarse por sucursal y cartera.
8. ETD/ETA/ATD/ATA deben mantener consistencia cronológica.

## 8) KPI funcionales iniciales

- Open shipments
- Delayed milestones
- Quotes sent (30 días)
- Quote win rate
- Monthly revenue/expense
- Estimated gross margin
- Overdue tasks
- Documents pending by shipment

## 9) Requisitos no funcionales

- Arquitectura modular y escalable.
- Tipado fuerte end-to-end (TypeScript).
- Validaciones robustas (Zod + reglas backend).
- Auditoría y trazabilidad.
- Rendimiento en tablas grandes (paginación/filtrado server-side).
- Seguridad enterprise (sessions seguras, RBAC, sanitización).

## 10) Roadmap de producto (resumen)

- **Fase 1 (MVP operativo):** auth, customers, quotes, shipments, milestones, docs metadata, dashboard.
- **Fase 2 (finanzas):** revenue/expense avanzado, facturación, CxC/CxP, rentabilidad consolidada.
- **Fase 3 (CRM+BI):** pipeline avanzado, forecast, dashboards ejecutivos, automatizaciones.
- **Fase 4 (portal cliente):** tracking externo, documentos publicados, notificaciones.

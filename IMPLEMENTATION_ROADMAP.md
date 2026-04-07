# Implementation Roadmap

## Principios

- Entregas incrementales por dominio.
- Cada incremento deja una vertical usable (UI + lógica + datos).
- Evitar big-bang: priorizar trazabilidad y control operativo primero.

## Fase 1 - MVP Operativo (implementación inicial de este repositorio)

### Objetivo
Tener una base funcional interna para operar clientes, cotizar y abrir/gestionar shipments.

### Incluye
1. Foundation
   - Next.js App Router + TypeScript + Tailwind + Prisma
   - Auth.js con credenciales
   - Layout dashboard + navegación
   - RBAC básico por rol

2. Master Data Core
   - Customers CRUD
   - Contacts básicos por customer
   - Ports/Airports/Currencies seeded

3. Quotes Core
   - Quotes CRUD
   - Quote items/cargos básicos
   - Estados + conversión a shipment

4. Shipment Core
   - Shipments CRUD
   - Milestones básicos
   - Document metadata básicos

5. Dashboard MVP
   - KPIs principales (open shipments, delayed milestones, quotes sent, margin estimada)

6. Activity Log MVP
   - Registro de acciones create/update/delete/convert

## Fase 2 - Administración y Finanzas

### Objetivo
Control financiero operativo por shipment y visibilidad CxC/CxP.

### Incluye
- Revenues y Expenses ampliados.
- Invoices y Payments base.
- Aging simple.
- Rentabilidad real por shipment.
- Cash flow básico.
- Cierre operativo condicionado por estado financiero.

## Fase 3 - CRM + BI + Automatizaciones

### Objetivo
Optimizar ventas y toma de decisión.

### Incluye
- Pipeline comercial avanzado.
- Forecast comercial.
- Dashboards analíticos por perfil.
- Notificaciones por reglas.
- Automatizaciones de hitos/documentos.

## Fase 4 - Portal Cliente + Tracking externo

### Objetivo
Dar visibilidad al cliente final sin fricción operativa.

### Incluye
- Portal externo con acceso por customer.
- Tracking live de hitos.
- Descarga documental publicada.
- Notificaciones por email/webhook.

## Dependencias técnicas por fase

- Fase 1 -> requiere base de auth + esquema datos core.
- Fase 2 -> depende de shipments y activity log consolidados.
- Fase 3 -> depende de data quality en quotes/shipments/finance.
- Fase 4 -> depende de seguridad externa + política documental.

## Criterios de salida por fase

- Fase 1: operador puede crear cliente, cotizar, abrir shipment, seguir hitos y ver KPI.
- Fase 2: administración puede imputar ingresos/egresos y ver margen por operación.
- Fase 3: dirección comercial y gerencia tienen forecast y BI confiables.
- Fase 4: cliente externo puede autogestionar tracking y documentos publicados.

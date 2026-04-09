# UX/UI Plan - Freight Forwarding Management Platform

## 1) Principios de diseño

- **Operational clarity first:** información crítica visible sin navegar en exceso.
- **Speed to action:** acciones frecuentes en 1-2 clics (crear shipment, registrar hito, cargar documento).
- **Contextual detail:** vistas detalle con timeline y panel financiero contextual.
- **Consistency:** estados y badges uniformes en todos los módulos.
- **Role-aware UI:** mostrar/ocultar módulos y columnas según permisos.

## 2) Layout base

### Estructura global
- **Sidebar izquierda fija**
  - Dashboard
  - CRM
  - Customers
  - Quotations
  - Shipments
  - Finance
  - Reports
  - Settings
- **Topbar**
  - Búsqueda global
  - Selector de sucursal
  - Quick actions (nuevo shipment, nueva quote, nuevo cliente)
  - Notificaciones
  - Menú usuario
- **Área contenido**
  - Breadcrumbs
  - Título + acciones
  - Filtros
  - Contenido principal (tabla/cards/form/detail)

## 3) Sitemap interno (MVP + preparación)

- `/login`
- `/dashboard`
- `/customers`
- `/customers/[id]`
- `/quotes`
- `/quotes/[id]`
- `/shipments`
- `/shipments/[id]`
- `/finance`
- `/settings/users`
- `/settings/roles`

## 4) Wireframes textuales

## 4.1 Login

```
+------------------------------------------------------+
| AtlasCargo                                           |
| Freight Forwarding Platform                          |
|                                                      |
|  Email                                               |
|  [____________________________]                      |
|  Password                                            |
|  [____________________________]                      |
|                                                      |
|  [ Sign in ]                                         |
|                                                      |
|  Secure access with role-based permissions           |
+------------------------------------------------------+
```

## 4.2 Dashboard

```
Topbar: [Search...] [Quick +] [Notifications] [User]
Sidebar: Dashboard | CRM | Customers | Quotes | Shipments | ...

KPI Row:
[Open Shipments] [Delayed] [Quotes Sent] [Win Rate]
[Revenue MTD] [Expense MTD] [Gross Margin] [Overdue Tasks]

Row 2:
[Shipments by Status (bar)] [Revenue vs Expense (line)]

Row 3:
[Upcoming ETAs table] [Critical Alerts panel]
```

## 4.3 Listado de Shipments

```
Header: Shipments            [New Shipment]
Filters: Mode | Type | Status | Branch | Customer | ETA range | Search ref

Table:
| Ref | Customer | Mode | Type | ETD | ETA | Status | Responsible | Margin* |
| ... |

Right Drawer (on row click quick preview):
- parties
- latest milestones
- pending docs
- quick actions
```

## 4.4 Detalle de Shipment

```
Header: SHP-2026-00124 (Ocean Export) [Edit] [Add Milestone] [Upload Doc]

Tabs:
[Overview] [Timeline] [Documents] [Financials] [Tasks] [Activity]

Overview:
- Parties card (shipper/consignee/notify)
- Routing card (POL/POD, ETD/ETA/ATD/ATA)
- Cargo card (packages/weight/volume/container)
- Ops notes

Timeline:
- Vertical milestones with expected/actual dates and delay flags

Documents:
- Doc table (type, version, status, uploadedBy, date)

Financials:
- Revenue list
- Expense list
- Estimated margin widget
```

## 4.5 Cotizaciones (list + detail)

```
List:
| Quote # | Customer | Mode | Direction | Total Sell | Status | Valid Until | Owner |

Detail:
Sections:
- Header: status + version + actions
- Parties and routing
- Charges grid: cost / sell / margin / currency
- Terms and notes
- Version history
```

## 4.6 CRM (pipeline)

```
Pipeline board:
[Lead] [Qualified] [Quoted] [Negotiation] [Won] [Lost]
Cards show:
- company
- expected revenue
- owner
- next activity date

Side panel on card click:
- contacts
- notes
- linked quotes
- tasks
```

## 4.7 Administración / Finanzas (MVP vista)

```
Summary Cards: AR Open | AP Open | Cash In MTD | Cash Out MTD

Tabs:
- Revenues
- Expenses

Tables include:
shipment ref, counterparty, amount, currency, due date, status
```

## 5) Patrones UI críticos

- **Badges estándar de estado**: draft/sent/approved, open/in_transit/delivered, paid/overdue.
- **Filtros persistentes por módulo** usando query params.
- **Acciones rápidas contextuales** en listados y detalle.
- **Timeline estandarizada** para hitos.
- **Tablas grandes** con paginación, orden y filtros server-side.
- **Formularios complejos** divididos por secciones y validación inline.
- **Estados de interfaz**: loading skeleton + empty state + error state con acción.

## 6) Tokens visuales (base)

- Tipografía sans moderna, jerarquía fuerte.
- Escala de grises sobria + color semántico por estado.
- Densidad media para backoffice operativo.
- Componentes shadcn como base: Table, Badge, Card, Tabs, Dialog, Drawer.


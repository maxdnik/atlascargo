# Technical Architecture - Freight Forwarding Management Platform

## 1) Architectural principles

1. **Domain-driven modularity**: funcionalidades agrupadas por dominio (`customers`, `quotes`, `shipments`, `finance`, etc).
2. **Type-safe end-to-end**: TypeScript estricto en frontend, backend y capa de datos.
3. **Server-first data mutations**: Server Actions + Route Handlers para seguridad y rendimiento.
4. **Security by default**: autenticación fuerte, autorización RBAC y auditoría.
5. **Scalable data access**: Prisma + PostgreSQL con índices y constraints de negocio.
6. **Internal-company first**: priorizar velocidad operativa para una empresa real; mantener soporte de sucursales sin complejidad SaaS innecesaria.

## 1.1) Scope decision (updated)

- Este sistema se implementa como **OS interno de una sola empresa forwarder**.
- Se mantiene `companyId` por coherencia de modelo y trazabilidad, pero sin construir aislamiento multi-tenant complejo.
- Se priorizan flujos diarios operativos y administrativos por encima de abstracciones de producto SaaS.
- Cualquier capacidad multi-company futura debe ser **ligera y no intrusiva** en el MVP.

## 2) Proposed stack

### Frontend
- Next.js (App Router)
- TypeScript
- Tailwind CSS
- shadcn/ui
- React Hook Form + Zod
- TanStack Table (listas de alto volumen)
- Recharts (KPIs dashboard)

### Backend / Application
- Next.js Server Actions (MVP CRUD y mutaciones principales)
- Next.js Route Handlers (`/api`) para integraciones internas y futuras externas
- Capa de servicios de dominio en `src/server/services`
- Repositorios en `src/server/repositories`

### Data Layer
- PostgreSQL
- Prisma ORM
- Prisma Migrate + Seed

### Auth & Security
- Auth.js (Credentials para MVP; extensible a SSO/OAuth)
- Session-based auth (JWT strategy en MVP)
- RBAC con `Role`, `Permission`, `RolePermission`, `UserRole`
- Restricciones por sucursal (`UserBranchAccess`)

### Document storage
- Metadata en PostgreSQL
- Binary storage desacoplado (S3/R2-ready)
- Referencias por URL, clave de objeto, versión, tamaño, hash

### Observability & auditing
- `ActivityLog` para trazabilidad funcional
- Logs técnicos en runtime (console structured para MVP)
- Preparado para OpenTelemetry/Sentry en fase posterior

### Notifications
- Modelo `Notification` + estados (`UNREAD`, `READ`)
- MVP in-app
- Fase posterior: email/webhooks

## 3) Runtime architecture

## Request flow (MVP)
1. User request → Middleware/session validation.
2. UI page server component carga datos.
3. Form client component valida con Zod.
4. Server Action ejecuta validación final + autorización RBAC.
5. Service layer aplica reglas de negocio.
6. Repository Prisma persiste.
7. ActivityLog registra evento crítico.
8. Revalidate path/cache updates.

## 4) Module boundaries

- `auth`: login, sesiones, guards
- `crm`: prospects, opportunities, activities (fase progresiva)
- `customers`: customers, contacts
- `quotes`: quotes, items, charges, approval flow básico
- `shipments`: shipment core, parties, legs, containers
- `milestones`: templates y timeline por shipment
- `documents`: metadata documental y faltantes
- `finance`: revenues, expenses, cash visibility inicial
- `reports`: consultas agregadas y export
- `settings`: catálogos, usuarios, roles, permisos, sucursales
- `audit`: activity logs transversales

## 5) Security design

1. Protected routes for dashboard modules.
2. `requirePermission(resource, action)` centralizado.
3. Filtros por `companyId` y/o `branchId` en consultas.
4. Sanitización de inputs y validación Zod.
5. Principio de mínimo privilegio.
6. Auditoría obligatoria para create/update/delete/approve.

## 6) Permission model

- `Permission`: `resource` + `action`
- `RolePermission`: asignación de permisos a rol
- `UserRole`: rol principal por usuario (MVP)
- Extensible a múltiples roles por usuario en fase siguiente.

Resources iniciales:
- dashboard, customers, contacts, quotes, shipments, milestones, documents, finance, reports, settings, users, roles

Actions:
- read, create, update, delete, approve, view_finance, view_margin

## 7) Data and performance considerations

1. Índices en campos de búsqueda y filtros (`status`, `customerId`, `branchId`, `eta`, `etd`).
2. Paginación server-side en listados.
3. Búsqueda textual por ILIKE en identificadores y referencias.
4. Cálculos de KPI con agregaciones SQL/Prisma.
5. Soft delete opcional para entidades sensibles (fase posterior).

## 8) API and integration readiness

Inicialmente se exponen Route Handlers internos:
- `/api/health`
- `/api/kpis/dashboard`
- `/api/shipments/search`

Diseño preparado para futuras integraciones:
- carriers
- tracking events
- accounting systems
- EDI/API con agentes
- webhooks de eventos de hitos

## 9) Deployment and environments

- Local: Node.js + PostgreSQL + Prisma
- Cloud: Vercel app + managed Postgres + object storage
- Variables de entorno:
  - `DATABASE_URL`
  - `NEXTAUTH_SECRET`
  - `NEXTAUTH_URL`

## 10) Testing strategy (next iterations)

- Unit tests: dominio (reglas de negocio críticas)
- Integration tests: server actions + DB test containers
- E2E tests: flujos de login, create quote, convert to shipment


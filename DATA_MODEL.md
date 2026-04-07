# Data Model - Freight Forwarding Management Platform

## 1) Principios de modelado

- Multi-branch ready desde MVP (multi-company evolutivo).
- Trazabilidad fuerte con `ActivityLog`.
- Relaciones explícitas entre comercial, operación y finanzas.
- Enums para estados críticos de negocio.
- Índices orientados a filtros operativos frecuentes.

## 2) Entidades principales

### Organization Layer

#### Company
- **Propósito:** entidad legal/empresa operadora.
- **Campos:** id, legalName, tradeName, taxId, country, timezone, createdAt.
- **Relaciones:** 1..n Branch, 1..n User.
- **Validaciones:** taxId único por company scope futuro.

#### Branch
- **Propósito:** sucursal operativa.
- **Campos:** id, companyId, code, name, city, country, active.
- **Relaciones:** n..1 Company, 1..n UserBranchAccess, 1..n Shipment.
- **Índices:** (companyId, code unique).

#### User
- **Propósito:** usuario interno/externo del sistema.
- **Campos:** id, companyId, email, name, role, isActive, passwordHash.
- **Relaciones:** n..1 Company, 1..n UserBranchAccess, ownership records.
- **Validaciones:** email único global (MVP) o por company (future).

#### UserBranchAccess
- **Propósito:** control de acceso por sucursal.
- **Campos:** id, userId, branchId, canViewFinance, canApprove.
- **Relaciones:** n..1 User, n..1 Branch.
- **Índices:** (userId, branchId unique).

### Master Data / Parties

#### Customer
- **Propósito:** cliente corporativo importador/exportador.
- **Campos:** id, companyId, branchId, code, legalName, taxId, paymentTermsDays, isActive.
- **Relaciones:** 1..n Contact, 1..n Quote, 1..n Shipment.
- **Índices:** code unique por company, taxId index.

#### Prospect
- **Propósito:** potencial cliente en CRM.
- **Campos:** id, companyId, branchId, companyName, status, source, assignedToId.
- **Relaciones:** opcional conversión a Customer.

#### Contact
- **Propósito:** contacto comercial/operativo de empresa.
- **Campos:** id, customerId/prospectId, fullName, email, phone, position, isPrimary.
- **Validaciones:** al menos uno entre email o teléfono.

#### Agent / Supplier / Carrier
- **Propósito:** terceros operativos y financieros.
- **Campos comunes:** id, companyId, type, name, country, taxId, active.
- **Relaciones:** ShipmentParty, Expense.
- **Nota:** en MVP se modela `BusinessPartner` con `partnerType`.

### Commercial

#### Quote
- **Propósito:** propuesta comercial.
- **Campos:** id, companyId, branchId, quoteNumber, customerId, mode, direction, status, validUntil, currency, exchangeRate, totalBuy, totalSell, marginAmount, marginPct.
- **Relaciones:** 1..n QuoteItem, 1..n QuoteCharge, 0..1 Shipment.
- **Validaciones:** status transitions válidas; quoteNumber único por company.
- **Índices:** (companyId, quoteNumber unique), status, validUntil.

#### QuoteItem
- **Propósito:** línea principal de servicio cotizado.
- **Campos:** description, qty, uom, buyAmount, sellAmount.
- **Relaciones:** n..1 Quote.

#### QuoteCharge
- **Propósito:** recargos (THC, BAF, docs, handling).
- **Campos:** concept, chargeType, buyAmount, sellAmount, currency.
- **Relaciones:** n..1 Quote.

### Operations

#### Shipment
- **Propósito:** expediente operativo principal (file).
- **Campos:** id, companyId, branchId, shipmentNumber, customerId, quoteId, mode, direction, incoterm, serviceLevel, status, referenceClient, commodity, packageCount, grossWeightKg, volumeM3, etd, eta, atd, ata, ownerUserId.
- **Relaciones:** 1..n ShipmentLeg, ShipmentMilestone, ShipmentDocument, Revenue, Expense, Task, Note; n..m parties via ShipmentParty.
- **Validaciones:** cronología ETD/ATD y ETA/ATA; cierre condicionado.
- **Índices:** shipmentNumber unique por company; (status, mode), eta, customerId, referenceClient.

#### ShipmentParty
- **Propósito:** rol de partes en la operación.
- **Campos:** shipmentId, role (SHIPPER/CONSIGNEE/NOTIFY/AGENT_ORIGIN/AGENT_DEST), partnerId o freeText.
- **Relaciones:** n..1 Shipment, n..1 BusinessPartner (opc).

#### ShipmentLeg
- **Propósito:** tramo logístico multimodal.
- **Campos:** shipmentId, sequence, mode, originCode, destinationCode, etd, eta, atd, ata, carrierId, vesselFlight.
- **Validaciones:** sequence único por shipment.

#### Container
- **Propósito:** detalle contenedor para ocean.
- **Campos:** shipmentId, containerNo, containerType, sealNo, tareWeight, grossWeight.

#### ShipmentMilestone
- **Propósito:** hito del workflow operativo.
- **Campos:** shipmentId, code, label, expectedAt, actualAt, status, isCritical, assignedTo.
- **Validaciones:** milestones críticos obligatorios para cierre.
- **Índices:** (shipmentId, code), status, expectedAt.

#### ShipmentDocument
- **Propósito:** metadata documental y referencia archivo.
- **Campos:** shipmentId, docType, fileName, storageKey, version, status, uploadedBy, uploadedAt, isRequired.
- **Validaciones:** `version` incremental por tipo.

### Finance

#### Revenue
- **Propósito:** ingreso asociado a shipment.
- **Campos:** shipmentId, customerId, concept, amount, currency, fxRate, amountBase, dueDate, status, invoiceNumber.
- **Índices:** dueDate, status, customerId.

#### Expense
- **Propósito:** costo/egreso asociado a shipment.
- **Campos:** shipmentId, supplierId, concept, amount, currency, fxRate, amountBase, dueDate, status, invoiceNumber.
- **Índices:** dueDate, status, supplierId.

#### Invoice / Payment (fase siguiente)
- **Propósito:** normalizar comprobantes y conciliaciones.
- **MVP:** parcialmente cubierto en Revenue/Expense con campos básicos.

#### ExchangeRate
- **Propósito:** tipo de cambio por fecha y moneda.
- **Campos:** baseCurrency, quoteCurrency, rate, date.
- **Índices:** (baseCurrency, quoteCurrency, date unique).

### Collaboration / System

#### Task
- **Propósito:** tarea operativa/comercial/financiera.
- **Campos:** entityType, entityId, title, dueAt, status, priority, assignedTo.

#### Note
- **Propósito:** notas internas por entidad.
- **Campos:** entityType, entityId, content, createdBy.

#### ActivityLog
- **Propósito:** auditoría de cambios críticos.
- **Campos:** entityType, entityId, action, beforeJson, afterJson, actorId, createdAt, ip, userAgent.
- **Índices:** (entityType, entityId), actorId, createdAt.

#### Notification
- **Propósito:** alertas in-app.
- **Campos:** userId, title, body, level, readAt, link.

## 3) Enums recomendados

- `TransportMode`: AIR, OCEAN, ROAD, RAIL, MULTIMODAL, SPECIAL
- `TradeDirection`: IMPORT, EXPORT, CROSS_TRADE
- `ShipmentStatus`: DRAFT, OPEN, IN_TRANSIT, ARRIVED, CUSTOMS, DELIVERED, INVOICED, CLOSED, CANCELLED
- `QuoteStatus`: DRAFT, SENT, APPROVED, REJECTED, EXPIRED
- `MilestoneStatus`: PENDING, IN_PROGRESS, COMPLETED, DELAYED, CANCELLED
- `TaskStatus`: TODO, IN_PROGRESS, DONE, CANCELLED
- `CurrencyCode`: USD, EUR, ARS
- `PartnerType`: AGENT, SUPPLIER, CARRIER, CUSTOMS_BROKER, TERMINAL, TRUCKER
- `DocumentType`: COMMERCIAL_INVOICE, PACKING_LIST, HBL, MBL, HAWB, MAWB, CERTIFICATE, PERMIT, POD, OTHER

## 4) Constraints y validaciones clave

1. Unicidad de numeración por compañía (`quoteNumber`, `shipmentNumber`).
2. Integridad de estados con transiciones permitidas.
3. No permitir `ShipmentStatus.CLOSED` con hitos críticos pendientes.
4. No permitir `Quote -> Shipment` si quote no está APPROVED.
5. `amountBase` obligatorio cuando moneda != base company currency.
6. Control de visibilidad por rol/sucursal para registros sensibles.

## 5) Índices de performance iniciales

- Shipments: `(companyId, status, mode)`, `(companyId, eta)`, `(companyId, customerId)`
- Quotes: `(companyId, status, createdAt)`, `(companyId, customerId)`
- Milestones: `(shipmentId, status, expectedAt)`
- Revenue/Expense: `(companyId, dueDate, status)`
- ActivityLog: `(entityType, entityId, createdAt)`

## 6) Estrategia de evolución

- Introducir tenant isolation por `companyId` a nivel middleware/repository.
- Particionar `ActivityLog` por fecha cuando escale.
- Separar módulo contable en subledger dedicado (fase avanzada).

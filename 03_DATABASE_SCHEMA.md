# 03_DATABASE_SCHEMA.md — Esquema de base de datos

## Objetivo
Definir una base de datos SQL robusta, extensible y consistente para e-commerce, administración, inventario y trazabilidad.

## Recomendación
- PostgreSQL como motor principal
- migraciones versionadas
- constraints estrictas
- timestamps en UTC
- soft delete solo donde tenga sentido
- auditoría obligatoria en cambios críticos

## Convenciones
- tablas en plural
- campos en snake_case
- claves primarias `id` UUID o BIGINT según decisión
- `created_at`, `updated_at`, `deleted_at` cuando aplique
- `status` con enums o tablas de catálogos
- FKs explícitas

## Tablas principales

### 1. users
Usuarios internos.
- id
- full_name
- email
- password_hash
- phone
- role_id
- is_active
- last_login_at
- created_at
- updated_at

### 2. roles
- id
- name
- slug
- description
- created_at
- updated_at

### 3. permissions
- id
- name
- slug
- module
- description

### 4. role_permissions
- id
- role_id
- permission_id

### 5. categories
- id
- parent_id
- name
- slug
- description
- sort_order
- seo_title
- seo_description
- is_active
- created_at
- updated_at

### 6. brands
- id
- name
- slug
- logo_url
- website_url
- is_active

### 7. products
- id
- category_id
- brand_id
- sku
- name
- slug
- short_description
- long_description
- price
- compare_at_price
- cost_price
- tax_rate
- is_active
- is_featured
- is_new
- created_at
- updated_at

### 8. product_images
- id
- product_id
- url
- alt_text
- sort_order
- is_primary

### 9. product_attributes
- id
- product_id
- attribute_name
- attribute_value
- sort_order

### 10. warehouses
- id
- name
- location
- is_active

### 11. inventory_items
- id
- product_id
- warehouse_id
- on_hand_qty
- reserved_qty
- available_qty
- min_qty
- max_qty
- updated_at

### 12. stock_movements
- id
- product_id
- warehouse_id
- movement_type
- quantity
- reason
- reference_type
- reference_id
- created_by_user_id
- created_at

### 13. carts
- id
- session_key
- customer_name
- customer_email
- customer_phone
- created_at
- updated_at

### 14. cart_items
- id
- cart_id
- product_id
- quantity
- unit_price
- created_at
- updated_at

### 15. orders
- id
- order_number
- customer_name
- customer_email
- customer_phone
- shipping_address
- shipping_city
- shipping_notes
- subtotal
- discount_total
- tax_total
- shipping_total
- grand_total
- order_status
- payment_status
- fulfillment_status
- created_at
- updated_at

### 16. order_items
- id
- order_id
- product_id
- product_name_snapshot
- sku_snapshot
- unit_price_snapshot
- quantity
- total_price

### 17. payments
- id
- order_id
- gateway
- gateway_reference
- transaction_id
- amount
- currency
- payment_status
- confirmed_at
- raw_payload
- created_at
- updated_at

### 18. shipments
- id
- order_id
- carrier_name
- tracking_number
- shipment_status
- shipped_at
- delivered_at
- notes

### 19. promotions
- id
- name
- slug
- type
- value
- start_date
- end_date
- is_active

### 20. product_promotions
- id
- product_id
- promotion_id

### 21. customer_leads
- id
- full_name
- email
- phone
- source
- status
- notes
- created_at
- updated_at

### 22. notifications
- id
- type
- channel
- recipient
- subject
- body
- status
- related_type
- related_id
- sent_at
- created_at

### 23. audit_logs
- id
- actor_user_id
- action
- entity_type
- entity_id
- before_data
- after_data
- ip_address
- user_agent
- created_at

### 24. settings
- id
- key
- value
- description
- updated_at

## Reglas de integridad
- `products.category_id` debe existir.
- `products.brand_id` debe existir si la marca es obligatoria.
- `inventory_items.available_qty = on_hand_qty - reserved_qty`.
- `orders.grand_total` debe ser calculado y persistido.
- `order_items` deben guardar snapshot para historial.
- `payments.order_id` debe ser único por transacción principal o controlado por índice compuesto según gateway.
- `audit_logs` nunca se borran salvo política legal.

## Índices recomendados
- products.slug
- products.name
- categories.slug
- orders.order_number
- orders.order_status
- orders.payment_status
- inventory_items.product_id
- stock_movements.product_id
- payments.gateway_reference
- customer_leads.email
- customer_leads.phone

## Estados sugeridos
### order_status
- draft
- pending_payment
- paid
- packed
- shipped
- delivered
- cancelled
- refunded

### payment_status
- pending
- approved
- rejected
- refunded
- cancelled

### fulfillment_status
- pending
- preparing
- ready_to_ship
- shipped
- delivered

### stock movement types
- sale
- purchase
- adjustment
- reservation
- release
- return
- damage
- transfer

## Migraciones
- toda modificación de esquema debe ir en migración
- nunca editar tablas manualmente sin migración
- agregar datos semilla controlada
- documentar rollback

## Auditoría de cambios
Los cambios a productos, precios, stock, pedidos y pagos deben dejar rastro.

## Criterio de aceptación
La base de datos es válida cuando:
- compila migraciones sin error
- integridad referencial está garantizada
- los estados cubren todos los flujos
- el stock se puede calcular correctamente
- el histórico se conserva

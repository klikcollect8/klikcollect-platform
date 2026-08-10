# KlikCollect RBAC

Clerk authenticates. KlikCollect authorizes via a permission catalog, role matrix, and scoped memberships.

## Planes

| Plane                                 | Scope                                                       |
| ------------------------------------- | ----------------------------------------------------------- |
| Platform                              | Platform-wide (`platform_memberships`)                      |
| Vendor / Store / Delivery / Warehouse | `vendor_id` (+ optional `store_id`) via `staff_memberships` |
| Customer / Guest                      | Ownership only - **no RBAC permissions**                    |

## Hierarchy → role IDs

### Platform

| Hierarchy name                 | Role ID               |
| ------------------------------ | --------------------- |
| Super Admin                    | `super_admin`         |
| Platform Admin                 | `platform_admin`      |
| Compliance Officer             | `compliance_officer`  |
| Finance Admin                  | `finance_admin`       |
| Support Manager                | `support_manager`     |
| Support Agent                  | `support_agent`       |
| Trust & Safety                 | `trust_safety`        |
| Marketplace Curator            | `marketplace_curator` |
| Content Manager                | `content_manager`     |
| Marketing Manager (platform)   | `platform_marketing`  |
| Customer Success               | `customer_success`    |
| Analytics Viewer               | `bi_analyst`          |
| Developer / System Maintenance | `developer`           |

### Vendor

| Hierarchy name    | Role ID                                                         |
| ----------------- | --------------------------------------------------------------- |
| Vendor Owner      | `vendor_owner`                                                  |
| Vendor Admin      | `vendor_admin`                                                  |
| Store Manager     | `store_manager`                                                 |
| Branch Manager    | `branch_manager`                                                |
| Cashier (POS)     | `cashier`                                                       |
| Inventory Manager | `inventory_manager`                                             |
| Warehouse Staff   | `warehouse_staff` (+ `warehouse_manager` / `picker` / `packer`) |
| Customer Service  | `vendor_support`                                                |
| Finance Staff     | `finance_manager`                                               |
| Marketing Staff   | `marketing_manager`                                             |
| Viewer            | `vendor_viewer`                                                 |
| Product Manager   | `product_manager`                                               |
| Legacy staff      | `vendor_staff`                                                  |

### Delivery / Store / Warehouse (control panel)

Off by default. Enable via Vendor OS **Control panel** (`store_ops`, `couriers`, `warehouse` flags) or Admin → System → Feature flags. Invites use `inviteableStaffRoles(flags)`.

| Plane     | Flag        | Role IDs                                                                                       |
| --------- | ----------- | ---------------------------------------------------------------------------------------------- |
| Store     | `store_ops` | `cashier`, `sales_assistant`, `stock_clerk`                                                    |
| Delivery  | `couriers`  | `fleet_manager`, `dispatch_manager`, `vendor_driver`, `independent_driver`, `delivery_auditor` |
| Warehouse | `warehouse` | `warehouse_manager`, `warehouse_staff`, `picker`, `packer`                                     |

### Customers

Guest / Customer / Business Customer (future) are **not** RBAC roles - ownership checks only.

## Source of truth

- Permissions: [`lib/authz/permissions.ts`](../lib/authz/permissions.ts) (`domain:action` - not dotted)
- Role → permissions: [`lib/authz/roles.ts`](../lib/authz/roles.ts)
- Role IDs / labels: [`lib/authz/role-ids.ts`](../lib/authz/role-ids.ts)
- Constitutional denials: [`lib/authz/constitutional.ts`](../lib/authz/constitutional.ts)
- Actor resolution: [`lib/authz/resolve-actor.ts`](../lib/authz/resolve-actor.ts)
- Schema: `013` / `014` / [`018_rbac_hierarchy_roles.sql`](../supabase/migrations/018_rbac_hierarchy_roles.sql)

## Resolution order (platform)

1. `platform_memberships` (Postgres)
2. Clerk `publicMetadata.role` (legacy names mapped: `head_admin` → `super_admin`, `analytics_viewer` → `bi_analyst`, etc.)
3. `PLATFORM_ADMIN_EMAILS` → `super_admin`

## Resolution order (vendor)

1. `staff_memberships` (Postgres)
2. File fallback `.data/vendor-memberships.json` unless `RBAC_FILE_MEMBERSHIPS=false`
3. Clerk `publicMetadata.vendorId` / `vendorRole`
4. Soft-open demo tenant when `RBAC_SOFT_OPEN_DEMO=true` or non-production default

## Constitutional safeguards

`platform_admin` and below cannot hold:

- `ledger:delete_immutable`
- `ledger:bypass`
- `authz:bypass`
- `audit:modify_history`

Only `super_admin` retains these (break-glass). **Developer has no finance/ledger permissions.**

## Catalogue authority (MVP)

- **Platform owns** canonical `products` (`products:create` / `products:edit` / `products:archive`).
- **Vendors own** `product_offers` via `offers:view`, `offers:price`, `offers:availability`, plus `inventory:adjust` and `catalogue:request_correction`.
- Vendor roles must **never** hold `products:create` / `products:edit` / `products:archive`.
- Soft-open demo memberships inherit `vendor_staff` (no catalogue write).

## Surfaces

| Surface        | Route                  | Gate                                                                                                                                                          |
| -------------- | ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Platform admin | `/admin`               | **Ops control plane** — catalogue, vendor offers, corrections, CMS, finance, flags, support, security                                                          |
| Vendor store   | `/app`                 | **My business** — home, orders, offers/stock, POS, storefront, branches, staff, Q&A/reviews, wallet/payouts                                                    |
| Customer       | `/account`, storefront | Clerk session + ownership                                                                                                                                     |

MVP staff invites use `MVP_VENDOR_INVITE_ROLES` (owner, manager, order manager, inventory, cashier, dispatch, finance view). Platform roles cannot be invited from `/app/staff`.

Vendors never receive platform permissions (`vendors:approve`, `flags:*`, `cms:*`, cross-tenant ledger). OS APIs are tenant-scoped (`vendorIds` from membership) with no platform god-mode.

## Invites

- Admin Team UI (`/admin/roles`) → `POST /api/admin/staff/invite`
- Vendor Staff UI (`/app/staff`) → `POST /api/os/staff` / invite

Invited rows use `status = invited` and `clerk_user_id = email:…` until first sign-in.

## Env flags

| Variable                | Meaning                                                             |
| ----------------------- | ------------------------------------------------------------------- |
| `PLATFORM_ADMIN_EMAILS` | Comma-separated emails → `super_admin`                              |
| `RBAC_SOFT_OPEN_DEMO`   | `true`/`false` - demo tenant for signed-in users without membership |
| `RBAC_FILE_MEMBERSHIPS` | `false` disables `.data` fallback                                   |

## Verify

```bash
npx tsx scripts/verify-rbac.ts
```

-- Widen platform_memberships + staff_memberships role CHECKs for hierarchy gap-fill.

-- Platform roles
alter table public.platform_memberships drop constraint if exists platform_memberships_role_check;

alter table public.platform_memberships
  add constraint platform_memberships_role_check check (role in (
    'super_admin',
    'platform_admin',
    'compliance_officer',
    'finance_admin',
    'support_manager',
    'support_agent',
    'trust_safety',
    'marketplace_curator',
    'content_manager',
    'platform_marketing',
    'customer_success',
    'bi_analyst',
    'developer'
  ));

-- Staff / vendor / store / delivery / warehouse roles
alter table public.staff_memberships drop constraint if exists staff_memberships_role_check;

alter table public.staff_memberships
  add constraint staff_memberships_role_check check (role in (
    'vendor_owner',
    'vendor_admin',
    'store_manager',
    'branch_manager',
    'inventory_manager',
    'product_manager',
    'finance_manager',
    'vendor_support',
    'marketing_manager',
    'vendor_viewer',
    'vendor_staff',
    'cashier',
    'sales_assistant',
    'stock_clerk',
    'vendor_driver',
    'independent_driver',
    'fleet_manager',
    'dispatch_manager',
    'delivery_auditor',
    'warehouse_manager',
    'warehouse_staff',
    'picker',
    'packer'
  ));

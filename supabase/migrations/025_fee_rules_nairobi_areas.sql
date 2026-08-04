-- Nairobi area delivery fees + a few category commission overrides.
-- flat_minor is KES cents (15000 = KES 150). percent_bps: 1000 = 10%.

-- Delivery by area (customer-facing when fulfilment=delivery / area_key set)
insert into public.fee_rules (public_id, kind, area_key, flat_minor, priority, metadata) values
  ('fee_delivery_westlands', 'delivery', 'westlands', 15000, 100, '{"label":"Westlands"}'::jsonb),
  ('fee_delivery_kilimani', 'delivery', 'kilimani', 18000, 100, '{"label":"Kilimani"}'::jsonb),
  ('fee_delivery_lavington', 'delivery', 'lavington', 20000, 100, '{"label":"Lavington"}'::jsonb),
  ('fee_delivery_parklands', 'delivery', 'parklands', 18000, 100, '{"label":"Parklands"}'::jsonb),
  ('fee_delivery_hurlingham', 'delivery', 'hurlingham', 17000, 100, '{"label":"Hurlingham"}'::jsonb),
  ('fee_delivery_riverside', 'delivery', 'riverside', 16000, 100, '{"label":"Riverside"}'::jsonb),
  ('fee_delivery_ngong_road', 'delivery', 'ngong-road', 20000, 100, '{"label":"Ngong Road"}'::jsonb),
  ('fee_delivery_south_c', 'delivery', 'south-c', 22000, 100, '{"label":"South C"}'::jsonb),
  ('fee_delivery_karen', 'delivery', 'karen', 35000, 100, '{"label":"Karen"}'::jsonb),
  ('fee_delivery_loresho', 'delivery', 'loresho', 28000, 100, '{"label":"Loresho"}'::jsonb),
  ('fee_delivery_nairobi_default', 'delivery', 'nairobi', 25000, 500, '{"label":"Nairobi default"}'::jsonb)
on conflict (public_id) do update set
  flat_minor = excluded.flat_minor,
  area_key = excluded.area_key,
  priority = excluded.priority,
  active = true,
  updated_at = now();

-- Delivery by collect hub (when checkout sends collectHub)
insert into public.fee_rules (public_id, kind, collect_hub, flat_minor, priority, metadata) values
  ('fee_hub_westlands', 'delivery', 'Westlands', 15000, 80, '{"label":"Hub Westlands"}'::jsonb),
  ('fee_hub_kilimani', 'delivery', 'Kilimani', 18000, 80, '{"label":"Hub Kilimani"}'::jsonb),
  ('fee_hub_cbd', 'delivery', 'CBD', 20000, 80, '{"label":"Hub CBD"}'::jsonb)
on conflict (public_id) do update set
  flat_minor = excluded.flat_minor,
  collect_hub = excluded.collect_hub,
  priority = excluded.priority,
  active = true,
  updated_at = now();

-- Category commission overrides (more specific than global 10%)
insert into public.fee_rules (public_id, kind, category_name, percent_bps, priority, metadata) values
  ('fee_comm_fresh_produce', 'commission', 'Fresh Produce', 800, 50, '{"note":"8% fresh"}'::jsonb),
  ('fee_comm_dairy', 'commission', 'Dairy', 900, 50, '{"note":"9% dairy"}'::jsonb),
  ('fee_comm_pantry', 'commission', 'Pantry', 1200, 50, '{"note":"12% pantry"}'::jsonb),
  ('fee_comm_household', 'commission', 'Household', 1100, 50, '{"note":"11% household"}'::jsonb),
  ('fee_comm_beverages', 'commission', 'Beverages', 1000, 50, '{"note":"10% beverages"}'::jsonb)
on conflict (public_id) do update set
  percent_bps = excluded.percent_bps,
  category_name = excluded.category_name,
  priority = excluded.priority,
  active = true,
  updated_at = now();

# Product resolver — real barcode E2E checklist

Manual warehouse flow against staging/prod admin (platform role with `barcode:scan` + `products:create`).

## Preconditions

- [ ] `KLIKCOLLECT_PRODUCT_RESOLVER_USER_AGENT` set (descriptive UA string)
- [ ] Migration `032_product_resolver` applied
- [ ] Camera permission granted (or use Hardware / Manual mode)
- [ ] At least one KlikCollect category exists for mapping

## Happy path (known grocery barcode)

Use a real EAN-13 on pack (e.g. Nutella `3017620422003` or a local Kenyan SKU known in Open Food Facts).

1. [ ] Open `/admin/products/scanner`
2. [ ] Scan with camera **or** enter barcode + Look up **or** hardware wedge (focus field, scan, Enter)
3. [ ] UI shows normalised format + code
4. [ ] If not already in catalogue: candidate fields + provenance (✓ OFF / ⚠)
5. [ ] Choose a KlikCollect category (never auto-map OFF taxonomy)
6. [ ] Edit name/brand if needed → **Create KlikCollect product**
7. [ ] Lands on `/admin/products/[id]` with status `pending_review`
8. [ ] `product_external_sources` + `product_field_provenance` rows present
9. [ ] `barcode_scan_events` row written; `product_audit_log` has `resolver.imported`
10. [ ] Product appears in Catalogue list; **not** `published`

## Duplicate protection

1. [ ] Re-scan the same barcode
2. [ ] UI shows existing product (no second create)
3. [ ] Audit action `resolver.duplicate_blocked` (or equivalent)

## Miss / manual

1. [ ] Scan a valid checksum barcode unlikely in OFF
2. [ ] Manual create fallback → fill name + category → commit `pending_review`

## Local-only path

1. [ ] Quick local hit via `GET /api/admin/catalogue/barcode/[code]` still returns `{ found, product }`
2. [ ] Wizard Scan → Look up enriches draft; does not auto-publish

## Resilience (optional)

1. [ ] With network blocked: resolve still allows manual create; friendly error, no crash
2. [ ] Torch / device picker work on supported Android Chrome

## Automated offline checks

```bash
npx tsx scripts/verify-product-resolver.ts
```

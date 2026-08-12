# Product resolver — real barcode E2E checklist

Manual warehouse flow against staging/prod admin (platform role with `barcode:scan` + `products:create`).

## Preconditions

- [ ] `KLIKCOLLECT_PRODUCT_RESOLVER_USER_AGENT` set (descriptive UA string)
- [ ] Migrations `032`–`034` applied (`034` expands `product_media.role`)
- [ ] Camera permission granted (or use Hardware / Manual mode)
- [ ] Role has `barcode:scan` (scanner) and `products:create` (commit)
- [ ] At least one KlikCollect category exists for mapping

## Fullscreen scan + full import

Use a real EAN-13 on pack (e.g. Nutella `3017620422003`).

1. [ ] Open `/admin/products/scanner` — fullscreen camera + session tray
2. [ ] Scan with camera **or** bottom search (name/barcode) **or** hardware wedge
3. [ ] Resolve progress steps show (Detect → KlikCollect → Databases → Ready)
4. [ ] If already in KC: intelligence sheet shows **Already in KlikCollect** — no create
5. [ ] If new: sheet shows identity, diet flags, ingredients, nutrition, packaging/origin, media (pick main)
6. [ ] Perishability options map to DB values (`non_perishable` / `refrigerated` / `perishable` / `frozen`)
7. [ ] Similar products strip appears (In catalogue / Not in KlikCollect)
8. [ ] Required: choose KC category, product type, sale unit; ack fuzzy dups if shown
9. [ ] **Create KlikCollect product** — with Continuous on, returns to camera; tray shows `created`
10. [ ] Product has attributes (ingredients, nutrition_json, vegan, storage, …), specs, media roles
11. [ ] Re-scan same barcode → existing product only (no second create)
12. [ ] Invalid checksum (manual force) → invalid UI → optional manual create

## Search

1. [ ] Type a product name in scanner search → local + external hits
2. [ ] Tap local → opens catalogue product
3. [ ] Tap external → resolve/review flow

## Discovery page

1. [ ] Open `/admin/products/discovery`
2. [ ] Type `milk` / category → temporary **Related products** live list
3. [ ] **Review** / **Add to queue** work; failed PATCH shows an error
4. [ ] Pending items from scan/similar/search appear
5. [ ] **Dismiss** / restore / bulk actions work

## Automated offline checks

```bash
npx tsx scripts/verify-product-resolver.ts
npx tsc --noEmit
```

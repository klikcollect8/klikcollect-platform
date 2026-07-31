# KlikCollect — Elite image prompts

Use Midjourney v6 / Flux / Ideogram. Keep a **shared style lock** on every prompt:

> `--style raw` · soft studio light · warm off-white `#f7f7f5` seamless background · minimal shadows · editorial product photography · no text · no logos · 85mm lens · high detail

---

## Hero collage (HomepageBanner — 4 frames)

1. **Hero A — Electronics lead**
   Premium noise-cancelling over-ear headphones in matte charcoal, three-quarter angle, floating on seamless warm off-white #f7f7f5 background, soft diffused studio lighting, subtle contact shadow, editorial luxury product photography, 85mm, ultra sharp — no text no logo

2. **Hero B — Fashion**
   Sand-coloured linen resort shirt folded with architectural precision on seamless #f7f7f5, natural fabric texture, soft top light, editorial still life, quiet luxury, 85mm — no text no logo

3. **Hero C — Home**
   Hand-thrown ceramic pour-over set, matte stoneware glaze, arranged as a quiet still life on seamless #f7f7f5, soft shadow, Japanese-minimal aesthetic, product editorial — no text no logo

4. **Hero D — Beauty**
   Frosted glass vitamin serum bottle with dropper, soft reflection, seamless #f7f7f5, clinical-luxury beauty photography, clean and expensive — no text no logo

---

## Category rail thumbnails (1:1)

5. Electronics — macro of brushed aluminium gadget edge, abstract product detail, #f7f7f5  
6. Mobile — premium phone + case stack, top-down, #f7f7f5  
7. Computers — slim laptop closed, edge profile, #f7f7f5  
8. Gaming — matte black controller, three-quarter, #f7f7f5  
9. Home & Kitchen — olive wood utensil + ceramic bowl, #f7f7f5  
10. Fashion — folded knit textile texture, #f7f7f5  
11. Beauty — lipstick / jar still life, #f7f7f5  
12. Baby — soft cotton knit garment, #f7f7f5  
13. Sports — matte water bottle + resistance band, #f7f7f5  
14. Groceries — single-origin coffee bag (blank label), beans beside, #f7f7f5  

---

## Featured scroll / PDP masters (4:5 vertical)

15. Noise-cancelling headphones — hero packshot, matte black, #f7f7f5, luxury ecommerce  
16. USB-C power bank — compact aluminium brick, subtle LED detail off, #f7f7f5  
17. Linen resort shirt — on invisible form / flat lay, sand colourway, #f7f7f5  
18. Ceramic pour-over — side profile, artisan glaze, #f7f7f5  
19. Vitamin C serum — bottle + drop of liquid freeze, #f7f7f5  
20. Kenyan AA coffee 500g — kraft bag blank, beans spilled artfully, #f7f7f5  
21. Camera sling bag — technical fabric, soft fold, #f7f7f5  

---

## Lifestyle / vendor atmosphere (optional, rare use)

22. Nairobi click & collect — hands receiving a small premium parcel at a sunlit storefront counter, documentary but elevated, muted palette, no faces sharp, 35mm  
23. Vendor atelier — craftsperson hands packing product in tissue, warm natural light, editorial documentary — no logos  

---

## Style negative prompt (append everywhere)

`cartoon, 3d render, neon, cyberpunk, busy background, watermark, text, logo, amazon packaging, plastic shine, cluttered, low quality, stock photo smile model, purple lighting`

---

## File naming (drop into `/public/products/` or your CDN)

| Slot | Suggested file |
|------|----------------|
| Hero A–D | `hero-01.jpg` … `hero-04.jpg` |
| Categories | `cat-electronics.jpg` … |
| SKUs | `sku-{product-id}.jpg` |

After generation, set product `image` fields / banner slides to these URLs — the UI already blends `#f7f7f5` stages so seamless backgrounds will disappear into the page.

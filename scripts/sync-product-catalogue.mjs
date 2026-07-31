/**
 * Copies assets/products → public/products with clean slugs,
 * and prints a verification summary for the seed catalogue.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const srcDir = path.join(root, "assets", "products");
const dstDir = path.join(root, "public", "products");

/** matchPrefix is matched against the start of the asset filename */
const CATALOGUE = [
  // Fresh Produce
  { id: "prd_baby_spinach", match: "Baby_spinach", slug: "baby-spinach", name: "Baby spinach bunch", description: "Tender baby spinach leaves, washed and tied for salads and sautés.", category: "Fresh Produce", price: 180 },
  { id: "prd_butterhead_lettuce", match: "Fresh_butterhead_lettuce", slug: "butterhead-lettuce", name: "Butterhead lettuce", description: "Crisp butterhead lettuce with soft, sweet leaves.", category: "Fresh Produce", price: 160 },
  { id: "prd_broccoli", match: "Fresh_organic_green_broccoli", slug: "organic-broccoli", name: "Organic broccoli", description: "Fresh organic broccoli crown, ideal for steaming or roasting.", category: "Fresh Produce", price: 220 },
  { id: "prd_avocado", match: "Ripe_avocado", slug: "ripe-avocado", name: "Ripe Hass avocado", description: "Creamy ripe avocado, ready to slice.", category: "Fresh Produce", price: 120 },
  { id: "prd_apple", match: "Single_fresh_red_apple", slug: "red-apple", name: "Fresh red apple", description: "Crisp red apple for snacking or lunchboxes.", category: "Fresh Produce", price: 80 },
  { id: "prd_carrots", match: "Three_fresh_orange_carrots", slug: "orange-carrots", name: "Orange carrots (bunch)", description: "Sweet orange carrots with leafy tops.", category: "Fresh Produce", price: 140 },
  { id: "prd_potatoes", match: "Three_organic_russet_potatoes", slug: "russet-potatoes", name: "Organic russet potatoes", description: "Earth-grown russet potatoes for roasting and mashing.", category: "Fresh Produce", price: 250 },
  { id: "prd_tomatoes", match: "Three_ripe_vine_tomatoes", slug: "vine-tomatoes", name: "Vine tomatoes", description: "Ripe vine tomatoes with rich flavour.", category: "Fresh Produce", price: 200 },
  { id: "prd_bell_peppers", match: "Two_bell_peppers", slug: "bell-peppers", name: "Bell peppers (pair)", description: "Fresh red and yellow bell peppers.", category: "Fresh Produce", price: 190 },
  { id: "prd_cucumbers", match: "Two_green_cucumbers", slug: "green-cucumbers", name: "Green cucumbers", description: "Cool, crisp cucumbers for salads.", category: "Fresh Produce", price: 130 },

  // Dairy & Eggs
  { id: "prd_mozzarella", match: "Ball_of_organic_mozzarella", slug: "organic-mozzarella", name: "Organic mozzarella", description: "Soft organic mozzarella ball, perfect for salads and pizza.", category: "Dairy & Eggs", price: 480 },
  { id: "prd_oat_milk", match: "Cardboard_carton_of_oat_milk", slug: "oat-milk", name: "Oat milk carton", description: "Creamy plant-based oat milk for coffee and cereal.", category: "Dairy & Eggs", price: 320 },
  { id: "prd_greek_yogurt", match: "Ceramic_cup_of_Greek_yogurt", slug: "greek-yogurt", name: "Greek yogurt", description: "Thick strained Greek yogurt.", category: "Dairy & Eggs", price: 280 },
  { id: "prd_cottage_cheese", match: "Ceramic_tub_of_cottage_cheese", slug: "cottage-cheese", name: "Cottage cheese", description: "Fresh cottage cheese tub for breakfast bowls.", category: "Dairy & Eggs", price: 350 },
  { id: "prd_cheddar", match: "Cheddar_cheese", slug: "cheddar-cheese", name: "Mature cheddar wedge", description: "Aged cheddar with a sharp, creamy bite.", category: "Dairy & Eggs", price: 520 },
  { id: "prd_cream", match: "Glass_bottle_of_fresh_cream", slug: "fresh-cream", name: "Fresh pouring cream", description: "Rich fresh cream in a glass bottle.", category: "Dairy & Eggs", price: 390 },
  { id: "prd_organic_milk", match: "Glass_bottle_of_organic_milk", slug: "organic-milk", name: "Organic milk", description: "Full-cream organic milk in glass.", category: "Dairy & Eggs", price: 240 },
  { id: "prd_yogurt_jar", match: "Glass_jar_of_organic_yogurt", slug: "organic-yogurt", name: "Organic yogurt jar", description: "Live-culture organic yogurt.", category: "Dairy & Eggs", price: 260 },
  { id: "prd_butter", match: "Organic_butter", slug: "organic-butter", name: "Organic butter", description: "Cultured organic butter wrapped in parchment.", category: "Dairy & Eggs", price: 420 },
  { id: "prd_eggs", match: "Three_farm_fresh_eggs", slug: "farm-eggs", name: "Farm-fresh eggs (3)", description: "Free-range farm eggs with rich yolks.", category: "Dairy & Eggs", price: 150 },

  // Beverages
  { id: "prd_green_tea", match: "Ceramic_cup_of_green_tea", slug: "green-tea", name: "Green tea", description: "Freshly steeped green tea, light and clean.", category: "Beverages", price: 180 },
  { id: "prd_hot_chocolate", match: "Ceramic_mug_hot_chocolate", slug: "hot-chocolate", name: "Hot chocolate", description: "Rich hot chocolate with a frothy finish.", category: "Beverages", price: 220 },
  { id: "prd_espresso", match: "Ceramic_mug_of_black_espresso", slug: "black-espresso", name: "Black espresso", description: "Bold single-origin espresso shot.", category: "Beverages", price: 200 },
  { id: "prd_lemonade", match: "Glass_bottle_fresh_lemonade", slug: "fresh-lemonade", name: "Fresh lemonade", description: "House lemonade with real lemon.", category: "Beverages", price: 250 },
  { id: "prd_orange_juice", match: "Glass_bottle_fresh_orange_juice", slug: "orange-juice", name: "Fresh orange juice", description: "Cold-pressed orange juice, no additives.", category: "Beverages", price: 280 },
  { id: "prd_coconut_water", match: "Glass_bottle_of_coconut_water", slug: "coconut-water", name: "Coconut water", description: "Naturally refreshing coconut water.", category: "Beverages", price: 300 },
  { id: "prd_mineral_water", match: "Glass_bottle_of_mineral_water", slug: "mineral-water", name: "Mineral water", description: "Still mineral water in glass.", category: "Beverages", price: 120 },
  { id: "prd_apple_juice", match: "Glass_bottle_organic_apple_juice", slug: "apple-juice", name: "Organic apple juice", description: "Pressed organic apple juice.", category: "Beverages", price: 270 },
  { id: "prd_sparkling_water", match: "Green_glass_bottle_sparkling_water", slug: "sparkling-water", name: "Sparkling water", description: "Crisp sparkling mineral water.", category: "Beverages", price: 140 },
  { id: "prd_chamomile", match: "Teacup_with_chamomile_tea", slug: "chamomile-tea", name: "Chamomile tea", description: "Calming chamomile infusion.", category: "Beverages", price: 190 },

  // Pantry
  { id: "prd_olive_oil", match: "Dark_glass_bottle_olive_oil", slug: "olive-oil", name: "Extra virgin olive oil", description: "Cold-pressed olive oil in dark glass.", category: "Pantry", price: 890 },
  { id: "prd_spaghetti", match: "Glass_container_with_spaghetti", slug: "spaghetti", name: "Spaghetti", description: "Durum wheat spaghetti in glass storage.", category: "Pantry", price: 280 },
  { id: "prd_chickpeas", match: "Glass_jar_filled_chickpeas", slug: "chickpeas", name: "Dried chickpeas", description: "Dried chickpeas for stews and hummus.", category: "Pantry", price: 320 },
  { id: "prd_lentils", match: "Glass_jar_filled_red_lentils", slug: "red-lentils", name: "Red lentils", description: "Quick-cooking red lentils.", category: "Pantry", price: 300 },
  { id: "prd_oats", match: "Glass_jar_filled_with_oats", slug: "rolled-oats", name: "Rolled oats", description: "Whole rolled oats for porridge and baking.", category: "Pantry", price: 350 },
  { id: "prd_penne", match: "Glass_jar_filled_with_penne", slug: "penne", name: "Penne pasta", description: "Bronze-cut penne pasta.", category: "Pantry", price: 290 },
  { id: "prd_quinoa", match: "Glass_jar_filled_with_quinoa", slug: "quinoa", name: "Quinoa", description: "Protein-rich white quinoa.", category: "Pantry", price: 480 },
  { id: "prd_rice", match: "Glass_jar_filled_with_rice", slug: "white-rice", name: "White rice", description: "Long-grain white rice.", category: "Pantry", price: 340 },
  { id: "prd_sugar", match: "Glass_jar_filled_with_sugar", slug: "cane-sugar", name: "Cane sugar", description: "Fine cane sugar for baking and tea.", category: "Pantry", price: 220 },
  { id: "prd_honey", match: "Glass_jar_honey", slug: "raw-honey", name: "Raw honey", description: "Raw honey with wooden dipper.", category: "Pantry", price: 650 },

  // Snacks
  { id: "prd_cashews", match: "Cashew_nuts", slug: "cashew-nuts", name: "Cashew nuts", description: "Roasted cashew nuts, lightly salted.", category: "Snacks", price: 450 },
  { id: "prd_popcorn", match: "Ceramic_bowl_filled_popcorn", slug: "popcorn", name: "Butter popcorn", description: "Freshly popped butter popcorn.", category: "Snacks", price: 180 },
  { id: "prd_mixed_nuts", match: "Ceramic_bowl_with_mixed_nuts", slug: "mixed-nuts", name: "Mixed nuts", description: "Assorted mixed nuts for snacking.", category: "Snacks", price: 520 },
  { id: "prd_almonds", match: "Heap_of_raw_almonds", slug: "raw-almonds", name: "Raw almonds", description: "Whole raw almonds.", category: "Snacks", price: 480 },
  { id: "prd_granola_bar", match: "Oats_and_honey_granola_bar", slug: "granola-bar", name: "Oats & honey granola bar", description: "Chewy granola bar with oats and honey.", category: "Snacks", price: 160 },
  { id: "prd_chocolate", match: "Premium_chocolate_bar", slug: "chocolate-bar", name: "Dark chocolate bar", description: "Premium dark chocolate bar.", category: "Snacks", price: 350 },
  { id: "prd_dried_mango", match: "Slices_of_sun-dried_mango", slug: "dried-mango", name: "Sun-dried mango", description: "Chewy sun-dried mango slices.", category: "Snacks", price: 380 },
  { id: "prd_crackers", match: "Stack_of_whole_grain_crackers", slug: "whole-grain-crackers", name: "Whole grain crackers", description: "Crisp whole-grain crackers.", category: "Snacks", price: 290 },
  { id: "prd_pretzels", match: "Three_salted_pretzels", slug: "salted-pretzels", name: "Salted pretzels", description: "Classic salted pretzels.", category: "Snacks", price: 200 },
  { id: "prd_trail_mix", match: "Trail_mix", slug: "trail-mix", name: "Trail mix", description: "Nuts, seeds, and dried fruit trail mix.", category: "Snacks", price: 420 },

  // Home & Kitchen
  { id: "prd_cast_iron", match: "Cast_iron_cooking_pot", slug: "cast-iron-pot", name: "Cast iron cooking pot", description: "Heavy cast iron pot for slow cooking.", category: "Home & Kitchen", price: 4500 },
  { id: "prd_cereal_bowl", match: "Ceramic_cereal_bowl", slug: "cereal-bowl", name: "Ceramic cereal bowl", description: "Minimal ceramic bowl with clean lines.", category: "Home & Kitchen", price: 850 },
  { id: "prd_dinner_plate", match: "Ceramic_dinner_plate", slug: "dinner-plate", name: "Ceramic dinner plate", description: "Textured-glaze ceramic dinner plate.", category: "Home & Kitchen", price: 980 },
  { id: "prd_chef_knife", match: "Chef_knife", slug: "chef-knife", name: "Chef knife", description: "Sharp chef knife with wooden handle.", category: "Home & Kitchen", price: 3200 },
  { id: "prd_measuring_cups", match: "Four_stainless_steel_measuring", slug: "measuring-cups", name: "Measuring cups set", description: "Four stainless steel measuring cups.", category: "Home & Kitchen", price: 1400 },
  { id: "prd_storage_jar", match: "Glass_storage_jar", slug: "storage-jar", name: "Glass storage jar", description: "Glass storage jar with wooden lid.", category: "Home & Kitchen", price: 1100 },
  { id: "prd_chopping_board", match: "Oak_wooden_chopping_board", slug: "chopping-board", name: "Oak chopping board", description: "Solid oak wooden chopping board.", category: "Home & Kitchen", price: 2800 },
  { id: "prd_frying_pan", match: "Stainless_steel_frying_pan", slug: "frying-pan", name: "Stainless steel frying pan", description: "Durable stainless steel frying pan.", category: "Home & Kitchen", price: 3600 },
  { id: "prd_cooking_spoon", match: "Wooden_cooking_spoon", slug: "cooking-spoon", name: "Wooden cooking spoon", description: "Hand-finished wooden cooking spoon.", category: "Home & Kitchen", price: 650 },
  { id: "prd_kitchen_towel", match: "Linen_kitchen_towel", slug: "kitchen-towel", name: "Linen kitchen towel", description: "Soft linen kitchen towel.", category: "Home & Kitchen", price: 900 },

  // Household Essentials
  { id: "prd_dish_brush", match: "Bamboo_dish_brush", slug: "dish-brush", name: "Bamboo dish brush", description: "Eco bamboo dish brush for the sink.", category: "Household Essentials", price: 450 },
  { id: "prd_cleaning_spray", match: "Glass_cleaning_spray", slug: "cleaning-spray", name: "Glass cleaning spray", description: "All-purpose glass cleaning spray.", category: "Household Essentials", price: 380 },
  { id: "prd_dish_soap", match: "Glass_dispenser_bottle_dish_soap", slug: "dish-soap", name: "Dish soap", description: "Gentle dish soap in a glass dispenser.", category: "Household Essentials", price: 420 },
  { id: "prd_bin_bags", match: "Grey_bin_bags", slug: "bin-bags", name: "Bin bags", description: "Sturdy grey bin bags roll.", category: "Household Essentials", price: 280 },
  { id: "prd_microfiber", match: "Grey_microfiber_cleaning", slug: "microfiber-cloth", name: "Microfiber cleaning cloth", description: "Reusable microfiber cleaning cloth.", category: "Household Essentials", price: 220 },
  { id: "prd_detergent", match: "Eco-friendly_detergent", slug: "laundry-detergent", name: "Eco laundry detergent", description: "Plant-based laundry detergent.", category: "Household Essentials", price: 680 },
  { id: "prd_detergent_pods", match: "Three_laundry_detergent_pods", slug: "detergent-pods", name: "Laundry detergent pods", description: "Concentrated laundry detergent pods.", category: "Household Essentials", price: 750 },
  { id: "prd_sponges", match: "Two_sponges", slug: "kitchen-sponges", name: "Kitchen sponges", description: "Dual kitchen sponges for dishes.", category: "Household Essentials", price: 180 },
  { id: "prd_bucket", match: "White_plastic_bucket", slug: "cleaning-bucket", name: "Cleaning bucket", description: "Sturdy bucket with wooden handle.", category: "Household Essentials", price: 550 },
  { id: "prd_mop", match: "Wooden_handle_mop", slug: "floor-mop", name: "Floor mop", description: "Wooden-handle mop for hard floors.", category: "Household Essentials", price: 980 },

  // Health & Wellness
  { id: "prd_lip_balm", match: "Aluminum_tube_of_lip_balm", slug: "lip-balm", name: "Lip balm", description: "Nourishing lip balm in an aluminum tube.", category: "Health & Wellness (non-prescription)", price: 320 },
  { id: "prd_vitamin_c", match: "Amber_glass_bottle_vitamin_C", slug: "vitamin-c", name: "Vitamin C capsules", description: "Vitamin C supplement in amber glass.", category: "Health & Wellness (non-prescription)", price: 1200 },
  { id: "prd_multivitamin", match: "Dark_glass_multivitamin", slug: "multivitamin", name: "Daily multivitamin", description: "Daily multivitamin capsules.", category: "Health & Wellness (non-prescription)", price: 1450 },
  { id: "prd_hand_sanitizer", match: "Frosted_glass_hand_sanitizer", slug: "hand-sanitizer", name: "Hand sanitizer", description: "Alcohol-based hand sanitizer.", category: "Health & Wellness (non-prescription)", price: 350 },
  { id: "prd_moisturizer", match: "Frosted_glass_jar_facial", slug: "facial-moisturizer", name: "Facial moisturizer", description: "Daily facial moisturizer in frosted glass.", category: "Health & Wellness (non-prescription)", price: 1600 },
  { id: "prd_craft_soap", match: "Hand-crafted_soap", slug: "handcrafted-soap", name: "Handcrafted soap", description: "Botanical handcrafted soap on a stone dish.", category: "Health & Wellness (non-prescription)", price: 480 },
  { id: "prd_first_aid", match: "Metal_white_first_aid", slug: "first-aid-kit", name: "First aid kit", description: "Compact metal first aid kit.", category: "Health & Wellness (non-prescription)", price: 2200 },
  { id: "prd_thermometer", match: "Minimalist_digital_thermometer", slug: "digital-thermometer", name: "Digital thermometer", description: "Fast-read digital thermometer.", category: "Health & Wellness (non-prescription)", price: 980 },
  { id: "prd_sunscreen", match: "Sleek_sunscreen_tube", slug: "sunscreen", name: "Daily sunscreen", description: "Broad-spectrum daily sunscreen.", category: "Health & Wellness (non-prescription)", price: 1350 },
  { id: "prd_bandages", match: "Stack_of_fabric_bandages", slug: "fabric-bandages", name: "Fabric bandages", description: "Soft fabric adhesive bandages.", category: "Health & Wellness (non-prescription)", price: 280 },

  // Groceries
  { id: "prd_sourdough", match: "Artisan_sourdough", slug: "sourdough-loaf", name: "Artisan sourdough loaf", description: "Freshly baked artisan sourdough loaf.", category: "Groceries", price: 450 },
  { id: "prd_peanut_butter", match: "Glass_jar_of_peanut_butter", slug: "peanut-butter", name: "Peanut butter", description: "Smooth natural peanut butter.", category: "Groceries", price: 520 },
  { id: "prd_strawberry_jam", match: "Glass_jar_of_strawberry_jam", slug: "strawberry-jam", name: "Strawberry jam", description: "Small-batch strawberry jam.", category: "Groceries", price: 480 },
  { id: "prd_coffee_beans", match: "Dark_glass_jar_coffee_beans", slug: "coffee-beans", name: "Coffee beans", description: "Roasted coffee beans in dark glass.", category: "Groceries", price: 950 },
  { id: "prd_black_tea", match: "Metal_tin_with_black_tea", slug: "black-tea", name: "Black tea tin", description: "Loose-leaf black tea in a metal tin.", category: "Groceries", price: 680 },
  { id: "prd_flour", match: "Linen_flour_bag", slug: "flour-bag", name: "Baking flour", description: "All-purpose flour in a linen bag.", category: "Groceries", price: 380 },
  { id: "prd_sea_salt", match: "Ceramic_jar_with_sea_salt", slug: "sea-salt", name: "Sea salt", description: "Flaky sea salt in a ceramic jar.", category: "Groceries", price: 420 },
  { id: "prd_lemons", match: "Two_lemons", slug: "lemons", name: "Fresh lemons", description: "Bright lemons for cooking and drinks.", category: "Groceries", price: 100 },
  { id: "prd_oranges", match: "Two_ripe_oranges", slug: "oranges", name: "Ripe oranges", description: "Juicy ripe oranges.", category: "Groceries", price: 160 },
  { id: "prd_bananas", match: "Yellow_bananas", slug: "bananas", name: "Yellow bananas", description: "Ripe yellow bananas.", category: "Groceries", price: 140 },

  // General Essentials
  { id: "prd_shopping_tote", match: "Cotton_canvas_shopping_tote", slug: "shopping-tote", name: "Canvas shopping tote", description: "Reusable cotton canvas shopping tote.", category: "General Essentials", price: 750 },
  { id: "prd_tissue_box", match: "Cardboard_tissue_box", slug: "tissue-box", name: "Tissue box", description: "Soft facial tissues in a cardboard box.", category: "General Essentials", price: 280 },
  { id: "prd_paper_towels", match: "Recycled_paper_towels", slug: "paper-towels", name: "Recycled paper towels", description: "Recycled paper towel roll.", category: "General Essentials", price: 320 },
  { id: "prd_toilet_paper", match: "Recycled_toilet_paper", slug: "toilet-paper", name: "Recycled toilet paper", description: "Soft recycled toilet paper.", category: "General Essentials", price: 450 },
  { id: "prd_water_bottle", match: "Reusable_glass_bottle_pure_water", slug: "water-bottle", name: "Reusable water bottle", description: "Reusable glass bottle for pure water.", category: "General Essentials", price: 890 },
  { id: "prd_bamboo_toothbrush", match: "Bamboo_toothbrush", slug: "bamboo-toothbrush", name: "Bamboo toothbrush", description: "Sustainable bamboo toothbrush.", category: "General Essentials", price: 250 },
  { id: "prd_toothpaste", match: "Minimalist_aluminum_tube_toothpaste", slug: "toothpaste", name: "Toothpaste", description: "Mint toothpaste in aluminum tube.", category: "General Essentials", price: 380 },
  { id: "prd_herbal_soap", match: "Herbal_soap_bar", slug: "herbal-soap", name: "Herbal soap bar", description: "Herbal soap bar wrapped in paper.", category: "General Essentials", price: 320 },
  { id: "prd_reed_diffuser", match: "Matte_white_reed_diffuser", slug: "reed-diffuser", name: "Reed diffuser", description: "Matte white reed diffuser for the home.", category: "General Essentials", price: 1800 },
  { id: "prd_rubber_gloves", match: "Yellow_rubber_gloves", slug: "rubber-gloves", name: "Rubber gloves", description: "Durable yellow rubber cleaning gloves.", category: "General Essentials", price: 280 },
];

const files = fs.readdirSync(srcDir).filter((f) => /\.jpe?g$/i.test(f));
fs.mkdirSync(dstDir, { recursive: true });

const used = new Set();
const missing = [];
const copied = [];

for (const item of CATALOGUE) {
  const file = files.find((f) => f.startsWith(item.match) && !used.has(f));
  if (!file) {
    missing.push(item);
    continue;
  }
  used.add(file);
  const destName = `${item.slug}.jpeg`;
  fs.copyFileSync(path.join(srcDir, file), path.join(dstDir, destName));
  copied.push({ ...item, image: `/products/${destName}`, src: file });
}

const unused = files.filter((f) => !used.has(f));

// Write JSON consumed by TypeScript seed (optional runtime import via fs)
const outJson = path.join(root, "lib", "seed-catalogue.json");
fs.writeFileSync(
  outJson,
  JSON.stringify(
    copied.map(({ id, name, description, category, price, image, slug }) => ({
      id,
      name,
      description,
      category,
      priceMajor: price,
      image,
      slug,
    })),
    null,
    2,
  ),
  "utf8",
);

console.log(`Copied ${copied.length}/${CATALOGUE.length} products → public/products`);
console.log(`Wrote ${outJson}`);
if (missing.length) {
  console.error("MISSING matches:", missing.map((m) => m.match));
  process.exitCode = 1;
}
if (unused.length) {
  console.warn("Unused asset files:", unused);
}

// category counts
const counts = {};
for (const p of copied) counts[p.category] = (counts[p.category] || 0) + 1;
console.log("Per category:", counts);

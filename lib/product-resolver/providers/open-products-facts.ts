import { createOpenFoodFactsProvider } from "@/lib/product-resolver/providers/open-food-facts";

/** Same v3 API shape as Open Food Facts, general consumer products. */
export const openProductsFactsProvider = createOpenFoodFactsProvider({
  host: "https://world.openproductsfacts.org",
  providerId: "open_products_facts",
});

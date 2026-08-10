import { getHomePageData } from "@/lib/home-page-data";
import ObscuraHome from "@/components/obscura/ObscuraHome";
import HomeBrowseClient from "@/components/marketplace/HomeBrowseClient";

export const revalidate = 60;

type SearchParams = Promise<{ category?: string; sort?: string }>;

export default async function HomePage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const sp = await searchParams;
  const category = sp.category || "all";
  const sort = sp.sort || "default";
  const { products, categories, hero, vendors } = await getHomePageData(48);

  if (category !== "all" || sort !== "default") {
    return (
      <HomeBrowseClient
        products={products}
        category={category}
        sort={sort}
      />
    );
  }

  return (
    <ObscuraHome
      products={products}
      categories={categories}
      hero={hero}
      vendors={vendors}
    />
  );
}

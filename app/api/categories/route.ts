import { NextRequest, NextResponse } from 'next/server';
import { softDeleteItem } from '@/lib/data';
import { listProducts } from '@/lib/products-store';
import { ensureNairobiSeed } from '@/lib/seed-nairobi';
import { Category } from '@/types';
import { createClient } from '@/lib/supabase/server';

function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

async function getProductCountByCategory(categoryName: string): Promise<number> {
  try {
    await ensureNairobiSeed();
    const products = await listProducts();
    return products.filter(
      (p) => p.category.toLowerCase() === categoryName.toLowerCase(),
    ).length;
  } catch {
    return 0;
  }
}

function mapCategoryFromDb(dbCategory: any): Category {
  return {
    id: dbCategory.id,
    name: dbCategory.name,
    description: dbCategory.description || '',
    slug: dbCategory.slug,
    image: dbCategory.image || '',
    icon: dbCategory.icon || '',
    productCount: dbCategory.product_count || 0,
    createdAt: dbCategory.created_at,
    updatedAt: dbCategory.updated_at,
  };
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('categories')
      .select('*')
      .order('name', { ascending: true });

    if (error) {
      // Categories table may not exist yet — soft-fail with empty list
      return NextResponse.json([]);
    }

    // Update product counts
    const categories = await Promise.all(
      (data || []).map(async (cat: { id: string; name: string; product_count: number }) => {
        const count = await getProductCountByCategory(cat.name);
        if (count !== cat.product_count) {
          // Update count in database
          await supabase
            .from('categories')
            .update({ product_count: count })
            .eq('id', cat.id);
          return { ...cat, product_count: count };
        }
        return cat;
      })
    );

    // Check for search query
    const searchParams = request.nextUrl.searchParams;
    const search = searchParams.get('search');
    
    let filteredCategories = categories.map(mapCategoryFromDb);
    if (search) {
      const searchLower = search.toLowerCase();
      filteredCategories = filteredCategories.filter(
        (cat: Category) =>
          cat.name.toLowerCase().includes(searchLower) ||
          cat.description?.toLowerCase().includes(searchLower) ||
          cat.slug.toLowerCase().includes(searchLower)
      );
    }
    
    return NextResponse.json(filteredCategories);
  } catch (error) {
    console.error('Failed to fetch categories:', error);
    return NextResponse.json({ error: 'Failed to fetch categories' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const body = await request.json();
    const { name, description, image, icon } = body;
    
    if (!name || !name.trim()) {
      return NextResponse.json({ error: 'Category name is required' }, { status: 400 });
    }
    
    const slug = generateSlug(name);
    
    // Check if category with same name or slug already exists
    const { data: existing } = await supabase
      .from('categories')
      .select('id')
      .or(`name.ilike.${name},slug.eq.${slug}`)
      .single();

    if (existing) {
      return NextResponse.json({ error: 'Category already exists' }, { status: 400 });
    }
    
    const { data, error } = await supabase
      .from('categories')
      .insert({
        name: name.trim(),
        description: description?.trim() || null,
        slug,
        image: image || null,
        icon: icon || null,
        product_count: 0,
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to add category: ${error.message}`);
    }
    
    return NextResponse.json(mapCategoryFromDb(data), { status: 201 });
  } catch (error) {
    console.error('Failed to add category:', error);
    return NextResponse.json({ error: 'Failed to add category' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const supabase = await createClient();
    const body = await request.json();
    const { id, name, description, image, icon } = body;
    
    if (!id) {
      return NextResponse.json({ error: 'Category ID is required' }, { status: 400 });
    }
    
    // Get existing category
    const { data: existingCategory, error: fetchError } = await supabase
      .from('categories')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError || !existingCategory) {
      return NextResponse.json({ error: 'Category not found' }, { status: 404 });
    }
    
    const slug = name ? generateSlug(name) : existingCategory.slug;
    
    // Check if another category has the same name or slug
    const { data: duplicate } = await supabase
      .from('categories')
      .select('id')
      .or(`name.ilike.${name || existingCategory.name},slug.eq.${slug}`)
      .neq('id', id)
      .single();

    if (duplicate) {
      return NextResponse.json({ error: 'Category name or slug already exists' }, { status: 400 });
    }
    
    const productCount = name 
      ? await getProductCountByCategory(name)
      : existingCategory.product_count;
    
    const { data, error } = await supabase
      .from('categories')
      .update({
        name: name?.trim() || existingCategory.name,
        description: description !== undefined ? description.trim() : existingCategory.description,
        slug,
        image: image !== undefined ? image : existingCategory.image,
        icon: icon !== undefined ? icon : existingCategory.icon,
        product_count: productCount,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update category: ${error.message}`);
    }
    
    return NextResponse.json(mapCategoryFromDb(data));
  } catch (error) {
    console.error('Failed to update category:', error);
    return NextResponse.json({ error: 'Failed to update category' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient();
    const searchParams = request.nextUrl.searchParams;
    const id = searchParams.get('id');
    
    if (!id) {
      return NextResponse.json({ error: 'Category ID is required' }, { status: 400 });
    }
    
    // Get category data before deleting
    const { data: categoryData, error: fetchError } = await supabase
      .from('categories')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError || !categoryData) {
      return NextResponse.json({ error: 'Category not found' }, { status: 404 });
    }

    // Soft delete (store in bin)
    await softDeleteItem('category', id, categoryData);
    
    // Actually delete category from Supabase
    const { error } = await supabase
      .from('categories')
      .delete()
      .eq('id', id);

    if (error) {
      return NextResponse.json({ error: 'Failed to delete category' }, { status: 500 });
    }
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to delete category:', error);
    return NextResponse.json({ error: 'Failed to delete category' }, { status: 500 });
  }
}

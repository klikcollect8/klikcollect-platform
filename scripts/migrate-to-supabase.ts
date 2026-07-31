import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { Product, Category, Order, User, ProductReview, ProductQuestion } from '../types';

// Load environment variables from .env.local or .env
const envPath = fs.existsSync(path.join(process.cwd(), '.env.local'))
  ? path.join(process.cwd(), '.env.local')
  : path.join(process.cwd(), '.env');

if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf-8');
  envContent.split('\n').forEach(line => {
    const [key, ...valueParts] = line.split('=');
    if (key && valueParts.length > 0) {
      const value = valueParts.join('=').trim().replace(/^["']|["']$/g, '');
      if (!process.env[key.trim()]) {
        process.env[key.trim()] = value;
      }
    }
  });
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase environment variables!');
  console.error('Required: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY');
  console.error('Please create a .env.local file with these variables.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// ID mapping for products (old string ID -> new UUID)
const productIdMap = new Map<string, string>();

async function migrateCategories() {
  console.log('Migrating categories...');
  const categoriesData = JSON.parse(
    fs.readFileSync(path.join(process.cwd(), 'data/categories.json'), 'utf-8')
  ) as Category[];

  for (const category of categoriesData) {
    const { data, error } = await supabase
      .from('categories')
      .upsert({
        name: category.name,
        slug: category.slug,
        description: category.description || null,
        image: category.image || null,
        icon: category.icon || null,
        product_count: category.productCount || 0,
        created_at: category.createdAt,
        updated_at: category.updatedAt,
      }, {
        onConflict: 'slug',
      })
      .select('id')
      .single();

    if (error) {
      console.error(`Error migrating category ${category.name}:`, error);
    } else {
      console.log(`Migrated category: ${category.name} -> ${data.id}`);
    }
  }
}

async function migrateProducts() {
  console.log('Migrating products...');
  const productsData = JSON.parse(
    fs.readFileSync(path.join(process.cwd(), 'data/products.json'), 'utf-8')
  ) as Product[];

  // First, get all categories to map category names to UUIDs
  const { data: categories } = await supabase.from('categories').select('id, slug, name');

  const categoryMap = new Map<string, string>();
  categories?.forEach(cat => {
    categoryMap.set(cat.name.toLowerCase(), cat.id);
    categoryMap.set(cat.slug.toLowerCase(), cat.id);
  });

  for (const product of productsData) {
    // Find category UUID
    const categoryId = categoryMap.get(product.category.toLowerCase()) || null;

    const { data, error } = await supabase
      .from('products')
      .insert({
        name: product.name,
        description: product.description,
        long_description: product.longDescription || null,
        price: product.price,
        image: product.image,
        images: product.images || [],
        category: product.category,
        category_id: categoryId,
        stock: product.stock,
        badges: product.badges || [],
        rating: product.rating || 0,
        review_count: product.reviewCount || 0,
        variations: product.variations || null,
        created_at: product.createdAt,
        updated_at: product.updatedAt,
      })
      .select('id')
      .single();

    if (error) {
      console.error(`Error migrating product ${product.name}:`, error);
    } else {
      productIdMap.set(product.id, data.id);
      console.log(`Migrated product: ${product.name} (${product.id} -> ${data.id})`);
    }
  }
}

async function migrateUsers() {
  console.log('Migrating users...');
  const usersData = JSON.parse(
    fs.readFileSync(path.join(process.cwd(), 'data/users.json'), 'utf-8')
  ) as User[];

  for (const user of usersData) {
    const { data, error } = await supabase
      .from('users')
      .upsert({
        id: user.id,
        email: user.email,
        password: user.password,
        role: user.role,
        created_at: new Date().toISOString(),
      }, {
        onConflict: 'email',
      })
      .select('id')
      .single();

    if (error) {
      console.error(`Error migrating user ${user.email}:`, error);
    } else {
      console.log(`Migrated user: ${user.email}`);
    }
  }
}

async function migrateOrders() {
  console.log('Migrating orders...');
  const ordersData = JSON.parse(
    fs.readFileSync(path.join(process.cwd(), 'data/orders.json'), 'utf-8')
  ) as Order[];

  for (const order of ordersData) {
    // Map product IDs in order items
    const mappedItems = order.items.map(item => ({
      ...item,
      product: {
        ...item.product,
        id: productIdMap.get(item.product.id) || item.product.id,
      },
    }));

    const { data, error } = await supabase
      .from('orders')
      .insert({
        order_number: order.orderNumber,
        customer_name: order.customerName,
        customer_email: order.customerEmail,
        customer_phone: order.customerPhone,
        total: order.total,
        status: order.status,
        pickup_date: order.pickupDate,
        pickup_time: order.pickupTime,
        items: mappedItems,
        created_at: order.createdAt,
        updated_at: order.createdAt,
      })
      .select('id')
      .single();

    if (error) {
      console.error(`Error migrating order ${order.orderNumber}:`, error);
    } else {
      console.log(`Migrated order: ${order.orderNumber} -> ${data.id}`);
    }
  }
}

async function migrateReviews() {
  console.log('Migrating reviews...');
  const reviewsData = JSON.parse(
    fs.readFileSync(path.join(process.cwd(), 'data/reviews.json'), 'utf-8')
  ) as ProductReview[];

  for (const review of reviewsData) {
    const productId = productIdMap.get(review.productId);
    if (!productId) {
      console.warn(`Skipping review for unknown product: ${review.productId}`);
      continue;
    }

    const { data, error } = await supabase
      .from('reviews')
      .insert({
        product_id: productId,
        user_name: review.userName,
        rating: review.rating,
        title: review.title,
        comment: review.comment,
        verified_purchase: review.verifiedPurchase,
        helpful_count: review.helpfulCount,
        created_at: review.createdAt,
        updated_at: review.createdAt,
        status: 'approved',
      })
      .select('id')
      .single();

    if (error) {
      console.error(`Error migrating review ${review.id}:`, error);
    } else {
      console.log(`Migrated review: ${review.id} -> ${data.id}`);
    }
  }
}

async function migrateQuestions() {
  console.log('Migrating questions...');
  const questionsData = JSON.parse(
    fs.readFileSync(path.join(process.cwd(), 'data/questions.json'), 'utf-8')
  ) as ProductQuestion[];

  for (const question of questionsData) {
    const productId = productIdMap.get(question.productId);
    if (!productId) {
      console.warn(`Skipping question for unknown product: ${question.productId}`);
      continue;
    }

    const { data, error } = await supabase
      .from('questions')
      .insert({
        product_id: productId,
        user_name: question.userName,
        question: question.question,
        answers: question.answers || [],
        created_at: question.createdAt,
        updated_at: question.createdAt,
        status: question.answers && question.answers.length > 0 ? 'answered' : 'pending',
      })
      .select('id')
      .single();

    if (error) {
      console.error(`Error migrating question ${question.id}:`, error);
    } else {
      console.log(`Migrated question: ${question.id} -> ${data.id}`);
    }
  }
}

async function migrateSettings() {
  console.log('Migrating settings...');
  const settingsData = JSON.parse(
    fs.readFileSync(path.join(process.cwd(), 'data/settings.json'), 'utf-8')
  );

  const { error } = await supabase
    .from('settings')
    .upsert({
      key: 'site_settings',
      value: settingsData,
      updated_at: new Date().toISOString(),
    }, {
      onConflict: 'key',
    });

  if (error) {
    console.error('Error migrating settings:', error);
  } else {
    console.log('Migrated settings');
  }
}

async function migrateHomepageSettings() {
  console.log('Migrating homepage settings...');
  const homepageData = JSON.parse(
    fs.readFileSync(path.join(process.cwd(), 'data/homepage-settings.json'), 'utf-8')
  );

  // Map product IDs in sections
  const mappedSections = homepageData.sections.map((section: any) => ({
    ...section,
    productIds: section.productIds?.map((id: string) => productIdMap.get(id) || id) || [],
  }));

  const { error } = await supabase
    .from('homepage_settings')
    .upsert({
      banner_message: homepageData.bannerMessage,
      banner_subtitle: homepageData.bannerSubtitle,
      banner_enabled: homepageData.bannerEnabled,
      banner_message_size: homepageData.bannerMessageSize,
      banner_subtitle_size: homepageData.bannerSubtitleSize,
      banner_message_sizes: homepageData.bannerMessageSizes,
      banner_subtitle_sizes: homepageData.bannerSubtitleSizes,
      sections: mappedSections,
      updated_at: new Date().toISOString(),
    }, {
      onConflict: 'id',
    });

  if (error) {
    console.error('Error migrating homepage settings:', error);
  } else {
    console.log('Migrated homepage settings');
  }
}

async function main() {
  try {
    await migrateCategories();
    await migrateProducts();
    await migrateUsers();
    await migrateOrders();
    await migrateReviews();
    await migrateQuestions();
    await migrateSettings();
    await migrateHomepageSettings();
    console.log('Migration completed successfully!');
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

main();


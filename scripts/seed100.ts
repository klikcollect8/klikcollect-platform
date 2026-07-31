import { addProduct } from '../lib/data';
import { ProductVariation } from '../types';

const categories = [
  'Electronics', 'Home & Office', 'Clothing', 'Sports & Outdoors', 
  'Appliances', 'Footwear', 'Accessories', 'Gaming', 'Books', 
  'Baby', 'Automotive', 'Music'
];

const productTemplates = [
  { baseName: 'Wireless Headphones', category: 'Electronics', basePrice: 199.99, stockRange: [15, 50] },
  { baseName: 'Smart Watch', category: 'Electronics', basePrice: 299.99, stockRange: [10, 40] },
  { baseName: 'Coffee Maker', category: 'Appliances', basePrice: 89.99, stockRange: [20, 60] },
  { baseName: 'Running Shoes', category: 'Footwear', basePrice: 129.99, stockRange: [15, 45] },
  { baseName: 'Backpack', category: 'Accessories', basePrice: 79.99, stockRange: [25, 70] },
  { baseName: 'Bluetooth Speaker', category: 'Electronics', basePrice: 69.99, stockRange: [20, 55] },
  { baseName: 'Laptop Stand', category: 'Accessories', basePrice: 49.99, stockRange: [30, 80] },
  { baseName: 'Wireless Mouse', category: 'Electronics', basePrice: 29.99, stockRange: [40, 100] },
  { baseName: 'Mechanical Keyboard', category: 'Electronics', basePrice: 149.99, stockRange: [10, 35] },
  { baseName: 'Desk Lamp', category: 'Home & Office', basePrice: 39.99, stockRange: [25, 70] },
  { baseName: 'Yoga Mat', category: 'Sports & Outdoors', basePrice: 34.99, stockRange: [30, 80] },
  { baseName: 'Water Bottle', category: 'Sports & Outdoors', basePrice: 24.99, stockRange: [40, 100] },
  { baseName: 'Phone Case', category: 'Accessories', basePrice: 19.99, stockRange: [50, 150] },
  { baseName: 'Tablet Stand', category: 'Accessories', basePrice: 15.99, stockRange: [60, 120] },
  { baseName: 'Wireless Charger', category: 'Electronics', basePrice: 22.99, stockRange: [45, 90] },
  { baseName: 'Cable Organizer', category: 'Accessories', basePrice: 12.99, stockRange: [70, 150] },
  { baseName: 'Monitor Stand', category: 'Accessories', basePrice: 89.99, stockRange: [15, 40] },
  { baseName: 'USB-C Hub', category: 'Electronics', basePrice: 45.99, stockRange: [25, 60] },
  { baseName: 'Webcam', category: 'Electronics', basePrice: 79.99, stockRange: [20, 50] },
  { baseName: 'Desk Organizer', category: 'Home & Office', basePrice: 27.99, stockRange: [35, 80] },
  { baseName: 'Standing Desk Converter', category: 'Home & Office', basePrice: 199.99, stockRange: [8, 25] },
  { baseName: 'Gaming Mouse', category: 'Gaming', basePrice: 79.99, stockRange: [20, 50] },
  { baseName: 'Gaming Headset', category: 'Gaming', basePrice: 129.99, stockRange: [15, 40] },
  { baseName: 'Gaming Chair', category: 'Gaming', basePrice: 299.99, stockRange: [5, 20] },
  { baseName: 'Fiction Book', category: 'Books', basePrice: 14.99, stockRange: [50, 200] },
  { baseName: 'Non-Fiction Book', category: 'Books', basePrice: 19.99, stockRange: [40, 150] },
  { baseName: 'Baby Stroller', category: 'Baby', basePrice: 199.99, stockRange: [10, 30] },
  { baseName: 'Baby Monitor', category: 'Baby', basePrice: 89.99, stockRange: [15, 40] },
  { baseName: 'Car Phone Mount', category: 'Automotive', basePrice: 24.99, stockRange: [40, 100] },
  { baseName: 'Car Charger', category: 'Automotive', basePrice: 19.99, stockRange: [50, 150] },
  { baseName: 'Guitar', category: 'Music', basePrice: 299.99, stockRange: [5, 20] },
  { baseName: 'Microphone', category: 'Music', basePrice: 149.99, stockRange: [10, 35] },
];

const colors = ['Black', 'White', 'Blue', 'Red', 'Gray', 'Silver', 'Green', 'Purple', 'Pink', 'Brown'];
const sizes = ['Small', 'Medium', 'Large', 'XL', 'XXL'];
const badges = ['Best Seller', "Amazon's Choice", 'New Arrival', 'Limited Edition'];

const unsplashImages = [
  'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=500',
  'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=500',
  'https://images.unsplash.com/photo-1517668808824-b7a0c59e1f77?w=500',
  'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=500',
  'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=500',
  'https://images.unsplash.com/photo-1608043152269-423dbba4e99e?w=500',
  'https://images.unsplash.com/photo-1527864550417-7fd91fc51a46?w=500',
  'https://images.unsplash.com/photo-1527814050087-3793815479db?w=500',
  'https://images.unsplash.com/photo-1541140532154-b024d705b90a?w=500',
  'https://images.unsplash.com/photo-1507473885765-e6ed057f782c?w=500',
  'https://images.unsplash.com/photo-1601925260368-ae2f83cf8b7f?w=500',
  'https://images.unsplash.com/photo-1602143407151-7111542de6e8?w=500',
  'https://images.unsplash.com/photo-1601972602237-8c79241f8eb6?w=500',
  'https://images.unsplash.com/photo-1586953208448-b95a79798f07?w=500',
  'https://images.unsplash.com/photo-1580910051074-3eb694886505?w=500',
  'https://images.unsplash.com/photo-1587825140708-dfaf72ae4b04?w=500',
];

function getRandomElement<T>(array: T[]): T {
  return array[Math.floor(Math.random() * array.length)];
}

function getRandomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function getRandomFloat(min: number, max: number, decimals: number = 2): number {
  return parseFloat((Math.random() * (max - min) + min).toFixed(decimals));
}

function generateProduct(index: number) {
  const template = getRandomElement(productTemplates);
  const variant = index % 5; // Create variants of the same product
  const name = variant === 0 ? template.baseName : `${template.baseName} ${variant}`;
  
  const priceVariation = getRandomFloat(0.8, 1.2); // ±20% price variation
  const price = Math.round(template.basePrice * priceVariation * 100) / 100;
  
  const stock = getRandomInt(template.stockRange[0], template.stockRange[1]);
  const rating = getRandomFloat(3.5, 5.0, 1);
  const reviewCount = getRandomInt(50, 5000);
  
  // Random badges (30% chance)
  const productBadges: string[] = [];
  if (Math.random() > 0.7) {
    const numBadges = Math.random() > 0.5 ? 1 : 2;
    for (let i = 0; i < numBadges; i++) {
      const badge = getRandomElement(badges);
      if (!productBadges.includes(badge)) {
        productBadges.push(badge);
      }
    }
  }
  
  // Random variations (50% chance)
  const variations: ProductVariation[] = [];
  if (Math.random() > 0.5) {
    if (Math.random() > 0.5) {
      variations.push({
        name: 'Color',
        options: [getRandomElement(colors), getRandomElement(colors), getRandomElement(colors)].filter((v, i, a) => a.indexOf(v) === i),
      });
    }
    if (Math.random() > 0.5 && template.category === 'Footwear' || template.category === 'Clothing') {
      variations.push({
        name: 'Size',
        options: sizes.slice(0, getRandomInt(3, 5)),
      });
    }
  }
  
  const mainImage = getRandomElement(unsplashImages);
  const additionalImages = [
    mainImage,
    getRandomElement(unsplashImages),
    getRandomElement(unsplashImages),
  ].filter((v, i, a) => a.indexOf(v) === i);
  
  return {
    name,
    description: `${name} - High quality product with excellent features and great value for money.`,
    longDescription: `Experience the best with our ${name}. This premium product offers outstanding quality, durability, and performance. Perfect for everyday use, it combines style and functionality to meet all your needs.`,
    price,
    image: mainImage,
    images: additionalImages.length > 1 ? additionalImages : undefined,
    category: template.category,
    stock,
    badges: productBadges.length > 0 ? productBadges : undefined,
    variations: variations.length > 0 ? variations : undefined,
    rating: Math.round(rating * 10) / 10,
    reviewCount,
    status: 'published' as const,
  };
}

async function seed100() {
  console.log('Generating 100 products...');
  
  for (let i = 0; i < 100; i++) {
    const product = generateProduct(i);
    addProduct(product);
    console.log(`${i + 1}/100: Added ${product.name} - $${product.price.toFixed(2)}`);
  }
  
  console.log('\n✅ Successfully added 100 products!');
}

seed100().catch(console.error);







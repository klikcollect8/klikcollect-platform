import { addProduct } from '../lib/data';

const sampleProducts = [
  {
    name: 'Wireless Headphones',
    description: 'Premium wireless headphones with noise cancellation and 30-hour battery life.',
    longDescription: 'Experience premium audio quality with these state-of-the-art wireless headphones. Featuring advanced active noise cancellation technology that blocks out ambient noise, allowing you to immerse yourself in your music. With a remarkable 30-hour battery life, you can enjoy uninterrupted listening all day long.',
    price: 199.99,
    image: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=500',
    images: [
      'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=500',
      'https://images.unsplash.com/photo-1484704849700-f032a568e944?w=500',
      'https://images.unsplash.com/photo-1546435770-a3e426bf472b?w=500'
    ],
    category: 'Electronics',
    stock: 25, status: "published" as const,
    badges: ['Best Seller', "Amazon's Choice"],
    variations: [{ name: 'Color', options: ['Black', 'White', 'Blue'], selected: 'Black' }],
    rating: 4.7,
    reviewCount: 3247,
  },
  {
    name: 'Smart Watch',
    description: 'Feature-rich smartwatch with fitness tracking, heart rate monitor, and GPS.',
    longDescription: 'Stay connected and track your fitness goals with this advanced smartwatch. Features include continuous heart rate monitoring, built-in GPS for accurate workout tracking, and water resistance up to 50 meters.',
    price: 299.99,
    image: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=500',
    images: [
      'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=500',
      'https://images.unsplash.com/photo-1551816230-ef5deaed4a26?w=500',
      'https://images.unsplash.com/photo-1579586337278-3befd40fd17a?w=500'
    ],
    category: 'Electronics',
    stock: 15, status: "published" as const,
    badges: ["Amazon's Choice", 'New Arrival'],
    variations: [
      { name: 'Size', options: ['40mm', '44mm'], selected: '44mm' },
      { name: 'Color', options: ['Black', 'Silver', 'Rose Gold'], selected: 'Black' }
    ],
    rating: 4.6,
    reviewCount: 1892,
  },
  {
    name: 'Coffee Maker',
    description: 'Programmable coffee maker with thermal carafe, perfect for your morning brew.',
    longDescription: 'Start your day right with this programmable coffee maker featuring a double-wall thermal carafe that keeps your coffee hot for hours without a warming plate.',
    price: 89.99,
    image: 'https://images.unsplash.com/photo-1517668808824-b7a0c59e1f77?w=500',
    images: [
      'https://images.unsplash.com/photo-1517668808824-b7a0c59e1f77?w=500',
      'https://images.unsplash.com/photo-1559056199-641a0ac8b55e?w=500',
      'https://images.unsplash.com/photo-1517487881594-2787fef5ebf7?w=500'
    ],
    category: 'Appliances',
    stock: 30, status: "published" as const,
    badges: ['Best Seller'],
    variations: [{ name: 'Capacity', options: ['8 Cup', '12 Cup'], selected: '12 Cup' }],
    rating: 4.8,
    reviewCount: 4567,
  },
  {
    name: 'Running Shoes',
    description: 'Comfortable running shoes with cushioned sole and breathable mesh upper.',
    longDescription: 'Designed for serious runners, these shoes feature advanced cushioning technology that provides superior shock absorption and energy return.',
    price: 129.99,
    image: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=500',
    images: [
      'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=500',
      'https://images.unsplash.com/photo-1460353581641-37baddab0fa2?w=500',
      'https://images.unsplash.com/photo-1608231387032-6d2876b9b59d?w=500'
    ],
    category: 'Footwear',
    stock: 20, status: "published" as const,
    badges: ['Best Seller'],
    variations: [
      { name: 'Size', options: ['7', '8', '9', '10', '11', '12'], selected: '10' },
      { name: 'Color', options: ['Black/White', 'Blue/White', 'Red/Black'], selected: 'Black/White' }
    ],
    rating: 4.5,
    reviewCount: 2891,
  },
  {
    name: 'Backpack',
    description: 'Durable backpack with laptop compartment and multiple pockets for daily use.',
    longDescription: 'This versatile backpack is perfect for students, professionals, or travelers. Features a padded laptop compartment that fits up to 15.6-inch laptops.',
    price: 79.99,
    image: 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=500',
    images: [
      'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=500',
      'https://images.unsplash.com/photo-1581605405669-fcdf81165afa?w=500',
      'https://images.unsplash.com/photo-1622560480605-d83c853bc5c3?w=500'
    ],
    category: 'Accessories',
    stock: 40, status: "published" as const,
    badges: ["Amazon's Choice"],
    variations: [{ name: 'Color', options: ['Black', 'Gray', 'Navy Blue'], selected: 'Black' }],
    rating: 4.4,
    reviewCount: 1234,
  },
  {
    name: 'Bluetooth Speaker',
    description: 'Portable Bluetooth speaker with 360-degree sound and waterproof design.',
    longDescription: 'Take your music anywhere with this powerful portable Bluetooth speaker. The 360-degree sound design ensures everyone can enjoy the music.',
    price: 69.99,
    image: 'https://images.unsplash.com/photo-1608043152269-423dbba4e99e?w=500',
    images: [
      'https://images.unsplash.com/photo-1608043152269-423dbba4e99e?w=500',
      'https://images.unsplash.com/photo-1545454675-3531baf60c04?w=500',
      'https://images.unsplash.com/photo-1608043152269-423dbba4e99e?w=500'
    ],
    category: 'Electronics',
    stock: 35, status: "published" as const,
    badges: ['Best Seller', "Amazon's Choice"],
    variations: [{ name: 'Color', options: ['Black', 'Blue', 'Red'], selected: 'Black' }],
    rating: 4.7,
    reviewCount: 5234,
  },
  {
    name: 'Laptop Stand',
    description: 'Ergonomic aluminum laptop stand with adjustable height and ventilation.',
    longDescription: 'Improve your workspace ergonomics with this premium aluminum laptop stand. Features adjustable height settings and built-in ventilation to keep your laptop cool.',
    price: 49.99,
    image: 'https://images.unsplash.com/photo-1527864550417-7fd91fc51a46?w=500',
    images: [
      'https://images.unsplash.com/photo-1527864550417-7fd91fc51a46?w=500',
      'https://images.unsplash.com/photo-1586953208448-b95a79798f07?w=500'
    ],
    category: 'Accessories',
    stock: 50, status: "published" as const,
    badges: ["Amazon's Choice"],
    variations: [{ name: 'Color', options: ['Silver', 'Black'], selected: 'Silver' }],
    rating: 4.6,
    reviewCount: 2156,
  },
  {
    name: 'Wireless Mouse',
    description: 'Ergonomic wireless mouse with long battery life and precise tracking.',
    longDescription: 'Work comfortably with this ergonomic wireless mouse. Features 12-month battery life, precise optical tracking, and comfortable design for extended use.',
    price: 29.99,
    image: 'https://images.unsplash.com/photo-1527814050087-3793815479db?w=500',
    images: [
      'https://images.unsplash.com/photo-1527814050087-3793815479db?w=500',
      'https://images.unsplash.com/photo-1615663245857-ac93bb7c39e7?w=500'
    ],
    category: 'Electronics',
    stock: 60, status: "published" as const,
    badges: ['Best Seller'],
    variations: [{ name: 'Color', options: ['Black', 'White', 'Gray'], selected: 'Black' }],
    rating: 4.5,
    reviewCount: 3421,
  },
  {
    name: 'Mechanical Keyboard',
    description: 'RGB backlit mechanical keyboard with tactile switches and programmable keys.',
    longDescription: 'Experience the satisfying click of mechanical switches with this RGB backlit keyboard. Features customizable RGB lighting, programmable macro keys, and durable construction.',
    price: 149.99,
    image: 'https://images.unsplash.com/photo-1541140532154-b024d705b90a?w=500',
    images: [
      'https://images.unsplash.com/photo-1541140532154-b024d705b90a?w=500',
      'https://images.unsplash.com/photo-1587829741301-dc798b83add3?w=500'
    ],
    category: 'Electronics',
    stock: 18, status: "published" as const,
    badges: ["Amazon's Choice"],
    variations: [{ name: 'Switch Type', options: ['Blue', 'Brown', 'Red'], selected: 'Brown' }],
    rating: 4.8,
    reviewCount: 1876,
  },
  {
    name: 'Desk Lamp',
    description: 'LED desk lamp with adjustable brightness and color temperature.',
    longDescription: 'Illuminate your workspace with this modern LED desk lamp. Features touch controls, adjustable brightness, and color temperature settings for optimal lighting.',
    price: 39.99,
    image: 'https://images.unsplash.com/photo-1507473885765-e6ed057f782c?w=500',
    images: [
      'https://images.unsplash.com/photo-1507473885765-e6ed057f782c?w=500',
      'https://images.unsplash.com/photo-1513506003901-1e6a229e2d15?w=500'
    ],
    category: 'Home & Office',
    stock: 45, status: "published" as const,
    badges: ['Best Seller'],
    variations: [{ name: 'Color', options: ['White', 'Black'], selected: 'White' }],
    rating: 4.4,
    reviewCount: 1234,
  },
  {
    name: 'Yoga Mat',
    description: 'Non-slip yoga mat with carrying strap, perfect for all yoga practices.',
    longDescription: 'Practice yoga comfortably with this premium non-slip mat. Features superior grip, extra cushioning, and comes with a carrying strap for easy transport.',
    price: 34.99,
    image: 'https://images.unsplash.com/photo-1601925260368-ae2f83cf8b7f?w=500',
    images: [
      'https://images.unsplash.com/photo-1601925260368-ae2f83cf8b7f?w=500',
      'https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?w=500'
    ],
    category: 'Sports & Outdoors',
    stock: 55, status: "published" as const,
    badges: ["Amazon's Choice"],
    variations: [{ name: 'Color', options: ['Purple', 'Blue', 'Pink'], selected: 'Purple' }],
    rating: 4.6,
    reviewCount: 2890,
  },
  {
    name: 'Water Bottle',
    description: 'Stainless steel insulated water bottle keeps drinks cold for 24 hours.',
    longDescription: 'Stay hydrated with this premium stainless steel water bottle. Double-wall insulation keeps drinks cold for 24 hours or hot for 12 hours. Leak-proof design.',
    price: 24.99,
    image: 'https://images.unsplash.com/photo-1602143407151-7111542de6e8?w=500',
    images: [
      'https://images.unsplash.com/photo-1602143407151-7111542de6e8?w=500',
      'https://images.unsplash.com/photo-1523362628745-0c100150b504?w=500'
    ],
    category: 'Sports & Outdoors',
    stock: 70, status: "published" as const,
    badges: ['Best Seller'],
    variations: [{ name: 'Size', options: ['20oz', '32oz', '40oz'], selected: '32oz' }],
    rating: 4.7,
    reviewCount: 4567,
  },
  {
    name: 'Phone Case',
    description: 'Protective phone case with shock absorption and screen protection.',
    longDescription: 'Protect your phone with this rugged case featuring military-grade drop protection. Includes screen protector and precise cutouts for all ports.',
    price: 19.99,
    image: 'https://images.unsplash.com/photo-1601972602237-8c79241f8eb6?w=500',
    images: [
      'https://images.unsplash.com/photo-1601972602237-8c79241f8eb6?w=500',
      'https://images.unsplash.com/photo-1601972602237-8c79241f8eb6?w=500'
    ],
    category: 'Accessories',
    stock: 100, status: "published" as const,
    badges: ["Amazon's Choice"],
    variations: [{ name: 'Color', options: ['Black', 'Clear', 'Blue'], selected: 'Black' }],
    rating: 4.3,
    reviewCount: 5678,
  },
  {
    name: 'Tablet Stand',
    description: 'Adjustable tablet stand for comfortable viewing and typing.',
    longDescription: 'Perfect for watching videos or video calls, this adjustable stand holds tablets securely at multiple angles. Compact and portable design.',
    price: 15.99,
    image: 'https://images.unsplash.com/photo-1586953208448-b95a79798f07?w=500',
    images: [
      'https://images.unsplash.com/photo-1586953208448-b95a79798f07?w=500',
      'https://images.unsplash.com/photo-1527864550417-7fd91fc51a46?w=500'
    ],
    category: 'Accessories',
    stock: 80, status: "published" as const,
    badges: ['Best Seller'],
    variations: [{ name: 'Color', options: ['Black', 'Silver'], selected: 'Black' }],
    rating: 4.5,
    reviewCount: 2345,
  },
  {
    name: 'Wireless Charger',
    description: 'Fast wireless charging pad compatible with all Qi-enabled devices.',
    longDescription: 'Charge your phone wirelessly with this fast-charging pad. Works with all Qi-enabled smartphones. LED indicator shows charging status.',
    price: 22.99,
    image: 'https://images.unsplash.com/photo-1580910051074-3eb694886505?w=500',
    images: [
      'https://images.unsplash.com/photo-1580910051074-3eb694886505?w=500',
      'https://images.unsplash.com/photo-1609091839311-d5365f5dfe91?w=500'
    ],
    category: 'Electronics',
    stock: 65, status: "published" as const,
    badges: ["Amazon's Choice"],
    variations: [{ name: 'Color', options: ['Black', 'White'], selected: 'Black' }],
    rating: 4.6,
    reviewCount: 3456,
  },
  {
    name: 'Cable Organizer',
    description: 'Cable management system to keep your desk tidy and organized.',
    longDescription: 'Organize all your cables with this management system. Includes cable clips, ties, and routing channels to keep your workspace neat.',
    price: 12.99,
    image: 'https://images.unsplash.com/photo-1586953208448-b95a79798f07?w=500',
    images: [
      'https://images.unsplash.com/photo-1586953208448-b95a79798f07?w=500'
    ],
    category: 'Accessories',
    stock: 90, status: "published" as const,
    badges: ['Best Seller'],
    variations: [],
    rating: 4.4,
    reviewCount: 1876,
  },
  {
    name: 'Monitor Stand',
    description: 'Dual monitor stand with adjustable height and tilt for ergonomic setup.',
    longDescription: 'Create the perfect dual monitor setup with this adjustable stand. Supports monitors up to 27 inches. Saves desk space and improves ergonomics.',
    price: 89.99,
    image: 'https://images.unsplash.com/photo-1527864550417-7fd91fc51a46?w=500',
    images: [
      'https://images.unsplash.com/photo-1527864550417-7fd91fc51a46?w=500',
      'https://images.unsplash.com/photo-1586953208448-b95a79798f07?w=500'
    ],
    category: 'Accessories',
    stock: 25, status: "published" as const,
    badges: ["Amazon's Choice"],
    variations: [{ name: 'Color', options: ['Black', 'Silver'], selected: 'Black' }],
    rating: 4.7,
    reviewCount: 1234,
  },
  {
    name: 'USB-C Hub',
    description: 'Multi-port USB-C hub with HDMI, USB 3.0, and SD card reader.',
    longDescription: 'Expand your laptop connectivity with this USB-C hub. Features HDMI output, multiple USB ports, SD card reader, and power delivery pass-through.',
    price: 45.99,
    image: 'https://images.unsplash.com/photo-1586953208448-b95a79798f07?w=500',
    images: [
      'https://images.unsplash.com/photo-1586953208448-b95a79798f07?w=500'
    ],
    category: 'Electronics',
    stock: 40, status: "published" as const,
    badges: ['Best Seller'],
    variations: [],
    rating: 4.5,
    reviewCount: 2987,
  },
  {
    name: 'Webcam',
    description: '1080p HD webcam with autofocus and built-in microphone.',
    longDescription: 'Crystal clear video calls with this 1080p HD webcam. Features autofocus, built-in noise-canceling microphone, and privacy shutter.',
    price: 79.99,
    image: 'https://images.unsplash.com/photo-1587825140708-dfaf72ae4b04?w=500',
    images: [
      'https://images.unsplash.com/photo-1587825140708-dfaf72ae4b04?w=500',
      'https://images.unsplash.com/photo-1601972602237-8c79241f8eb6?w=500'
    ],
    category: 'Electronics',
    stock: 30, status: "published" as const,
    badges: ["Amazon's Choice"],
    variations: [],
    rating: 4.6,
    reviewCount: 3456,
  },
  {
    name: 'Desk Organizer',
    description: 'Bamboo desk organizer with multiple compartments for office supplies.',
    longDescription: 'Keep your desk organized with this elegant bamboo organizer. Features multiple compartments for pens, paper clips, and other office supplies.',
    price: 27.99,
    image: 'https://images.unsplash.com/photo-1586953208448-b95a79798f07?w=500',
    images: [
      'https://images.unsplash.com/photo-1586953208448-b95a79798f07?w=500'
    ],
    category: 'Home & Office',
    stock: 50, status: "published" as const,
    badges: ['Best Seller'],
    variations: [],
    rating: 4.5,
    reviewCount: 1876,
  },
  {
    name: 'Standing Desk Converter',
    description: 'Adjustable standing desk converter for healthier work posture.',
    longDescription: 'Transform your desk into a standing workstation with this adjustable converter. Easy to raise and lower, supports monitors and laptops.',
    price: 199.99,
    image: 'https://images.unsplash.com/photo-1527864550417-7fd91fc51a46?w=500',
    images: [
      'https://images.unsplash.com/photo-1527864550417-7fd91fc51a46?w=500',
      'https://images.unsplash.com/photo-1586953208448-b95a79798f07?w=500'
    ],
    category: 'Home & Office',
    stock: 15, status: "published" as const,
    badges: ["Amazon's Choice"],
    variations: [{ name: 'Size', options: ['Small', 'Large'], selected: 'Large' }],
    rating: 4.7,
    reviewCount: 987,
  },
];

async function seed() {
  console.log('Seeding products...');
  for (const product of sampleProducts) {
    addProduct(product);
    console.log(`Added: ${product.name}`);
  }
  console.log('Seeding complete!');
}

seed();

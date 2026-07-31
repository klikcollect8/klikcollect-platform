export interface ProductReview {
  id: string;
  productId: string;
  userName: string;
  rating: number;
  title: string;
  comment: string;
  verifiedPurchase: boolean;
  helpfulCount: number;
  createdAt: string;
  answers?: ReviewAnswer[];
}

export interface ReviewAnswer {
  id: string;
  reviewId: string;
  userName: string;
  answer: string;
  helpfulCount: number;
  createdAt: string;
}

export interface ProductQuestion {
  id: string;
  productId: string;
  userName: string;
  question: string;
  answers: ProductAnswer[];
  createdAt: string;
}

export interface ProductAnswer {
  id: string;
  userName: string;
  answer: string;
  helpfulCount: number;
  createdAt: string;
}

export interface ProductVariation {
  name: string;
  options: string[];
  selected?: string;
}

/** Vendor sellable offer for a canonical product */
export interface ProductOffer {
  id: string;
  productId: string;
  vendorId: string;
  vendorName: string;
  neighbourhood?: string;
  price: number;
  moneyMinor: number;
  onHand: number;
  reserved: number;
  /** Available = onHand − reserved */
  stock: number;
  status: "published" | "archived";
  barcode?: string;
  gtin?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Product {
  id: string;
  name: string;
  description: string;
  longDescription?: string;
  /** Display/listing may omit; price lives on ProductOffer */
  price?: number;
  image: string;
  images?: string[];
  category: string;
  /** Aggregate availability across offers; prefer offer.stock at checkout */
  stock?: number;
  status: 'draft' | 'pending_review' | 'published' | 'archived';
  badges?: string[];
  variations?: ProductVariation[];
  rating?: number;
  reviewCount?: number;
  /** @deprecated Prefer offers — kept for cart snapshots / legacy */
  vendorName?: string;
  neighbourhood?: string;
  /** Offer count for listings (optional) */
  offerCount?: number;
  /** Detail responses may include vendor offers */
  offers?: ProductOffer[];
  createdAt: string;
  updatedAt: string;
}

export type FulfilmentMethod = "pickup" | "delivery";

export interface CartItem {
  product: Product;
  quantity: number;
  /** Selected vendor offer — required for multi-vendor products */
  offerId?: string;
  /** Snapshots from the chosen offer */
  offerPrice?: number;
  vendorId?: string;
  vendorName?: string;
  neighbourhood?: string;
  /** How the customer wants to receive the item */
  fulfilment?: FulfilmentMethod;
}

export interface Order {
  id: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  items: CartItem[];
  total: number;
  status: 'pending' | 'confirmed' | 'ready' | 'collected' | 'cancelled';
  pickupDate: string;
  pickupTime: string;
  createdAt: string;
  orderNumber: string;
  paymentStatus: 'pending' | 'paid' | 'failed' | 'abandoned';
  paymentReference?: string;
  paymentMethod?: string;
  paymentChannel?: string;
  paidAt?: string;
}

export interface User {
  id: string;
  email: string;
  password: string; // In production, this should be hashed
  role: 'admin' | 'user';
}

export interface Category {
  id: string;
  name: string;
  description?: string;
  slug: string;
  image?: string;
  icon?: string;
  productCount?: number;
  createdAt: string;
  updatedAt: string;
}

export interface DeletedItem {
  id: string;
  itemType: 'product' | 'review' | 'question' | 'answer' | 'category' | 'order';
  itemId: string;
  itemData: any;
  deletedBy?: string;
  deletedAt: string;
  restoredAt?: string;
  permanentlyDeletedAt?: string;
  reason?: string;
}


/**
 * LEGACY - Supabase + JSON fallback helpers.
 *
 * Prefer M1 local truth:
 * lib/commerce-truth.ts, catalogue-store, orders-store, customer-store, m1-store
 *
 * Narrow remaining imports; do not add new call sites.
 */
import {
  Product,
  Order,
  User,
  ProductReview,
  ProductQuestion,
  DeletedItem,
  ReviewAnswer,
} from "@/types";
import { createClient } from "./supabase/server";
import { PRODUCT_IMAGE_FALLBACK } from "./product-image";
import { productImageUrl } from "@/lib/storage-urls";

// Basic fallback catalog used when Supabase isn't available so the site still works.
const fallbackProducts: Product[] = [
  {
    id: "fallback-1",
    name: "Baby spinach bunch",
    description: "Tender baby spinach leaves for salads and sautés.",
    longDescription: "Tender baby spinach leaves for salads and sautés.",
    price: 180,
    image: productImageUrl("baby-spinach.jpeg"),
    images: [productImageUrl("baby-spinach.jpeg")],
    category: "Fresh Produce",
    stock: 25,
    status: "published",
    badges: [],
    variations: [],
    rating: 4.7,
    reviewCount: 124,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "fallback-2",
    name: "Organic milk",
    description: "Full-cream organic milk in glass.",
    longDescription: "Full-cream organic milk in glass.",
    price: 240,
    image: productImageUrl("organic-milk.jpeg"),
    images: [productImageUrl("organic-milk.jpeg")],
    category: "Dairy & Eggs",
    stock: 15,
    status: "published",
    badges: [],
    variations: [],
    rating: 4.6,
    reviewCount: 89,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "fallback-3",
    name: "Extra virgin olive oil",
    description: "Cold-pressed olive oil in dark glass.",
    longDescription: "Cold-pressed olive oil in dark glass.",
    price: 890,
    image: productImageUrl("olive-oil.jpeg"),
    images: [productImageUrl("olive-oil.jpeg")],
    category: "Pantry",
    stock: 30,
    status: "published",
    badges: [],
    variations: [],
    rating: 4.8,
    reviewCount: 210,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "fallback-4",
    name: "Artisan sourdough loaf",
    description: "Freshly baked artisan sourdough loaf.",
    longDescription: "Freshly baked artisan sourdough loaf.",
    price: 450,
    image: productImageUrl("sourdough-loaf.jpeg"),
    images: [productImageUrl("sourdough-loaf.jpeg")],
    category: "Groceries",
    stock: 20,
    status: "published",
    badges: [],
    variations: [],
    rating: 4.5,
    reviewCount: 156,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

// Helper to convert Supabase product to Product type
function mapProductFromDb(dbProduct: any): Product {
  // Safely convert price, handling null/undefined/NaN
  const priceValue = dbProduct.price != null ? Number(dbProduct.price) : 0;
  const price = isNaN(priceValue) ? 0 : priceValue;

  // Handle image - filter out empty strings and ensure we have at least one valid image
  const mainImage =
    dbProduct.image &&
    typeof dbProduct.image === "string" &&
    dbProduct.image.trim() !== ""
      ? dbProduct.image
      : undefined;

  // Handle images array - filter out empty strings
  const imagesArray = Array.isArray(dbProduct.images)
    ? dbProduct.images.filter(
        (img: any) => img && typeof img === "string" && img.trim() !== "",
      )
    : [];

  // If no main image but we have images array, use first image
  const finalImage =
    mainImage || (imagesArray.length > 0 ? imagesArray[0] : undefined);

  // Ensure images array includes the main image if it exists
  const finalImages =
    finalImage && !imagesArray.includes(finalImage)
      ? [finalImage, ...imagesArray]
      : imagesArray.length > 0
        ? imagesArray
        : finalImage
          ? [finalImage]
          : [];

  return {
    id: dbProduct.id,
    name: dbProduct.name || "Unnamed Product",
    description: dbProduct.description || "",
    longDescription: dbProduct.long_description || undefined,
    price: price,
    image: finalImage,
    images: finalImages,
    category: dbProduct.category || "",
    stock: dbProduct.stock != null ? Number(dbProduct.stock) : 0,
    status: dbProduct.status || "published",
    badges: Array.isArray(dbProduct.badges) ? dbProduct.badges : [],
    variations: dbProduct.variations || undefined,
    rating: dbProduct.rating ? Number(dbProduct.rating) : undefined,
    reviewCount: dbProduct.review_count || undefined,
    createdAt: dbProduct.created_at,
    updatedAt: dbProduct.updated_at,
  };
}

// Helper to convert Supabase order to Order type
function mapOrderFromDb(dbOrder: any): Order {
  return {
    id: dbOrder.id,
    orderNumber: dbOrder.order_number,
    customerName: dbOrder.customer_name,
    customerEmail: dbOrder.customer_email,
    customerPhone: dbOrder.customer_phone,
    items: dbOrder.items || [],
    total: Number(dbOrder.total),
    status: dbOrder.status,
    pickupDate: dbOrder.pickup_date,
    pickupTime: dbOrder.pickup_time,
    createdAt: dbOrder.created_at,
    paymentStatus: dbOrder.payment_status || "pending",
    paymentReference: dbOrder.payment_reference || undefined,
    paymentMethod: dbOrder.payment_method || undefined,
    paymentChannel: dbOrder.payment_channel || undefined,
    paidAt: dbOrder.paid_at || undefined,
  };
}

// Helper to convert Supabase review to ProductReview type
function mapReviewFromDb(dbReview: any): ProductReview {
  return {
    id: dbReview.id,
    productId: dbReview.product_id,
    userName: dbReview.user_name,
    rating: dbReview.rating,
    title: dbReview.title,
    comment: dbReview.comment,
    verifiedPurchase: dbReview.verified_purchase || false,
    helpfulCount: dbReview.helpful_count || 0,
    createdAt: dbReview.created_at,
    answers: dbReview.answers || [],
  };
}

// Helper to convert Supabase question to ProductQuestion type
function mapQuestionFromDb(dbQuestion: any): ProductQuestion {
  return {
    id: dbQuestion.id,
    productId: dbQuestion.product_id,
    userName: dbQuestion.user_name,
    question: dbQuestion.question,
    answers: dbQuestion.answers || [],
    createdAt: dbQuestion.created_at,
  };
}

export async function getProducts(): Promise<Product[]> {
  try {
    // Try admin client first (bypasses RLS), fallback to regular client
    const { createAdminClient } = await import("./supabase/server");
    const adminClient = createAdminClient();
    const supabase = adminClient || (await createClient());

    // Get total count first
    const { count, error: countError } = await supabase
      .from("products")
      .select("*", { count: "exact", head: true });

    const totalProducts = count || 0;

    if (totalProducts === 0) {
      // Try fetching without count as fallback
      const { data, error } = await supabase
        .from("products")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) return fallbackProducts;

      if (data && Array.isArray(data)) {
        const mapped = data.map(mapProductFromDb);
        return mapped.length > 0 ? mapped : fallbackProducts;
      }

      return fallbackProducts;
    }

    // Fetch all products in batches of 1000
    const batchSize = 1000;
    const allProducts: any[] = [];
    const totalBatches = Math.ceil(totalProducts / batchSize);

    for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
      const from = batchIndex * batchSize;
      const to = Math.min(from + batchSize - 1, totalProducts - 1);

      const { data, error } = await supabase
        .from("products")
        .select("*")
        .order("created_at", { ascending: false })
        .range(from, to);

      if (error) continue;

      if (data && Array.isArray(data)) {
        allProducts.push(...data);
      }
    }

    if (allProducts.length > 0) {
      return allProducts.map(mapProductFromDb);
    }
    return fallbackProducts;
  } catch {
    return fallbackProducts;
  }
}

export async function getProduct(id: string): Promise<Product | null> {
  try {
    // Try admin client first (bypasses RLS), fallback to regular client
    const { createAdminClient } = await import("./supabase/server");
    const adminClient = createAdminClient();
    const supabase = adminClient || (await createClient());

    const { data, error } = await supabase
      .from("products")
      .select("*")
      .eq("id", id)
      .single();

    if (error || !data) {
      return fallbackProducts.find((p) => p.id === id) || null;
    }

    const mapped = mapProductFromDb(data);
    return mapped;
  } catch {
    return fallbackProducts.find((p) => p.id === id) || null;
  }
}

export async function addProduct(
  product: Omit<Product, "id" | "createdAt" | "updatedAt">,
): Promise<Product> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("products")
      .insert({
        name: product.name,
        description: product.description,
        long_description: product.longDescription || null,
        price: product.price,
        image: product.image,
        images: product.images || [],
        category: product.category,
        stock: product.stock,
        status: (product as any).status || "published",
        badges: product.badges || [],
        rating: product.rating || 0,
        review_count: product.reviewCount || 0,
        variations: product.variations || null,
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to add product: ${error.message}`);
    }

    return mapProductFromDb(data);
  } catch (error) {
    console.error("Error adding product:", error);
    throw error;
  }
}

export async function updateProduct(
  id: string,
  updates: Partial<Product>,
): Promise<Product | null> {
  try {
    const supabase = await createClient();
    const updateData: any = {};

    if (updates.name !== undefined) updateData.name = updates.name;
    if (updates.description !== undefined)
      updateData.description = updates.description;
    if (updates.longDescription !== undefined)
      updateData.long_description = updates.longDescription;
    if (updates.price !== undefined) updateData.price = updates.price;
    if (updates.image !== undefined) updateData.image = updates.image;
    if (updates.images !== undefined) updateData.images = updates.images;
    if (updates.category !== undefined) updateData.category = updates.category;
    if (updates.stock !== undefined) updateData.stock = updates.stock;
    if ((updates as any).status !== undefined)
      updateData.status = (updates as any).status;
    if (updates.badges !== undefined) updateData.badges = updates.badges;
    if (updates.rating !== undefined) updateData.rating = updates.rating;
    if (updates.reviewCount !== undefined)
      updateData.review_count = updates.reviewCount;
    if (updates.variations !== undefined)
      updateData.variations = updates.variations;

    updateData.updated_at = new Date().toISOString();

    const { data, error } = await supabase
      .from("products")
      .update(updateData)
      .eq("id", id)
      .select()
      .single();

    if (error || !data) {
      return null;
    }

    return mapProductFromDb(data);
  } catch (error) {
    console.error("Error updating product:", error);
    return null;
  }
}

export async function deleteProduct(id: string): Promise<boolean> {
  try {
    const supabase = await createClient();
    const { error } = await supabase.from("products").delete().eq("id", id);

    return !error;
  } catch (error) {
    console.error("Error deleting product:", error);
    return false;
  }
}

export async function getOrders(): Promise<Order[]> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("orders")
      .select("*")
      .order("created_at", { ascending: false });

    if (!error && data?.length) {
      return data.map(mapOrderFromDb);
    }

    // Local OS orders when Supabase orders table is missing.
    try {
      const { ensureOrderSeed, listOsOrders } = await import(
        "@/lib/orders-store"
      );
      await ensureOrderSeed();
      const local = await listOsOrders();
      return local.map((o) => ({
        id: o.id,
        orderNumber: o.orderNumber,
        customerName: o.customerName,
        customerEmail: o.customerEmail,
        customerPhone: o.customerPhone,
        items: o.items.map((i) => ({
          product: {
            id: i.productId,
            name: i.name,
            price: i.unitPrice,
            image: PRODUCT_IMAGE_FALLBACK,
            description: i.name,
            category: "General",
            stock: 0,
            status: "published" as const,
            createdAt: o.createdAt,
            updatedAt: o.updatedAt,
          },
          quantity: i.quantity,
        })),
        total: o.total,
        status: o.status as Order["status"],
        pickupDate: "",
        pickupTime: "",
        paymentStatus: "pending" as const,
        createdAt: o.createdAt,
      })) as Order[];
    } catch {
      return [];
    }
  } catch {
    return [];
  }
}

export async function getOrder(id: string): Promise<Order | null> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("orders")
      .select("*")
      .eq("id", id)
      .single();

    if (error || !data) {
      return null;
    }

    return mapOrderFromDb(data);
  } catch (error) {
    console.error("Error fetching order:", error);
    return null;
  }
}

export async function addOrder(
  order: Omit<Order, "id" | "createdAt" | "orderNumber"> & {
    userId?: string | null;
    giftWrap?: boolean;
    giftMessage?: string | null;
  },
): Promise<Order> {
  try {
    const supabase = await createClient();
    const orderNumber = `ORD-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;

    const orderData: any = {
      order_number: orderNumber,
      customer_name: order.customerName,
      customer_email: order.customerEmail,
      customer_phone: order.customerPhone,
      items: order.items,
      total: order.total,
      status: order.status,
      pickup_date: order.pickupDate,
      pickup_time: order.pickupTime,
      payment_status: order.paymentStatus || "pending",
      payment_method: order.paymentMethod || "card",
    };

    // Add payment reference if provided
    if (order.paymentReference) {
      orderData.payment_reference = order.paymentReference;
    }

    // Add user_id if provided
    if (order.userId) {
      orderData.user_id = order.userId;
    }

    const { data, error } = await supabase
      .from("orders")
      .insert(orderData)
      .select()
      .single();

    if (error) {
      console.error("Supabase error:", error);
      throw new Error(`Failed to add order: ${error.message}`);
    }

    return mapOrderFromDb(data);
  } catch (error) {
    console.error("Error adding order:", error);
    throw error;
  }
}

export async function getOrderByPaymentReference(
  reference: string,
): Promise<Order | null> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("orders")
      .select("*")
      .eq("payment_reference", reference)
      .single();

    if (error || !data) return null;
    return mapOrderFromDb(data);
  } catch (error) {
    console.error("Error getting order by payment reference:", error);
    return null;
  }
}

export async function updateOrderPaymentStatus(
  orderId: string,
  paymentStatus: "pending" | "paid" | "failed" | "abandoned",
  paymentDetails?: {
    paymentChannel?: string;
    paidAt?: string;
    paymentReference?: string;
  },
): Promise<Order | null> {
  try {
    const supabase = await createClient();
    const updateData: any = {
      payment_status: paymentStatus,
    };

    if (paymentDetails?.paymentChannel) {
      updateData.payment_channel = paymentDetails.paymentChannel;
    }
    if (paymentDetails?.paidAt) {
      updateData.paid_at = paymentDetails.paidAt;
    }
    if (paymentDetails?.paymentReference) {
      updateData.payment_reference = paymentDetails.paymentReference;
    }

    // If payment is successful, also update order status to confirmed
    if (paymentStatus === "paid") {
      updateData.status = "confirmed";
    }

    const { data, error } = await supabase
      .from("orders")
      .update(updateData)
      .eq("id", orderId)
      .select()
      .single();

    if (error || !data) return null;
    return mapOrderFromDb(data);
  } catch (error) {
    console.error("Error updating order payment status:", error);
    return null;
  }
}

export async function updateOrder(
  id: string,
  updates: Partial<Order>,
): Promise<Order | null> {
  try {
    const supabase = await createClient();
    const updateData: any = {};

    if (updates.status !== undefined) updateData.status = updates.status;
    if (updates.pickupDate !== undefined)
      updateData.pickup_date = updates.pickupDate;
    if (updates.pickupTime !== undefined)
      updateData.pickup_time = updates.pickupTime;
    if (updates.items !== undefined) updateData.items = updates.items;
    if (updates.total !== undefined) updateData.total = updates.total;
    if (updates.paymentStatus !== undefined)
      updateData.payment_status = updates.paymentStatus;
    if (updates.paymentReference !== undefined)
      updateData.payment_reference = updates.paymentReference;
    if (updates.paymentMethod !== undefined)
      updateData.payment_method = updates.paymentMethod;
    if (updates.paymentChannel !== undefined)
      updateData.payment_channel = updates.paymentChannel;
    if (updates.paidAt !== undefined) updateData.paid_at = updates.paidAt;

    updateData.updated_at = new Date().toISOString();

    const { data, error } = await supabase
      .from("orders")
      .update(updateData)
      .eq("id", id)
      .select()
      .single();

    if (error || !data) {
      return null;
    }

    return mapOrderFromDb(data);
  } catch (error) {
    console.error("Error updating order:", error);
    return null;
  }
}

export async function getUserByEmail(email: string): Promise<User | null> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("users")
      .select("*")
      .eq("email", email)
      .single();

    if (error || !data) {
      return null;
    }

    return {
      id: data.id,
      email: data.email,
      password: data.password,
      role: data.role,
    };
  } catch (error) {
    console.error("Error fetching user:", error);
    return null;
  }
}

export async function decrementProductStock(
  productId: string,
  quantity: number,
): Promise<boolean> {
  try {
    const product = await getProduct(productId);
    if (!product) return false;

    const stock = product.stock ?? 0;
    if (stock < quantity) return false;

    await updateProduct(productId, { stock: stock - quantity });
    return true;
  } catch (error) {
    console.error("Error decrementing stock:", error);
    return false;
  }
}

export async function incrementProductStock(
  productId: string,
  quantity: number,
): Promise<boolean> {
  try {
    const product = await getProduct(productId);
    if (!product) return false;

    await updateProduct(productId, { stock: (product.stock ?? 0) + quantity });
    return true;
  } catch (error) {
    console.error("Error incrementing stock:", error);
    return false;
  }
}

export async function getReviews(productId: string): Promise<ProductReview[]> {
  try {
    const { createAdminClient } = await import("./supabase/server");
    const adminClient = createAdminClient();
    const supabase = adminClient || (await createClient());
    const { data, error } = await supabase
      .from("reviews")
      .select("*")
      .eq("product_id", productId)
      .neq("status", "hidden")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching reviews:", error);
      return [];
    }

    return (data || []).map(mapReviewFromDb);
  } catch (error) {
    console.error("Error fetching reviews:", error);
    return [];
  }
}

export async function getAllReviews(): Promise<ProductReview[]> {
  try {
    const { createAdminClient } = await import("./supabase/server");
    const adminClient = createAdminClient();
    const supabase = adminClient || (await createClient());
    const { data, error } = await supabase
      .from("reviews")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching reviews:", error);
      return [];
    }

    return (data || []).map(mapReviewFromDb);
  } catch (error) {
    console.error("Error fetching reviews:", error);
    return [];
  }
}

export async function addReview(
  review: Omit<ProductReview, "id" | "createdAt">,
): Promise<ProductReview> {
  try {
    const { createAdminClient } = await import("./supabase/server");
    const adminClient = createAdminClient();
    const supabase = adminClient || (await createClient());
    const { data, error } = await supabase
      .from("reviews")
      .insert({
        product_id: review.productId,
        user_name: review.userName,
        rating: review.rating,
        title: review.title,
        comment: review.comment,
        verified_purchase: review.verifiedPurchase || false,
        helpful_count: review.helpfulCount || 0,
        status: "approved",
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to add review: ${error.message}`);
    }

    const newReview = mapReviewFromDb(data);

    // Update product rating
    const productReviews = await getReviews(review.productId);
    const avgRating =
      productReviews.reduce((sum, r) => sum + r.rating, 0) /
      productReviews.length;
    await updateProduct(review.productId, {
      rating: Math.round(avgRating * 10) / 10,
      reviewCount: productReviews.length,
    });

    return newReview;
  } catch (error) {
    console.error("Error adding review:", error);
    throw error;
  }
}

export async function addReviewAnswer(
  answer: Omit<ReviewAnswer, "id" | "createdAt">,
): Promise<ReviewAnswer> {
  try {
    const supabase = await createClient();

    // Get the review to update its answers array
    const { data: reviewData, error: reviewError } = await supabase
      .from("reviews")
      .select("answers")
      .eq("id", answer.reviewId)
      .single();

    if (reviewError || !reviewData) {
      throw new Error(`Review not found: ${reviewError?.message}`);
    }

    const newAnswer: ReviewAnswer = {
      id: `ans_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      reviewId: answer.reviewId,
      userName: answer.userName,
      answer: answer.answer,
      helpfulCount: answer.helpfulCount || 0,
      createdAt: new Date().toISOString(),
    };

    const currentAnswers = (reviewData.answers || []) as ReviewAnswer[];
    const updatedAnswers = [...currentAnswers, newAnswer];

    // Update the review with the new answer
    const { data, error } = await supabase
      .from("reviews")
      .update({ answers: updatedAnswers })
      .eq("id", answer.reviewId)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to add review answer: ${error.message}`);
    }

    return newAnswer;
  } catch (error) {
    console.error("Error adding review answer:", error);
    throw error;
  }
}

export async function deleteReviewAnswer(answerId: string): Promise<boolean> {
  try {
    const supabase = await createClient();

    // Find the review containing this answer
    const { data: reviews, error: fetchError } = await supabase
      .from("reviews")
      .select("id, answers");

    if (fetchError) {
      throw new Error(`Failed to fetch reviews: ${fetchError.message}`);
    }

    // Find and remove the answer from the appropriate review
    for (const review of reviews || []) {
      const answers = (review.answers || []) as ReviewAnswer[];
      const answerIndex = answers.findIndex((a) => a.id === answerId);

      if (answerIndex !== -1) {
        const updatedAnswers = answers.filter((a) => a.id !== answerId);

        const { error: updateError } = await supabase
          .from("reviews")
          .update({ answers: updatedAnswers })
          .eq("id", review.id);

        if (updateError) {
          throw new Error(
            `Failed to delete review answer: ${updateError.message}`,
          );
        }

        return true;
      }
    }

    return false;
  } catch (error) {
    console.error("Error deleting review answer:", error);
    throw error;
  }
}

export async function getQuestions(
  productId: string,
): Promise<ProductQuestion[]> {
  try {
    const { createAdminClient } = await import("./supabase/server");
    const adminClient = createAdminClient();
    const supabase = adminClient || (await createClient());
    const { data, error } = await supabase
      .from("questions")
      .select("*")
      .eq("product_id", productId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching questions:", error);
      return [];
    }

    return (data || []).map(mapQuestionFromDb);
  } catch (error) {
    console.error("Error fetching questions:", error);
    return [];
  }
}

export async function getAllQuestions(): Promise<ProductQuestion[]> {
  try {
    const { createAdminClient } = await import("./supabase/server");
    const adminClient = createAdminClient();
    const supabase = adminClient || (await createClient());
    const { data, error } = await supabase
      .from("questions")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching questions:", error);
      return [];
    }

    return (data || []).map(mapQuestionFromDb);
  } catch (error) {
    console.error("Error fetching questions:", error);
    return [];
  }
}

export async function addQuestion(
  question: Omit<ProductQuestion, "id" | "createdAt">,
): Promise<ProductQuestion> {
  try {
    const { createAdminClient } = await import("./supabase/server");
    const adminClient = createAdminClient();
    const supabase = adminClient || (await createClient());
    const { data, error } = await supabase
      .from("questions")
      .insert({
        product_id: question.productId,
        user_name: question.userName,
        question: question.question,
        answers: question.answers || [],
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to add question: ${error.message}`);
    }

    return mapQuestionFromDb(data);
  } catch (error) {
    console.error("Error adding question:", error);
    throw error;
  }
}

// Soft delete functions for bin/recycle functionality
export async function softDeleteItem(
  itemType: "product" | "review" | "question" | "answer" | "category" | "order",
  itemId: string,
  itemData: any,
  deletedBy?: string,
): Promise<boolean> {
  try {
    const supabase = await createClient();

    // Get current user if deletedBy is not provided
    let userId = deletedBy;
    if (!userId) {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      userId = user?.id;
    }

    // Check if item already exists in deleted_items (to handle re-deletion)
    const { data: existing } = await supabase
      .from("deleted_items")
      .select("id")
      .eq("item_type", itemType)
      .eq("item_id", itemId)
      .is("restored_at", null)
      .is("permanently_deleted_at", null)
      .single();

    if (existing) {
      // Item already in bin, just update the deleted_at timestamp
      const { error } = await supabase
        .from("deleted_items")
        .update({
          item_data: itemData,
          deleted_by: userId,
          deleted_at: new Date().toISOString(),
          restored_at: null,
        })
        .eq("id", existing.id);

      return !error;
    }

    // Insert new deleted item
    const { error } = await supabase.from("deleted_items").insert({
      item_type: itemType,
      item_id: itemId,
      item_data: itemData,
      deleted_by: userId,
      deleted_at: new Date().toISOString(),
    });

    return !error;
  } catch (error) {
    console.error("Error soft deleting item:", error);
    return false;
  }
}

export async function getDeletedItems(
  itemType?:
    | "product"
    | "review"
    | "question"
    | "answer"
    | "category"
    | "order",
  userId?: string,
): Promise<DeletedItem[]> {
  try {
    const supabase = await createClient();
    let query = supabase
      .from("deleted_items")
      .select("*")
      .is("restored_at", null)
      .is("permanently_deleted_at", null)
      .order("deleted_at", { ascending: false });

    if (itemType) {
      query = query.eq("item_type", itemType);
    }

    if (userId) {
      query = query.eq("deleted_by", userId);
    }

    const { data, error } = await query;

    if (error) {
      console.error("Error fetching deleted items:", error);
      return [];
    }

    return (data || []).map((item: any) => ({
      id: item.id,
      itemType: item.item_type,
      itemId: item.item_id,
      itemData: item.item_data,
      deletedBy: item.deleted_by,
      deletedAt: item.deleted_at,
      restoredAt: item.restored_at,
      permanentlyDeletedAt: item.permanently_deleted_at,
      reason: item.reason,
    }));
  } catch (error) {
    console.error("Error fetching deleted items:", error);
    return [];
  }
}

export async function restoreDeletedItem(
  deletedItemId: string,
): Promise<boolean> {
  try {
    const supabase = await createClient();

    // Get the deleted item
    const { data: deletedItem, error: fetchError } = await supabase
      .from("deleted_items")
      .select("*")
      .eq("id", deletedItemId)
      .single();

    if (fetchError || !deletedItem) {
      console.error("Deleted item not found:", fetchError);
      return false;
    }

    // Check if already restored or permanently deleted
    if (deletedItem.restored_at || deletedItem.permanently_deleted_at) {
      console.error("Item already restored or permanently deleted");
      return false;
    }

    const itemData = deletedItem.item_data;
    const itemType = deletedItem.item_type;
    const itemId = deletedItem.item_id;

    // Restore based on item type
    switch (itemType) {
      case "product": {
        // Check if product already exists
        const { data: existingProduct } = await supabase
          .from("products")
          .select("id")
          .eq("id", itemId)
          .single();

        if (existingProduct) {
          // Product already exists, update it instead
          const { error: updateError } = await supabase
            .from("products")
            .update({
              name: itemData.name,
              description: itemData.description,
              long_description:
                itemData.long_description || itemData.longDescription || null,
              price: itemData.price,
              image: itemData.image,
              images: itemData.images || [],
              category: itemData.category,
              stock: itemData.stock || 0,
              badges: itemData.badges || [],
              rating: itemData.rating || 0,
              review_count: itemData.review_count || itemData.reviewCount || 0,
              variations: itemData.variations || null,
              updated_at: new Date().toISOString(),
            })
            .eq("id", itemId);

          if (updateError) {
            console.error("Error restoring product (update):", updateError);
            return false;
          }
        } else {
          // Product doesn't exist, insert it
          const { error: insertError } = await supabase
            .from("products")
            .insert({
              id: itemId,
              name: itemData.name,
              description: itemData.description,
              long_description:
                itemData.long_description || itemData.longDescription || null,
              price: itemData.price,
              image: itemData.image,
              images: itemData.images || [],
              category: itemData.category,
              stock: itemData.stock || 0,
              badges: itemData.badges || [],
              rating: itemData.rating || 0,
              review_count: itemData.review_count || itemData.reviewCount || 0,
              variations: itemData.variations || null,
              created_at:
                itemData.created_at ||
                itemData.createdAt ||
                new Date().toISOString(),
              updated_at: new Date().toISOString(),
            });

          if (insertError) {
            console.error("Error restoring product (insert):", insertError);
            return false;
          }
        }
        break;
      }
      case "review": {
        const { error: insertError } = await supabase.from("reviews").insert({
          id: itemId,
          product_id: itemData.product_id || itemData.productId,
          user_name: itemData.user_name || itemData.userName,
          rating: itemData.rating,
          title: itemData.title,
          comment: itemData.comment,
          verified_purchase:
            itemData.verified_purchase || itemData.verifiedPurchase || false,
          helpful_count: itemData.helpful_count || itemData.helpfulCount || 0,
          status: itemData.status || "approved",
          created_at:
            itemData.created_at ||
            itemData.createdAt ||
            new Date().toISOString(),
        });

        if (insertError) {
          console.error("Error restoring review:", insertError);
          return false;
        }
        break;
      }
      case "question": {
        const { error: insertError } = await supabase.from("questions").insert({
          id: itemId,
          product_id: itemData.product_id || itemData.productId,
          user_name: itemData.user_name || itemData.userName,
          question: itemData.question,
          answers: itemData.answers || [],
          status: itemData.status || "pending",
          created_at:
            itemData.created_at ||
            itemData.createdAt ||
            new Date().toISOString(),
        });

        if (insertError) {
          console.error("Error restoring question:", insertError);
          return false;
        }
        break;
      }
      case "answer": {
        // Answers are stored within questions, so we need to update the question
        const questionId = itemData.question_id || itemData.questionId;
        if (questionId) {
          const { data: questionData } = await supabase
            .from("questions")
            .select("answers")
            .eq("id", questionId)
            .single();

          if (questionData) {
            const answers = questionData.answers || [];
            const answerExists = answers.some((a: any) => a.id === itemId);

            if (!answerExists) {
              answers.push({
                id: itemId,
                ...itemData,
              });

              const { error: updateError } = await supabase
                .from("questions")
                .update({ answers })
                .eq("id", questionId);

              if (updateError) {
                console.error("Error restoring answer:", updateError);
                return false;
              }
            }
          }
        }
        break;
      }
      case "category": {
        const { error: insertError } = await supabase
          .from("categories")
          .insert({
            id: itemId,
            name: itemData.name,
            description: itemData.description || "",
            slug: itemData.slug,
            image: itemData.image || "",
            icon: itemData.icon || "",
            product_count: itemData.product_count || itemData.productCount || 0,
            created_at:
              itemData.created_at ||
              itemData.createdAt ||
              new Date().toISOString(),
            updated_at: new Date().toISOString(),
          });

        if (insertError) {
          console.error("Error restoring category:", insertError);
          return false;
        }
        break;
      }
      case "order": {
        const { error: insertError } = await supabase.from("orders").insert({
          id: itemId,
          order_number: itemData.order_number || itemData.orderNumber,
          customer_name: itemData.customer_name || itemData.customerName,
          customer_email: itemData.customer_email || itemData.customerEmail,
          customer_phone: itemData.customer_phone || itemData.customerPhone,
          items: itemData.items || [],
          total: itemData.total,
          status: itemData.status,
          pickup_date: itemData.pickup_date || itemData.pickupDate,
          pickup_time: itemData.pickup_time || itemData.pickupTime,
          created_at:
            itemData.created_at ||
            itemData.createdAt ||
            new Date().toISOString(),
        });

        if (insertError) {
          console.error("Error restoring order:", insertError);
          return false;
        }
        break;
      }
      default:
        console.error("Unknown item type:", itemType);
        return false;
    }

    // Mark as restored in deleted_items table
    const { error: updateError } = await supabase
      .from("deleted_items")
      .update({ restored_at: new Date().toISOString() })
      .eq("id", deletedItemId);

    if (updateError) {
      console.error("Error updating deleted_items:", updateError);
      return false;
    }

    return true;
  } catch (error) {
    console.error("Error restoring deleted item:", error);
    return false;
  }
}

export async function permanentlyDeleteItem(
  deletedItemId: string,
): Promise<boolean> {
  try {
    const supabase = await createClient();

    const { error } = await supabase
      .from("deleted_items")
      .update({ permanently_deleted_at: new Date().toISOString() })
      .eq("id", deletedItemId);

    return !error;
  } catch (error) {
    console.error("Error permanently deleting item:", error);
    return false;
  }
}

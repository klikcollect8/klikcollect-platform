/**
 * Tenant-scoped product reviews & Q&A for the vendor OS.
 * Reviews/questions are keyed by product public_id; scope = products the vendor sells.
 */
import { getServiceSupabase } from "@/lib/supabase/admin";
import type {
  ProductAnswer,
  ProductQuestion,
  ProductReview,
  ReviewAnswer,
} from "@/types";

export type VendorProductRef = {
  publicId: string;
  name: string;
  imageUrl: string | null;
};

export async function listVendorProductRefs(
  vendorPublicIds: string[],
): Promise<VendorProductRef[]> {
  if (!vendorPublicIds.length) return [];
  const sb = getServiceSupabase();
  const { data: vendors } = await sb
    .from("vendors")
    .select("id")
    .in("public_id", vendorPublicIds);
  const vendorUuids = (vendors || []).map((v) => v.id as string);
  if (!vendorUuids.length) return [];

  const { data: offers } = await sb
    .from("product_offers")
    .select("products(public_id, name, image_url)")
    .in("vendor_id", vendorUuids)
    .is("deleted_at", null);

  const map = new Map<string, VendorProductRef>();
  for (const row of offers || []) {
    const p = (
      row as {
        products?: {
          public_id?: string;
          name?: string;
          image_url?: string | null;
        };
      }
    ).products;
    const id = p?.public_id;
    if (!id || map.has(id)) continue;
    map.set(id, {
      publicId: id,
      name: String(p?.name || id),
      imageUrl: p?.image_url ? String(p.image_url) : null,
    });
  }
  return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
}

function mapReview(
  row: Record<string, unknown>,
): ProductReview & { status?: string } {
  return {
    id: String(row.id),
    productId: String(row.product_id),
    userName: String(row.user_name),
    rating: Number(row.rating),
    title: String(row.title || ""),
    comment: String(row.comment || ""),
    verifiedPurchase: Boolean(row.verified_purchase),
    helpfulCount: Number(row.helpful_count || 0),
    createdAt: String(row.created_at),
    answers: Array.isArray(row.answers) ? (row.answers as ReviewAnswer[]) : [],
    status: row.status ? String(row.status) : "approved",
  };
}

function mapQuestion(row: Record<string, unknown>): ProductQuestion {
  return {
    id: String(row.id),
    productId: String(row.product_id),
    userName: String(row.user_name),
    question: String(row.question),
    answers: Array.isArray(row.answers) ? (row.answers as ProductAnswer[]) : [],
    createdAt: String(row.created_at),
  };
}

export async function listVendorReviews(vendorPublicIds: string[]) {
  const products = await listVendorProductRefs(vendorPublicIds);
  const productIds = products.map((p) => p.publicId);
  if (!productIds.length) {
    return { reviews: [] as ReturnType<typeof mapReview>[], products };
  }
  const sb = getServiceSupabase();
  const { data, error } = await sb
    .from("reviews")
    .select("*")
    .in("product_id", productIds)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return {
    reviews: (data || []).map((r) => mapReview(r as Record<string, unknown>)),
    products,
  };
}

export async function listVendorQuestions(vendorPublicIds: string[]) {
  const products = await listVendorProductRefs(vendorPublicIds);
  const productIds = products.map((p) => p.publicId);
  if (!productIds.length) {
    return { questions: [] as ProductQuestion[], products };
  }
  const sb = getServiceSupabase();
  const { data, error } = await sb
    .from("questions")
    .select("*")
    .in("product_id", productIds)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return {
    questions: (data || []).map((q) =>
      mapQuestion(q as Record<string, unknown>),
    ),
    products,
  };
}

async function assertReviewInScope(
  reviewId: string,
  vendorPublicIds: string[],
): Promise<Record<string, unknown> | null> {
  const products = await listVendorProductRefs(vendorPublicIds);
  const allowed = new Set(products.map((p) => p.publicId));
  if (!allowed.size) return null;
  const sb = getServiceSupabase();
  const { data } = await sb
    .from("reviews")
    .select("*")
    .eq("id", reviewId)
    .maybeSingle();
  if (!data || !allowed.has(String(data.product_id))) return null;
  return data as Record<string, unknown>;
}

async function assertQuestionInScope(
  questionId: string,
  vendorPublicIds: string[],
): Promise<Record<string, unknown> | null> {
  const products = await listVendorProductRefs(vendorPublicIds);
  const allowed = new Set(products.map((p) => p.publicId));
  if (!allowed.size) return null;
  const sb = getServiceSupabase();
  const { data } = await sb
    .from("questions")
    .select("*")
    .eq("id", questionId)
    .maybeSingle();
  if (!data || !allowed.has(String(data.product_id))) return null;
  return data as Record<string, unknown>;
}

async function binItem(
  itemType: "review" | "question" | "answer",
  itemId: string,
  itemData: unknown,
  deletedBy?: string | null,
) {
  const sb = getServiceSupabase();
  await sb.from("deleted_items").insert({
    item_type: itemType,
    item_id: itemId,
    item_data: itemData,
    deleted_by: deletedBy || null,
    deleted_at: new Date().toISOString(),
  });
}

export async function deleteVendorReview(
  reviewId: string,
  vendorPublicIds: string[],
  deletedBy?: string | null,
) {
  const row = await assertReviewInScope(reviewId, vendorPublicIds);
  if (!row) return { ok: false as const, reason: "not_found" };
  await binItem("review", reviewId, row, deletedBy);
  const sb = getServiceSupabase();
  const { error } = await sb.from("reviews").delete().eq("id", reviewId);
  if (error) return { ok: false as const, reason: error.message };
  return { ok: true as const, productId: String(row.product_id) };
}

export async function setVendorReviewStatus(
  reviewId: string,
  vendorPublicIds: string[],
  status: "approved" | "hidden",
) {
  const row = await assertReviewInScope(reviewId, vendorPublicIds);
  if (!row) return { ok: false as const, reason: "not_found" };
  const sb = getServiceSupabase();
  const { data, error } = await sb
    .from("reviews")
    .update({ status })
    .eq("id", reviewId)
    .select("*")
    .maybeSingle();
  if (error || !data)
    return { ok: false as const, reason: error?.message || "update_failed" };
  return {
    ok: true as const,
    review: mapReview(data as Record<string, unknown>),
  };
}

export async function replyToVendorReview(
  reviewId: string,
  vendorPublicIds: string[],
  input: { userName: string; answer: string },
) {
  const row = await assertReviewInScope(reviewId, vendorPublicIds);
  if (!row) return { ok: false as const, reason: "not_found" };
  const newAnswer: ReviewAnswer = {
    id: `ans_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
    reviewId,
    userName: input.userName,
    answer: input.answer,
    helpfulCount: 0,
    createdAt: new Date().toISOString(),
  };
  const answers = Array.isArray(row.answers)
    ? (row.answers as ReviewAnswer[])
    : [];
  const sb = getServiceSupabase();
  const { data, error } = await sb
    .from("reviews")
    .update({ answers: [...answers, newAnswer] })
    .eq("id", reviewId)
    .select("*")
    .maybeSingle();
  if (error || !data)
    return { ok: false as const, reason: error?.message || "update_failed" };
  return {
    ok: true as const,
    answer: newAnswer,
    review: mapReview(data as Record<string, unknown>),
  };
}

export async function deleteVendorReviewAnswer(
  reviewId: string,
  answerId: string,
  vendorPublicIds: string[],
  deletedBy?: string | null,
) {
  const row = await assertReviewInScope(reviewId, vendorPublicIds);
  if (!row) return { ok: false as const, reason: "not_found" };
  const answers = Array.isArray(row.answers)
    ? (row.answers as ReviewAnswer[])
    : [];
  const target = answers.find((a) => a.id === answerId);
  if (!target) return { ok: false as const, reason: "answer_not_found" };
  await binItem(
    "answer",
    answerId,
    { ...target, review_id: reviewId, product_id: row.product_id },
    deletedBy,
  );
  const sb = getServiceSupabase();
  const { data, error } = await sb
    .from("reviews")
    .update({ answers: answers.filter((a) => a.id !== answerId) })
    .eq("id", reviewId)
    .select("*")
    .maybeSingle();
  if (error || !data)
    return { ok: false as const, reason: error?.message || "update_failed" };
  return {
    ok: true as const,
    review: mapReview(data as Record<string, unknown>),
  };
}

export async function deleteVendorQuestion(
  questionId: string,
  vendorPublicIds: string[],
  deletedBy?: string | null,
) {
  const row = await assertQuestionInScope(questionId, vendorPublicIds);
  if (!row) return { ok: false as const, reason: "not_found" };
  await binItem("question", questionId, row, deletedBy);
  const sb = getServiceSupabase();
  const { error } = await sb.from("questions").delete().eq("id", questionId);
  if (error) return { ok: false as const, reason: error.message };
  return { ok: true as const, productId: String(row.product_id) };
}

export async function replyToVendorQuestion(
  questionId: string,
  vendorPublicIds: string[],
  input: { userName: string; answer: string },
) {
  const row = await assertQuestionInScope(questionId, vendorPublicIds);
  if (!row) return { ok: false as const, reason: "not_found" };
  const newAnswer: ProductAnswer = {
    id: `ans_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
    userName: input.userName,
    answer: input.answer,
    helpfulCount: 0,
    createdAt: new Date().toISOString(),
  };
  const answers = Array.isArray(row.answers)
    ? (row.answers as ProductAnswer[])
    : [];
  const sb = getServiceSupabase();
  const { data, error } = await sb
    .from("questions")
    .update({ answers: [...answers, newAnswer] })
    .eq("id", questionId)
    .select("*")
    .maybeSingle();
  if (error || !data)
    return { ok: false as const, reason: error?.message || "update_failed" };
  return {
    ok: true as const,
    answer: newAnswer,
    question: mapQuestion(data as Record<string, unknown>),
  };
}

export async function deleteVendorQuestionAnswer(
  questionId: string,
  answerId: string,
  vendorPublicIds: string[],
  deletedBy?: string | null,
) {
  const row = await assertQuestionInScope(questionId, vendorPublicIds);
  if (!row) return { ok: false as const, reason: "not_found" };
  const answers = Array.isArray(row.answers)
    ? (row.answers as ProductAnswer[])
    : [];
  const target = answers.find((a) => a.id === answerId);
  if (!target) return { ok: false as const, reason: "answer_not_found" };
  await binItem(
    "answer",
    answerId,
    { ...target, question_id: questionId, product_id: row.product_id },
    deletedBy,
  );
  const sb = getServiceSupabase();
  const { data, error } = await sb
    .from("questions")
    .update({ answers: answers.filter((a) => a.id !== answerId) })
    .eq("id", questionId)
    .select("*")
    .maybeSingle();
  if (error || !data)
    return { ok: false as const, reason: error?.message || "update_failed" };
  return {
    ok: true as const,
    question: mapQuestion(data as Record<string, unknown>),
  };
}

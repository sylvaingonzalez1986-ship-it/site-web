import "server-only";

import { createSupabaseServiceClient } from "@/lib/supabase/admin";
import type { BlogComment, BlogCommentStatus, BlogRatingStats } from "@/types/blog";

type CommentRow = {
  id: string;
  post_id: string;
  customer_id: string;
  content: string;
  status: BlogCommentStatus;
  admin_note: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
};

type RatingRow = {
  rating: number;
};

function toStringValue(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function toNullableString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

function toNumberValue(value: unknown, fallback = 0): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function toComment(row: CommentRow): BlogComment {
  return {
    id: row.id,
    postId: row.post_id,
    customerId: row.customer_id,
    customerFirstName: "",
    customerLastName: "",
    content: row.content,
    status: row.status,
    adminNote: row.admin_note ?? "",
    reviewedBy: row.reviewed_by,
    reviewedAt: row.reviewed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function getApprovedBlogCommentsByPostId(postId: string): Promise<BlogComment[]> {
  const supabase = createSupabaseServiceClient();
  const { data, error } = await supabase
    .from("blog_comments")
    .select("id,post_id,customer_id,content,status,admin_note,reviewed_by,reviewed_at,created_at,updated_at")
    .eq("post_id", postId)
    .eq("status", "approved")
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(`[supabase:blog_comments:approved] ${error.message}`);
  }

  const rows = (data ?? []) as CommentRow[];
  if (rows.length === 0) {
    return [];
  }

  const customerIds = Array.from(new Set(rows.map((row) => row.customer_id)));
  const profilesResult = await supabase
    .from("profiles")
    .select("id,first_name,last_name")
    .in("id", customerIds);

  if (profilesResult.error) {
    throw new Error(`[supabase:profiles:blog_comments] ${profilesResult.error.message}`);
  }

  const profileById = new Map<string, { firstName: string; lastName: string }>(
    (profilesResult.data ?? []).map((row) => [
      toStringValue((row as { id?: unknown }).id),
      {
        firstName: toStringValue((row as { first_name?: unknown }).first_name),
        lastName: toStringValue((row as { last_name?: unknown }).last_name),
      },
    ]),
  );

  return rows.map((row) => {
    const comment = toComment(row);
    const profile = profileById.get(comment.customerId);
    return {
      ...comment,
      customerFirstName: profile?.firstName ?? "",
      customerLastName: profile?.lastName ?? "",
    };
  });
}

export async function createBlogComment(input: {
  postId: string;
  customerId: string;
  content: string;
}): Promise<void> {
  const supabase = createSupabaseServiceClient();
  const { error } = await supabase.from("blog_comments").insert({
    post_id: input.postId,
    customer_id: input.customerId,
    content: input.content,
    status: "pending",
  });

  if (error) {
    throw new Error(`[supabase:blog_comments:create] ${error.message}`);
  }
}

export async function getBlogRatingStats(postId: string, customerId?: string): Promise<BlogRatingStats> {
  const supabase = createSupabaseServiceClient();
  const ratingsResult = await supabase.from("blog_ratings").select("rating").eq("post_id", postId);

  if (ratingsResult.error) {
    throw new Error(`[supabase:blog_ratings:stats] ${ratingsResult.error.message}`);
  }

  const rows = (ratingsResult.data ?? []) as RatingRow[];
  const totalRatings = rows.length;
  const averageRating =
    totalRatings > 0
      ? Number((rows.reduce((sum, row) => sum + toNumberValue(row.rating), 0) / totalRatings).toFixed(2))
      : 0;

  let userRating: number | null = null;
  if (customerId) {
    const userResult = await supabase
      .from("blog_ratings")
      .select("rating")
      .eq("post_id", postId)
      .eq("customer_id", customerId)
      .maybeSingle();

    if (userResult.error && userResult.error.code !== "PGRST116") {
      throw new Error(`[supabase:blog_ratings:user] ${userResult.error.message}`);
    }

    userRating = userResult.data ? toNumberValue((userResult.data as { rating?: unknown }).rating, 0) : null;
    if (userRating && (userRating < 1 || userRating > 5)) {
      userRating = null;
    }
  }

  return {
    postId,
    averageRating,
    totalRatings,
    userRating,
  };
}

export async function upsertBlogRating(input: {
  postId: string;
  customerId: string;
  rating: number;
}): Promise<void> {
  const supabase = createSupabaseServiceClient();
  const { error } = await supabase.from("blog_ratings").upsert(
    {
      post_id: input.postId,
      customer_id: input.customerId,
      rating: input.rating,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "post_id,customer_id" },
  );

  if (error) {
    throw new Error(`[supabase:blog_ratings:upsert] ${error.message}`);
  }
}

export async function getAdminBlogComments(status?: BlogCommentStatus): Promise<BlogComment[]> {
  const supabase = createSupabaseServiceClient();
  let query = supabase
    .from("blog_comments")
    .select("id,post_id,customer_id,content,status,admin_note,reviewed_by,reviewed_at,created_at,updated_at")
    .order("created_at", { ascending: false });

  if (status) {
    query = query.eq("status", status);
  }

  const { data, error } = await query;
  if (error) {
    throw new Error(`[supabase:blog_comments:admin] ${error.message}`);
  }

  const rows = (data ?? []) as CommentRow[];
  if (rows.length === 0) {
    return [];
  }

  const customerIds = Array.from(new Set(rows.map((row) => row.customer_id)));
  const profilesResult = await supabase
    .from("profiles")
    .select("id,first_name,last_name")
    .in("id", customerIds);

  if (profilesResult.error) {
    throw new Error(`[supabase:profiles:blog_comments_admin] ${profilesResult.error.message}`);
  }

  const profileById = new Map<string, { firstName: string; lastName: string }>(
    (profilesResult.data ?? []).map((row) => [
      toStringValue((row as { id?: unknown }).id),
      {
        firstName: toStringValue((row as { first_name?: unknown }).first_name),
        lastName: toStringValue((row as { last_name?: unknown }).last_name),
      },
    ]),
  );

  return rows.map((row) => {
    const base = toComment(row);
    const profile = profileById.get(base.customerId);
    return {
      ...base,
      customerFirstName: profile?.firstName ?? "",
      customerLastName: profile?.lastName ?? "",
      reviewedBy: toNullableString(base.reviewedBy),
    };
  });
}

export async function moderateBlogComment(input: {
  commentId: string;
  status: Exclude<BlogCommentStatus, "pending">;
  adminNote?: string;
  reviewedBy: string;
}): Promise<void> {
  const supabase = createSupabaseServiceClient();
  const { error } = await supabase
    .from("blog_comments")
    .update({
      status: input.status,
      admin_note: (input.adminNote ?? "").trim(),
      reviewed_by: input.reviewedBy,
      reviewed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.commentId);

  if (error) {
    throw new Error(`[supabase:blog_comments:moderate] ${error.message}`);
  }
}

import "server-only";

import {
  createBlogComment,
  getAdminBlogComments,
  getApprovedBlogCommentsByPostId,
  getBlogRatingStats,
  moderateBlogComment,
  upsertBlogRating,
} from "@/lib/supabase/blog-interactions-backend";
import type { BlogCommentStatus } from "@/types/blog";

export {
  createBlogComment,
  getAdminBlogComments,
  getApprovedBlogCommentsByPostId,
  getBlogRatingStats,
  moderateBlogComment,
  upsertBlogRating,
};

export function parseBlogCommentStatus(value: string | null): BlogCommentStatus | undefined {
  if (!value) {
    return undefined;
  }
  if (value === "pending" || value === "approved" || value === "rejected") {
    return value;
  }
  return undefined;
}

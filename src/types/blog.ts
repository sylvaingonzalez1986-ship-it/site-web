export type BlogCommentStatus = "pending" | "approved" | "rejected";

export type BlogComment = {
  id: string;
  postId: string;
  customerId: string;
  customerFirstName: string;
  customerLastName: string;
  content: string;
  status: BlogCommentStatus;
  adminNote: string;
  reviewedBy: string | null;
  reviewedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type BlogRatingStats = {
  postId: string;
  averageRating: number;
  totalRatings: number;
  userRating: number | null;
};

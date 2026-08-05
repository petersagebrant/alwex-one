export type ActivityComment = {
  id: string;
  activityId: string;
  authorName: string;
  content: string;
  createdAt: string;
  updatedAt: string;
};

export type CreateActivityCommentInput = {
  activityId: string;
  authorName: string;
  content: string;
};

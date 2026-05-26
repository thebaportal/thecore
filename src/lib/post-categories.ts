export type PostCategory = { name: string; emoji: string };

export const DEFAULT_POST_CATEGORIES: PostCategory[] = [
  { emoji: "📢", name: "Announcement" },
  { emoji: "📋", name: "Update" },
  { emoji: "✅", name: "Decision" },
  { emoji: "📝", name: "Meeting Notes" },
  { emoji: "❓", name: "Question" },
];

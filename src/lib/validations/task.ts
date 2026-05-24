import { z } from "zod";

export const createTaskSchema = z.object({
  projectId: z.string().min(1),
  title: z.string().min(1, "Title is required").max(200),
  description: z.string().max(2000).optional(),
  assigneeId: z.string().min(1).optional(),
  parentTaskId: z.string().min(1).optional(),
  status: z.enum(["TODO", "IN_PROGRESS", "IN_REVIEW", "DONE", "CANCELLED"]).optional().default("TODO"),
  priority: z.enum(["URGENT", "HIGH", "MEDIUM", "LOW", "NO_PRIORITY"]).optional().default("MEDIUM"),
  dueDate: z.coerce.date().optional(),
});

export const updateTaskSchema = z.object({
  projectId: z.string().min(1).optional(),
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).nullable().optional(),
  assigneeId: z.string().min(1).nullable().optional(),
  parentTaskId: z.string().min(1).optional(),
  status: z.enum(["TODO", "IN_PROGRESS", "IN_REVIEW", "DONE", "CANCELLED"]).optional(),
  priority: z.enum(["URGENT", "HIGH", "MEDIUM", "LOW", "NO_PRIORITY"]).optional(),
  position: z.number().optional(),
  dueDate: z.union([z.coerce.date(), z.null()]).optional(),
});

export type CreateTaskInput = z.infer<typeof createTaskSchema>;
export type UpdateTaskInput = z.infer<typeof updateTaskSchema>;

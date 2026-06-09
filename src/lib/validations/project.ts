import { z } from "zod";

export const createProjectSchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  description: z.string().max(500).optional(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  iconEmoji: z.string().max(10).optional(),
  startDate: z.coerce.date().optional(),
  targetDate: z.coerce.date().optional(),
  templateId: z.string().optional(),
});

export const updateProjectSchema = createProjectSchema.partial().extend({
  status: z.enum(["ACTIVE", "ON_HOLD", "COMPLETED", "ARCHIVED"]).optional(),
  nextSession: z.string().max(120).optional().nullable(),
  instructor: z.string().max(120).optional().nullable(),
  cohort: z.string().max(120).optional().nullable(),
});

export type CreateProjectInput = z.infer<typeof createProjectSchema>;
export type UpdateProjectInput = z.infer<typeof updateProjectSchema>;

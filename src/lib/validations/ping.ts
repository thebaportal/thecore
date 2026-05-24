import { z } from "zod";

export const createPingSchema = z.object({
  type: z.enum(["DIRECT", "GROUP", "CONTEXTUAL"]),
  title: z.string().max(100).optional(),
  participantIds: z.array(z.string()).default([]),
  projectId: z.string().optional(),
  taskId: z.string().optional(),
}).refine(
  (data) => data.type === "CONTEXTUAL" || data.participantIds.length >= 1,
  { message: "At least one participant required", path: ["participantIds"] }
).refine(
  (data) => data.type !== "CONTEXTUAL" || data.projectId != null || data.taskId != null,
  { message: "CONTEXTUAL pings must be anchored to a project or task", path: ["projectId"] }
);

export const sendMessageSchema = z.object({
  pingId: z.string().min(1),
  body: z.string().min(1).max(4000),
  threadParentId: z.string().min(1).optional(),
  attachments: z.array(z.object({
    url: z.string(),
    name: z.string(),
    mimeType: z.string(),
    size: z.number(),
  })).optional().default([]),
});

export type CreatePingInput = z.infer<typeof createPingSchema>;
export type SendMessageInput = z.infer<typeof sendMessageSchema>;

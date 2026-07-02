import { z } from 'zod';

// Zod schemas for the video factory

export const TopicSchema = z.object({
  topic: z.string().min(3).max(100),
});

export const TitleSchema = z.object({
  titles: z.array(z.string()).min(5).max(10),
});

export const SceneSchema = z.object({
  id: z.string(),
  text: z.string(),
  duration: z.number().min(1),
  visualPrompt: z.string().nullable(),
});

export const ScriptSchema = z.object({
  title: z.string(),
  hook: z.string(),
  scenes: z.array(SceneSchema),
  narration: z.string(),
  cta: z.string(),
});

export type Topic = z.infer<typeof TopicSchema>;
export type TitleList = z.infer<typeof TitleSchema>;
export type Scene = z.infer<typeof SceneSchema>;
export type Script = z.infer<typeof ScriptSchema>;

export const VideoRequestSchema = z.object({
  id: z.string(),
  userId: z.string(),
  script: ScriptSchema,
  status: z.enum(['pending', 'rendering', 'completed', 'failed', 'approved', 'rejected', 'queued']),
  videoUrl: z.string().optional(),
});

export type VideoRequest = z.infer<typeof VideoRequestSchema>;

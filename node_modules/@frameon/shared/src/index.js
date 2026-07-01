"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.VideoRequestSchema = exports.ScriptSchema = exports.SceneSchema = exports.TitleSchema = exports.TopicSchema = void 0;
const zod_1 = require("zod");
// Zod schemas for the video factory
exports.TopicSchema = zod_1.z.object({
    topic: zod_1.z.string().min(3).max(100),
});
exports.TitleSchema = zod_1.z.object({
    titles: zod_1.z.array(zod_1.z.string()).min(5).max(10),
});
exports.SceneSchema = zod_1.z.object({
    id: zod_1.z.string(),
    text: zod_1.z.string(),
    duration: zod_1.z.number().min(1),
    visualPrompt: zod_1.z.string().optional(),
});
exports.ScriptSchema = zod_1.z.object({
    title: zod_1.z.string(),
    hook: zod_1.z.string(),
    scenes: zod_1.z.array(exports.SceneSchema),
    narration: zod_1.z.string(),
    cta: zod_1.z.string(),
});
exports.VideoRequestSchema = zod_1.z.object({
    id: zod_1.z.string(),
    userId: zod_1.z.string(),
    script: exports.ScriptSchema,
    status: zod_1.z.enum(['pending', 'rendering', 'completed', 'failed', 'approved', 'rejected', 'queued']),
    videoUrl: zod_1.z.string().optional(),
});

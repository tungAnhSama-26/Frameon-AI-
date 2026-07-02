"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AIGenerator = void 0;
const openai_1 = __importDefault(require("openai"));
const shared_1 = require("@frameon/shared");
const zod_1 = require("openai/helpers/zod");
class AIGenerator {
    openai;
    constructor(apiKey) {
        this.openai = new openai_1.default({ apiKey });
    }
    async generateTitles(topic) {
        const completion = await this.openai.beta.chat.completions.parse({
            model: 'gpt-4o-2024-08-06',
            messages: [
                {
                    role: 'system',
                    content: 'You are an expert short-form video producer. Generate 5-10 highly engaging and viral titles for a video based on the user topic.',
                },
                {
                    role: 'user',
                    content: `Topic: ${topic}`,
                },
            ],
            response_format: (0, zod_1.zodResponseFormat)(shared_1.TitleSchema, 'title_list'),
        });
        const parsed = completion.choices[0].message.parsed;
        if (!parsed) {
            throw new Error('Failed to generate titles');
        }
        return parsed.titles;
    }
    async generateScript(title) {
        const completion = await this.openai.beta.chat.completions.parse({
            model: 'gpt-4o-2024-08-06',
            messages: [
                {
                    role: 'system',
                    content: 'You are a master scriptwriter for TikTok and YouTube Shorts. Write an engaging video script with a hook, a series of short visual scenes, narration text, and a Call To Action (CTA).',
                },
                {
                    role: 'user',
                    content: `Write a script for the title: "${title}"`,
                },
            ],
            response_format: (0, zod_1.zodResponseFormat)(shared_1.ScriptSchema, 'script'),
        });
        const parsed = completion.choices[0].message.parsed;
        if (!parsed) {
            throw new Error('Failed to generate script');
        }
        return parsed;
    }
}
exports.AIGenerator = AIGenerator;

import OpenAI from 'openai';
import { TitleList, TitleSchema, Script, ScriptSchema } from '@frameon/shared';
import { zodResponseFormat } from 'openai/helpers/zod';

export class AIGenerator {
  private openai: OpenAI;

  constructor(apiKey: string) {
    this.openai = new OpenAI({ apiKey });
  }

  async generateTitles(topic: string): Promise<string[]> {
    const completion = await this.openai.chat.completions.parse({
      model: 'gpt-4o-2024-08-06',
      messages: [
        {
          role: 'system',
          content: 'You are an expert short-form video producer. Generate 5-10 highly engaging and viral titles for a video based on the user topic. IMPORTANT: You MUST generate the titles in the exact SAME LANGUAGE as the user\'s topic (e.g. if the topic is in Vietnamese, generate Vietnamese titles).',
        },
        {
          role: 'user',
          content: `Topic: ${topic}`,
        },
      ],
      response_format: zodResponseFormat(TitleSchema, 'title_list'),
    });

    const parsed = completion.choices[0].message.parsed;
    if (!parsed) {
      throw new Error('Failed to generate titles');
    }
    return parsed.titles;
  }

  async generateScript(title: string): Promise<Script> {
    const completion = await this.openai.chat.completions.parse({
      model: 'gpt-4o-2024-08-06',
      messages: [
        {
          role: 'system',
          content: 'You are a master scriptwriter for TikTok and YouTube Shorts. Write an engaging video script with a hook, a series of short visual scenes, narration text, and a Call To Action (CTA). IMPORTANT: You MUST write the script in the exact SAME LANGUAGE as the video title.',
        },
        {
          role: 'user',
          content: `Write a script for the title: "${title}"`,
        },
      ],
      response_format: zodResponseFormat(ScriptSchema, 'script'),
    });

    const parsed = completion.choices[0].message.parsed;
    if (!parsed) {
      throw new Error('Failed to generate script');
    }
    return parsed;
  }
}

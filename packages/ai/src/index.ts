import OpenAI from 'openai';
import { TitleList, TitleSchema, Script, ScriptSchema, MessageIntent, MessageIntentSchema } from '@frameon/shared';
import { zodResponseFormat } from 'openai/helpers/zod';

export class AIGenerator {
  private openai: OpenAI;

  constructor(apiKey: string) {
    this.openai = new OpenAI({ 
      apiKey,
      baseURL: 'https://generativelanguage.googleapis.com/v1beta/openai/'
    });
  }

  async classifyMessage(message: string): Promise<MessageIntent> {
    const completion = await this.openai.chat.completions.parse({
      model: 'gemini-2.5-flash',
      messages: [
        {
          role: 'system',
          content: 'You are an AI assistant for a video generation bot. Classify the user\'s message intent.\n- "topic": The user provides a subject/idea to create a new video about.\n- "chat": The user is just chatting or saying ok/thanks.\n- "status": The user asks about the status of their video.\n- "export": The user asks to export/render/download the video.\nIf the intent is not "topic", provide a brief helpful "reply" in the exact same language as the user explaining the situation (e.g., if they ask to export, explain the video is already rendering automatically and they will be notified).',
        },
        {
          role: 'user',
          content: message,
        },
      ],
      response_format: zodResponseFormat(MessageIntentSchema, 'message_intent'),
    });

    const parsed = completion.choices[0].message.parsed;
    if (!parsed) {
      return { intent: 'topic' };
    }
    return parsed;
  }

  async generateTitles(topic: string): Promise<string[]> {
    const completion = await this.openai.chat.completions.parse({
      model: 'gemini-2.5-flash',
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
      model: 'gemini-2.5-flash',
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

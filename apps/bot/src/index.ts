import * as dotenv from 'dotenv';
import * as path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

import { Bot, InlineKeyboard, Keyboard } from 'grammy';
import { AIGenerator } from '@frameon/ai';
import { prisma } from '@frameon/database';

const botToken = process.env.BOT_TOKEN || '';
const openaiKey = process.env.OPENAI_API_KEY || '';

if (!botToken || !openaiKey) {
  console.warn('BOT_TOKEN or OPENAI_API_KEY is missing');
}

const bot = new Bot(botToken);
const ai = new AIGenerator(openaiKey);

bot.command('start', (ctx) => {
  const webAppUrl = process.env.WEBAPP_URL || 'https://frameon-ai.example.com';
  
  const keyboard = new Keyboard()
    .webApp('Launch Frameon AI App', webAppUrl)
    .resized();

  ctx.reply('Welcome to Frameon AI! Open the app to select a template and generate your video, or just send me a topic.', {
    reply_markup: keyboard,
  });
});

bot.on('message:web_app_data', async (ctx) => {
  const data = JSON.parse(ctx.message.web_app_data.data);
  
  if (data.action === 'generate_video') {
    const topic = data.topic;
    const template = data.template;
    
    const loadingMsg = await ctx.reply(`🤖 Generating titles for topic: "${topic}" using template: ${template}...`);
    
    try {
      const titles = await ai.generateTitles(topic);
      
      const keyboard = new InlineKeyboard();
      titles.forEach((title: string, index: number) => {
        keyboard.text(title.substring(0, 30) + '...', `select_title:${index}`).row();
      });

      (global as any).tempTitles = titles;
      (global as any).tempTopic = topic;

      await ctx.api.editMessageText(ctx.chat.id, loadingMsg.message_id, 'Select a title for your video:', {
        reply_markup: keyboard,
      });
    } catch (error) {
      console.error(error);
      await ctx.api.editMessageText(ctx.chat.id, loadingMsg.message_id, '❌ Failed to generate titles. Try again later.');
    }
  }
});

bot.on('message:text', async (ctx) => {
  const topic = ctx.message.text;
  const loadingMsg = await ctx.reply('🤖 Generating titles...');

  try {
    const titles = await ai.generateTitles(topic);
    
    const keyboard = new InlineKeyboard();
    titles.forEach((title: string, index: number) => {
      // Store topic and title index or just title in callback data (limited to 64 bytes)
      // For a real app, we'd store these in a temporary session or DB
      keyboard.text(title.substring(0, 30) + '...', `select_title:${index}`).row();
    });

    // Store in a simple map for demo purposes (use Redis/Session in prod)
    (global as any).tempTitles = titles;
    (global as any).tempTopic = topic;

    await ctx.api.editMessageText(ctx.chat.id, loadingMsg.message_id, 'Select a title for your video:', {
      reply_markup: keyboard,
    });
  } catch (error) {
    console.error(error);
    await ctx.api.editMessageText(ctx.chat.id, loadingMsg.message_id, '❌ Failed to generate titles. Try again later.');
  }
});

bot.callbackQuery(/select_title:(\d+)/, async (ctx) => {
  const index = parseInt(ctx.match[1], 10);
  const titles = (global as any).tempTitles as string[];
  const topic = (global as any).tempTopic as string;

  if (!titles || !titles[index]) {
    return ctx.answerCallbackQuery('Session expired. Please send a new topic.');
  }

  const selectedTitle = titles[index];
  await ctx.answerCallbackQuery();
  const loadingMsg = await ctx.reply(`🎬 Selected: "${selectedTitle}"\nGenerating script...`);

  try {
    const script = await ai.generateScript(selectedTitle);
    
    let user = await prisma.user.findUnique({ where: { telegramId: ctx.from.id.toString() } });
    if (!user) {
      user = await prisma.user.create({
        data: {
          telegramId: ctx.from.id.toString(),
          username: ctx.from.username,
        }
      });
    }

    const video = await prisma.video.create({
      data: {
        userId: user.id,
        topic,
        title: selectedTitle,
        script: script as any,
        status: 'queued' // Actually it should be queued for rendering
      }
    });

    if (!ctx.chat) return;

    await ctx.api.editMessageText(
      ctx.chat.id, 
      loadingMsg.message_id, 
      `✅ Script generated successfully!\n\n**Hook:** ${script.hook}\n\nVideo is now queued for rendering. ID: ${video.id}`
    );

    // TODO: Send to BullMQ queue here

  } catch (error) {
    console.error(error);
    if (ctx.chat) {
      await ctx.api.editMessageText(ctx.chat.id, loadingMsg.message_id, '❌ Failed to generate script.');
    }
  }
});

bot.catch((err) => {
  console.error(`Error while handling update ${err.ctx.update.update_id}:`);
  console.error(err.error);
});

export const startBot = () => {
  bot.start();
  console.log('🤖 Bot started');
};

if (require.main === module) {
  startBot();
}

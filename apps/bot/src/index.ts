import * as dotenv from 'dotenv';
import * as path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../../../.env'), override: true });

import { Bot, InlineKeyboard, Keyboard } from 'grammy';
import { AIGenerator } from '@frameon/ai';
import { prisma } from '@frameon/database';

const botToken = process.env.BOT_TOKEN || '';
const apiKey = process.env.OPENAI_API_KEY || process.env.GEMINI_API_KEY || '';

if (!botToken || !apiKey) {
  console.warn('BOT_TOKEN or API Key is missing');
}
console.log('Using Bot Token:', botToken);

const bot = new Bot(botToken);
const ai = new AIGenerator(apiKey);



bot.on('message:web_app_data', async (ctx) => {
  const data = JSON.parse(ctx.message.web_app_data.data);
  
  if (data.action === 'generate_video') {
    const topic = data.topic;
    const template = data.template;
    
    const loadingMsg = await ctx.reply(`🤖 Đang tạo các tiêu đề hấp dẫn cho chủ đề: "${topic}"...`);
    
    try {
      const titles = await ai.generateTitles(topic);
      
      let messageText = `👇 Vui lòng chọn một tiêu đề cho video của bạn:\n\n`;
      const keyboard = new InlineKeyboard();
      titles.forEach((title: string, index: number) => {
        messageText += `*${index + 1}.* ${title}\n\n`;
        keyboard.text(`👉 Chọn ${index + 1}`, `select_title:${index}`).row();
      });

      (global as any).tempTitles = titles;
      (global as any).tempTopic = topic;

      await ctx.api.editMessageText(ctx.chat.id, loadingMsg.message_id, messageText, {
        reply_markup: keyboard,
        parse_mode: 'Markdown'
      });
    } catch (error) {
      console.error(error);
      await ctx.api.editMessageText(ctx.chat.id, loadingMsg.message_id, '❌ Đã có lỗi xảy ra khi tạo tiêu đề. Vui lòng thử lại sau.');
    }
  }
});

bot.on('message:text', async (ctx) => {
  const text = ctx.message.text.trim();
  const lowerText = text.toLowerCase();
  
  // Treat standard greetings or commands as a trigger to show the Web App button
  if (['/start', '/menu', '/app', 'hi', 'hello', 'menu', 'app', 'chào'].includes(lowerText)) {
    const webAppUrl = process.env.WEBAPP_URL || 'https://frameon-ai.example.com';
    const keyboard = new InlineKeyboard()
      .webApp('Mở Ứng Dụng Frameon', webAppUrl);

    return ctx.reply('👋 Chào mừng bạn đến với Frameon AI!\n\nHãy nhấn nút bên dưới để mở ứng dụng và tạo video, hoặc bạn có thể gửi trực tiếp một chủ đề (topic) bất kỳ cho mình ở đây nhé.', {
      reply_markup: keyboard,
    });
  }

  const topic = text;
  const loadingMsg = await ctx.reply('🤖 Đang phân tích yêu cầu...');

  try {
    const intentData = await ai.classifyMessage(text);
    
    if (intentData.intent !== 'topic') {
      await ctx.api.editMessageText(
        ctx.chat.id, 
        loadingMsg.message_id, 
        intentData.reply || 'Cảm ơn bạn! Bạn có muốn tạo video về chủ đề gì không?'
      );
      return;
    }

    await ctx.api.editMessageText(ctx.chat.id, loadingMsg.message_id, '🤖 Đang suy nghĩ tiêu đề...');
    const titles = await ai.generateTitles(topic);
    
    let messageText = '👇 Vui lòng chọn một tiêu đề cho video của bạn:\n\n';
    const keyboard = new InlineKeyboard();
    titles.forEach((title: string, index: number) => {
      messageText += `*${index + 1}.* ${title}\n\n`;
      keyboard.text(`👉 Chọn ${index + 1}`, `select_title:${index}`).row();
    });

    // Store in a simple map for demo purposes (use Redis/Session in prod)
    (global as any).tempTitles = titles;
    (global as any).tempTopic = topic;

    await ctx.api.editMessageText(ctx.chat.id, loadingMsg.message_id, messageText, {
      reply_markup: keyboard,
      parse_mode: 'Markdown'
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
    return ctx.answerCallbackQuery('⏳ Phiên làm việc đã hết hạn. Vui lòng gửi lại chủ đề mới.');
  }

  const selectedTitle = titles[index];
  await ctx.answerCallbackQuery();
  const loadingMsg = await ctx.reply(`🎬 Đã chọn: "${selectedTitle}"\n\n📝 Đang viết kịch bản chi tiết...`);

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

    let scriptText = `✅ **Kịch bản đã hoàn tất!**\n\n🎯 **Hook (Mở bài):** ${script.hook}\n\n`;
    script.scenes.forEach((scene: any, i: number) => {
      scriptText += `🎬 **Cảnh ${i + 1} (${scene.duration}s):**\n- Hành động: ${scene.text}\n- Hình ảnh: ${scene.visualPrompt || 'Không có'}\n\n`;
    });
    scriptText += `🎙 **Lời đọc (Narration):** ${script.narration}\n\n`;
    scriptText += `🔔 **Kêu gọi hành động (CTA):** ${script.cta}\n\n`;
    scriptText += `🎥 Video đang được đưa vào hàng đợi để render tự động. ID: ${video.id}`;

    await ctx.api.editMessageText(ctx.chat.id, loadingMsg.message_id, scriptText, { parse_mode: 'Markdown' });

    // Send to BullMQ queue
    const { Queue } = require('bullmq');
    const IORedis = require('ioredis');
    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
    const connection = new IORedis(redisUrl, { maxRetriesPerRequest: null });
    const videoQueue = new Queue('video-render', { connection });
    
    await videoQueue.add('render', { videoId: video.id });
    console.log(`Added video ${video.id} to queue`);

  } catch (error) {
    console.error(error);
    if (ctx.chat) {
      await ctx.api.editMessageText(ctx.chat.id, loadingMsg.message_id, '❌ Đã có lỗi xảy ra khi tạo kịch bản.');
    }
  }
});

bot.catch((err) => {
  console.error(`Error while handling update ${err.ctx.update.update_id}:`);
  console.error(err.error);
});

export const startBot = async () => {
  const webAppUrl = process.env.WEBAPP_URL || 'https://frameon-ai.example.com';
  try {
    await bot.api.setChatMenuButton({
      menu_button: {
        type: 'web_app',
        text: 'Mở App',
        web_app: { url: webAppUrl }
      }
    });
    console.log('✅ Menu button configured');
  } catch (err) {
    console.error('⚠️ Failed to set menu button:', err);
  }

  bot.start();
  console.log('🤖 Bot started');
};

if (require.main === module) {
  startBot();
}

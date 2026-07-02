import { Worker, Job } from 'bullmq';
import * as dotenv from 'dotenv';
import * as path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

import IORedis from 'ioredis';
import { prisma } from '@frameon/database';
import { VideoRenderer } from '@frameon/renderer';
import { Script } from '@frameon/shared';

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
const connection = new IORedis(redisUrl, { maxRetriesPerRequest: null });

const renderer = new VideoRenderer();

const worker = new Worker('video-render', async (job: Job) => {
  const { videoId } = job.data;

  const video = await prisma.video.findUnique({ where: { id: videoId } });
  
  if (!video || !video.script) {
    throw new Error(`Video or script not found for id ${videoId}`);
  }

  await prisma.video.update({
    where: { id: videoId },
    data: { status: 'rendering' }
  });

  try {
    // Generate simple HTML using the template package or simple inline string
    // For demo purposes, we build a simple HTML here. In reality, it calls @frameon/templates
    const script = video.script as unknown as Script;
    
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { margin: 0; padding: 0; background: #000; color: #fff; font-family: sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; text-align: center;}
          h1 { font-size: 80px; }
        </style>
      </head>
      <body>
        <div>
          <h1>${script.title}</h1>
          <p style="font-size: 40px">${script.hook}</p>
        </div>
      </body>
      </html>
    `;

    const os = require('os');
    const outputPath = path.join(os.tmpdir(), `${videoId}.mp4`);
    
    await renderer.render(script, html, outputPath);

    await prisma.video.update({
      where: { id: videoId },
      data: { status: 'completed', videoUrl: outputPath }
    });
    
    console.log(`Rendered video ${videoId} to ${outputPath}`);

    // Send back to Telegram if we have user
    const user = await prisma.user.findUnique({ where: { id: video.userId } });
    if (user && user.telegramId) {
      const { Bot, InputFile } = require('grammy');
      const botToken = process.env.BOT_TOKEN;
      if (botToken) {
        const bot = new Bot(botToken);
        await bot.api.sendVideo(user.telegramId, new InputFile(outputPath), {
          caption: `🎉 Video của bạn đã sẵn sàng!\n\n🎬 **Chủ đề:** ${video.topic}`
        });
        console.log(`Sent video to user ${user.telegramId}`);
      }
    }

  } catch (error) {
    console.error(`Failed to render video ${videoId}`, error);
    await prisma.video.update({
      where: { id: videoId },
      data: { status: 'failed' }
    });
    throw error;
  }
}, { connection: connection as any });

worker.on('completed', job => {
  console.log(`Job ${job.id} completed!`);
});

worker.on('failed', (job, err) => {
  console.error(`Job ${job?.id} failed with ${err.message}`);
});

console.log('Worker is running and waiting for jobs...');

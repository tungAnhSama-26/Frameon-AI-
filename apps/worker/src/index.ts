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
        <link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@700;900&family=Inter:wght@400;600&display=swap" rel="stylesheet">
        <style>
          body { 
            margin: 0; padding: 0; 
            background: linear-gradient(135deg, #1e003b 0%, #4a00e0 50%, #8e2de2 100%);
            color: #fff; 
            font-family: 'Inter', sans-serif; 
            display: flex; align-items: center; justify-content: center; 
            height: 100vh; width: 100vw;
            text-align: center;
            overflow: hidden;
            position: relative;
          }
          .glass-panel {
            background: rgba(255, 255, 255, 0.1);
            backdrop-filter: blur(20px);
            border-radius: 40px;
            padding: 80px 60px;
            box-shadow: 0 20px 50px rgba(0,0,0,0.5);
            border: 2px solid rgba(255,255,255,0.2);
            width: 80%;
            transform: scale(0.8);
            opacity: 0;
          }
          h1 { 
            font-family: 'Montserrat', sans-serif;
            font-size: 85px; 
            font-weight: 900;
            margin-bottom: 40px;
            text-transform: uppercase;
            background: linear-gradient(to right, #f8ff00, #3ad59f);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            line-height: 1.2;
          }
          p { 
            font-size: 55px; 
            line-height: 1.5;
            text-shadow: 2px 2px 10px rgba(0,0,0,0.5);
            font-weight: 600;
          }
          
          /* Particles */
          .particle {
            position: absolute;
            background: white;
            border-radius: 50%;
            opacity: 0.5;
          }
        </style>
      </head>
      <body>
        <!-- Background particles -->
        <div id="particles"></div>
        
        <div class="glass-panel" id="panel">
          <h1 id="title">${script.title.replace(/"/g, '&quot;')}</h1>
          <p id="hook">${script.hook.replace(/"/g, '&quot;')}</p>
        </div>

        <script>
          // Create background particles
          const particlesContainer = document.getElementById('particles');
          const particles = [];
          for(let i=0; i<30; i++) {
            const p = document.createElement('div');
            p.className = 'particle';
            const size = Math.random() * 15 + 5;
            p.style.width = size + 'px';
            p.style.height = size + 'px';
            const x = Math.random() * window.innerWidth;
            const y = Math.random() * window.innerHeight;
            p.style.left = x + 'px';
            p.style.top = y + 'px';
            particlesContainer.appendChild(p);
            particles.push({ element: p, x, y, speedY: - (Math.random() * 50 + 20) });
          }

          window.seekTo = function(time) {
            // time is in seconds
            const panel = document.getElementById('panel');
            
            // Animation logic for panel (fade in + scale up in first 1 second)
            if (time < 1) {
              const progress = time; // 0 to 1
              // Easing function (easeOutQuad)
              const ease = 1 - (1 - progress) * (1 - progress);
              panel.style.opacity = ease;
              panel.style.transform = \`scale(\${0.8 + ease * 0.2})\`; // scale from 0.8 to 1.0
            } else {
              panel.style.opacity = 1;
              panel.style.transform = 'scale(1)';
            }
            
            // Subtle floating effect for panel after intro
            if (time >= 1) {
              const floatOffset = Math.sin(time * 2) * 15;
              panel.style.transform = \`scale(1) translateY(\${floatOffset}px)\`;
            }

            // Animate particles
            particles.forEach(p => {
              // Calculate new Y based on time and speed
              let currentY = p.y + (p.speedY * time);
              // Wrap around screen
              currentY = currentY % window.innerHeight;
              if (currentY < 0) currentY += window.innerHeight;
              
              p.element.style.transform = \`translateY(\${currentY - p.y}px)\`;
            });
          };
        </script>
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

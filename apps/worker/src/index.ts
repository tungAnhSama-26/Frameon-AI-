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

async function generateTTS(text: string, outputPath: string) {
  const chunks = text.match(/[^.!?]+[.!?]+/g) || [text];
  const buffers = [];
  for (let chunk of chunks) {
    if (!chunk.trim()) continue;
    const url = `https://translate.google.com/translate_tts?ie=UTF-8&tl=vi&client=tw-ob&q=${encodeURIComponent(chunk.trim())}`;
    try {
      const res = await fetch(url);
      if (res.ok) {
        buffers.push(Buffer.from(await res.arrayBuffer()));
      }
    } catch (e) {
      console.error('TTS Fetch Error', e);
    }
  }
  if (buffers.length > 0) {
    require('fs').writeFileSync(outputPath, Buffer.concat(buffers));
    return true;
  }
  return false;
}

async function fetchImageBase64(prompt: string) {
  try {
    const enhancedPrompt = prompt + ", masterpiece, cinematic lighting, 8k resolution, highly detailed";
    const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(enhancedPrompt)}?width=1080&height=1920&nologo=true`;
    console.log(`[Worker] Fetching image for: ${prompt}`);
    const res = await fetch(url);
    if (!res.ok) throw new Error('Fetch failed');
    const buffer = await res.arrayBuffer();
    return `data:image/jpeg;base64,${Buffer.from(buffer).toString('base64')}`;
  } catch (e) {
    console.error('Image Fetch Error', e);
    // fallback gradient
    return '';
  }
}

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
    
    console.log(`[Worker] Downloading scene images...`);
    const scenesWithImages = [];
    for (const scene of script.scenes) {
      const b64 = await fetchImageBase64(scene.visualPrompt || scene.text);
      scenesWithImages.push({ ...scene, b64 });
    }

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@700;800;900&display=swap" rel="stylesheet">
        <style>
          body { margin: 0; padding: 0; background: #000; overflow: hidden; font-family: 'Montserrat', sans-serif; }
          .scene {
            position: absolute; top: 0; left: 0; width: 100vw; height: 100vh;
            opacity: 0; transition: opacity 0.8s ease;
            background-size: cover; background-position: center;
          }
          .scene.active { opacity: 1; }
          .subtitle-container {
            position: absolute; bottom: 15%; left: 8%; right: 8%;
            text-align: center; z-index: 100;
          }
          .subtitle {
            color: #fff;
            font-size: 55px;
            font-weight: 800;
            line-height: 1.4;
            text-transform: uppercase;
            text-shadow: 0px 4px 20px rgba(0,0,0,0.9), 0px 0px 8px rgba(0,0,0,0.8);
            letter-spacing: 2px;
          }
          .overlay {
            position: absolute; top:0; left:0; width:100%; height:100%;
            background: linear-gradient(180deg, rgba(0,0,0,0) 40%, rgba(0,0,0,0.9) 100%);
            z-index: 50;
          }
          .progress-bar {
            position: absolute; top: 0; left: 0; height: 10px; background: #FFD700; z-index: 200; width: 0%;
          }
        </style>
      </head>
      <body>
        ${scenesWithImages.map((scene: any, i: number) => `
          <div class="scene" id="scene-${i}" style="${scene.b64 ? `background-image: url('${scene.b64}');` : 'background: linear-gradient(45deg, #2b1f4a, #1a365d);'}"></div>
        `).join('')}
        
        <div class="overlay"></div>
        
        <div class="subtitle-container">
          <div class="subtitle" id="subtitle">${script.title}</div>
        </div>
        <div class="progress-bar" id="progress"></div>

        <script>
          const scenesData = ${JSON.stringify(scenesWithImages)};
          const totalDuration = scenesData.reduce((acc, s) => acc + s.duration, 0);
          
          window.seekTo = function(time) {
            let currentTime = 0;
            let activeIndex = scenesData.length - 1;
            let sceneStartTime = 0;
            
            for (let i = 0; i < scenesData.length; i++) {
              if (time >= currentTime && time < currentTime + scenesData[i].duration) {
                activeIndex = i;
                sceneStartTime = currentTime;
                break;
              }
              currentTime += scenesData[i].duration;
            }

            // Update active scene and Ken Burns effect
            document.querySelectorAll('.scene').forEach((el, idx) => {
              if (idx === activeIndex) {
                el.classList.add('active');
                // Ken Burns logic: Scale up from 1.0 to 1.15 over the duration
                const elapsedInScene = time - sceneStartTime;
                const progress = elapsedInScene / scenesData[activeIndex].duration;
                const scale = 1.0 + (progress * 0.15);
                el.style.transform = \`scale(\${scale})\`;
              } else {
                el.classList.remove('active');
                el.style.transform = 'scale(1.0)';
              }
            });
            
            // Update subtitle
            const subtitleEl = document.getElementById('subtitle');
            if (subtitleEl.innerText !== scenesData[activeIndex].text) {
              subtitleEl.innerText = scenesData[activeIndex].text;
            }
            
            // Update progress bar
            document.getElementById('progress').style.width = \`\${(time / totalDuration) * 100}%\`;
          };
        </script>
      </body>
      </html>
    `;

    const os = require('os');
    const outputPath = path.join(os.tmpdir(), `${videoId}.mp4`);
    const audioPath = path.join(os.tmpdir(), `${videoId}.mp3`);
    
    console.log(`[Worker] Generating TTS audio...`);
    const hasAudio = await generateTTS(script.narration, audioPath);
    
    console.log(`[Worker] Rendering video ${hasAudio ? 'with audio' : 'without audio'}...`);
    await renderer.render(script, html, outputPath, hasAudio ? audioPath : undefined);

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

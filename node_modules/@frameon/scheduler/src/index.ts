import { Queue } from 'bullmq';
import * as dotenv from 'dotenv';
import * as path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });
import IORedis from 'ioredis';
import { prisma } from '@frameon/database';

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
const connection = new IORedis(redisUrl, { maxRetriesPerRequest: null });

const publishQueue = new Queue('video-publish', { connection: connection as any });

async function schedulePublishing() {
  console.log('Checking for videos to publish...');
  
  // Find videos that are queued for publishing (e.g., approved by user)
  const videos = await prisma.video.findMany({
    where: { status: 'queued_for_publish' },
    take: 10
  });

  for (const video of videos) {
    await publishQueue.add('publish', { videoId: video.id });
    
    // Mark as publishing
    await prisma.video.update({
      where: { id: video.id },
      data: { status: 'publishing' }
    });
    
    console.log(`Queued video ${video.id} for publishing.`);
  }
}

// Run every minute
setInterval(() => {
  schedulePublishing().catch(console.error);
}, 60000);

console.log('Scheduler is running...');

"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const bullmq_1 = require("bullmq");
const ioredis_1 = __importDefault(require("ioredis"));
const database_1 = require("@frameon/database");
const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
const connection = new ioredis_1.default(redisUrl, { maxRetriesPerRequest: null });
const publishQueue = new bullmq_1.Queue('video-publish', { connection: connection });
async function schedulePublishing() {
    console.log('Checking for videos to publish...');
    // Find videos that are queued for publishing (e.g., approved by user)
    const videos = await database_1.prisma.video.findMany({
        where: { status: 'queued_for_publish' },
        take: 10
    });
    for (const video of videos) {
        await publishQueue.add('publish', { videoId: video.id });
        // Mark as publishing
        await database_1.prisma.video.update({
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

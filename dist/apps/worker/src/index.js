"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const bullmq_1 = require("bullmq");
const ioredis_1 = __importDefault(require("ioredis"));
const database_1 = require("@frameon/database");
const renderer_1 = require("@frameon/renderer");
const path = __importStar(require("path"));
const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
const connection = new ioredis_1.default(redisUrl, { maxRetriesPerRequest: null });
const renderer = new renderer_1.VideoRenderer();
const worker = new bullmq_1.Worker('video-render', async (job) => {
    const { videoId } = job.data;
    const video = await database_1.prisma.video.findUnique({ where: { id: videoId } });
    if (!video || !video.script) {
        throw new Error(`Video or script not found for id ${videoId}`);
    }
    await database_1.prisma.video.update({
        where: { id: videoId },
        data: { status: 'rendering' }
    });
    try {
        // Generate simple HTML using the template package or simple inline string
        // For demo purposes, we build a simple HTML here. In reality, it calls @frameon/templates
        const script = video.script;
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
        const outputPath = path.join('/tmp', `${videoId}.mp4`);
        await renderer.render(script, html, outputPath);
        await database_1.prisma.video.update({
            where: { id: videoId },
            data: { status: 'completed', videoUrl: outputPath }
        });
        console.log(`Rendered video ${videoId} to ${outputPath}`);
    }
    catch (error) {
        console.error(`Failed to render video ${videoId}`, error);
        await database_1.prisma.video.update({
            where: { id: videoId },
            data: { status: 'failed' }
        });
        throw error;
    }
}, { connection: connection });
worker.on('completed', job => {
    console.log(`Job ${job.id} completed!`);
});
worker.on('failed', (job, err) => {
    console.error(`Job ${job?.id} failed with ${err.message}`);
});
console.log('Worker is running and waiting for jobs...');

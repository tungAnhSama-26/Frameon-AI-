import * as dotenv from 'dotenv';
import * as path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../../../.env'), override: true });

import Fastify from 'fastify';
import cors from '@fastify/cors';
import { prisma } from '@frameon/database';
import { AIGenerator } from '@frameon/ai';

const ai = new AIGenerator(process.env.OPENAI_API_KEY || process.env.GEMINI_API_KEY || '');

const fastify = Fastify({
  logger: true
});

fastify.register(cors, {
  origin: true // Allow all origins for local dev
});

fastify.get('/videos', async (request, reply) => {
  const videos = await prisma.video.findMany({
    orderBy: { createdAt: 'desc' }
  });
  return videos;
});

fastify.get('/videos/:id', async (request, reply) => {
  const { id } = request.params as { id: string };
  const video = await prisma.video.findUnique({ where: { id } });
  if (!video) {
    return reply.status(404).send({ error: 'Video not found' });
  }
  return video;
});

fastify.post('/generate/titles', async (request, reply) => {
  const { topic } = request.body as { topic: string };
  if (!topic) return reply.status(400).send({ error: 'Topic is required' });
  
  try {
    const titles = await ai.generateTitles(topic);
    return { titles };
  } catch (error: any) {
    fastify.log.error(error);
    return reply.status(500).send({ error: error.message || 'Failed to generate titles' });
  }
});

fastify.post('/generate/script', async (request, reply) => {
  const { title } = request.body as { title: string };
  if (!title) return reply.status(400).send({ error: 'Title is required' });
  
  try {
    const script = await ai.generateScript(title);
    return { script };
  } catch (error: any) {
    fastify.log.error(error);
    return reply.status(500).send({ error: error.message || 'Failed to generate script' });
  }
});

const start = async () => {
  try {
    await fastify.listen({ port: 3000, host: '0.0.0.0' });
    console.log(`Server listening on port 3000`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};
start();

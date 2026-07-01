import Fastify from 'fastify';
import { prisma } from '@frameon/database';

const fastify = Fastify({
  logger: true
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

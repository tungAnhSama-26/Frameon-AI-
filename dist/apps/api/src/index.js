"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const fastify_1 = __importDefault(require("fastify"));
const database_1 = require("@frameon/database");
const fastify = (0, fastify_1.default)({
    logger: true
});
fastify.get('/videos', async (request, reply) => {
    const videos = await database_1.prisma.video.findMany({
        orderBy: { createdAt: 'desc' }
    });
    return videos;
});
fastify.get('/videos/:id', async (request, reply) => {
    const { id } = request.params;
    const video = await database_1.prisma.video.findUnique({ where: { id } });
    if (!video) {
        return reply.status(404).send({ error: 'Video not found' });
    }
    return video;
});
const start = async () => {
    try {
        await fastify.listen({ port: 3000, host: '0.0.0.0' });
        console.log(`Server listening on port 3000`);
    }
    catch (err) {
        fastify.log.error(err);
        process.exit(1);
    }
};
start();

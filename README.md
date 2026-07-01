# Frameon AI

An AI-powered automation platform that converts user text prompts into fully automated short-form videos through a Telegram Bot.

## Tech Stack
- TypeScript (strict)
- Node.js LTS
- grammY (Telegram Bot)
- Fastify (API optional)
- Puppeteer (render engine)
- FFmpeg (video encoding)
- BullMQ (queue)
- Redis
- PostgreSQL + Prisma
- Zod

## Monorepo Structure

- **apps/bot**: The Telegram bot (grammY) that interacts with the user.
- **apps/api**: Fastify server to serve video files or provide a webhook.
- **apps/worker**: BullMQ worker that processes video rendering using Puppeteer and FFmpeg.
- **apps/scheduler**: A node cron service to auto-publish queued videos to TikTok/YouTube/Facebook.
- **packages/ai**: OpenAI generation logic with Zod strict schemas (titles, scripts).
- **packages/renderer**: Puppeteer and fluent-ffmpeg wrapper to render HTML to MP4.
- **packages/database**: Prisma ORM client and schema definition.
- **packages/shared**: Zod schemas and TypeScript types shared across the monorepo.
- **packages/templates**: (Placeholder) HTML/CSS/JS injection templates.
- **packages/utils**: (Placeholder) Utility functions.

## Setup Instructions

1. Install dependencies:
   ```bash
   npm install
   ```
2. Initialize Prisma:
   ```bash
   cd packages/database
   npx prisma generate
   npx prisma db push
   ```
3. Create a `.env` file in the root:
   ```
   BOT_TOKEN="your_telegram_bot_token"
   OPENAI_API_KEY="your_openai_api_key"
   DATABASE_URL="postgresql://user:pass@localhost:5432/frameon"
   REDIS_URL="redis://localhost:6379"
   ```
4. Build all packages and apps:
   ```bash
   npm run build
   ```
5. Run the services (e.g. Bot):
   ```bash
   npm run dev -w @frameon/bot
   ```

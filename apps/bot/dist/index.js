"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.startBot = void 0;
const grammy_1 = require("grammy");
const ai_1 = require("@frameon/ai");
const database_1 = require("@frameon/database");
const botToken = process.env.BOT_TOKEN || '';
const openaiKey = process.env.OPENAI_API_KEY || '';
if (!botToken || !openaiKey) {
    console.warn('BOT_TOKEN or OPENAI_API_KEY is missing');
}
const bot = new grammy_1.Bot(botToken);
const ai = new ai_1.AIGenerator(openaiKey);
bot.command('start', (ctx) => {
    ctx.reply('Welcome to Frameon AI! Send me a topic to generate a short-form video.');
});
bot.on('message:text', async (ctx) => {
    const topic = ctx.message.text;
    const loadingMsg = await ctx.reply('🤖 Generating titles...');
    try {
        const titles = await ai.generateTitles(topic);
        const keyboard = new grammy_1.InlineKeyboard();
        titles.forEach((title, index) => {
            // Store topic and title index or just title in callback data (limited to 64 bytes)
            // For a real app, we'd store these in a temporary session or DB
            keyboard.text(title.substring(0, 30) + '...', `select_title:${index}`).row();
        });
        // Store in a simple map for demo purposes (use Redis/Session in prod)
        global.tempTitles = titles;
        global.tempTopic = topic;
        await ctx.api.editMessageText(ctx.chat.id, loadingMsg.message_id, 'Select a title for your video:', {
            reply_markup: keyboard,
        });
    }
    catch (error) {
        console.error(error);
        await ctx.api.editMessageText(ctx.chat.id, loadingMsg.message_id, '❌ Failed to generate titles. Try again later.');
    }
});
bot.callbackQuery(/select_title:(\d+)/, async (ctx) => {
    const index = parseInt(ctx.match[1], 10);
    const titles = global.tempTitles;
    const topic = global.tempTopic;
    if (!titles || !titles[index]) {
        return ctx.answerCallbackQuery('Session expired. Please send a new topic.');
    }
    const selectedTitle = titles[index];
    await ctx.answerCallbackQuery();
    const loadingMsg = await ctx.reply(`🎬 Selected: "${selectedTitle}"\nGenerating script...`);
    try {
        const script = await ai.generateScript(selectedTitle);
        let user = await database_1.prisma.user.findUnique({ where: { telegramId: ctx.from.id.toString() } });
        if (!user) {
            user = await database_1.prisma.user.create({
                data: {
                    telegramId: ctx.from.id.toString(),
                    username: ctx.from.username,
                }
            });
        }
        const video = await database_1.prisma.video.create({
            data: {
                userId: user.id,
                topic,
                title: selectedTitle,
                script: script,
                status: 'queued' // Actually it should be queued for rendering
            }
        });
        if (!ctx.chat)
            return;
        await ctx.api.editMessageText(ctx.chat.id, loadingMsg.message_id, `✅ Script generated successfully!\n\n**Hook:** ${script.hook}\n\nVideo is now queued for rendering. ID: ${video.id}`);
        // TODO: Send to BullMQ queue here
    }
    catch (error) {
        console.error(error);
        if (ctx.chat) {
            await ctx.api.editMessageText(ctx.chat.id, loadingMsg.message_id, '❌ Failed to generate script.');
        }
    }
});
bot.catch((err) => {
    console.error(`Error while handling update ${err.ctx.update.update_id}:`);
    console.error(err.error);
});
const startBot = () => {
    bot.start();
    console.log('🤖 Bot started');
};
exports.startBot = startBot;
if (require.main === module) {
    (0, exports.startBot)();
}

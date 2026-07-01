"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.VideoRenderer = void 0;
const puppeteer_1 = __importDefault(require("puppeteer"));
const fluent_ffmpeg_1 = __importDefault(require("fluent-ffmpeg"));
const stream_1 = require("stream");
class VideoRenderer {
    width;
    height;
    fps;
    constructor(width = 1080, height = 1920, fps = 30) {
        this.width = width;
        this.height = height;
        this.fps = fps;
    }
    async render(script, htmlContent, outputPath) {
        const browser = await puppeteer_1.default.launch({ headless: true });
        const page = await browser.newPage();
        await page.setViewport({ width: this.width, height: this.height });
        await page.setContent(htmlContent);
        // Assuming the HTML template has a fixed duration or we calculate based on scenes
        const durationSec = script.scenes.reduce((acc, scene) => acc + scene.duration, 0);
        const totalFrames = durationSec * this.fps;
        const stream = new stream_1.PassThrough();
        return new Promise((resolve, reject) => {
            (0, fluent_ffmpeg_1.default)()
                .input(stream)
                .inputFormat('image2pipe')
                .inputFPS(this.fps)
                .output(outputPath)
                .videoCodec('libx264')
                .outputOptions('-pix_fmt yuv420p')
                .on('end', async () => {
                await browser.close();
                resolve(outputPath);
            })
                .on('error', async (err) => {
                await browser.close();
                reject(err);
            })
                .run();
            const captureFrames = async () => {
                for (let i = 1; i <= totalFrames; i++) {
                    // Trigger any JS animations based on time if needed
                    await page.evaluate((time) => {
                        // custom logic inside HTML to seek animations
                        if (window.seekTo)
                            window.seekTo(time);
                    }, i / this.fps);
                    const screenshot = await page.screenshot({ type: 'jpeg', quality: 90 });
                    stream.write(screenshot);
                }
                stream.end();
            };
            captureFrames().catch(err => {
                stream.end();
                reject(err);
            });
        });
    }
}
exports.VideoRenderer = VideoRenderer;

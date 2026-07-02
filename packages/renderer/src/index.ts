import puppeteer from 'puppeteer';
import ffmpeg from 'fluent-ffmpeg';
import { PassThrough } from 'stream';
import { Script } from '@frameon/shared';
import * as fs from 'fs';
import * as path from 'path';

// Fix fluent-ffmpeg by providing static binary
const ffmpegStatic = require('ffmpeg-static');
ffmpeg.setFfmpegPath(ffmpegStatic);

export class VideoRenderer {
  constructor(private readonly width = 1080, private readonly height = 1920, private readonly fps = 30) {}

  async render(script: Script, htmlContent: string, outputPath: string): Promise<string> {
    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();
    await page.setViewport({ width: this.width, height: this.height });
    
    await page.setContent(htmlContent);

    // Assuming the HTML template has a fixed duration or we calculate based on scenes
    const durationSec = script.scenes.reduce((acc: number, scene: any) => acc + scene.duration, 0);
    const totalFrames = durationSec * this.fps;

    const stream = new PassThrough();

    return new Promise((resolve, reject) => {
      ffmpeg()
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
        .on('error', async (err: any) => {
          await browser.close();
          reject(err);
        })
        .run();

      const captureFrames = async () => {
        for (let i = 1; i <= totalFrames; i++) {
          // Trigger any JS animations based on time if needed
          await page.evaluate((time) => {
            // custom logic inside HTML to seek animations
            if (window.seekTo) window.seekTo(time);
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

declare global {
  interface Window {
    seekTo?: (time: number) => void;
  }
}

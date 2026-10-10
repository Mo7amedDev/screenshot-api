//src/routes/screenshot.website.ts

import { FastifyInstance } from 'fastify';
import sharp from 'sharp';
import { screenshotUrl } from '../services/playwright.service';
import { saveImage } from '../services/storage.service';
import { websiteScreenshotSchema } from '../schemas/request.schema';

type Format = 'png' | 'jpeg' | 'webp';
type ReturnType = 'image' | 'url';
type WaitUntil = 'domcontentloaded' | 'load' | 'networkidle';

const MIME: Record<Format, string> = {
    png: 'image/png',
    jpeg: 'image/jpeg',
    webp: 'image/webp',
};

export interface WebsiteBody {
    url: string;
    selector?: string;
    width?: number;
    height?: number;
    fullPage?: boolean;
    format?: Format;
    quality?: number;
    limit?: number;
    returnType?: ReturnType;
    waitUntil?: WaitUntil;
    waitFor?: string;
    waitMs?: number;
    waitForImages?: boolean;
    blockAds?: boolean;
}

/**
 * Combines an array of image buffers into a single vertical strip image.
 */
async function stitchImagesVertically(images: Buffer[], format: Format, quality: number): Promise<Buffer> {
    const metadataList = await Promise.all(images.map(img => sharp(img).metadata()));

    const maxWidth = Math.max(...metadataList.map(m => m.width ?? 0));
    const totalHeight = metadataList.reduce((sum: number, m) => sum + (m.height ?? 0), 0);

    let currentTop = 0;
    const composites = images.map((img, idx) => {
        const top = currentTop;
        currentTop += metadataList[idx].height ?? 0;
        return { input: img, top, left: 0 };
    });

    // Create a base blank canvas transparency layer
    let pipeline = sharp({
        create: {
            width: maxWidth,
            height: totalHeight,
            channels: 4,
            background: { r: 255, g: 255, b: 255, alpha: 0 }
        }
    }).composite(composites);

    // Format composition layers cleanly
    switch (format) {
        case 'jpeg': return pipeline.jpeg({ quality }).toBuffer();
        case 'webp': return pipeline.webp({ quality }).toBuffer();
        default: return pipeline.png().toBuffer();
    }
}

async function handler(app: FastifyInstance, path: string) {
    app.post<{ Body: WebsiteBody }>(
        path,
        { schema: websiteScreenshotSchema },
        async (request, reply) => {
            const { url: rawUrl, format = 'png', returnType = 'image', quality = 90, limit, ...rest } = request.body;

            const url = rawUrl.startsWith('http') ? rawUrl : `https://${rawUrl}`;

            // 1. Fire Playwright collector - returns array of buffers
            const images = await screenshotUrl({ url, format, quality, limit, ...rest });

            // ── RETURN OPTION 1: Direct Binary Stream Image Output ────────────────
            if (returnType === 'image') {
                if (images.length === 0) {
                    return reply.status(404).send({ error: 'No elements matched selector to print' });
                }

                // If only 1 card matches, send directly. If multiple match, stitch them vertically!
                const finalImageBuffer = images.length === 1
                    ? images[0]
                    : await stitchImagesVertically(images, format, quality);

                return reply
                    .header('Content-Type', MIME[format])
                    .header('Cache-Control', 'public, max-age=60')
                    .send(finalImageBuffer);
            }

            // ── RETURN OPTION 2: Persistent Media URLs ───────────────────────────
            const baseUrl = `${request.protocol}://${request.hostname}`;

            // Map asynchronously to store all captured component screenshots
            const savedResults = await Promise.all(
                images.map(imgBuffer => saveImage(imgBuffer, format, baseUrl))
            );

            return reply.send({
                count: savedResults.length,
                format,
                // Returns clean map schema listing URLs for every single component detected
                results: savedResults.map(saved => ({
                    url: saved.url,
                    filename: saved.filename,
                }))
            });
        }
    );
}

export async function websiteScreenshotRoute(app: FastifyInstance) {
    await handler(app, '/screenshot/website');
    await handler(app, '/screenshot/playwright');
}
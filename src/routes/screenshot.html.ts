//src/routes/screenshot.html.ts

import { FastifyInstance } from 'fastify';
import sharp from 'sharp';
import { screenshotHtml } from '../services/satori.service';
import { saveImage } from '../services/storage.service';
import { htmlScreenshotSchema } from '../schemas/request.schema';

type Format = 'png' | 'jpeg' | 'webp';
type ReturnType = 'image' | 'url';

const MIME: Record<Format, string> = {
    png: 'image/png',
    jpeg: 'image/jpeg',
    webp: 'image/webp',
};

interface HtmlBody {
    htmls: string[];
    width?: number;
    height?: number;
    format?: Format;
    quality?: number;
    returnType?: ReturnType;
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

    let pipeline = sharp({
        create: {
            width: maxWidth,
            height: totalHeight,
            channels: 4,
            background: { r: 255, g: 255, b: 255, alpha: 0 }
        }
    }).composite(composites);

    switch (format) {
        case 'jpeg': return pipeline.jpeg({ quality }).toBuffer();
        case 'webp': return pipeline.webp({ quality }).toBuffer();
        default: return pipeline.png().toBuffer();
    }
}

const testElement = `<div style='display: flex; flex-direction: column; width: 400px; height: 520px; background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 16px; padding: 20px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);'>
  
  <div style='display: flex; width: 360px; height: 320px; border-radius: 12px; overflow: hidden; margin-bottom: 16px;'>
    <img 
      src='https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=600&q=80' 
      style='width: 360px; height: 320px; object-fit: cover;' 
      alt='Product'
    />
  </div>

  <div style='display: flex; flex-direction: column; width: 100%;'>
    <span style='display: flex; color: #4f46e5; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 6px;'>
      Footwear
    </span>
    
    <span style='display: flex; color: #1e293b; font-size: 20px; font-weight: 700; margin-bottom: 12px;'>
      Sonic Speed Running Shoes
    </span>

    <div style='display: flex; justify-content: space-between; align-items: center; width: 100%; margin-top: auto;'>
      <span style='display: flex; color: #0f172a; font-size: 24px; font-weight: 800;'>
        $129.99
      </span>
      <div style='display: flex; background-color: #25D366; color: #ffffff; padding: 6px 14px; border-radius: 20px; font-size: 13px; font-weight: 600;'>
        In Stock
      </div>
    </div>
  </div>

</div>`

export async function htmlScreenshotRoute(app: FastifyInstance) {
    app.post<{ Body: HtmlBody }>(
        '/screenshot/html',
        { schema: htmlScreenshotSchema },
        async (request, reply) => {
            const { htmls, format = 'png', returnType = 'image', quality = 90, ...rest } = request.body;
            //const testhtmls = [testElement, testElement, testElement]
            // Render all HTML strings in parallel using Satori
            const images = await Promise.all(
                htmls.map((html) => screenshotHtml({ html, format, quality, ...rest }))
            );

            // ── RETURN OPTION 1: Direct Binary Stream Image Output ────────────────
            if (returnType === 'image') {
                if (images.length === 0) {
                    return reply.status(400).send({ error: 'No HTML provided' });
                }

                // If only 1 item, return it. If multiple, stitch vertically!
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

            const savedResults = await Promise.all(
                images.map(imgBuffer => saveImage(imgBuffer, format, baseUrl))
            );

            return reply.send({
                count: savedResults.length,
                format,
                results: savedResults.map(saved => ({
                    url: saved.url,
                    filename: saved.filename,
                }))
            });
        }
    );
}
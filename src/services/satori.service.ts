//src/services/satori.service.ts

import satori from 'satori';
import parse from 'html-react-parser';
import { Resvg } from '@resvg/resvg-js';
import sharp from 'sharp';
import { readFileSync } from 'fs';
import { join } from 'path';

// ---------------------------------------------------------------------------
// Fonts
// ---------------------------------------------------------------------------
const fontData = readFileSync(join(__dirname, 'fonts', 'Inter-Regular.ttf'));

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
export interface HtmlScreenshotOptions {
    html: string;
    width?: number;
    height?: number;
    format?: 'png' | 'jpeg' | 'webp';
    quality?: number;
    background?: string;
}

// ---------------------------------------------------------------------------
// Renderer
// ---------------------------------------------------------------------------


export async function screenshotHtml(opts: HtmlScreenshotOptions): Promise<Buffer> {
    const width = opts.width ?? 1200;
    const height = opts.height ?? 630;
    const background = opts.background ?? 'white';

    // 1. Keep the template strictly flush with NO external newlines or spaces
    const template = `<div style="display: flex; flex-direction: column; width: ${width}px; height: ${height}px; background-color: ${background}; overflow: hidden; font-family: 'Inter';">${opts.html}</div>`;

    // 2. Parse into React nodes
    let element = parse(template);

    // 3. DEFENSIVE CHECK: If the parser wrapped it in an array due to hidden text fragments,
    // find and extract the actual main element object.
    if (Array.isArray(element)) {
        element = element.find(
            (node) => node && typeof node === 'object' && 'props' in node
        );
    }

    // If something went horribly wrong and no element was found, throw a clean error
    if (!element) {
        throw new Error("Failed to parse a valid root HTML element for Satori.");
    }

    // 4. Pass the guaranteed single object element to Satori
    const svg = await satori(element as any, {
        width,
        height,
        fonts: [
            {
                name: 'Inter',
                data: fontData,
                weight: 400,
                style: 'normal',
            },
        ],
    });

    const resvg = new Resvg(svg, {
        fitTo: { mode: 'width', value: width },
        background,
    });

    const pngBuffer = Buffer.from(resvg.render().asPng());

    const format = opts.format ?? 'png';
    const quality = opts.quality ?? 90;

    switch (format) {
        case 'jpeg':
            return sharp(pngBuffer).jpeg({ quality }).toBuffer();
        case 'webp':
            return sharp(pngBuffer).webp({ quality }).toBuffer();
        case 'png':
        default:
            return sharp(pngBuffer).png({ compressionLevel: 6 }).toBuffer();
    }
}
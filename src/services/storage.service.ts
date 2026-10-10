//src/services/storage.service.ts

import { writeFile, mkdir, unlink } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';
import { randomUUID } from 'crypto';

// ---------------------------------------------------------------------------
// Storage folder sits at the project root: <cwd>/storage/
// Files are served statically by Fastify at /storage/<filename>
// ---------------------------------------------------------------------------
const STORAGE_DIR = join(process.cwd(), 'storage');

export async function ensureStorageDir(): Promise<void> {
    if (!existsSync(STORAGE_DIR)) {
        await mkdir(STORAGE_DIR, { recursive: true });
    }
}

/**
 * Deletes an image from the storage folder.
 * @param filename File name to delete
 */
export async function deleteImage(filename: string): Promise<boolean> {
    const filePath = join(STORAGE_DIR, filename);
    if (!existsSync(filePath)) {
        return false;
    }
    await unlink(filePath);
    return true;
}

export interface SaveResult {
    /** Public URL the caller can return to the user, e.g. http://localhost:3000/storage/abc.webp */
    url: string;
    /** Absolute path on disk */
    filePath: string;
    /** Just the filename, e.g. abc.webp */
    filename: string;
}

/**
 * Saves an image buffer to the storage folder and returns a public URL.
 *
 * @param buffer  Raw image bytes
 * @param format  'png' | 'jpeg' | 'webp'
 * @param baseUrl Full base URL of the server, e.g. 'http://localhost:3000'
 */
export async function saveImage(
    buffer: Buffer,
    format: 'png' | 'jpeg' | 'webp',
    baseUrl: string
): Promise<SaveResult> {
    await ensureStorageDir();

    const ext = format === 'jpeg' ? 'jpg' : format;
    const filename = `${randomUUID()}.${ext}`;
    const filePath = join(STORAGE_DIR, filename);

    await writeFile(filePath, buffer);

    return {
        url: `${baseUrl}/storage/${filename}`,
        filePath,
        filename,
    };
}
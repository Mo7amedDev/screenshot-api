//src/routes/storage.ts

import { FastifyInstance } from 'fastify';
import { deleteImage } from '../services/storage.service';

export async function storageRoutes(app: FastifyInstance) {
    app.delete<{ Params: { filename: string } }>(
        '/storage/:filename',
        async (request, reply) => {
            const { filename } = request.params;

            // Security check: prevent directory traversal
            if (filename.includes('/') || filename.includes('..')) {
                return reply.status(400).send({ error: 'Invalid filename' });
            }

            const deleted = await deleteImage(filename);

            if (!deleted) {
                return reply.status(404).send({ error: 'File not found' });
            }

            return reply.send({ success: true, message: `File ${filename} deleted` });
        }
    );
}

//src/cluster.ts

/**
 * cluster.ts — Run one Fastify worker per CPU core.
 * Use this in production instead of `node dist/server.js`
 * when you want to fully utilize multi-core machines.
 *
 * Each worker gets its own browser pool.
 * Requests are round-robin'd across workers by the OS.
 *
 * Start with: node dist/cluster.js
 */
import cluster from 'cluster';
import os from 'os';

const NUM_WORKERS = Number(process.env.WORKERS) || os.cpus().length;

if (cluster.isPrimary) {
    console.log(`[cluster] Primary ${process.pid} starting ${NUM_WORKERS} workers`);

    for (let i = 0; i < NUM_WORKERS; i++) {
        cluster.fork();
    }

    cluster.on('exit', (worker, code, signal) => {
        console.warn(
            `[cluster] Worker ${worker.process.pid} died (code=${code}, signal=${signal}). Restarting...`
        );
        cluster.fork(); // Auto-restart dead workers
    });

    cluster.on('online', (worker) => {
        console.log(`[cluster] Worker ${worker.process.pid} is online`);
    });
} else {
    // Each worker runs the full Fastify server
    require('./server');
}
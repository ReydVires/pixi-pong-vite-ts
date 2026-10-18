import { defineConfig } from 'vite';

/**
 * Dev-only endpoint used by `scripts/dev.mjs`: when a second `npm run dev`
 * finds the server already running, it GETs `/__dev-reload` and the running
 * server pushes a full-reload to every connected browser tab.
 */
const reloadEndpoint = () => ({
    name: 'dev-reload-endpoint',
    configureServer(server) {
        server.middlewares.use((req, res, next) => {
            if (req.url === '/__dev-reload') {
                res.setHeader('Content-Type', 'application/json');
                res.end('{"ok":true}');
                server.ws.send({ type: 'full-reload' });
                return;
            }
            next();
        });
    },
});

export default defineConfig({
    base: './',
    build: {
        rollupOptions: {
            output: {
                manualChunks: {
                    pixi: ['pixi.js']
                }
            }
        },
    },
    server: {
        port: 8080,
        // Open the browser when the dev server starts.
        open: true
    },
    plugins: [reloadEndpoint()]
});

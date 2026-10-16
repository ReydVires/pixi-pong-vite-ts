import { defineConfig } from 'vite';

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
        port: 8080
    }
});

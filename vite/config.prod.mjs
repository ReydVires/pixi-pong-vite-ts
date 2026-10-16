import { defineConfig } from 'vite';

const buildmsg = () => {
    return {
        name: 'buildmsg',
        buildStart() {
            process.stdout.write(`Building for production...\n`);
        },
        buildEnd() {
            const line = "---------------------------------------------------------";
            const msg = `🎮 Have fun building your game! 🎮`;
            process.stdout.write(`${line}\n${msg}\n${line}\n`);
            
            process.stdout.write(`✨ Done ✨\n`);
        }
    }
}   

export default defineConfig({
    base: './',
    logLevel: 'warning',
    build: {
        rollupOptions: {
            output: {
                manualChunks: {
                    pixi: ['pixi.js']
                }
            }
        },
        minify: 'terser',
        terserOptions: {
            compress: {
                passes: 2
            },
            mangle: true,
            format: {
                comments: false
            }
        }
    },
    server: {
        port: 8080
    },
    plugins: [
        buildmsg()
    ]
});

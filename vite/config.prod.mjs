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
                manualChunks(id) {
                    // Isolate Vite's preload helper. It is shared by the entry and
                    // by pixi.js (which has internal dynamic imports); left to
                    // Rollup it lands inside the pixi chunk, which then makes the
                    // tiny entry statically depend on ~600 KB of engine code.
                    if (id.includes('preload-helper')) return 'preload-helper';

                    if (id.includes('node_modules/pixi.js')) return 'pixi';
                },
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

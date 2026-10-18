#!/usr/bin/env node
/**
 * Dev launcher for `npm run dev`.
 *
 * - No server yet  -> start Vite (its config opens the browser automatically).
 * - Server already running -> don't start a second one; refresh the tab that's
 *   already open on the port instead (falling back to opening it).
 *
 * The "refresh" works by hitting a tiny endpoint (`/__dev-reload`) exposed by
 * the dev config, which tells the running server to send a full-reload to every
 * connected browser.
 */
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import http from 'node:http';

const require = createRequire(import.meta.url);

const PORT = 8080;
const HOST = 'localhost';
const CONFIG = 'vite/config.dev.mjs';
const URL = `http://${HOST}:${PORT}`;

/** GET a path from the dev server; resolves to the status code (0 if unreachable). */
function status(path) {
    return new Promise((resolve) => {
        const req = http.get({ host: HOST, port: PORT, path, timeout: 1500 }, (res) => {
            res.resume();
            resolve(res.statusCode ?? 0);
        });
        req.on('error', () => resolve(0));
        req.on('timeout', () => {
            req.destroy();
            resolve(0);
        });
    });
}

/** Open a URL in the default browser (macOS, Linux and Windows). */
function openBrowser(target) {
    // `start` is a cmd.exe builtin, so it runs via `cmd /c`. The empty `""` is
    // the window title slot — without it `start` would treat the URL as the title.
    // Passing args as an array (no `shell: true`) avoids Node's DEP0190 warning
    // and any quoting/injection problems.
    const [command, args] =
        process.platform === 'win32'
            ? ['cmd', ['/c', 'start', '', target]]
            : process.platform === 'darwin'
              ? ['open', [target]]
              : ['xdg-open', [target]];

    spawn(command, args, { stdio: 'ignore', detached: true })
        .on('error', () => {
            // No browser opener available (e.g. headless Linux). Not fatal —
            // Vite still prints the URL so it can be opened manually.
        })
        .unref();
}

async function main() {
    // Vite serves its HMR client at /@vite/client — a reliable "this is Vite" probe.
    const isViteRunning = (await status('/@vite/client')) === 200;

    if (isViteRunning) {
        const refreshed = (await status('/__dev-reload')) === 200;

        if (refreshed) {
            console.log(`\n♻️  Dev server already running at ${URL} — refreshed the open tab.\n`);
        } else {
            console.log(`\n♻️  Dev server already running at ${URL} — opening it.\n`);
            openBrowser(URL);
        }
        return;
    }

    // No server yet: start Vite. Its config sets `server.open` to open the browser.
    const viteBin = join(dirname(require.resolve('vite/package.json')), 'bin/vite.js');
    const child = spawn(process.execPath, [viteBin, '--config', CONFIG, ...process.argv.slice(2)], {
        stdio: 'inherit',
    });

    for (const signal of ['SIGINT', 'SIGTERM']) {
        process.on(signal, () => child.kill(signal));
    }
    child.on('exit', (code) => process.exit(code ?? 0));
}

void main();

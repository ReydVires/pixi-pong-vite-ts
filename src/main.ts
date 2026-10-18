/**
 * Thin bootstrap.
 *
 * The Pixi engine and the rest of the game live behind a *dynamic* import, so
 * they ship as separate async chunks. This file stays tiny, `index.html` paints
 * its splash immediately, and the engine downloads in parallel instead of
 * blocking the first render (which is what a static `import` of `Game` would do).
 *
 * The import starts right away — the game needs it in a moment anyway — and the
 * splash is hidden once the renderer is mounted.
 */
const gameModule = import('./game/Game');

// Module scripts run after the HTML is parsed, so `DOMContentLoaded` fires just
// after this — the listener is always registered in time.
document.addEventListener('DOMContentLoaded', () => {
    void boot();
});

async function boot(): Promise<void> {
    const splash = document.getElementById('splash');

    try {
        const { Game } = await gameModule;

        await new Game().start('game-container', {
            onReady: () => splash?.remove(),
        });
    } catch (error) {
        console.error(error);

        if (splash) {
            splash.classList.add('error');
            splash.textContent = 'Failed to load the game. Please check your connection and refresh.';
        }
    }
}

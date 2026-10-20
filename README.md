# PixiJS Vite TypeScript Template

A small, batteries-included starter for 2D games built with **[PixiJS 8](https://pixijs.com)**,
**[TypeScript 5.7](https://www.typescriptlang.org)** and **[Vite 6](https://vitejs.dev)**.
It gives you the boring-but-important parts already wired up — screen transitions, asset
loading, sound, pointer input, and responsive scaling — so you can focus on making the game.

> Never touched a game engine before? Read **[Your first 30 minutes](#your-first-30-minutes)**,
> then the **[Cookbook](#cookbook-common-tasks)**. You'll be dangerous in no time.

## What you get out of the box

- 🧩 **Screens** with a clean lifecycle (`init` → `update` → `destroy`) and animated transitions
- 🖥️ **Responsive scaling** that works on phones, tablets and desktop with no extra effort
- 🎨 **Two layers** per screen: `world` (gameplay/backdrops) and `ui` (HUD/menus)
- 📦 **Asset loader** with progress reporting (perfect for a loading bar)
- 🔊 **Sound with no files to ship** — a Web Audio manager with synthesised effects,
  volume/mute that persist, and a ready-made toggle
- 🔤 **Bundled web font** (Titan One) loaded before any text, so labels look identical everywhere
- 👆 **Pointer input** scoped to a screen, cleaned up automatically
- ⌨️ **Keyboard input** scoped to a screen (`isDown` polling + `onKeyDown` events)
- ⏸️ **Pause pattern** — ESC freezes gameplay and shows an overlay with Resume/Exit
- ⚡ An **instant HTML splash** while the Pixi engine downloads as a separate async chunk
- 🧪 A **dev handle** (`window.game`) so you can poke at the running game from the console

## Quick start

**Prerequisites:** [Node.js 18+](https://nodejs.org) and npm.

```bash
npm install      # install dependencies
npm run dev      # start the dev server (opens your browser)
```

Your browser opens **http://localhost:8080** automatically. Edit any file under `src/` and it
hot-reloads instantly.

If you run `npm run dev` again while the server is still running, it **reuses** that server
and **refreshes the tab that's already open** instead of starting a second instance on another
port. (Set `BROWSER=none` to suppress opening the browser, e.g. on a remote machine.)

```bash
npm run build    # produce an optimized build in dist/
```

| Command         | Description                                            |
| --------------- | ------------------------------------------------------ |
| `npm run dev`   | Start the dev server (opens/refreshes the browser, port `8080`) |
| `npm run build` | Generate an optimized production build in `dist/`      |

## Your first 30 minutes

If you're new, do these in order:

1. **Run it.** `npm install` then `npm run dev`.
2. **Find the gameplay code.** Open `src/game/screens/PlayScreen.ts` — this is "the game"
   (Whack-a-Capy: capys pop out of a honeycomb of holes, tap them before they duck back).
   Change the prompt text in `src/game/levels/stages.ts`, save, and watch it update live.
3. **Understand the flow.** The game boots in `src/main.ts` → `Game.ts` → the `Preloader`
   screen → `MainMenu` → `Play` → `Results`. Tap anywhere to advance between them.
4. **Read one screen top to bottom.** `MainMenuScreen.ts` is the best example — it draws a
   background, adds a spinning logo, shows text, and reacts to a tap and to resizing.
5. **Make a change.** Follow a recipe in the **[Cookbook](#cookbook-common-tasks)** — e.g.
   *"Show an image"* or *"React to a tap"*.

## How the game boots

```
index.html .................... paints the loading splash instantly (no JS required)
   └── src/main.ts ............. tiny bootstrap; `import('./game/Game')` loads the engine lazily
         └── Game.ts ........... composition root (ships as its own async chunk):
               ├── Application ... the Pixi renderer + ticker
               ├── AssetLoader ... loads and caches textures + web fonts
               ├── AudioManager .. synthesised sound, volume + mute (no files)
               ├── Responsive .... fits the canvas to the screen, world/ui layers
               └── ScreenManager . owns the active screen and transitions
                     └── Preloader → MainMenu → Play → Results
```

Everything long-lived is created once in `Game.ts`. Screens are created and destroyed as you
move between them.

## Load time & code splitting

`src/main.ts` deliberately keeps its only import of the engine **dynamic**:

```ts
const gameModule = import('./game/Game'); // a separate async chunk, not part of the entry
```

Because of that, the initial download is just a few KB (the bootstrap plus the HTML/CSS), so the
`#splash` element in `index.html` paints and animates immediately while the ~600 KB Pixi engine
streams in behind it. When the renderer has mounted, `Game.start()` calls its `onReady`
callback and the splash is removed — a seamless hand-off, since the splash background matches
`CLEAR_COLOR`.

`vite/config.prod.mjs` keeps the split efficient:

- **`pixi.js` is its own chunk**, separate from your game code, so repeat visitors only
  re-download the small game chunk when you change gameplay. (This is what `manualChunks` is
  actually good for — caching, not lazy-loading.)
- **Vite's preload helper is isolated** into its own tiny chunk. Without that, the entry would
  statically depend on the pixi chunk, and the browser would preload all ~600 KB *before* the
  splash could even paint.

The same trick works anywhere: wrap any `import(...)` and that module becomes its own chunk,
fetched on demand.

## Project structure

```
src/
├── main.ts                     Entry point — mounts the game on DOMContentLoaded
└── game/
    ├── Game.ts                 Composition root: creates the app + services, starts first screen
    ├── config.ts               Resolution, colors, screen keys, asset + audio settings, stages
    ├── core/                   Reusable engine plumbing (you rarely edit this)
    │   ├── screens/            Screen interface + ScreenManager (lifecycle/transitions)
    │   ├── input/              PointerInput + KeyboardInput — screen-scoped input
    │   ├── assets/             AssetLoader — texture + web-font registry with progress
    │   ├── audio/              AudioManager + synth — sound, with no files to ship
    │   ├── display/            Building blocks: Background, Button, SceneButton, Image, Label, ProgressBar, SoundToggle
    │   ├── responsive/         Responsive — viewport scaling, orientation, breakpoints
    │   ├── layout/             hexLayout — pure hole-placement math (honeycomb / grid)
    │   └── entities/           Entity + Component — composable per-frame behaviors
    ├── audio/                  sfx — every sound the game makes, by name (data only)
    ├── levels/                 What spawns: capy archetypes + the stage table (data only)
    ├── systems/                Pure rules: SessionClock, ScoreKeeper, ComboTracker, Spawner
    ├── components/             Gameplay components (Emerge, HitTarget, Spin, Pulse)
    ├── entities/               Display objects built from components: Hole, Capy, capyFace
    └── screens/                The actual game screens  ← most of your work happens here
        ├── index.ts            Registers every screen with the ScreenManager
        ├── PreloaderScreen.ts  Loads assets behind a progress bar
        ├── MainMenuScreen.ts   Title screen (entity + Spin component demo + sound toggle)
        ├── PlayScreen.ts       The game itself — runs one stage (Whack-a-Capy)
        ├── ResultsScreen.ts    Post-stage summary: stars, score, Replay / Next / Menu
        ├── CelebrationScreen.ts  The finale: a present to open
        └── LetterScreen.ts     The letter the present promised
```

Public files served as-is live in `public/` (e.g. `public/assets/bg.png`). The HTML shell is
`index.html` and the page CSS is `public/style.css`.

## Core concepts

The template uses **composition** rather than deep class hierarchies. There are only five
ideas you really need.

### 1. Screens

A screen is a plain object with a lifecycle. There's no base class to extend — just implement
the parts you need:

```ts
export interface Screen<P = void> {
    init(context: ScreenContext, params: P): Promise<void> | void; // build it (may await assets)
    update?(dt: number): void;                          // called every frame, dt in milliseconds
    onResize?(viewport: ViewportMetrics): void;         // viewport changed
    destroy?(): void;                                   // release subscriptions/resources
}
```

The `ScreenContext` passed to `init()` is your toolbox:

| Property      | What it is                                                            |
| ------------- | --------------------------------------------------------------------- |
| `world`       | Container for gameplay/backdrops (may extend past the design area)    |
| `ui`          | Container for HUD/menus, drawn above `world`                          |
| `assets`      | Load assets with progress: `await assets.load(ASSETS.logo)`, `await assets.loadFont(FONTS.display)` |
| `audio`       | Sound: `audio.play(SFX.tap)`, plus volume/mute (persisted) and `audio.load(...)` for files |
| `input`       | Pointer events scoped to this screen: `input.once(...)` / `input.on(...)` |
| `keyboard`    | Keyboard scoped to this screen: `keyboard.isDown('ArrowLeft')`, `keyboard.onKeyDown('Escape', cb)` |
| `screens`     | Navigate: `screens.start(SCREENS.Play, { stageId })`                   |
| `responsive`  | Viewport info + `toWorld(pointerEvent)`                               |
| `app`         | The raw Pixi `Application`, if you need the renderer/ticker directly  |

`ScreenManager` handles the transition details for you: it destroys the outgoing screen's
containers and listeners before building the next one, and only ticks the active screen.

### Passing data between screens

`screens.start()` accepts an optional `params` payload that is handed to the next screen's
factory and `init()`. Declare the payload type on the screen that receives it:

```ts
// The receiving screen declares what it expects (see ResultsScreen.ts):
export interface ResultsParams {
    stageId: string;
    score: number;
    stars: number;
}

export class ResultsScreen implements Screen<ResultsParams> {
    init({ ui }: ScreenContext, params: ResultsParams): void {
        const score = createLabel(`${params.score}`);
        // ...
    }
}
```

```ts
// The sending screen passes it at transition time (see PlayScreen.finish()):
void screens.start(SCREENS.Results, { stageId: 'stage-1', score: 240, stars: 2 });
```

Screens that don't need data simply use the default `Screen` (i.e. `Screen<void>`) and ignore
the param. Note that `params` is **per-transition** — it exists only while the screen is
active. For state that must outlive screens (settings, totals), create a small store in
`Game.ts` and reach it through the `ScreenContext` instead.

### 2. `world` vs `ui` (and `Responsive`)

Each screen draws into **two** containers:

- **`world`** — the game world. It shares the design coordinate space, but the *visible* area
  extends beyond the design bounds (the letterbox margins), so full-bleed backgrounds always
  cover the screen. Put sprites, parallax and gameplay here.
- **`ui`** — HUD, buttons, menus. Drawn on top of `world`. Keep interactive elements inside
  the design area so they never get cut off.

Both layers are scaled uniformly so the whole **768×1024 design area** is always visible and
undistorted on any screen. See **[Responsive layout](#responsive-layout)** for the details.

### 3. Entities & Components

An `Entity` is a display object (a `Container`) that hosts small behaviors called
`Component`s. Instead of subclassing, you mix behaviors onto an entity at runtime:

```ts
import { Entity } from '../core/entities/Entity';
import { createImage } from '../core/display/Image';
import { Spin } from '../components/Spin';

const logo = new Entity();
logo.addChild(createImage(assets.texture(ASSETS.logo)));
logo.position.set(SCREEN_CENTER.x, SCREEN_CENTER.y);
logo.addComponent(new Spin(logo, { speed: 45 })); // rotates the entity every frame

ui.addChild(logo);
```

The screen must tick entities from its own `update()`:

```ts
update(dt: number): void {
    for (const entity of this.entities) entity.update(dt);
}
```

A `Component` is any object with `update?(dt)` and/or `destroy?()` — see
`src/game/components/Spin.ts` for a ~30-line example to copy.

### 4. Config

`src/game/config.ts` is the single place for numbers and registries you'll tweak often:

- `GAME_WIDTH` / `GAME_HEIGHT` — the design resolution (portrait `768×1024` by default)
- `SCREEN_CENTER` — handy `{ x, y }` for centering UI
- `COLORS` — the palette
- `SCREENS` — string keys for every screen (used by `screens.start(...)`)
- `ASSETS` — the texture registry (alias → path)
- `FONTS` — the web-font registry (alias → file + family); `FONT_FAMILY` is the face labels use
- `AUDIO_SETTINGS` — master/effects levels, whether to start muted, and the `localStorage` key
- `BREAKPOINTS` — mobile/tablet/desktop thresholds
- `CELEBRATION` — the finale's words, and the optional `gift.png` it would rather use

### 5. Sound

There are no audio files in the project. Every sound is **synthesised** from two
primitives — a `tone()` and a `noise()` burst — so the game has sound to play
without downloading a byte of it. `AudioManager` owns one `AudioContext` and a
two-knob gain graph (`master` → `sfx`), and sounds are registered as *recipes*:
small functions that build their nodes on that context and start them.

Screens only ever talk in names, never recipes:

```ts
import { SFX } from '../audio/sfx';

audio.play(SFX.whack);                                  // as written
audio.play(SFX.combo, { rate: 1 + (tier - 2) * 0.18 }); // pitched by the tier
```

That indirection is the point: the bank in `src/game/audio/sfx.ts` can be
re-voiced, or replaced with real recordings, and no screen changes.

Two browser rules are handled for you:

- **Autoplay.** A context may only start from a user gesture, so it is created
  lazily and the first tap or keypress resumes it. Anything played before that
  is *dropped* rather than queued, so a page never erupts into a pile of stacked
  sounds the moment the player touches something.
- **The player's choice.** `setMuted` / `setVolume` persist to `localStorage`, so
  the setting survives a reload. `createSoundToggle(audio)` in
  `core/display/soundToggle.ts` is a ready-made button — the menu has one.

`play()` also warns and returns `false` for an unknown name, and `load()` warns
and resolves to `null` for a missing file. Sound is decoration; decoration is
never allowed to break the game.

## Cookbook (common tasks)

Copy-paste starting points. All snippets assume you're inside a screen's `init(context)`.

### Add a new screen

1. Add a key in `config.ts`:

   ```ts
   export const SCREENS = { /* ... */ Settings: 'Settings' } as const;
   ```

2. Create `src/game/screens/SettingsScreen.ts`:

   ```ts
   import type { Screen, ScreenContext } from '../core/screens/Screen';

   export class SettingsScreen implements Screen {
       init({ ui }: ScreenContext, _params: void): void {
           // build your UI here
       }
       destroy(): void {
           // clean up anything you subscribed to
       }
   }
   ```

   Need data from the previous screen (e.g. a level number)? Declare a params
   type and use `implements Screen<SettingsParams>` — see
   **[Passing data between screens](#passing-data-between-screens)**.

3. Register it in `src/game/screens/index.ts`:

   ```ts
   screens.register(SCREENS.Settings, () => new SettingsScreen());
   ```

4. Navigate to it from anywhere with `screens.start(SCREENS.Settings)` — optionally with a
   payload: `screens.start(SCREENS.Settings, { level: 3 })`.

### Show an image

```ts
import { createImage } from '../core/display/Image';

const sprite = createImage(assets.texture(ASSETS.logo), {
    x: SCREEN_CENTER.x,
    y: SCREEN_CENTER.y,   // anchor defaults to 0.5 (centered)
});
ui.addChild(sprite);
```

### Show text

```ts
import { createLabel } from '../core/display/Label';

const label = createLabel('Hello!', { fontSize: 48, fill: 0xffcc00 });
label.anchor.set(0.5);
label.position.set(SCREEN_CENTER.x, SCREEN_CENTER.y);
ui.addChild(label);
```

### Load an asset (with progress)

Add it to the registry, then load it. Results are cached, so calling `load` again is free.

```ts
// config.ts
export const ASSETS = { /* ... */ coin: { alias: 'coin', src: 'assets/coin.png' } };

// in a screen
const texture = await assets.load(ASSETS.coin, (progress) => bar.setProgress(progress));
// later, synchronous access:
const cached = assets.texture(ASSETS.coin);
```

Place the actual file in `public/assets/coin.png`.

### Add a web font

The template bundles **Titan One** (`public/assets/fonts/titan-one.woff2`, OFL-licensed) and
loads it in the preloader, so labels look identical on every device. To swap it or add a face:

1. Drop the `.woff2` into `public/assets/fonts/` (keep its license file alongside it).
2. Register it in `config.ts`, and point `FONT_FAMILY` at the family name:

   ```ts
   export const FONT_FAMILY = 'Bungee';
   export const FONTS = {
       display: { alias: 'font-display', src: 'assets/fonts/bungee.woff2', family: FONT_FAMILY },
   };
   ```

3. Load it **before creating any text**:

   ```ts
   await assets.loadFont(FONTS.display);
   ```

Text created before the face resolves silently falls back to a browser default, so always
`await assets.loadFont(...)` up front (the preloader already does). Prefer an OFL/free font so
you can ship it; Pixi registers the `FontFace` for you — no CSS `@font-face` needed.

### Play a sound

Sounds are named constants from `src/game/audio/sfx.ts`, so a typo is caught by
the type checker and everything the game can say is listed in one file:

```ts
import { SFX } from '../audio/sfx';

button.on('pointerdown', () => audio.play(SFX.tap));
```

`{ volume, rate }` shape that one play — `rate` is a pitch multiplier, which is
how the same recipe rises with the combo. Add a new sound by adding a recipe to
`SFX_RECIPES` in that same file:

```ts
[SFX.pop]: (ctx, out, o) => {
    tone(ctx, out, { wave: 'sine', freq: 800, freqTo: 400, ms: 90, gain: 0.3 * o.volume, rate: o.rate });
},
```

### Add a sound file

Prefer a recording over synthesis? Drop the file into `public/assets/audio/` and
load it: it registers under its alias, and `play(alias)` then treats it exactly
like a synthesised sound.

```ts
// one file
await audio.load({ alias: 'pop', src: 'assets/audio/pop.wav' });

// or a list, with progress like the asset loader
await audio.loadAll(
    [{ alias: 'pop', src: 'assets/audio/pop.wav' }],
    (progress) => bar.setProgress(progress),
);

audio.play('pop');
```

Loading happens *before* the first gesture is fine — the context simply starts
suspended and resumes on the first tap.

### React to a tap / click

```ts
this.stop = input.once((event) => {
    void screens.start(SCREENS.Play, { stageId: 'tutorial' }); // fires once, then unsubscribes
});

// or every click:
this.stop = input.on((event) => {
    const point = responsive.toWorld(event); // convert to world coordinates
    console.log('clicked at', point.x, point.y);
});
```

Remember to call `this.stop?.()` in the screen's `destroy()`.

### React to the keyboard

`context.keyboard` is scoped to the screen like `input`. Poll held keys from
`update()` for continuous control, or subscribe for one-shot presses:

```ts
// Continuous: poll while the key is held.
update(dt: number): void {
    if (keyboard.isDown('ArrowLeft')) sprite.x -= 0.5 * dt;
}

// One-shot: fire on each press.
this.stopKey = keyboard.onKeyDown('Escape', () => this.togglePause());
```

Unsubscribe in `destroy()` — keyboard listeners live on `window`, so the screen
manager cannot clean them up for you.

### Pause the game (ESC + overlay)

The pattern used by `PlayScreen`: a hidden overlay container in `ui`, ESC
toggles it, and `update()` returns early while paused so gameplay freezes:

```ts
init({ ui, keyboard }: ScreenContext): void {
    this.pauseOverlay = this.createPauseOverlay(); // dim + Resume/Exit buttons
    this.pauseOverlay.visible = false;
    ui.addChild(this.pauseOverlay);
    this.stopKey = keyboard.onKeyDown('Escape', () => this.togglePause());
}

update(dt: number): void {
    if (this.paused) return;   // freeze gameplay
    // ...normal per-frame work
}

togglePause(): void {
    this.paused = !this.paused;
    this.pauseOverlay.visible = this.paused;
}
```

Buttons in the overlay are plain containers with `eventMode = 'static'` and a
`pointerdown` handler — the shared `createButton()` helper in
`core/display/Button.ts` builds both for you. "Quit to Menu" simply
calls `screens.start(SCREENS.MainMenu)`.

### Animate something every frame

```ts
update(dt: number): void {
    // dt is milliseconds since the previous frame (≈16.7ms at 60fps)
    sprite.rotation += 0.001 * dt;   // ~1 radian per second
    sprite.x += 0.05 * dt;           // 50 pixels per second
}
```

Prefer `dt`-based math over "per frame" so speed is consistent across devices. For reusable
behavior, wrap it in a `Component` and attach it with `entity.addComponent(...)`.

### React to resizing / breakpoints

```ts
onResize(viewport: ViewportMetrics): void {
    if (viewport.breakpoint === 'mobile') {
        this.title.position.set(SCREEN_CENTER.x, SCREEN_CENTER.y - 100);
    }
}
```

See **[Responsive layout](#responsive-layout)** for everything `viewport` exposes.

## Responsive layout

The game is authored at a fixed **768×1024 (portrait)** design resolution
(`GAME_WIDTH` / `GAME_HEIGHT` in `config.ts`). On any screen, `Responsive` applies a single
uniform `containScale()` so the whole design area stays visible and undistorted — never
stretched, never cropped.

- **`context.world`** shares the design coordinate space, but the *visible* area extends past
  the design bounds (the letterbox margins). Size full-bleed artwork to
  `responsive.visibleBounds` and it always covers the screen — `createColorBackground` /
  `createTextureBackground` already do this.
- **`context.ui`** is drawn above the world. Keep interactive elements inside the 768×1024
  design area so they stay on screen.
- **`Screen.onResize(viewport)`** fires on every resize/orientation change.
- `viewport` exposes `scale`, `visible`, `visibleBounds`, `orientation` (`portrait` /
  `landscape`) and `breakpoint` (`mobile` / `tablet` / `desktop`, measured by the shortest
  side so rotation doesn't flip it). Watch breakpoint changes with
  `responsive.onBreakpointChange(cb)`.
- Use `responsive.toWorld(pointerEvent)` to convert a pointer position into world coordinates.

```ts
// in a screen
const { world, ui, responsive } = context;

world.addChild(createTextureBackground(texture, responsive)); // full-bleed backdrop
ui.addChild(menuButton);                                       // always on screen

onResize(viewport: ViewportMetrics) {
    // viewport.breakpoint === 'mobile' | 'tablet' | 'desktop'
}
```

Want a different orientation? Swap `GAME_WIDTH` / `GAME_HEIGHT` in `config.ts` (e.g. `1024×768`
for landscape) — everything else adapts automatically.

## Loading static files

To load static files such as images, audio or video, place them into `public/assets/`, then
reference them through the asset registry in `src/game/config.ts` and load them through
`context.assets`:

```ts
// config.ts
export const ASSETS = {
    background: { alias: 'background', src: 'assets/bg.png' },
    logo: { alias: 'logo', src: 'assets/logo.png' },
};

// in a screen
const texture = await context.assets.load(ASSETS.logo, (progress) => bar.setProgress(progress));
```

Web fonts work the same way through the `FONTS` registry — see **[Add a web font](#add-a-web-font)**.
Audio is the exception: it goes through `context.audio` instead, because a sound
is played rather than cached as an image — see **[Add a sound file](#add-a-sound-file)**.

## Debugging tips

- In **dev builds only**, the running game is exposed as `window.game`. From the browser
  console you can do things like `game.screens.active`, `game.responsive.viewport`, or even
  `game.screens.start('Game')`. This is stripped from production builds.
- `game.audio` is the sound manager: `game.audio.muted`, `game.audio.setVolume(0.3)`,
  `game.audio.play('whack')`. Nothing plays until the page has seen a click or a keypress —
  that is the browser's autoplay policy, not a bug.
- Hot reload is on: change a color or a coordinate, save, and see it instantly.
- If a screen looks empty, check that you `addChild`'d to `world` or `ui` (not to nowhere),
  and that anything you want to move every frame is ticked from `update(dt)`.

## Conventions

- **Keep gameplay in `src/game/screens/`.** `src/game/core/` is engine plumbing — treat it as
  stable and extend it only when it genuinely helps.
- **One screen per file**, named `SomethingScreen.ts`, registered in `screens/index.ts`.
- **New assets** always go through `config.ts` (`ASSETS`) — never hard-code paths in screens.
- **New sounds** go through the `SFX` constants in `src/game/audio/sfx.ts` — screens play
  names, never `tone()` / `noise()` directly.
- **Clean up after yourself** in `destroy()`: unsubscribe from `input`,
  `keyboard` and any `responsive.onResize(...)` listeners you created.
- **Scale by `dt`**, not by frame count.

## Resources

- [PixiJS Docs](https://pixijs.com/8.x/guides)
- [PixiJS Examples](https://pixijs.playground.pixijs.com)
- [Vite Docs](https://vitejs.dev/guide)

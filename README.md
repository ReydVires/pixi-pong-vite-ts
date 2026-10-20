# Whack-a-Capy

A **Whack-a-Mole**-style arcade game built with **[PixiJS 8](https://pixijs.com)**,
**[TypeScript 5.7](https://www.typescriptlang.org)** and **[Vite 6](https://vitejs.dev)**. Built on a reusable PixiJS template with a focus on composition, data-driven design, and snappy arcade feel. 

Tap capys as they pop out of a honeycomb of holes, build up your combo, and don't whack the bombs! Clear stages to earn stars, make your way to the finale, and open the birthday present.

## What you get out of the box

- 🎮 **Data-driven gameplay** — stages, capy archetypes and spawn logic live as pure data (`levels/`)
- 🧠 **Explicit game state** — `PlayScreen` uses a single `PlayMode` (`playing` | `paused` | `finished`) with controlled transitions via `enter()` for predictable state
- 🎯 **Centralised hit testing** — one pointer handler, honest accuracy accounting
- 💥 **Juice without noise** — combo milestones kick the field, show comic words, and pitch the ladder up, with no unnecessary particles
- 🔊 **Procedural audio** — synthesised SFX from `tone()`/`noise()` primitives, no audio files shipped
- 🎨 **Component-based entities** — `Entity` + `Component` composition rather than deep inheritance
- 🖥️ **Responsive + safe-area aware** — uniform scaling with notch/home-indicator handling via `viewport.safeArea`
- 🧩 **Modal overlays** — pause and end-of-stage results panels render over the frozen playfield (not new screens)

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
   screen → `MainMenu` → `Play`. Stages chain through `Play`; the last one opens the
   `Celebration`. Tap anywhere to advance between them.
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
                     └── Preloader → MainMenu → Play → Celebration
```

Everything long-lived is created once in `Game.ts`. Screens are created and destroyed as you
move between them.

## High-level architecture

The game follows a **composition + data-driven** design:

- **Screens** own the lifecycle and orchestration for a given UI/game state (Preloader, MainMenu, Play, Celebration, Letter)
- **Systems** contain pure game rules (timing, scoring, combos, spawning) with no Pixi dependencies — easy to reason about and test
- **Entities + Components** compose display objects with behaviours (`Hole`, `Capy`, `Emerge`, `HitTarget`, `Spin`, etc.)
- **Core plumbing** is reusable engine code (screens, input, assets, audio, display, responsive, layout)
- **Data** (`levels/`, `config.ts`, `audio/sfx.ts`) drives content; code drives behaviour

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
    │   ├── display/            Building blocks: Background, Button, SceneButton, Image, Label, Overlay, ProgressBar, SoundToggle
    │   ├── responsive/         Responsive — viewport scaling, orientation, breakpoints
    │   ├── layout/             hexLayout — pure hole-placement math (honeycomb / grid)
    │   └── entities/           Entity + Component — composable per-frame behaviors
    ├── audio/                  sfx — every sound the game makes, by name (data only)
    ├── levels/                 What spawns: capy archetypes + the stage table (data only)
    ├── systems/                Reusable logic: SessionClock, ScoreKeeper, ComboTracker, Spawner, TweenSystem
    ├── components/             Gameplay components (Emerge, HitTarget, Spin, Pulse)
    ├── entities/               Display objects built from components: Hole, Capy, capyFace
    └── screens/                The actual game screens  ← most of your work happens here
        ├── index.ts            Registers every screen with the ScreenManager
        ├── PreloaderScreen.ts  Loads assets behind a progress bar
        ├── MainMenuScreen.ts   Title screen (entity + Spin component demo + sound toggle)
        ├── PlayScreen.ts       The game itself — runs one stage (Whack-a-Capy)
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
// The receiving screen declares what it expects (see PlayScreen.ts):
export interface PlayParams {
    stageId: string;
}

export class PlayScreen implements Screen<PlayParams> {
    init({ ui }: ScreenContext, params: PlayParams): void {
        const stage = findStage(params.stageId);
        // ...
    }
}
```

```ts
// The sending screen passes it at transition time (see PlayScreen.finish()):
void screens.start(SCREENS.Play, { stageId: 'stage-2' });
```

Screens that don't need data simply use the default `Screen` (i.e. `Screen<void>`) and ignore
the param. Note that `params` is **per-transition** — it exists only while the screen is
active. For state that must outlive screens (settings, totals), create a small store in
`Game.ts` and reach it through the `ScreenContext` instead.

### Modals that aren't screens

Sometimes a screen needs to *interrupt* itself — pause mid-run, show results when a stage
ends — without tearing down and rebuilding everything on screen. A separate `Screen` can't do
that: transitioning destroys the outgoing screen and every object in it, and you'd lose the
frozen playfield you wanted to keep behind the panel.

Use `createOverlay()` (`core/display/overlay.ts`) instead. It's a display object, not a screen:
no lifecycle, no state — the caller decides when it's visible. It dims everything behind it and
swallows input, so the playfield can't take hits through it.

```ts
import { createOverlay } from '../core/display/overlay';

const overlay = createOverlay(responsive, {
    title: 'Stage 2 complete',
    figure: this.createStars(2),          // optional graphic (e.g. a star row)
    hero: '420',                          // optional large headline value
    lines: ['Accuracy 92%   ·   Best Combo 11'],
    actions: [
        { label: 'Next', onTap: () => screens.start(SCREENS.Play, { stageId: 'stage-3' }) },
        { label: 'Replay', onTap: () => screens.start(SCREENS.Play, { stageId: 'stage-2' }) },
        { label: 'Menu', onTap: () => screens.start(SCREENS.MainMenu) },
    ],
    onAction: () => audio.play(SFX.tap),
});
```

`PlayScreen` uses this for both the pause menu and the end-of-stage results panel. Mount
overlays in a container added *last* to `ui`, so a modal is never buried under HUD chrome.

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

The pattern used by `PlayScreen`: a hidden overlay built with `createOverlay()` in `ui`,
ESC toggles it, and `update()` returns early while paused so gameplay freezes:

```ts
import { createOverlay } from '../core/display/overlay';

init({ ui, keyboard, responsive }: ScreenContext): void {
    this.pauseOverlay = createOverlay(responsive, {
        title: 'Paused',
        actions: [
            { label: 'Resume', onTap: () => this.togglePause() },
            { label: 'Quit to Menu', onTap: () => screens.start(SCREENS.MainMenu) },
        ],
    });
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

`createOverlay()` (in `core/display/overlay.ts`) draws a full-bleed dim that spans the whole
visible area — not just the design rect, so letterbox margins are covered — and swallows taps
aimed at the playfield behind it. It lays out the title, an optional `figure` (a graphic such as
a row of stars), the detail `lines`, and the `actions` (buttons) in one flow, so they can't
collide. The first action is styled as the primary. Pass `onAction` to play a click sound.

See also **[Modals that aren't screens](#modals-that-arent-screens)** below.

### Tween a numeric value

PixiJS provides the ticker, but not a general-purpose tween API. The reusable
`TweenSystem` uses the screen's `dt` from that ticker to interpolate numeric
values with an easing function. Retargeting the same key replaces the active
tween; call `clear()` when the owning screen is destroyed.

```ts
import { Easing, TweenSystem } from '../systems/TweenSystem';

private readonly tweens = new TweenSystem();

showScore(next: number): void {
    this.tweens.to('score', this.displayedScore, next, {
        durationMs: 300,
        easing: Easing.easeOutCubic,
        onUpdate: (value) => {
            this.displayedScore = Math.round(value);
            this.scoreLabel.text = `${this.displayedScore}`;
        },
    });
}

update(dt: number): void {
    this.tweens.update(dt);
}

destroy(): void {
    this.tweens.clear();
}
```

Built-in easing functions are `linear`, `easeOutCubic`, and `easeOutBack`. A tween
can animate any number; `onUpdate` decides how that value affects a Pixi display
object, so the system itself stays independent of Pixi types.

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
- `viewport` exposes `scale`, `visible`, `visibleBounds`, `safeArea`, `orientation` (`portrait` /
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

### Notches and home indicators

The page opts into the full screen (`viewport-fit=cover` in `index.html`), so the canvas reaches
the physical screen edges on a notched phone instead of being inset by iOS. That means artwork
also runs *under* the notch, the Dynamic Island and the home indicator — which is what you want
for a background, and not what you want for a button.

`viewport.safeArea` is the design box minus those bands, expressed in **design units** (the CSS
insets are divided by the current `scale` for you). UI that sits near an edge should use it:

```ts
// Push a top-corner control clear of the notch. `safeArea` is clamped to the
// design box, so this can only move it down — never off the top.
control.position.set(GAME_WIDTH - 64, Math.max(64, responsive.safeArea.y + 64));
```

Two details worth knowing:

- The insets come from the `--safe-top/right/bottom/left` CSS variables in `public/style.css`,
  read on every resize — rotating a phone moves the notch to a different edge, and the values
  swap with it.
- The safe area is **intersected with the design box**, never expanded past it. A device whose
  inset is larger than the letterbox margin clamps rather than inverting the rectangle, so a
  control can't be pushed off screen by an aggressive inset.

Screens that don't opt in are unaffected: with no insets, `safeArea` is the whole design box and
`Math.max(64, …)` returns its original value.

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

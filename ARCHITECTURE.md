# Architecture

How this project fits together — for someone opening the codebase for the first time.

Stack: **PixiJS 8 + TypeScript + Vite**. No framework, no game library beyond Pixi's renderer.

## Boot flow

```
index.html                     Splash paints instantly (no JS)
└── src/main.ts                Tiny bootstrap; import('./game/Game') = async chunk
    └── src/game/Game.ts       Composition root — everything long-lived is created here
        ├── Application        Pixi renderer + ticker
        ├── AssetLoader        Texture + font registry with progress
        ├── AudioManager       Synthesised SFX (no audio files)
        ├── Responsive         Fits canvas to viewport, world/ui layers
        └── ScreenManager      Owns the active screen, transitions, route table
            └── Preloader → MainMenu → Play → Celebration → Letter
```

Services live as long as the app. Screens are built and destroyed on every transition.

## Screen flow

Routes are declared in `src/game/screens/index.ts` by merging into core's open
`ScreenRoutes` interface. The key → params table is what makes
`screens.start(SCREENS.Play, { stageId })` type-checked.

```
Preloader ──▶ MainMenu ──▶ Play (one stage) ──▶ ... ──▶ Celebration ──▶ Letter
```

- `Play` and `Letter` register **async factories** — they ship as separate chunks
  and download the first time the player needs them.
- Payloads travel through `start()`: a `void` route takes none, a typed route
  requires it. `params` lives only while the screen is active.

## Directory map

```
src/game/
├── Game.ts              Composition root: app + services + first screen
├── config.ts            Resolution, palette, screen keys, asset registry, celebration copy
├── core/                Reusable engine plumbing — rarely edit
│   ├── screens/         Screen interface, ScreenManager, TransitionOverlay
│   ├── input/           PointerInput, KeyboardInput (screen-scoped)
│   ├── assets/          AssetLoader
│   ├── audio/           AudioManager + tone/noise synth
│   ├── display/         Backgrounds, buttons, labels, overlays, progress bar, fades
│   ├── responsive/      Viewport scaling, breakpoints, safe area
│   ├── layout/          hexLayout — pure hole-placement math
│   └── entities/        Entity, OneShot, Component — composition base
├── audio/sfx.ts         Every sound by name (data only)
├── levels/              Stage table + capy archetypes (data only)
├── systems/             Reusable logic, see below
├── components/          Per-frame behaviors attached to entities
├── entities/            Display objects: Hole, Capy, Gift, Burst, Shockwave
├── ui/                  Composed panels: PlayHud, ResultsPanel, PausePanel, WishPanel, SweepWash
└── screens/             Orchestration + rules — most work happens here
```

## Layers and their rules

| Layer | Owns | Never does |
|---|---|---|
| `screens/` | Lifecycle, orchestration, the *rules* (when a stage ends, what a tap means, which screen is next) | Draw reusable widgets |
| `ui/` | Presentation. Spec in, callbacks out | Navigate, score, hold game state |
| `systems/` | Reusable rules (timing, scoring, combos, spawning) + runtime services (tweens, particles) | Know about screens |
| `entities/` + `components/` | Composable display + behavior | Decide what a tap means |
| `levels/`, `config.ts` | Content as pure data | Run logic |
| `core/` | Engine services every layer may use | Import gameplay modules (`screens/`, `entities/`, `systems/`, `ui/`, `levels/`) |

Direction of knowledge flows one way: screens may use everything. One shared
exception: `config.ts` sits at the game root and both layers read it (palette,
resolution, breakpoints) — it is settings, not gameplay.

## The five ideas

### 1. Screens are plain objects

No base class. Implement what you need of `Screen<P>`:

```ts
export interface Screen<P = void> {
    init(context: ScreenContext, params: P): Promise<void> | void;
    update?(dt: number): void;      // dt in ms
    onResize?(viewport: ViewportMetrics): void;
    destroy?(): void;
}
```

`ScreenContext` is the toolbox handed to `init()`: `world`, `ui`, `assets`,
`audio`, `input`, `keyboard`, `screens`, `responsive`, `app`.

`ScreenManager` destroys the outgoing screen before building the next, ticks
only the active screen, and awaits async factories — one loading overlay
covers the whole transition, appearing after a brief delay if either the
screen's chunk download or its `init()` (asset loads) is slow.

### 2. Entity + Component, not inheritance

`Entity extends Container` hosts `Component`s and ticks them. Behavior is
attached, not subclassed:

```ts
const capy = new Capy(type, hole);      // entity wires its own components in the constructor
capy.emerge.start();                    // the screen drives them through a domain API
capy.addComponent(new Flash(overlay));  // extra behaviors attach from outside
```

A component owns one behavior and its timer; the entity exposes a domain API
(`flash()`, `hopTo()`); the screen decides what it all means.

### 3. Modals are not screens

Pausing or showing results must not tear down the frozen playfield. Modals are
`ui/` panels mounted over it — `PausePanel`, `ResultsPanel` — driven by
callbacks. The screen keeps its state machine (`playing | paused | finished`,
stored as one `PlayMode` value).

### 4. Content is data

Add a stage: edit `levels/stages.ts`. Add a capy archetype: edit
`levels/capyTypes.ts`. Tune colors, words, celebration text: `config.ts`.
Gameplay code doesn't change.

### 5. Lazy chunks where it counts

`import(...)` = separate chunk. Used in `main.ts` (engine), `screens/index.ts`
(`PlayScreen`, `LetterScreen`), and the gift art. Keep the entry chunk small;
 Pixi itself is a separate cached chunk via `manualChunks`.

## Suggested reading order

1. `src/main.ts` → `src/game/Game.ts` — how it boots
2. `src/game/screens/index.ts` — the route map
3. `src/game/screens/MainMenuScreen.ts` — smallest complete screen
4. `src/game/screens/PlayScreen.ts` — the game itself (the big one; take your time)
5. `src/game/levels/stages.ts` + `capyTypes.ts` — content as data
6. `src/game/core/entities/Entity.ts` + one component (`Flash.ts`) — the composition pattern

For recipes ("show an image", "react to a tap") see the
[Cookbook in the README](README.md#cookbook-common-tasks).

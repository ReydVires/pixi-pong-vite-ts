# Architecture

How this project fits together — for someone opening the codebase for the first time.

Stack: **PixiJS 8 + TypeScript + Vite**. No framework, no game library beyond Pixi's renderer.

## Three concepts

Everything that runs each frame is one of three things. Learn these and the rest
is detail.

1. **Entity** — a Pixi `Container` that hosts components and ticks them. It never
   simulates on its own; a subclass only adds art and a domain API over its
   components (`Capy`, `Gift`).
2. **Component** — one behavior with an optional `update(dt)` and `dispose()`,
   attached with `entity.addComponent(...)`. Anything that changes over time is a
   component — a spin, a shake, or a pool of short-lived effects.
3. **Rule** — plain game logic and data with no display and no Pixi: scoring, the
   clock, spawning, combos, the tutorial. Lives in `rules/`.

Around these: **screens** orchestrate, **UI units** present, **core** is engine
plumbing, **levels/config** are content.

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
│   ├── ecs/             Entity, Component, OneShot — the composition base
│   ├── screens/         Screen interface, ScreenManager, TransitionOverlay
│   ├── input/           PointerInput, KeyboardInput (screen-scoped)
│   ├── assets/          AssetLoader
│   ├── audio/           AudioManager + tone/noise synth
│   ├── display/         Backgrounds, buttons, labels, overlays, progress bar, fades
│   ├── responsive/      Viewport scaling, breakpoints, safe area
│   ├── layout/          hexLayout — pure hole-placement math
│   └── tween.ts         Tweens + Easing — keyed numeric interpolation
├── audio/sfx.ts         Every sound by name (data only)
├── levels/              Stage table + capy archetypes (data only)
├── rules/               Game logic: ScoreKeeper, ComboTracker, SessionClock,
│                        Spawner, TutorialRunner, HitWords, HitTarget, plus the
│                        particles/fireworks math and progress persistence
├── components/          Per-frame behaviors attached to entities: the visual
│                        ones (Emerge, Spin, Shake, Fade, …) and the pools that
│                        own short-lived effects (EffectsPool, PopupsPool,
│                        FireworksPool)
├── entities/            Display objects: Hole, Capy, Gift, Burst, Shockwave
├── ui/                  Composed panels: PlayHud (+ ScoreView/TimerView/ComboView),
│                        ResultsPanel, PausePanel, WishPanel, SweepWash
└── screens/             Orchestration + rules — most work happens here
```

## Layers and their rules

| Layer | Owns | Never does |
|---|---|---|
| `screens/` | Lifecycle, orchestration, the *rules* (when a stage ends, what a tap means, which screen is next) | Draw reusable widgets |
| `ui/` | Presentation. Spec in, callbacks out | Navigate, score, hold game state |
| `components/` + `entities/` | Composable behavior + display | Decide what a tap means |
| `rules/` | Pure game logic and math | Touch Pixi |
| `levels/`, `config.ts` | Content as pure data | Run logic |
| `core/` | Engine services every layer may use | Import gameplay modules |

Direction of knowledge flows one way: screens may use everything. One shared
exception: `config.ts` sits at the game root and both layers read it (palette,
resolution, breakpoints) — it is settings, not gameplay.

## Screens are plain objects

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
only the active screen, and awaits async factories — one loading overlay covers
the whole transition, appearing after a brief delay if either the screen's chunk
download or its `init()` (asset loads) is slow.

## Entity + Component, not inheritance

An entity hosts components and ticks them; behavior is attached, not subclassed:

```ts
const field = new Entity();              // a plain handle for components
field.addComponent(new Shake(field));    // attach a behavior
field.update(dt);                        // tick them, from the screen

const capy = new Capy(type, hole);       // a prefab wires its own art + components
capy.flash();                            // the screen drives it through a domain API
```

A component owns one behavior and its timer; a screen decides what it all means.
The per-frame managers that own short-lived things — `EffectsPool`,
`PopupsPool`, `FireworksPool` — are components too: attach one to a layer entity
and ticking that entity drives the whole pool.

## Modals are not screens

Pausing or showing results must not tear down the frozen playfield. Modals are
`ui/` panels mounted over it — `PausePanel`, `ResultsPanel` — driven by
callbacks. The screen keeps its state machine (`playing | paused | finished`,
stored as one `PlayMode` value).

## Content is data

Add a stage: edit `levels/stages.ts`. Add a capy archetype: edit
`levels/capyTypes.ts`. Tune colors, words, celebration text: `config.ts`.
Gameplay code doesn't change.

## Lazy chunks where it counts

`import(...)` = separate chunk. Used in `main.ts` (engine), `screens/index.ts`
(`PlayScreen`, `LetterScreen`), and the gift art. Keep the entry chunk small;
Pixi itself is a separate cached chunk via `manualChunks`.

## Suggested reading order

1. `src/main.ts` → `src/game/Game.ts` — how it boots
2. `src/game/screens/index.ts` — the route map
3. `src/game/screens/MainMenuScreen.ts` — smallest complete screen
4. `src/game/screens/PlayScreen.ts` — the game itself (the big one; take your time)
5. `src/game/levels/stages.ts` + `capyTypes.ts` — content as data
6. `src/game/core/ecs/Entity.ts` + one component (`Flash.ts`) — the composition pattern

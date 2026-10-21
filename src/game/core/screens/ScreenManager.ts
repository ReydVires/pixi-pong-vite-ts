import { Container, Graphics, Ticker } from 'pixi.js';
import type { Application } from 'pixi.js';
import type { AssetLoader } from '../assets/AssetLoader';
import type { AudioManager } from '../audio/AudioManager';
import { COLORS, SCREEN_CENTER } from '../../config';
import { createColorBackground } from '../display/background';
import { createLabel } from '../display/label';
import { KeyboardInput } from '../input/KeyboardInput';
import { PointerInput } from '../input/PointerInput';
import type { Responsive, ViewportMetrics } from '../responsive/Responsive';
import type { Unsubscribe } from '../responsive/layout';
import type { Nullable } from '../types';
import type { Screen, ScreenContext, ScreenFactory, ScreenRoutes, StartArgs } from './screen';

const TRANSITION_LOADER_DELAY_MS = 160;

/**
 * Owns the lifecycle of screens: registration, transitions, teardown
 * and per-frame updates of whichever screen is active.
 *
 * Every screen gets a `world` and a `ui` container mounted into the matching
 * responsive layer, so content automatically follows the viewport transform.
 *
 * Keys and payloads are checked against the game's route map (`ScreenRoutes`,
 * declared by augmentation in `screens/index.ts`): `register()` only accepts
 * declared keys, and `start()` only accepts the params its screen declares.
 *
 * Transition guarantees:
 * - the outgoing screen's `destroy()` runs before the incoming `init()`,
 * - its containers (and therefore all of its display objects) are destroyed,
 * - its listeners are gone (they live on the containers),
 * - `update()` only ever reaches the active screen.
 */
export class ScreenManager {
    private readonly factories = new Map<string, ScreenFactory<never>>();
    private readonly stopResize: Unsubscribe;
    private current: Nullable<Screen<never>> = null;
    private currentWorld: Nullable<Container> = null;
    private currentUi: Nullable<Container> = null;
    private currentInput: Nullable<PointerInput> = null;
    private currentKeyboard: Nullable<KeyboardInput> = null;
    private currentName: Nullable<keyof ScreenRoutes & string> = null;
    private transitionId = 0;
    private transitionLoader: Nullable<Container> = null;
    private transitionSpinner: Nullable<Container> = null;

    constructor(
        private readonly app: Application,
        private readonly assets: AssetLoader,
        private readonly audio: AudioManager,
        private readonly responsive: Responsive,
    ) {
        // Forward viewport changes to whichever screen is active.
        this.stopResize = this.responsive.onResize(this.handleResize);
    }

    /**
     * Register a screen factory under a key. Returns `this` for chaining.
     * The key and the factory's params come from the route map (`ScreenRoutes`),
     * as do `start()`'s — so a typo'd key or a mismatched payload won't compile.
     * The factory receives the `params` passed to `start()` at transition time.
     */
    register<K extends keyof ScreenRoutes & string>(name: K, factory: ScreenFactory<ScreenRoutes[K]>): this {
        // The map is heterogeneous: it erases to `never` inside, and the route
        // map puts the types back on both edges (register and start).
        this.factories.set(name, factory as ScreenFactory<never>);
        return this;
    }

    /** Key of the currently active screen, if any. */
    get active(): Nullable<keyof ScreenRoutes & string> {
        return this.currentName;
    }

    /**
     * Resolve the next screen, tear down the current one, then `init()` the next.
     * `params` is handed to the new screen's factory and `init()` — use it to
     * carry data across the transition (e.g. the final score). The route map
     * decides whether it is required: a `void` route takes none, a route with a
     * payload type won't compile without one.
     * If a newer transition starts while its factory is awaiting, the older
     * request is abandoned and never activated.
     */
    async start<K extends keyof ScreenRoutes & string>(name: K, ...args: StartArgs<ScreenRoutes[K]>): Promise<void> {
        const params = args[0] as ScreenRoutes[K] | undefined;
        const factory = this.factories.get(name);
        if (!factory) {
            throw new Error(`Unknown screen "${name}". Did you register it in registerScreens()?`);
        }

        const transitionId = ++this.transitionId;
        const result = (factory as ScreenFactory<ScreenRoutes[K] | undefined>)(params);
        let screen: Awaited<typeof result>;
        let loadingDelay: Nullable<number> = null;

        if (result instanceof Promise) {
            this.app.ticker.remove(this.tick);
            loadingDelay = window.setTimeout(() => {
                if (this.transitionId === transitionId) this.showTransitionLoader(name);
            }, TRANSITION_LOADER_DELAY_MS);

            try {
                screen = await result;
            } catch (error) {
                window.clearTimeout(loadingDelay);
                if (this.transitionId === transitionId) {
                    this.hideTransitionLoader();
                    if (this.current) this.app.ticker.add(this.tick);
                }
                throw error;
            }
        } else {
            screen = result;
        }

        if (transitionId !== this.transitionId) {
            if (loadingDelay !== null) window.clearTimeout(loadingDelay);
            return;
        }

        if (loadingDelay === null) this.hideTransitionLoader();
        this.disposeCurrent();

        const world = new Container();
        world.label = `${name}:world`;
        this.responsive.world.addChild(world);

        const ui = new Container();
        ui.label = `${name}:ui`;
        this.responsive.ui.addChild(ui);

        const input = new PointerInput(world, this.responsive);
        const keyboard = new KeyboardInput();

        this.current = screen as Screen<never>;
        this.currentWorld = world;
        this.currentUi = ui;
        this.currentInput = input;
        this.currentKeyboard = keyboard;
        this.currentName = name;

        const context: ScreenContext = {
            app: this.app,
            world,
            ui,
            screens: this,
            assets: this.assets,
            audio: this.audio,
            input,
            keyboard,
            responsive: this.responsive,
        };

        // Attach the ticker *before* init so async screens can animate
        // (progress bars, spinners) while they are still loading.
        this.app.ticker.add(this.tick);

        try {
            await screen.init(context, params as never);
        } catch (error) {
            if (loadingDelay !== null) window.clearTimeout(loadingDelay);
            if (this.current === screen) this.disposeCurrent();
            if (transitionId === this.transitionId) this.hideTransitionLoader();
            throw error;
        }

        if (loadingDelay !== null) window.clearTimeout(loadingDelay);
        if (transitionId === this.transitionId) this.hideTransitionLoader();
    }

    /** Tear down the active screen and stop forwarding resize events. Safe to call twice. */
    dispose(): void {
        this.transitionId += 1;
        this.hideTransitionLoader();
        this.stopResize();
        this.disposeCurrent();
    }

    private showTransitionLoader(_name: string): void {
        if (this.transitionLoader) return;

        const overlay = new Container();
        overlay.label = 'transition-loader';

        const dim = createColorBackground(COLORS.black, this.responsive, 0.72);
        dim.eventMode = 'static';
        overlay.addChild(dim);

        const spinner = new Container();
        spinner.position.set(SCREEN_CENTER.x, SCREEN_CENTER.y - 20);
        const track = new Graphics().circle(0, 0, 24).stroke({ width: 5, color: 0x3a3f4b });
        const arc = new Graphics()
            .moveTo(0, -24)
            .arc(0, 0, 24, -Math.PI / 2, Math.PI * 0.8)
            .stroke({ width: 5, color: COLORS.accent, cap: 'round' });
        spinner.addChild(track, arc);
        overlay.addChild(spinner);

        const label = createLabel(`Please wait...`, {
            fontSize: 28,
            fill: COLORS.white,
        });
        label.anchor.set(0.5);
        label.position.set(SCREEN_CENTER.x, SCREEN_CENTER.y + 32);
        overlay.addChild(label);

        this.transitionLoader = overlay;
        this.transitionSpinner = spinner;
        this.responsive.ui.addChild(overlay);
        this.app.ticker.add(this.updateTransitionLoader);
    }

    private hideTransitionLoader(): void {
        this.app.ticker.remove(this.updateTransitionLoader);
        this.transitionLoader?.removeFromParent();
        this.transitionLoader?.destroy({ children: true });
        this.transitionLoader = null;
        this.transitionSpinner = null;
    }

    private readonly tick = (ticker: Ticker): void => {
        this.current?.update?.(ticker.deltaMS);
    };

    private readonly handleResize = (viewport: ViewportMetrics): void => {
        this.current?.onResize?.(viewport);
    };

    private readonly updateTransitionLoader = (ticker: Ticker): void => {
        if (this.transitionSpinner) this.transitionSpinner.rotation += ticker.deltaMS * 0.006;
    };

    private disposeCurrent(): void {
        this.app.ticker.remove(this.tick);

        const screen = this.current;
        const world = this.currentWorld;
        const ui = this.currentUi;
        const input = this.currentInput;
        const keyboard = this.currentKeyboard;
        this.current = null;
        this.currentWorld = null;
        this.currentUi = null;
        this.currentInput = null;
        this.currentKeyboard = null;
        this.currentName = null;

        try {
            screen?.destroy?.();
        } finally {
            keyboard?.destroy();
            input?.destroy();
            world?.destroy({ children: true });
            ui?.destroy({ children: true });
        }
    }
}

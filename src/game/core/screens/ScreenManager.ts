import { Container, Ticker } from 'pixi.js';
import type { Application } from 'pixi.js';
import type { AssetLoader } from '../assets/AssetLoader';
import { KeyboardInput } from '../input/KeyboardInput';
import { PointerInput } from '../input/PointerInput';
import type { Responsive, ViewportMetrics } from '../responsive/Responsive';
import type { Unsubscribe } from '../responsive/layout';
import type { Screen, ScreenContext, ScreenFactory } from './screen';

/**
 * Owns the lifecycle of screens: registration, transitions, teardown
 * and per-frame updates of whichever screen is currently active.
 *
 * Every screen gets a `world` and a `ui` container mounted into the matching
 * responsive layer, so content automatically follows the viewport transform.
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
    private current: Screen<never> | null = null;
    private currentWorld: Container | null = null;
    private currentUi: Container | null = null;
    private currentInput: PointerInput | null = null;
    private currentKeyboard: KeyboardInput | null = null;
    private currentName: string | null = null;

    constructor(
        private readonly app: Application,
        private readonly assets: AssetLoader,
        private readonly responsive: Responsive,
    ) {
        // Forward viewport changes to whichever screen is active.
        this.stopResize = this.responsive.onResize(this.handleResize);
    }

    /**
     * Register a screen factory under a key. Returns `this` for chaining.
     * The factory receives the `params` passed to `start()` at transition time.
     */
    register<P>(name: string, factory: ScreenFactory<P>): this {
        this.factories.set(name, factory as ScreenFactory<never>);
        return this;
    }

    /** Key of the currently active screen, if any. */
    get active(): string | null {
        return this.currentName;
    }

    /**
     * Transition to a screen: tear down the current one, then `init()` the next.
     * `params` is handed to the new screen's factory and `init()` — use it to
     * carry data across the transition (e.g. the final score).
     * If a newer transition starts while `init()` is still awaiting, the older
     * screen is abandoned and never activated.
     */
    async start<P>(name: string, params?: P): Promise<void> {
        const factory = this.factories.get(name);
        if (!factory) {
            throw new Error(`Unknown screen "${name}". Did you register it in registerScreens()?`);
        }

        this.disposeCurrent();

        const world = new Container();
        world.label = `${name}:world`;
        this.responsive.world.addChild(world);

        const ui = new Container();
        ui.label = `${name}:ui`;
        this.responsive.ui.addChild(ui);

        const input = new PointerInput(world, this.responsive);
        const keyboard = new KeyboardInput();

        const screen = (factory as ScreenFactory<P | undefined>)(params) as Screen<never>;
        this.current = screen;
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
            if (this.current === screen) this.disposeCurrent();
            throw error;
        }
    }

    /** Tear down the active screen and stop forwarding resize events. Safe to call twice. */
    dispose(): void {
        this.stopResize();
        this.disposeCurrent();
    }

    private readonly tick = (ticker: Ticker): void => {
        this.current?.update?.(ticker.deltaMS);
    };

    private readonly handleResize = (viewport: ViewportMetrics): void => {
        this.current?.onResize?.(viewport);
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

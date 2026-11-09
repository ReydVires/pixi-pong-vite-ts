import { Container, Ticker } from 'pixi.js';
import type { Application } from 'pixi.js';
import type { AssetLoader } from '../assets/AssetLoader';
import type { AudioManager } from '../audio/AudioManager';
import { KeyboardInput } from '../input/KeyboardInput';
import { PointerInput } from '../input/PointerInput';
import type { Responsive, ViewportMetrics } from '../responsive/Responsive';
import type { Unsubscribe } from '../responsive/layout';
import type { Nullable } from '../types';
import type { Screen, ScreenContext, ScreenFactory, ScreenRoutes, StartArgs } from './screen';
import { TransitionOverlay } from './TransitionOverlay';

export class ScreenManager {
    private readonly factories = new Map<string, ScreenFactory<never>>();
    private readonly stopResize: Unsubscribe;
    private readonly overlay = new TransitionOverlay();
    private current: Nullable<Screen<never>> = null;
    private currentWorld: Nullable<Container> = null;
    private currentUi: Nullable<Container> = null;
    private currentInput: Nullable<PointerInput> = null;
    private currentKeyboard: Nullable<KeyboardInput> = null;
    private currentName: Nullable<keyof ScreenRoutes & string> = null;
    private transitionId = 0;

    constructor(
        private readonly app: Application,
        private readonly assets: AssetLoader,
        private readonly audio: AudioManager,
        private readonly responsive: Responsive,
    ) {
        this.stopResize = this.responsive.onResize(this.handleResize);
    }

    register<K extends keyof ScreenRoutes & string>(name: K, factory: ScreenFactory<ScreenRoutes[K]>): this {
        this.factories.set(name, factory as ScreenFactory<never>);
        return this;
    }

    get active(): Nullable<keyof ScreenRoutes & string> {
        return this.currentName;
    }

    async start<K extends keyof ScreenRoutes & string>(name: K, ...args: StartArgs<ScreenRoutes[K]>): Promise<void> {
        const params = args[0] as ScreenRoutes[K] | undefined;
        const factory = this.getFactory(name);

        const id = ++this.transitionId;
        const isStale = () => this.transitionId !== id;

        // One loader covers the whole transition: a slow chunk download *and*
        // a slow `init()` (asset loads). The overlay only becomes visible
        // after its delay, so quick transitions never flash it.
        this.app.ticker.remove(this.tick);
        this.overlay.arm(this.app, this.responsive, isStale);

        const result = (factory as ScreenFactory<ScreenRoutes[K] | undefined>)(params);
        let screen: Screen<never>;

        try {
            screen = (await (result instanceof Promise ? result : Promise.resolve(result))) as Screen<never>;
        } catch (error) {
            this.overlay.cancel();
            if (!isStale() && this.current) this.app.ticker.add(this.tick);
            throw error;
        }

        if (isStale()) {
            this.overlay.cancel();
            return;
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
            audio: this.audio,
            input,
            keyboard,
            responsive: this.responsive,
        };

        this.app.ticker.add(this.tick);

        try {
            await screen.init(context, params as never);
        } catch (error) {
            if (this.current === screen) this.disposeCurrent();
            if (!isStale()) this.overlay.hide(this.app);
            throw error;
        }

        if (!isStale()) this.overlay.hide(this.app);
    }

    dispose(): void {
        this.transitionId += 1;
        this.overlay.hide(this.app);
        this.stopResize();
        this.disposeCurrent();
    }

    private getFactory(name: string): ScreenFactory<never> {
        const factory = this.factories.get(name);
        if (!factory) throw new Error(`Unknown screen "${name}". Did you register it in registerScreens()?`);
        return factory;
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
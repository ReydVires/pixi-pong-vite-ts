import { Container, EventEmitter } from 'pixi.js';
import type { Application, FederatedPointerEvent, Point } from 'pixi.js';
import { BREAKPOINTS, GAME_HEIGHT, GAME_WIDTH } from '../../config';
import type { Nullable } from '../types';
import { centeredRect, classifyBreakpoint, containScale, orientationOf, readInsets, safeAreaRect, visibleSize } from './layout';
import type { Breakpoint, Orientation, Rect, Size, Unsubscribe } from './layout';

/** A snapshot of how the viewport maps onto the design resolution. */
export interface ViewportMetrics {
    /** Viewport width in CSS pixels. */
    readonly width: number;
    /** Viewport height in CSS pixels. */
    readonly height: number;
    /** Uniform scale applied to the world and ui layers. */
    readonly scale: number;
    /** Viewport size expressed in design/world units. */
    readonly visible: Size;
    /** `visible` as a rectangle centered on the design area, in world coordinates. */
    readonly visibleBounds: Rect;
    /** The design box minus the hardware's insets, in world coordinates. */
    readonly safeArea: Rect;
    /** Detected viewport orientation. */
    readonly orientation: Orientation;
    /** Detected device class (based on the shortest viewport side). */
    readonly breakpoint: Breakpoint;
}

export interface ResponsiveEvents {
    resize: [viewport: ViewportMetrics];
    breakpoint: [breakpoint: Breakpoint, viewport: ViewportMetrics];
}

/**
 * Keeps the game letterboxed and centered as the viewport changes.
 *
 * - `world`: gameplay/backdrop content. Shares the design coordinate space, but
 *   the *visible* area extends past the design bounds, so full-bleed artwork can
 *   fill the letterbox margins (see `visibleBounds`).
 * - `ui`: HUD/buttons drawn on top, always kept inside the design area.
 *
 * Both layers use the same uniform `containScale()`, which guarantees the whole
 * design area stays visible and undistorted on any screen.
 */
export class Responsive extends EventEmitter<ResponsiveEvents> {
    /** Gameplay/backdrop layer. */
    readonly world = new Container();

    /** HUD/menu layer, drawn above the world. */
    readonly ui = new Container();

    private parent: Nullable<HTMLElement> = null;
    private metrics: Nullable<ViewportMetrics> = null;
    private lastBreakpoint: Nullable<Breakpoint> = null;
    private attached = false;

    constructor(private readonly app: Application) {
        super();
        this.world.label = 'world';
        this.ui.label = 'ui';
    }

    /** Latest viewport metrics. Throws before `attach()` has run. */
    get viewport(): ViewportMetrics {
        if (!this.metrics) {
            throw new Error('Responsive.attach() must be called before reading the viewport.');
        }
        return this.metrics;
    }

    get scale(): number {
        return this.viewport.scale;
    }

    get visible(): Size {
        return this.viewport.visible;
    }

    get visibleBounds(): Rect {
        return this.viewport.visibleBounds;
    }

    /** The design box minus any hardware obstruction — where UI should sit. */
    get safeArea(): Rect {
        return this.viewport.safeArea;
    }

    get orientation(): Orientation {
        return this.viewport.orientation;
    }

    get breakpoint(): Breakpoint {
        return this.viewport.breakpoint;
    }

    /** Run `handler` on every resize. */
    onResize(handler: (viewport: ViewportMetrics) => void): Unsubscribe {
        this.on('resize', handler);
        return () => {
            this.off('resize', handler);
        };
    }

    /** Run `handler` only when the device class changes. */
    onBreakpointChange(handler: (breakpoint: Breakpoint, viewport: ViewportMetrics) => void): Unsubscribe {
        this.on('breakpoint', handler);
        return () => {
            this.off('breakpoint', handler);
        };
    }

    /**
     * Mount the layers into the stage and start tracking the parent element.
     * Call once, after the renderer has initialized.
     */
    attach(parent: HTMLElement): void {
        if (this.attached) return;
        this.attached = true;
        this.parent = parent;

        this.app.stage.addChild(this.world, this.ui);

        window.addEventListener('resize', this.handleWindowResize);
        window.addEventListener('orientationchange', this.handleWindowResize);
        window.visualViewport?.addEventListener('resize', this.handleWindowResize);
        this.app.renderer.on('resize', this.handleRendererResize);

        this.handleWindowResize();
        this.recompute();
    }

    /** Stop tracking the viewport. Safe to call more than once. */
    detach(): void {
        if (!this.attached) return;
        this.attached = false;

        window.removeEventListener('resize', this.handleWindowResize);
        window.removeEventListener('orientationchange', this.handleWindowResize);
        window.visualViewport?.removeEventListener('resize', this.handleWindowResize);
        this.app.renderer.off('resize', this.handleRendererResize);
    }

    /** Convert a pointer event's global (screen) position into world coordinates. */
    toWorld(event: FederatedPointerEvent): Point {
        return this.world.toLocal(event.global);
    }

    /** Stop listening and release the layers. */
    destroy(): void {
        this.detach();
        this.removeAllListeners();
        this.world.destroy({ children: true });
        this.ui.destroy({ children: true });
    }

    private readonly handleWindowResize = (): void => {
        const width = this.parent?.clientWidth || window.innerWidth;
        const height = this.parent?.clientHeight || window.innerHeight;
        if (!width || !height) return;

        // Emits renderer "resize", which drives recompute() below.
        // Pass the DPR so moving between monitors/zoom levels stays crisp.
        this.app.renderer.resize(width, height, window.devicePixelRatio);
    };

    private readonly handleRendererResize = (): void => {
        this.recompute();
    };

    /** Recompute metrics and re-apply the layer transform. */
    private recompute(): void {
        const { width, height } = this.app.renderer.screen;

        const scale = containScale(width, height, GAME_WIDTH, GAME_HEIGHT);
        const visible = visibleSize(scale, width, height);
        const visibleBounds = centeredRect(visible, GAME_WIDTH / 2, GAME_HEIGHT / 2);

        // Re-read every pass, not once at attach: rotating a phone moves the
        // notch to a different edge, and the insets swap with it.
        const insets = readInsets(this.parent);
        const safeArea = safeAreaRect(insets, scale, GAME_WIDTH, GAME_HEIGHT);

        // Map the design center onto the viewport center.
        const offsetX = width / 2 - (GAME_WIDTH / 2) * scale;
        const offsetY = height / 2 - (GAME_HEIGHT / 2) * scale;
        for (const layer of [this.world, this.ui]) {
            layer.scale.set(scale);
            layer.position.set(offsetX, offsetY);
        }

        const orientation = orientationOf(width, height);
        const breakpoint = classifyBreakpoint(width, height, BREAKPOINTS);

        this.metrics = { width, height, scale, visible, visibleBounds, safeArea, orientation, breakpoint };

        this.emit('resize', this.metrics);
        if (breakpoint !== this.lastBreakpoint) {
            this.lastBreakpoint = breakpoint;
            this.emit('breakpoint', breakpoint, this.metrics);
        }
    }
}

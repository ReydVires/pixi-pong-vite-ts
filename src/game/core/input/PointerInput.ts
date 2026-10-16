import { Rectangle } from 'pixi.js';
import type { Container, FederatedPointerEvent } from 'pixi.js';
import type { Responsive } from '../responsive/Responsive';
import type { Unsubscribe } from '../responsive/layout';

export type { Unsubscribe };

/**
 * Pointer events scoped to a single screen container.
 *
 * The container gets a hit area covering the whole visible world area, so a
 * click anywhere counts. The hit area is refreshed on resize, and every
 * listener dies together with the container on screen teardown (`destroy()`).
 */
export class PointerInput {
    private readonly stopResize: Unsubscribe;

    constructor(
        private readonly root: Container,
        responsive: Responsive,
    ) {
        this.root.eventMode = 'static';
        this.applyHitArea(responsive.viewport.visibleBounds);
        this.stopResize = responsive.onResize((viewport) => this.applyHitArea(viewport.visibleBounds));
    }

    /** Listen for the next click/tap anywhere. Returns an unsubscribe function. */
    once(handler: (event: FederatedPointerEvent) => void): Unsubscribe {
        this.root.once('pointerdown', handler);
        return () => this.root.off('pointerdown', handler);
    }

    /** Listen for every click/tap. Returns an unsubscribe function. */
    on(handler: (event: FederatedPointerEvent) => void): Unsubscribe {
        this.root.on('pointerdown', handler);
        return () => this.root.off('pointerdown', handler);
    }

    /** Stop tracking the viewport. Safe to call more than once. */
    destroy(): void {
        this.stopResize();
    }

    private applyHitArea(bounds: { x: number; y: number; width: number; height: number }): void {
        this.root.hitArea = new Rectangle(bounds.x, bounds.y, bounds.width, bounds.height);
    }
}

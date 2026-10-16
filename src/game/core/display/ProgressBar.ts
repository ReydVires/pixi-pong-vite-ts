import { Container, Graphics, Sprite, Texture } from 'pixi.js';
import { COLORS } from '../../config';

export interface ProgressBarOptions {
    /** Total width in px. @default 468 */
    width?: number;
    /** Total height in px. @default 32 */
    height?: number;
    /** Fill height in px. @default 28 */
    fillHeight?: number;
    /** Time the fill needs to catch up with the target, in ms. @default 200 */
    smoothingMs?: number;
}

/**
 * A loading bar composed of an outline and a stretching fill sprite.
 *
 * `setProgress()` only sets the target — call `update(dt)` every frame to
 * animate toward it, and `settle()` to await the visual catch-up.
 */
export class ProgressBar {
    /** Center-anchored container; position it where the bar should be centered. */
    readonly view = new Container();

    private readonly fill: Sprite;
    private readonly trackWidth: number;
    private readonly smoothingMs: number;
    private target = 0;
    private value = 0;
    private settleResolve: (() => void) | null = null;
    private destroyed = false;

    constructor(options: ProgressBarOptions = {}) {
        const { width = 468, height = 32, fillHeight = 28, smoothingMs = 200 } = options;

        this.trackWidth = width - 4;
        this.smoothingMs = smoothingMs;

        const outline = new Graphics()
            .rect(0.5, 0.5, width - 1, height - 1)
            .stroke({ width: 1, color: COLORS.white });
        outline.position.set(-width / 2, -height / 2);

        this.fill = new Sprite({ texture: Texture.WHITE });
        this.fill.anchor.set(0, 0.5);
        this.fill.position.set(-width / 2 + 2, 0);
        this.fill.width = 4;
        this.fill.height = fillHeight;

        this.view.addChild(outline, this.fill);
    }

    /** Set the 0..1 target; the bar animates toward it over the next frames. */
    setProgress(progress: number): void {
        this.target = Math.min(1, Math.max(0, progress));
    }

    /** Resolves once the bar visually matches the last `setProgress()` value. */
    settle(): Promise<void> {
        if (this.destroyed || this.value >= this.target) return Promise.resolve();

        return new Promise((resolve) => {
            this.settleResolve = resolve;
        });
    }

    /** Animate the fill toward the target. Screens call this from their `update()`. */
    update(dt: number): void {
        if (this.value < this.target) {
            this.value = Math.min(this.target, this.value + dt / this.smoothingMs);
            this.fill.width = 4 + (this.trackWidth - 4) * this.value;
        }

        if (this.value >= this.target) this.resolveSettle();
    }

    /** Releases the view and any pending `settle()` promise. */
    destroy(): void {
        if (this.destroyed) return;
        this.destroyed = true;

        this.resolveSettle();
        this.view.removeFromParent();
        this.view.destroy({ children: true });
    }

    private resolveSettle(): void {
        if (!this.settleResolve) return;

        const resolve = this.settleResolve;
        this.settleResolve = null;
        resolve();
    }
}

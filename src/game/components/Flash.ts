import type { Graphics } from 'pixi.js';
import type { Component } from '../core/entities/component';

/** How long a hit flash stays visible, in ms. */
const FLASH_MS = 140;

/**
 * A brief white overlay so a tap feels answered even before points land.
 *
 * Composes onto any entity that draws a hit flash: the screen triggers it with
 * `flash()` and the component owns the countdown, the fade and the reset — the
 * host doesn't need an `update()` override of its own.
 *
 * ```ts
 * const flash = entity.addComponent(new Flash(overlayGraphics));
 * flash.flash(); // on a hit
 * ```
 */
export class Flash implements Component {
    private left = 0;

    constructor(private readonly overlay: Graphics) {}

    /** Start (or restart) the flash. */
    flash(): void {
        this.left = FLASH_MS;
    }

    update(dt: number): void {
        if (this.left <= 0) return;

        this.left = Math.max(0, this.left - dt);
        this.overlay.alpha = this.left / FLASH_MS;
    }
}

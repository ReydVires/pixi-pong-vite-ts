import type { Container } from 'pixi.js';
import type { OneShot } from '../core/entities/OneShot';
import { Burst } from '../entities/Burst';
import { Shockwave } from '../entities/Shockwave';
import type { ShockwaveOptions } from '../entities/Shockwave';
import type { BurstOptions } from './particles';

/**
 * Owns short-lived visual effects mounted into a Pixi container.
 *
 * Screens decide when and where effects happen; this system handles their
 * shared lifecycle: construction, ticking, and unmounting once `finished`.
 * Every effect is a `OneShot`, so the two kinds need no separate lists.
 */
export class EffectsSystem {
    private readonly live: OneShot[] = [];

    constructor(private readonly layer: Container) {}

    addBurst(color: number, options: BurstOptions): void {
        this.add(new Burst(color, options));
    }

    addShockwave(options: ShockwaveOptions): void {
        this.add(new Shockwave(options));
    }

    update(dt: number): void {
        for (let index = this.live.length - 1; index >= 0; index--) {
            const effect = this.live[index];
            effect.update(dt);
            if (!effect.finished) continue;

            this.drop(effect);
            this.live.splice(index, 1);
        }
    }

    destroy(): void {
        for (const effect of this.live) this.drop(effect);
        this.live.length = 0;
    }

    private add(effect: OneShot): void {
        this.layer.addChild(effect);
        this.live.push(effect);
    }

    private drop(effect: OneShot): void {
        effect.removeFromParent();
        effect.destroy({ children: true });
    }
}

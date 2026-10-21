import type { Container } from 'pixi.js';
import { Burst } from '../entities/Burst';
import { Shockwave } from '../entities/Shockwave';
import type { ShockwaveOptions } from '../entities/Shockwave';
import type { BurstOptions } from './particles';

/**
 * Owns short-lived visual effects mounted into a Pixi container.
 *
 * Screens decide when and where effects happen; this system handles their
 * shared lifecycle: construction, ticking, and removal when finished.
 */
export class EffectsSystem {
    private readonly bursts: Burst[] = [];
    private readonly shockwaves: Shockwave[] = [];

    constructor(private readonly layer: Container) {}

    addBurst(color: number, options: BurstOptions): Burst {
        const burst = new Burst(color, options);
        this.layer.addChild(burst);
        this.bursts.push(burst);
        return burst;
    }

    addShockwave(options: ShockwaveOptions): Shockwave {
        const shockwave = new Shockwave(options);
        this.layer.addChild(shockwave);
        this.shockwaves.push(shockwave);
        return shockwave;
    }

    update(dt: number): void {
        this.updateList(this.bursts, dt);
        this.updateList(this.shockwaves, dt);
    }

    destroy(): void {
        this.destroyList(this.bursts);
        this.destroyList(this.shockwaves);
    }

    private updateList<T extends Burst | Shockwave>(effects: T[], dt: number): void {
        for (let index = effects.length - 1; index >= 0; index--) {
            const effect = effects[index];
            effect.update(dt);
            if (!effect.finished) continue;

            effect.destroy({ children: true });
            effects.splice(index, 1);
        }
    }

    private destroyList<T extends Burst | Shockwave>(effects: T[]): void {
        for (const effect of effects) {
            effect.removeFromParent();
            effect.destroy({ children: true });
        }
        effects.length = 0;
    }
}
import type { Container } from 'pixi.js';
import type { Component } from '../core/ecs/Component';
import { OneShot } from '../core/ecs/OneShot';
import { Burst } from '../entities/Burst';
import { Shockwave } from '../entities/Shockwave';
import type { ShockwaveOptions } from '../entities/Shockwave';
import type { BurstOptions } from '../rules/particles';

/**
 * Holds the short-lived visual effects mounted into one layer.
 *
 * Screens decide when and where an effect happens; the pool owns the shared
 * lifecycle — construction, ticking, and unmounting once `finished`. Every
 * effect is a `OneShot`, so bursts and shockwaves need no separate lists.
 */
export class EffectsPool implements Component {
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

    dispose(): void {
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

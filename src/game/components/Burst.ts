import { Graphics } from 'pixi.js';
import { Entity } from '../core/entities/Entity';
import { advance, alphaOf, burst as makeParticles } from '../systems/particles';
import type { BurstOptions, Particle } from '../systems/particles';

/**
 * A one-shot cloud of confetti-coloured particles.
 *
 * Lives in world coordinates and never moves: the particles carry the motion,
 * so the entity is positioned at the origin and drawn where it was thrown. It
 * owns its own lifetime — `finished` turns true once the last particle dies —
 * so the owner only has to drop it.
 *
 * All the particles share one `Graphics`, redrawn each frame. A handful of
 * circles is cheaper to rebuild than to track as display objects, and it keeps
 * a burst to a single draw call.
 */
export class Burst extends Entity {
    private readonly particles: Particle[];
    private readonly color: number;
    private readonly gravity: number | undefined;
    private readonly dots = new Graphics();

    constructor(color: number, options: BurstOptions) {
        super();

        this.color = color;
        this.gravity = options.gravity;
        this.particles = makeParticles(options);
        this.addChild(this.dots);
        this.draw();
    }

    get finished(): boolean {
        return this.particles.length === 0;
    }

    override update(dt: number): void {
        super.update(dt);
        advance(this.particles, dt, this.gravity);
        this.draw();
    }

    private draw(): void {
        this.dots.clear();

        for (const particle of this.particles) {
            const fade = alphaOf(particle);
            // Shrink as it fades, so a burst looks like it is losing energy
            // rather than switching off.
            this.dots.circle(particle.x, particle.y, particle.size * (0.4 + 0.6 * fade)).fill({
                color: this.color,
                alpha: fade,
            });
        }
    }
}

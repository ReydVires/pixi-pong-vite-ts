import { Graphics } from 'pixi.js';
import type { Container } from 'pixi.js';
import type { Component } from '../core/ecs/Component';
import { advance, alphaOf, burst as makeParticles } from '../rules/particles';
import type { BurstOptions, Particle } from '../rules/particles';

/**
 * A one-shot cloud of confetti-coloured particles, drawn into a single
 * `Graphics` that the component mounts into its owner.
 *
 * The owner stays put: the particles carry all the motion, thrown from the
 * `x`/`y` in the options. `finished` turns true once the last particle dies,
 * which is what lets the entity above it be dropped.
 *
 * A handful of circles is cheaper to rebuild every frame than to track as
 * display objects, and it keeps a burst to a single draw call.
 */
export class Sparks implements Component {
    private readonly particles: Particle[];
    private readonly color: number;
    private readonly gravity: number | undefined;
    private readonly shape: 'circle' | 'star';
    private readonly dots = new Graphics();

    constructor(owner: Container, color: number, options: BurstOptions) {
        this.color = color;
        this.gravity = options.gravity;
        this.shape = options.shape ?? 'circle';
        this.particles = makeParticles(options);

        owner.addChild(this.dots);
        this.draw();
    }

    /** True once every particle has burned out. */
    get finished(): boolean {
        return this.particles.length === 0;
    }

    update(dt: number): void {
        advance(this.particles, dt, this.gravity);
        this.draw();
    }

    private draw(): void {
        this.dots.clear();

        for (const particle of this.particles) {
            const fade = alphaOf(particle);
            // Shrink as it fades, so a burst looks like it is losing energy
            // rather than switching off.
            const size = particle.size * (0.4 + 0.6 * fade);
            if (this.shape === 'star') {
                const points: number[] = [];
                for (let i = 0; i < 10; i++) {
                    const angle = (Math.PI / 5) * i - Math.PI / 2;
                    const radius = size * (i % 2 === 0 ? 1 : 0.45);
                    points.push(particle.x + Math.cos(angle) * radius, particle.y + Math.sin(angle) * radius);
                }
                this.dots.poly(points, true).fill({ color: this.color, alpha: fade });
            } else {
                this.dots.circle(particle.x, particle.y, size).fill({ color: this.color, alpha: fade });
            }
        }
    }
}

/**
 * Particle motion — the pure half of every burst and firework.
 *
 * No Pixi and no screen: a `Particle` is plain numbers and `advance()` is one
 * integration step, so the *feel* (how far, how fast, how long) can be reasoned
 * about and tested without a canvas. `Burst` is the display half that draws
 * these, and `fireworks.ts` is the scheduling half.
 */

export interface Particle {
    x: number;
    y: number;
    /** Velocity in design px per second. */
    vx: number;
    vy: number;
    /** Milliseconds left before it vanishes. */
    life: number;
    /** The life it was born with, so the fade has a denominator. */
    maxLife: number;
    /** Drawn radius in design px. */
    size: number;
}

/** Downward pull on every particle, in px/s². */
export const PARTICLE_GRAVITY = 1500;

export interface BurstOptions {
    count: number;
    x: number;
    y: number;
    /** Particle silhouette, rendered by `Burst`. @default 'circle' */
    shape?: 'circle' | 'star';
    /** Speed band in px/s. */
    speed: readonly [number, number];
    /** Lifetime band in ms. */
    lifeMs: readonly [number, number];
    /** Radius band in px. @default [3, 6] */
    size?: readonly [number, number];
    /**
     * Downward pull for this burst, in px/s². @default PARTICLE_GRAVITY
     *
     * Lower it for things that should hang: a firework drifting down over a
     * second reads very differently from a whack's sparks dropping instantly.
     */
    gravity?: number;
    /**
     * Direction cone in radians: `[base, halfWidth]`. The default covers every
     * direction, which is what a whack and a firework both want; a narrower cone
     * is how a directional spray would be made.
     */
    cone?: readonly [number, number];
    /** Randomness in `[0, 1)`. Injectable so tests can pin the spread. */
    rng?: () => number;
}

/**
 * Throw `count` particles out from `(x, y)`.
 *
 * Directions are spread evenly across the cone and only then jittered, one
 * particle per slice. Picking each angle at random instead clumps visibly at
 * the small counts a whack uses — a burst of six should read as a ring.
 */
export function burst(options: BurstOptions): Particle[] {
    const { count, x, y, speed, lifeMs, size = [3, 6], cone = [0, Math.PI], rng = Math.random } = options;
    const [base, half] = cone;
    const [minSpeed, maxSpeed] = speed;
    const [minLife, maxLife] = lifeMs;
    const [minSize, maxSize] = size;
    const particles: Particle[] = [];

    for (let i = 0; i < count; i++) {
        const slice = base - half + ((i + rng()) / count) * 2 * half;
        const velocity = minSpeed + rng() * (maxSpeed - minSpeed);
        const life = minLife + rng() * (maxLife - minLife);

        particles.push({
            x,
            y,
            vx: Math.cos(slice) * velocity,
            vy: Math.sin(slice) * velocity,
            life,
            maxLife: life,
            size: minSize + rng() * (maxSize - minSize),
        });
    }

    return particles;
}

/**
 * One integration step, in place. `dt` is ms.
 *
 * Particles that run out of life are dropped here rather than by the caller, so
 * "am I done?" is only ever `particles.length === 0`.
 */
export function advance(particles: Particle[], dt: number, gravity = PARTICLE_GRAVITY): void {
    const seconds = dt / 1000;

    for (let i = particles.length - 1; i >= 0; i--) {
        const particle = particles[i];
        particle.life -= dt;

        if (particle.life <= 0) {
            particles.splice(i, 1);
            continue;
        }

        particle.vy += gravity * seconds;
        particle.x += particle.vx * seconds;
        particle.y += particle.vy * seconds;
    }
}

/** Fade curve: 1 at birth, 0 at death. */
export function alphaOf(particle: Particle): number {
    return Math.max(0, particle.life / particle.maxLife);
}

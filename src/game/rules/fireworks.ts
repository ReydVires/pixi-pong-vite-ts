/**
 * When and where the next firework goes off.
 *
 * Pure scheduling, kept apart from the drawing so the celebration's *pacing* is
 * testable: the screen asks for one, waits out the delay, sets it off with
 * `Burst`, then asks for the next.
 */

/** Colours a firework can take — bright against the night sky. */
export const FIREWORK_COLORS = [0xff7aa2, 0xffd166, 0x7ae0ff, 0x9dff8a, 0xc8b6ff, 0xffffff] as const;

/** Rest between bursts, in ms. The low end is what makes it feel like a finale. */
export const FIREWORK_DELAY_MS: readonly [number, number] = [240, 700];

export interface FireworkBounds {
    x: number;
    y: number;
    width: number;
    height: number;
}

export interface Firework {
    /** How long to wait before setting it off, in ms. */
    delayMs: number;
    x: number;
    y: number;
    color: number;
}

/**
 * The next burst to schedule, inside `bounds` — pass the *visible* area, not the
 * design rect, so the sky stays full on a wider landscape screen.
 */
export function nextFirework(
    bounds: FireworkBounds,
    rng: () => number = Math.random,
    palette: readonly number[] = FIREWORK_COLORS,
): Firework {
    const [minDelay, maxDelay] = FIREWORK_DELAY_MS;
    const color = palette[Math.floor(rng() * palette.length)] ?? palette[0];

    return {
        delayMs: minDelay + rng() * (maxDelay - minDelay),
        x: bounds.x + rng() * bounds.width,
        y: bounds.y + rng() * bounds.height,
        color,
    };
}

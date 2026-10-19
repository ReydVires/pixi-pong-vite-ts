import type { Graphics } from 'pixi.js';
import type { CapyType } from '../levels/types';

/**
 * A capybara's face, drawn once for everyone who needs one.
 *
 * `Capy` calls this for the head in every hole; the finale's present calls it
 * again at a much larger radius, so the capy that pops out of the box is
 * unmistakably the character the player has been whacking rather than a
 * hand-drawn lookalike that drifts out of sync with it.
 *
 * The face is everything that identifies the animal — skull, muzzle, ears, eyes
 * and nose. What a *type does* is not here: a bomb's spike and a golden's
 * sparkle are gameplay signalling, and `Capy` draws those on top.
 */
export function drawCapyFace(target: Graphics, radius: number, type: CapyType): void {
    const r = radius;

    // Capybara silhouette: a blocky skull and a blunt, squared muzzle.
    // Deliberately built from rounded rectangles — a plain circle with
    // round ears on top reads "bear", which is what this replaces.
    target.roundRect(-r * 0.95, -r * 0.75, r * 1.9, r * 1.3, r * 0.4).fill(type.color);
    target.roundRect(-r * 0.725, r * 0.145, r * 1.45, r * 0.75, r * 0.32).fill(type.color);

    // Ears: tiny nubs poking above the top corners, not discs.
    target.circle(-r * 0.68, -r * 0.7, r * 0.16).fill(type.color);
    target.circle(r * 0.68, -r * 0.7, r * 0.16).fill(type.color);
    target.circle(-r * 0.68, -r * 0.7, r * 0.08).fill(type.accent);
    target.circle(r * 0.68, -r * 0.7, r * 0.08).fill(type.accent);

    // Eyes: high on the skull and wide apart, as a capybara's are.
    target.circle(-r * 0.52, -r * 0.3, r * 0.13).fill(0xffffff);
    target.circle(r * 0.52, -r * 0.3, r * 0.13).fill(0xffffff);
    target.circle(-r * 0.5, -r * 0.3, r * 0.065).fill(0x1b1b1b);
    target.circle(r * 0.5, -r * 0.3, r * 0.065).fill(0x1b1b1b);

    // Nose: a wide oval on the muzzle, darkened from the coat so it always
    // silhouettes — a fixed brown disappears on the dark bomb coat.
    target.ellipse(0, r * 0.42, r * 0.36, r * 0.26).fill(darken(type.color, 0.62));
    target.circle(-r * 0.13, r * 0.38, r * 0.05).fill(0x1b1b1b);
    target.circle(r * 0.13, r * 0.38, r * 0.05).fill(0x1b1b1b);
}

/** Push a hex colour toward black — `amount` in [0,1]. Keeps the hue. */
function darken(color: number, amount: number): number {
    const channel = (shift: number): number => Math.round(((color >> shift) & 0xff) * (1 - amount));
    return (channel(16) << 16) | (channel(8) << 8) | channel(0);
}

import type { Graphics } from 'pixi.js';
import type { CapyType } from '../levels/types';

export type CapyExpression = 'neutral' | 'hit';

/**
 * A capybara's face, drawn once for everyone who needs one.
 *
 * Special capys in holes and the finale's present use this drawing, so the
 * golden, tough and harmful archetypes retain clear gameplay colors.
 *
 * The face is everything that identifies the animal — skull, muzzle, ears, eyes
 * and nose. What a *type does* is not here: a bomb's spike and a golden's
 * sparkle are gameplay signalling, and `Capy` draws those on top.
 */
export function drawCapyFace(
    target: Graphics,
    radius: number,
    type: CapyType,
    expression: CapyExpression = 'neutral',
): void {
    const r = radius;
    const outline = type.accent;

    target.ellipse(-r * 0.67, -r * 0.66, r * 0.23, r * 0.2).fill(type.color).stroke({ width: r * 0.1, color: outline });
    target.ellipse(r * 0.67, -r * 0.66, r * 0.23, r * 0.2).fill(type.color).stroke({ width: r * 0.1, color: outline });
    target.ellipse(-r * 0.67, -r * 0.66, r * 0.12, r * 0.1).fill(darken(type.color, 0.32));
    target.ellipse(r * 0.67, -r * 0.66, r * 0.12, r * 0.1).fill(darken(type.color, 0.32));

    target
        .moveTo(-r * 0.94, -r * 0.12)
        .bezierCurveTo(-r * 0.98, -r * 0.64, -r * 0.56, -r * 0.96, -r * 0.08, -r * 0.98)
        .bezierCurveTo(r * 0.42, -r, r * 0.88, -r * 0.66, r * 0.92, -r * 0.16)
        .bezierCurveTo(r, r * 0.2, r * 0.86, r * 0.68, r * 0.63, r * 0.86)
        .bezierCurveTo(r * 0.34, r * 1.04, -r * 0.34, r * 1.04, -r * 0.63, r * 0.86)
        .bezierCurveTo(-r * 0.88, r * 0.68, -r, r * 0.25, -r * 0.94, -r * 0.12)
        .closePath()
        .fill(type.color)
        .stroke({ width: r * 0.1, color: outline });

    target.ellipse(-r * 0.57, r * 0.49, r * 0.09, r * 0.07).fill(darken(type.color, 0.22));
    target.ellipse(-r * 0.43, r * 0.61, r * 0.07, r * 0.055).fill(darken(type.color, 0.22));

    if (expression === 'hit') {
        target.circle(-r * 0.42, -r * 0.4, r * 0.075).fill(outline);
        target.circle(r * 0.42, -r * 0.4, r * 0.075).fill(outline);
        target.ellipse(-r * 0.53, -r * 0.12, r * 0.085, r * 0.17).fill(0xb9f2f4);
        target.ellipse(r * 0.53, -r * 0.12, r * 0.085, r * 0.17).fill(0xb9f2f4);
        target.ellipse(-r * 0.12, -r * 0.2, r * 0.055, r * 0.045).fill(outline);
        target.ellipse(r * 0.12, -r * 0.2, r * 0.055, r * 0.045).fill(outline);
        target.ellipse(0, r * 0.1, r * 0.27, r * 0.32).fill(outline);
        target.ellipse(0, r * 0.12, r * 0.17, r * 0.22).fill(0xf05e70);
    } else {
        target.circle(-r * 0.42, -r * 0.32, r * 0.075).fill(outline);
        target.circle(r * 0.42, -r * 0.32, r * 0.075).fill(outline);
        target.ellipse(0, r * 0.04, r * 0.3, r * 0.23).fill(darken(type.color, 0.45));
        target.circle(-r * 0.11, r * 0.015, r * 0.045).fill(outline);
        target.circle(r * 0.11, r * 0.015, r * 0.045).fill(outline);
        target
            .moveTo(0, r * 0.12)
            .lineTo(0, r * 0.2)
            .lineTo(-r * 0.1, r * 0.26)
            .moveTo(0, r * 0.2)
            .lineTo(r * 0.1, r * 0.26)
            .stroke({ width: r * 0.055, color: outline, cap: 'round', join: 'round' });
    }
}

/** Push a hex colour toward black — `amount` in [0,1]. Keeps the hue. */
function darken(color: number, amount: number): number {
    const channel = (shift: number): number => Math.round(((color >> shift) & 0xff) * (1 - amount));
    return (channel(16) << 16) | (channel(8) << 8) | channel(0);
}

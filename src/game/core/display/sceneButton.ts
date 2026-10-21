import { Container, Graphics } from 'pixi.js';
import { COLORS } from '../../config';
import type { Nullable } from '../types';
import { createLabel } from './label';

/** Size of the button, in design px. */
const SCENE_BUTTON = { width: 320, height: 68 } as const;

/**
 * A button that belongs to the night sky: a soft rounded plaque rather than the
 * arcade slab `core/display/button.ts` draws.
 *
 * `accent` marks the payoff — gold with dark text, picking up the ribbon and the
 * fireworks. The plain variant is a dim pane with a cool outline, so the way out
 * is always there without competing with whatever the screen is showing.
 *
 * Pass `null` for `onTap` to stage a button that is not wired up yet: it keeps
 * its place and its looks, but takes no taps rather than silently swallowing
 * them, so a placeholder can never be mistaken for a broken control.
 */
export function createSceneButton(text: string, onTap: Nullable<() => void>, accent = false): Container {
    const { width, height } = SCENE_BUTTON;
    const button = new Container();

    const plaque = new Graphics()
        .roundRect(-width / 2, -height / 2, width, height, height / 2)
        .fill({ color: accent ? COLORS.star : COLORS.sky, alpha: accent ? 0.9 : 0.55 })
        .stroke({ width: 2, color: accent ? COLORS.star : 0x5c6a9c, alpha: 0.95 });

    const label = createLabel(text, {
        fontSize: 28,
        fill: accent ? COLORS.sky : COLORS.white,
        stroke: accent ? null : { color: COLORS.sky, width: 3 },
    });
    label.anchor.set(0.5);

    button.addChild(plaque, label);

    if (onTap) {
        button.eventMode = 'static';
        button.cursor = 'pointer';
        button.on('pointerdown', onTap);
    }

    return button;
}

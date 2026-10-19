import { Text } from 'pixi.js';
import type { TextStyleOptions } from 'pixi.js';
import { COLORS, FONT_FAMILY } from '../../config';

/** Text style options, except `stroke` may also be `null` to disable the outline. */
export interface LabelOptions extends Omit<Partial<TextStyleOptions>, 'stroke'> {
    stroke?: TextStyleOptions['stroke'] | null;
}

/**
 * Default outline for labels.
 *
 * `join: 'round'` is important: the default Pixi join is `miter`, which makes
 * sharp letters (M, W, A, V) grow pointed spikes at their corners. Round joins
 * keep the outline smooth.
 */
const DEFAULT_STROKE = {
    color: COLORS.black,
    width: 4,
    join: 'round',
} as const;

/**
 * Text with the template's arcade style (heavy font + outline) already applied.
 * Pass overrides to tweak size, color, stroke, etc.
 *
 * A partial `stroke` is merged over the defaults, so `{ stroke: { width: 3 } }`
 * keeps the round-join fix. Pass `stroke: null` to remove the outline entirely.
 */
export function createLabel(text: string, style: LabelOptions = {}): Text {
    const { stroke = DEFAULT_STROKE, ...rest } = style;

    // `null` disables the outline; a partial object merges over the defaults.
    const outline =
        stroke === null
            ? undefined
            : typeof stroke === 'object'
              ? { ...DEFAULT_STROKE, ...stroke }
              : stroke;

    return new Text({
        text,
        style: {
            fontFamily: FONT_FAMILY,
            fontSize: 38,
            fill: COLORS.white,
            align: 'center',
            ...rest,
            stroke: outline,
        },
    });
}

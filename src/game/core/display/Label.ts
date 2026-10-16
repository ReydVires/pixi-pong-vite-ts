import { Text } from 'pixi.js';
import type { TextStyleOptions } from 'pixi.js';
import { COLORS } from '../../config';

/** Default face used across the template. */
export const FONT_FAMILY = 'Arial Black';

/**
 * Text with the template's arcade style (heavy font + outline) already applied.
 * Pass overrides to tweak size, color, stroke, etc.
 */
export function createLabel(text: string, style: Partial<TextStyleOptions> = {}): Text {
    return new Text({
        text,
        style: {
            fontFamily: FONT_FAMILY,
            fontSize: 38,
            fill: COLORS.white,
            stroke: { color: COLORS.black, width: 8 },
            align: 'center',
            ...style,
        },
    });
}

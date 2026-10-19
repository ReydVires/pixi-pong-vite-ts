import { Container, Graphics } from 'pixi.js';
import { COLORS } from '../../config';
import { createLabel } from './Label';

export interface ButtonOptions {
    /** Total width in design px. @default 300 */
    width?: number;
    /** Total height in design px. @default 72 */
    height?: number;
    /** Fill colour. @default COLORS.accent */
    fill?: number;
    /** Label size. @default 30 */
    fontSize?: number;
}

/**
 * A tappable button with the template's arcade styling: rounded fill, thin
 * white outline, heavy font.
 *
 * The label uses a *thin* dark outline rather than `createLabel`'s default,
 * because at 28–30px a 4–8px stroke swallows the glyph and turns it into a blob.
 */
export function createButton(text: string, onTap: () => void, options: ButtonOptions = {}): Container {
    const width = options.width ?? 300;
    const height = options.height ?? 72;
    const fill = options.fill ?? COLORS.accent;

    const button = new Container();
    button.eventMode = 'static';
    button.cursor = 'pointer';

    const background = new Graphics()
        .roundRect(-width / 2, -height / 2, width, height, 18)
        .fill(fill)
        .stroke({ width: 3, color: COLORS.white });

    const label = createLabel(text, {
        fontSize: options.fontSize ?? 30,
        fill: COLORS.white,
        stroke: { color: COLORS.black, width: 3 },
    });
    label.anchor.set(0.5);

    button.addChild(background, label);
    button.on('pointerdown', onTap);

    return button;
}

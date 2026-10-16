import { Graphics, Sprite } from 'pixi.js';
import type { ColorSource, Texture } from 'pixi.js';
import type { Responsive, ViewportMetrics } from '../responsive/Responsive';

/**
 * Full-bleed solid backdrop. Redraws to cover the whole visible world area
 * (including the letterbox margins) and cleans up its resize listener when
 * the graphics is destroyed.
 */
export function createColorBackground(color: ColorSource, responsive: Responsive): Graphics {
    const background = new Graphics();

    const draw = (metrics: ViewportMetrics): void => {
        const { x, y, width, height } = metrics.visibleBounds;
        background.clear().rect(x, y, width, height).fill(color);
    };

    draw(responsive.viewport);
    background.once('destroyed', responsive.onResize(draw));

    return background;
}

/**
 * Full-bleed image backdrop, scaled like CSS `background-size: cover`
 * (uniform scale, cropped) and re-fit whenever the viewport changes.
 * Pass an alpha below 1 to dim it (e.g. 0.5).
 */
export function createTextureBackground(texture: Texture, responsive: Responsive, alpha = 1): Sprite {
    const sprite = new Sprite({ texture });
    sprite.anchor.set(0.5);
    sprite.alpha = alpha;

    const draw = (metrics: ViewportMetrics): void => {
        const { x, y, width, height } = metrics.visibleBounds;
        const scale = Math.max(width / texture.width, height / texture.height);
        sprite.scale.set(scale);
        sprite.position.set(x + width / 2, y + height / 2);
    };

    draw(responsive.viewport);
    sprite.once('destroyed', responsive.onResize(draw));

    return sprite;
}

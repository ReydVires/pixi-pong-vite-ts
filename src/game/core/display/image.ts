import { Sprite, Texture } from 'pixi.js';

export interface ImageOptions {
    /** @default 0 */
    x?: number;
    /** @default 0 */
    y?: number;
    /** Anchor as a 0..1 fraction. @default 0.5 (centered) */
    anchor?: number;
    /** @default 1 */
    alpha?: number;
}

/** Creates a sprite with sane template defaults (centered anchor). */
export function createImage(texture: Texture, options: ImageOptions = {}): Sprite {
    const { x = 0, y = 0, anchor = 0.5, alpha = 1 } = options;

    const sprite = new Sprite({ texture });
    sprite.anchor.set(anchor, anchor);
    sprite.position.set(x, y);
    sprite.alpha = alpha;

    return sprite;
}

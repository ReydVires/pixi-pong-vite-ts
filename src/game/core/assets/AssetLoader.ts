import { Assets } from 'pixi.js';
import type { ProgressCallback, Texture } from 'pixi.js';

export interface AssetDefinition {
    /** Key used to look the asset up again later. */
    alias: string;
    /** Path relative to the site base. */
    src: string;
}

export interface FontDefinition {
    /** Key used to look the font up again later. */
    alias: string;
    /** Path relative to the site base. */
    src: string;
    /** CSS `font-family` name to reference in text styles. */
    family: string;
}

/**
 * Thin wrapper over the Pixi asset pipeline with local texture and font
 * registries, so gameplay code never touches the global cache directly.
 */
export class AssetLoader {
    private readonly textures = new Map<string, Texture>();
    private readonly fonts = new Map<string, FontFace>();

    /**
     * Load a texture, optionally reporting 0..1 download progress.
     * Results are cached — repeated calls resolve immediately.
     */
    async load(asset: AssetDefinition, onProgress?: ProgressCallback): Promise<Texture> {
        const cached = this.textures.get(asset.alias);
        if (cached) return cached;

        const texture = await Assets.load<Texture>({ alias: asset.alias, src: asset.src }, onProgress);
        this.textures.set(asset.alias, texture);

        return texture;
    }

    /**
     * Load a web font (`.woff2`/`.woff`/`.ttf`/`.otf`) and register it with the
     * browser. Resolves once the face is ready, so text created afterwards uses
     * it immediately. Results are cached — repeated calls resolve immediately.
     */
    async loadFont(font: FontDefinition): Promise<FontFace> {
        const cached = this.fonts.get(font.alias);
        if (cached) return cached;

        const face = await Assets.load<FontFace>({
            alias: font.alias,
            src: font.src,
            data: { family: font.family },
        });
        this.fonts.set(font.alias, face);

        return face;
    }

    /** Retrieve a previously loaded texture. Throws if it was never loaded. */
    texture(asset: AssetDefinition): Texture {
        const texture = this.textures.get(asset.alias);
        if (!texture) {
            throw new Error(`Asset "${asset.alias}" (${asset.src}) has not been loaded yet.`);
        }

        return texture;
    }
}

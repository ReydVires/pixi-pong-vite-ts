import { Assets } from 'pixi.js';
import type { ProgressCallback, Texture } from 'pixi.js';

export interface AssetDefinition {
    /** Key used to look the asset up again later. */
    alias: string;
    /** Path relative to the site base. */
    src: string;
}

/**
 * Thin wrapper over the Pixi asset pipeline with a local texture registry,
 * so gameplay code never touches the global cache directly.
 */
export class AssetLoader {
    private readonly textures = new Map<string, Texture>();

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

    /** Retrieve a previously loaded texture. Throws if it was never loaded. */
    texture(asset: AssetDefinition): Texture {
        const texture = this.textures.get(asset.alias);
        if (!texture) {
            throw new Error(`Asset "${asset.alias}" (${asset.src}) has not been loaded yet.`);
        }

        return texture;
    }
}

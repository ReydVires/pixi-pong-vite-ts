/**
 * A single behavior attached to an `Entity`.
 *
 * Components are mixed onto an entity instead of inherited from, so behaviors
 * can be added and removed at runtime. A component owns one job and its own
 * timer; the entity only forwards frames to it.
 */
export interface Component {
    /** Begin — or restart — the behavior. */
    start?(): void;

    /** Called every frame while the owning entity is active. `dt` is in ms. */
    update?(dt: number): void;

    /**
     * Release anything the component acquired that the entity does not own — an
     * event subscription, or a display object it detached and must put down.
     * Called by `Entity.removeComponent()` and `Entity.destroy()`.
     *
     * Named `dispose` rather than `destroy` so it never reads as Pixi's own
     * `Container.destroy`.
     */
    dispose?(): void;
}

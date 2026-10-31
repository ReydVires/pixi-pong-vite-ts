/**
 * A single piece of behavior or data attached to an `Entity`.
 *
 * Components are composed onto entities instead of inherited from,
 * so behaviors can be mixed, matched, added and removed at runtime.
 */
export interface Component {
    /** Begin — or restart — the behavior. */
    start?(): void;

    /**
     * Called every frame while the owning entity is active.
     * @param dt Elapsed time in milliseconds since the previous frame.
     */
    update?(dt: number): void;

    /**
     * Release resources when the component is removed or its entity is destroyed.
     *
     * Optional on purpose. A component that only drives properties (a timer over
     * `x`, `y`, `alpha`, `scale`) has nothing to release — its targets are the
     * entity's own children, which Pixi destroys. Implement this only when the
     * component acquires something the entity does not own: an event
     * subscription, a ticker/interval outside the entity, or a display object it
     * detached and must put down. `Entity.removeComponent()` and
     * `Entity.destroy()` both call it, before the entity's children go away.
     */
    destroy?(): void;
}

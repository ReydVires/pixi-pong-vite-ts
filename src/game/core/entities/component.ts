/**
 * A single piece of behavior or data attached to an `Entity`.
 *
 * Components are composed onto entities instead of inherited from,
 * so behaviors can be mixed, matched, added and removed at runtime.
 */
export interface Component {
    /**
     * Called every frame while the owning entity is active.
     * @param dt Elapsed time in milliseconds since the previous frame.
     */
    update?(dt: number): void;

    /** Release resources when the component is removed or its entity is destroyed. */
    destroy?(): void;
}

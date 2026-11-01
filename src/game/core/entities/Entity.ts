import { Container } from 'pixi.js';
import type { DestroyOptions } from 'pixi.js';
import type { Component } from './component';

/**
 * A display object that hosts components — and nothing more.
 *
 * The rule is strict: an entity never simulates on its own. Anything that
 * changes over time lives in a component ticked by this class; a subclass only
 * adds art and a domain API over its components. A screen that just needs a
 * handle for components builds `new Entity()` rather than a subclass.
 *
 * If the entity has a lifetime its owner must poll, extend `OneShot` instead of
 * overriding `update()` to report it.
 */
export class Entity extends Container {
    private readonly components: Component[] = [];

    /** Attach a behavior and hand it back for convenient wiring. */
    addComponent<T extends Component>(component: T): T {
        this.components.push(component);
        return component;
    }

    /** Detach a behavior, calling its `destroy()` hook. */
    removeComponent(component: Component): void {
        const index = this.components.indexOf(component);
        if (index === -1) return;

        this.components.splice(index, 1);
        component.destroy?.();
    }

    /** Tick every attached component. Screens call this from their own `update()`. */
    update(dt: number): void {
        for (const component of this.components) {
            component.update?.(dt);
        }
    }

    override destroy(options?: DestroyOptions): void {
        for (const component of this.components) {
            component.destroy?.();
        }
        this.components.length = 0;

        super.destroy(options);
    }
}

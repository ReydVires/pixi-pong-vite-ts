import { Container } from 'pixi.js';
import type { DestroyOptions } from 'pixi.js';
import type { Component } from './Component';

/**
 * A display object that hosts components — and nothing more.
 *
 * An entity never simulates on its own: anything that changes over time lives
 * in a component, ticked from `update(dt)`. A subclass only adds art and a
 * domain API over its components (`Capy`, `Gift`); a screen that just wants a
 * handle to attach components to builds `new Entity()`.
 *
 * Give an entity a lifetime its owner can poll by extending `OneShot`, rather
 * than overriding `update()` to report one.
 */
export class Entity extends Container {
    private readonly components: Component[] = [];

    /** Attach a behavior and hand it back, so a host can wire it in one line. */
    addComponent<T extends Component>(component: T): T {
        this.components.push(component);
        return component;
    }

    /** Detach a behavior, disposing it. */
    removeComponent(component: Component): void {
        const index = this.components.indexOf(component);
        if (index === -1) return;

        this.components.splice(index, 1);
        component.dispose?.();
    }

    /** Tick every attached component. Screens call this from their own `update()`. */
    update(dt: number): void {
        for (const component of this.components) {
            component.update?.(dt);
        }
    }

    override destroy(options?: DestroyOptions): void {
        for (const component of this.components) {
            component.dispose?.();
        }
        this.components.length = 0;

        super.destroy(options);
    }
}

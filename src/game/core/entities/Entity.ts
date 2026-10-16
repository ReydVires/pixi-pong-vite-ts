import { Container } from 'pixi.js';
import type { DestroyOptions } from 'pixi.js';
import type { Component } from './Component';

/**
 * A display object that composes zero or more `Component` behaviors.
 *
 * An entity only knows how to host and tick components — what it actually
 * *does* lives entirely in the components attached to it.
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

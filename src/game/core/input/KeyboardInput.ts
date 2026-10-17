import type { Unsubscribe } from '../responsive/layout';

/** Keys the game listens for, by `KeyboardEvent.code`. */
export type KeyCode = 'Escape' | 'ArrowLeft' | 'ArrowRight' | 'ArrowUp' | 'ArrowDown' | 'KeyA' | 'KeyD' | 'KeyW' | 'KeyS';

/**
 * Keyboard input scoped to a screen.
 *
 * Listeners are registered on `window` and every subscription returned here
 * must be called in the screen's `destroy()` — the screen manager does not
 * clean these up automatically.
 *
 * ```ts
 * const stop = keyboard.onKeyDown('Escape', () => this.togglePause());
 * // later, in destroy():
 * stop();
 * ```
 */
export class KeyboardInput {
    private readonly handlers = new Map<KeyCode, Set<(event: KeyboardEvent) => void>>();
    private readonly downKeys = new Set<KeyCode>();
    private attached = false;

    /** True while the key is held down (polled each frame). */
    isDown(code: KeyCode): boolean {
        return this.downKeys.has(code);
    }

    /** Run `handler` each time the key is pressed. Returns an unsubscribe function. */
    onKeyDown(code: KeyCode, handler: (event: KeyboardEvent) => void): Unsubscribe {
        this.attach();
        let set = this.handlers.get(code);
        if (!set) {
            set = new Set();
            this.handlers.set(code, set);
        }
        set.add(handler);
        return () => {
            set?.delete(handler);
        };
    }

    /** Stop tracking the window. Call once in the screen's `destroy()`. */
    destroy(): void {
        if (!this.attached) return;
        this.attached = false;

        window.removeEventListener('keydown', this.handleKeyDown);
        window.removeEventListener('keyup', this.handleKeyUp);
        this.handlers.clear();
        this.downKeys.clear();
    }

    private attach(): void {
        if (this.attached) return;
        this.attached = true;

        window.addEventListener('keydown', this.handleKeyDown);
        window.addEventListener('keyup', this.handleKeyUp);
    }

    private readonly handleKeyDown = (event: KeyboardEvent): void => {
        const code = event.code as KeyCode;
        this.downKeys.add(code);
        this.handlers.get(code)?.forEach((handler) => handler(event));
    };

    private readonly handleKeyUp = (event: KeyboardEvent): void => {
        this.downKeys.delete(event.code as KeyCode);
    };
}

import type { Container } from 'pixi.js';
import { createOverlay } from '../core/display/overlay';
import type { Responsive } from '../core/responsive/Responsive';

/** What the pause menu needs from the screen that owns pausing. */
export interface PauseSpec {
    /** Close the menu and let the run continue. */
    readonly onResume: () => void;
    /** Close the menu and leave the stage for the main menu. */
    readonly onQuit: () => void;
    /** Fired before either action runs — used to play the click sound. */
    readonly onAction: () => void;
}

/**
 * The pause menu: a modal over the frozen run.
 *
 * Presentation only, exactly like `ResultsPanel` — the screen owns the
 * `playing`/`paused` state and the *rules* behind each button, and hands the
 * callbacks over here as a `PauseSpec`. Mount `overlay` wherever modals live
 * (PlayScreen uses `hud.mountOverlay`) and show or hide it through
 * `setPaused(...)`.
 */
export class PausePanel {
    readonly overlay: Container;

    constructor(responsive: Responsive, spec: PauseSpec) {
        this.overlay = createOverlay(responsive, {
            label: 'pause-overlay',
            title: 'Paused',
            actions: [
                { label: 'Resume', onTap: spec.onResume },
                { label: 'Quit to Menu', onTap: spec.onQuit },
            ],
            onAction: spec.onAction,
        });
        this.overlay.visible = false;
    }

    /** Show the menu when pausing; hide it when the run resumes. */
    setPaused(paused: boolean): void {
        this.overlay.visible = paused;
    }
}

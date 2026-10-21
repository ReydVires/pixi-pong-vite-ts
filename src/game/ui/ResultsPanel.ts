import { Container, Graphics } from 'pixi.js';
import type { Text } from 'pixi.js';
import { COLORS } from '../config';
import { createOverlay } from '../core/display/overlay';
import type { OverlayAction, OverlayOptions } from '../core/display/overlay';
import type { Responsive } from '../core/responsive/Responsive';
import { Easing, TweenSystem } from '../systems/TweenSystem';

/** Star row of the results panel: outer/inner radius of one point. */
const STAR_OUTER = 30;
const STAR_INNER = 13;

/** Everything the results panel shows. The screen computes it; this renders it. */
export interface ResultsSpec {
    /** e.g. "Stage 2 complete". */
    readonly title: string;
    /** Earned star count, drawn as the panel's figure row. */
    readonly stars: number;
    /** Final score — the headline number, counted up on entry. */
    readonly score: number;
    /** Detail lines, e.g. accuracy and best combo. */
    readonly lines: readonly string[];
    /** Buttons, top to bottom; the first is the primary. */
    readonly actions: readonly OverlayAction[];
    /** Fired before any action runs — used to play the click sound. */
    readonly onAction: () => void;
}

/**
 * The end-of-stage results panel: a modal over the frozen playfield, with its
 * score counting into the hero slot and the buttons sliding in one by one.
 *
 * Presentation only. The screen owns the *rules* — stars earned, whether the
 * player may advance, which stage is next — and hands the outcome over as a
 * `ResultsSpec` of plain values plus tap callbacks. Mount `overlay` wherever
 * modals live (PlayScreen uses `hud.mountOverlay`), tick `update(dt)` while the
 * screen is `finished`, and `destroy()` when the screen goes away.
 */
export class ResultsPanel {
    readonly overlay: Container;
    private readonly tweens = new TweenSystem();

    constructor(responsive: Responsive, spec: ResultsSpec) {
        const options: OverlayOptions = {
            label: 'results-overlay',
            title: spec.title,
            // A row of stars, drawn where the panel's flow wants it, rather than
            // at a fixed offset that could collide with the title or the lines.
            figure: this.createStars(spec.stars),
            // The score is the headline, not a detail line: it gets the hero
            // slot so it reads at a glance the moment the stage ends.
            hero: '0',
            onHeroCreated: (hero) => this.animateScore(hero, spec.score),
            lines: spec.lines,
            actions: spec.actions,
            onAction: spec.onAction,
            onButtonCreated: (button, index) => this.animateButton(button, index),
        };

        this.overlay = createOverlay(responsive, options);
    }

    /** Tick the entrance animations (score count-up, button slide-ins). */
    update(dt: number): void {
        this.tweens.update(dt);
    }

    destroy(): void {
        this.tweens.clear();
    }

    /** Count the final score into the results headline with a short pop. */
    private animateScore(hero: Text, score: number): void {
        hero.alpha = 0;
        hero.scale.set(0.78);

        this.tweens.to('result-score', 0, score, {
            durationMs: Math.min(1100, 650 + score * 0.2),
            delayMs: 120,
            easing: Easing.easeOutCubic,
            onUpdate: (value, progress) => {
                hero.text = `${Math.round(value)}`;
                hero.alpha = Math.min(1, progress * 2.5);
                const pulse = Math.sin(progress * Math.PI) * 0.1;
                hero.scale.set(0.78 + progress * 0.22 + pulse);
            },
            onComplete: () => {
                hero.text = `${score}`;
                hero.alpha = 1;
                hero.scale.set(1);
            },
        });
    }

    /** Slide and pop each result action into view, one after another. */
    private animateButton(button: Container, index: number): void {
        const targetY = button.y;
        const targetScale = 1;
        const startScale = 0.82;
        const delayMs = 360 + index * 110;

        button.y = targetY + 26;
        button.alpha = 0;
        button.scale.set(startScale);
        button.eventMode = 'none';
        button.cursor = 'default';

        this.tweens.to(`result-button-${index}-y`, button.y, targetY, {
            durationMs: 420,
            delayMs,
            easing: Easing.easeOutBack,
            onUpdate: (value) => {
                button.y = value;
            },
        });
        this.tweens.to(`result-button-${index}-alpha`, 0, 1, {
            durationMs: 260,
            delayMs,
            easing: Easing.easeOutCubic,
            onUpdate: (value) => {
                button.alpha = value;
            },
        });
        this.tweens.to(`result-button-${index}-scale`, startScale, targetScale, {
            durationMs: 420,
            delayMs,
            easing: Easing.easeOutBack,
            onUpdate: (value) => {
                button.scale.set(value);
            },
            onComplete: () => {
                button.eventMode = 'static';
                button.cursor = 'pointer';
            },
        });
    }

    /** A row of three stars, filled according to how well the stage went. */
    private createStars(earned: number): Container {
        const row = new Container();

        for (let i = 0; i < 3; i++) {
            const star = this.createStar(i < earned);
            star.position.set((i - 1) * 84, 0);
            row.addChild(star);
        }

        return row;
    }

    private createStar(filled: boolean): Graphics {
        const points: number[] = [];
        for (let i = 0; i < 10; i++) {
            const angle = (Math.PI / 5) * i - Math.PI / 2;
            const radius = i % 2 === 0 ? STAR_OUTER : STAR_INNER;
            points.push(Math.cos(angle) * radius, Math.sin(angle) * radius);
        }

        return new Graphics()
            .poly(points, true)
            .fill(filled ? COLORS.star : 0x3a3f4b)
            .stroke({ width: 3, color: COLORS.black });
    }
}

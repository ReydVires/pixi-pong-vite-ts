export type EasingFunction = (progress: number) => number;

export const Easing = {
    linear: (progress: number): number => progress,
    easeOutCubic: (progress: number): number => 1 - (1 - progress) ** 3,
    easeOutBack: (progress: number): number => {
        const overshoot = 1.70158;
        return 1 + (overshoot + 1) * (progress - 1) ** 3 + overshoot * (progress - 1) ** 2;
    },
} satisfies Record<string, EasingFunction>;

export interface TweenOptions {
    /** Duration in milliseconds. */
    durationMs: number;
    /** Wait before advancing the tween, in milliseconds. @default 0 */
    delayMs?: number;
    /** Easing applied to normalized progress. @default Easing.linear */
    easing?: EasingFunction;
    /** Called with the interpolated value and eased progress each update. */
    onUpdate: (value: number, progress: number) => void;
    /** Called once the tween reaches its target. */
    onComplete?: () => void;
}

interface ActiveTween extends TweenOptions {
    from: number;
    to: number;
    elapsedMs: number;
    delayRemainingMs: number;
}

/**
 * Advances keyed numeric tweens using the frame delta supplied by Pixi's
 * ticker. Starting a tween with an existing key replaces that tween, which
 * makes it straightforward to retarget animated values without stale work.
 */
export class TweenSystem {
    private readonly active = new Map<string, ActiveTween>();

    to(key: string, from: number, to: number, options: TweenOptions): void {
        const durationMs = Math.max(0, options.durationMs);
        const delayMs = Math.max(0, options.delayMs ?? 0);
        const tween: ActiveTween = {
            ...options,
            from,
            to,
            durationMs,
            elapsedMs: 0,
            delayRemainingMs: delayMs,
        };

        this.active.set(key, tween);

        if (durationMs === 0 && delayMs === 0) {
            this.active.delete(key);
            options.onUpdate(to, 1);
            options.onComplete?.();
        }
    }

    cancel(key: string): void {
        this.active.delete(key);
    }

    clear(): void {
        this.active.clear();
    }

    update(dt: number): void {
        const frameMs = Math.max(0, dt);

        for (const [key, tween] of this.active) {
            const tweenMs = Math.max(0, frameMs - tween.delayRemainingMs);
            tween.delayRemainingMs = Math.max(0, tween.delayRemainingMs - frameMs);
            if (tween.delayRemainingMs > 0) continue;

            tween.elapsedMs = Math.min(tween.durationMs, tween.elapsedMs + tweenMs);
            const progress = tween.durationMs === 0 ? 1 : tween.elapsedMs / tween.durationMs;
            const eased = (tween.easing ?? Easing.linear)(progress);
            const value = tween.from + (tween.to - tween.from) * eased;

            tween.onUpdate(value, eased);

            if (progress >= 1 && this.active.get(key) === tween) {
                this.active.delete(key);
                tween.onComplete?.();
            }
        }
    }
}
import type { Nullable } from '../types';
/**
 * Pure geometry helpers behind the responsive system.
 *
 * Nothing here touches Pixi or the DOM, so the math can be reasoned about
 * (and unit-tested) in isolation. `Responsive` is the stateful wrapper.
 */

/** Screen orientation, derived from the viewport's aspect ratio. */
export type Orientation = 'portrait' | 'landscape';

/** Coarse device class, derived from the viewport's shortest side. */
export type Breakpoint = 'mobile' | 'tablet' | 'desktop';

/** Removes a listener previously registered with `Responsive.onResize`. */
export type Unsubscribe = () => void;

export interface Size {
    readonly width: number;
    readonly height: number;
}

export interface Rect {
    readonly x: number;
    readonly y: number;
    readonly width: number;
    readonly height: number;
}

export interface Breakpoints {
    readonly tablet: number;
    readonly desktop: number;
}

/** `landscape` when wider than tall, otherwise `portrait` (square counts as portrait). */
export function orientationOf(width: number, height: number): Orientation {
    return height >= width ? 'portrait' : 'landscape';
}

/** Classify a viewport by its shortest side, so rotation keeps the same result. */
export function classifyBreakpoint(width: number, height: number, breakpoints: Breakpoints): Breakpoint {
    const shortest = Math.min(width, height);
    if (shortest < breakpoints.tablet) return 'mobile';
    if (shortest < breakpoints.desktop) return 'tablet';
    return 'desktop';
}

/** Uniform scale that fits the whole design area inside the viewport (letterbox). */
export function containScale(viewportWidth: number, viewportHeight: number, designWidth: number, designHeight: number): number {
    return Math.min(viewportWidth / designWidth, viewportHeight / designHeight);
}

/** Uniform scale that fills the viewport, cropping the design area (cover). */
export function coverScale(viewportWidth: number, viewportHeight: number, designWidth: number, designHeight: number): number {
    return Math.max(viewportWidth / designWidth, viewportHeight / designHeight);
}

/** Viewport size expressed in design/world units at a given scale. */
export function visibleSize(scale: number, viewportWidth: number, viewportHeight: number): Size {
    return { width: viewportWidth / scale, height: viewportHeight / scale };
}

/** A `visibleSize()` rectangle centered on a point, in world coordinates. */
export function centeredRect(size: Size, centerX: number, centerY: number): Rect {
    return {
        x: centerX - size.width / 2,
        y: centerY - size.height / 2,
        width: size.width,
        height: size.height,
    };
}

/** Screen edges obstructed by hardware (notch, Dynamic Island, home indicator). */
export interface Insets {
    readonly top: number;
    readonly right: number;
    readonly bottom: number;
    readonly left: number;
}

/** No obstruction — the desktop/browser default. */
export const NO_INSETS: Insets = { top: 0, right: 0, bottom: 0, left: 0 };

/**
 * The visible screen minus the hardware bands, in design coordinates.
 *
 * The insets arrive in CSS pixels and layout happens in design units, so each is
 * divided by the current `scale`. The rect is measured from `visibleBounds`, not
 * from the design box: on a letterboxed viewport (a tall phone, a wide desktop)
 * the screen extends past the design box, and edge-anchored chrome belongs out
 * there with it. Clamping each inset to half the visible dimension keeps an
 * aggressive notch from inverting the rectangle.
 */
export function safeAreaRect(insets: Insets, scale: number, visibleBounds: Rect): Rect {
    const top = Math.min(insets.top / scale, visibleBounds.height / 2);
    const bottom = Math.min(insets.bottom / scale, visibleBounds.height / 2);
    const left = Math.min(insets.left / scale, visibleBounds.width / 2);
    const right = Math.min(insets.right / scale, visibleBounds.width / 2);

    return {
        x: visibleBounds.x + left,
        y: visibleBounds.y + top,
        width: visibleBounds.width - left - right,
        height: visibleBounds.height - top - bottom,
    };
}

/**
 * Read the safe-area insets the page published as CSS variables.
 *
 * The values are lengths like `47px` or `0px`, so they are parsed rather than
 * trusted as numbers. Anything unreadable counts as zero: a missing inset only
 * ever means "assume nothing is obstructed", which is the pre-existing
 * behaviour, so a browser that hides `env()` degrades to the old layout instead
 * of breaking. Returns `NO_INSETS` outside a DOM (e.g. when unit-tested).
 */
export function readInsets(root: Nullable<HTMLElement>): Insets {
    if (!root || typeof getComputedStyle !== 'function') return NO_INSETS;

    const style = getComputedStyle(root);
    const read = (name: string): number => {
        const value = style.getPropertyValue(name).trim();
        const parsed = Number.parseFloat(value);
        return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
    };

    return {
        top: read('--safe-top'),
        right: read('--safe-right'),
        bottom: read('--safe-bottom'),
        left: read('--safe-left'),
    };
}

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

/**
 * Hole placement for the playfield.
 *
 * Pure geometry — no Pixi, no DOM — so it can be reasoned about (and unit
 * tested) in isolation, matching the style of `responsive/layout.ts`.
 *
 * The default `hex` layout is a honeycomb: circular holes pack more evenly on
 * a hexagonal lattice than on a square grid, and concentric rings read as a
 * capy den. Hit-testing is unaffected — holes are circles wherever they sit,
 * so `PlayScreen` only ever needs a point-in-circle check.
 */

export interface HoleSlot {
    /** Hole centre, in design/world units. */
    readonly x: number;
    readonly y: number;
    /** Radius of the hole opening. */
    readonly radius: number;
}

export type HoleLayout = 'hex' | 'grid';

export interface HoleLayoutOptions {
    /** Cluster centre, in design/world units. @default 0,0 */
    centerX?: number;
    centerY?: number;
    /** Distance between the centres of two adjacent holes. @default 230 */
    spacing?: number;
    /** Radius of one hole. @default 74 */
    radius?: number;
}

/**
 * Every axial coordinate within `radius` hex rings, nearest first.
 *
 * Flat-top lattice: axial `q` runs horizontally, `r` diagonally, and the
 * hex distance is `max(|q|, |r|, |q + r|)`.
 */
function axialCoordinates(radius: number): [number, number][] {
    const coords: [number, number][] = [];

    for (let q = -radius; q <= radius; q++) {
        const minR = Math.max(-radius, -q - radius);
        const maxR = Math.min(radius, -q + radius);
        for (let r = minR; r <= maxR; r++) {
            coords.push([q, r]);
        }
    }

    // Nearest ring first, then sweep around the ring so the order is stable.
    return coords.sort((a, b) => {
        const da = hexDistance(a[0], a[1]);
        const db = hexDistance(b[0], b[1]);
        if (da !== db) return da - db;
        return angleOf(a) - angleOf(b);
    });
}

function hexDistance(q: number, r: number): number {
    return Math.max(Math.abs(q), Math.abs(r), Math.abs(q + r));
}

function angleOf([q, r]: [number, number]): number {
    return Math.atan2(r + q / 2, q);
}

/** Honeycomb centres: 1 hole (ring 0), 7 (ring 1), 19 (ring 2), … */
function hexSlots(count: number, spacing: number, centerX: number, centerY: number): { x: number; y: number }[] {
    // Adjacent flat-top centres sit `sqrt(3) * size` apart; solve for `size`.
    const size = spacing / Math.sqrt(3);

    return axialCoordinates(Math.ceil(Math.sqrt(count))).slice(0, count).map(([q, r]) => ({
        x: centerX + size * 1.5 * q,
        y: centerY + size * Math.sqrt(3) * (r + q / 2),
    }));
}

/** Square-grid centres — the documented fallback if the honeycomb ever misbehaves. */
function gridSlots(count: number, spacing: number, centerX: number, centerY: number): { x: number; y: number }[] {
    const cols = Math.max(1, Math.ceil(Math.sqrt(count)));
    const rows = Math.ceil(count / cols);
    const cells: { x: number; y: number }[] = [];

    for (let i = 0; i < count; i++) {
        const row = Math.floor(i / cols);
        const col = i % cols;
        cells.push({
            x: centerX + (col - (cols - 1) / 2) * spacing,
            y: centerY + (row - (rows - 1) / 2) * spacing,
        });
    }

    return cells;
}

/** Lay out `count` hole centres for the requested arrangement. */
export function holeSlots(count: number, layout: HoleLayout, options: HoleLayoutOptions = {}): HoleSlot[] {
    const { centerX = 0, centerY = 0, spacing = 230, radius = 74 } = options;
    const clamped = Math.max(1, count);

    const cells =
        layout === 'grid' ? gridSlots(clamped, spacing, centerX, centerY) : hexSlots(clamped, spacing, centerX, centerY);

    return cells.map((cell) => ({ ...cell, radius }));
}

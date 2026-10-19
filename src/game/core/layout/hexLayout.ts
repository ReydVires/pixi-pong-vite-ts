/**
 * Hole placement for the playfield.
 *
 * Pure geometry — no Pixi, no DOM — so it can be reasoned about (and unit
 * tested) in isolation, matching the style of `responsive/layout.ts`.
 *
 * The default `hex` layout is a honeycomb: circular holes pack more evenly on
 * a hexagonal lattice than on a square grid, and concentric rings read as a
 * capy den. Rings are handed out whole, and an incomplete outer ring is filled
 * symmetrically about the centre line, so a den never looks like a pie with a
 * bite taken out of it.
 *
 * Hit-testing is unaffected — holes are circles wherever they sit, so
 * `PlayScreen` only ever needs a point-in-circle check.
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

/** Every point on ring `ring` of the honeycomb, swept in angle order. */
function axialRing(ring: number): [number, number][] {
    return axialCoordinates(ring).filter(([q, r]) => hexDistance(q, r) === ring);
}

/**
 * Take `n` points off one ring while keeping the ring's symmetry.
 *
 * A ring's points pair up under the mirror across the vertical centre line: the
 * mirror of `(q, r)` is `(-q, r + q)`. Only the points on the line itself are
 * their own mirror. So the picks come out in whole pairs, and an odd one left
 * over takes an axis point on whichever side the pairs are *not* leaning —
 * which recentres the cluster as well as mirroring it.
 *
 * Taking the first `n` round the ring instead is what made a four-hole
 * honeycomb read lopsided: `centre, up-left, up, up-right`, all three outer
 * holes crowded into the top of the field.
 */
function symmetricPick(ring: [number, number][], n: number): [number, number][] {
    const picked: [number, number][] = [];
    const axis: [number, number][] = [];
    const taken = new Set<string>();

    for (const [q, r] of ring) {
        // A point on the centre line is its own mirror; there are only ever two
        // per ring, and they are the odd ones out.
        if (q === 0) {
            axis.push([q, r]);
            continue;
        }

        const mirror: [number, number] = [-q, r + q];
        if (taken.has(`${mirror[0]},${mirror[1]}`)) continue;

        // Whole pairs only — half a pair is exactly the lopsidedness being
        // fixed here.
        if (picked.length + 2 <= n) picked.push([q, r], mirror);
        taken.add(`${q},${r}`);
    }

    if (picked.length < n) {
        // Which way the pairs lean, so the odd one can pull back against it.
        const lean = picked.reduce((sum, [q, r]) => sum + r + q / 2, 0);
        const odd = axis.find(([, r]) => Math.sign(r) !== Math.sign(lean)) ?? axis[0];
        if (odd) picked.push(odd);
    }

    return picked;
}

/** Honeycomb centres: 1 hole (ring 0), 7 (ring 1), 19 (ring 2), … */
function hexSlots(count: number, spacing: number, centerX: number, centerY: number): { x: number; y: number }[] {
    // Adjacent flat-top centres sit `sqrt(3) * size` apart; solve for `size`.
    const size = spacing / Math.sqrt(3);
    const placed: [number, number][] = [];

    // Whole rings in, then one last ring filled symmetrically. A whole ring is
    // symmetrical on its own, so it is only ever taken in one piece.
    for (let ring = 0; placed.length < count; ring++) {
        const points = axialRing(ring);
        placed.push(...(placed.length + points.length <= count ? points : symmetricPick(points, count - placed.length)));
    }

    return placed.map(([q, r]) => ({
        x: centerX + size * 1.5 * q,
        y: centerY + size * Math.sqrt(3) * (r + q / 2),
    }));
}

/** Square-grid centres — what the tutorial uses: four holes beat a honeycomb to learn on. */
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

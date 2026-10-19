import { Container, Graphics } from 'pixi.js';
import { COLORS } from '../config';
import { Entity } from '../core/entities/Entity';
import type { HoleSlot } from '../core/layout/hexLayout';

/**
 * One hole: a mound, the dark interior, a socket that holds the mouse, and a
 * front lip drawn *over* the socket.
 *
 * The lip is what sells the illusion. Mice are mounted into `socket`, so they
 * are sandwiched between the interior and the lip — they rise from behind the
 * near rim and sink below it, with no clipping needed.
 */
export class Hole extends Entity {
    readonly slot: HoleSlot;
    private readonly socket = new Container();

    constructor(slot: HoleSlot) {
        super();
        this.slot = slot;
        this.position.set(slot.x, slot.y);

        this.addChild(this.createInterior(), this.socket, this.createFrontLip());
    }

    /** True when no mouse currently occupies this hole. */
    get free(): boolean {
        return this.socket.children.length === 0;
    }

    /** Put a mouse into the hole. It will be drawn between interior and lip. */
    mount(child: Container): void {
        this.socket.addChild(child);
    }

    private createInterior(): Container {
        const { radius } = this.slot;
        const interior = new Container();
        interior.addChild(new Graphics().circle(0, 0, radius + 16).fill(COLORS.mound));
        interior.addChild(new Graphics().circle(0, 0, radius).fill(COLORS.pit));
        return interior;
    }

    private createFrontLip(): Container {
        const { radius } = this.slot;
        const lip = new Container();

        // Lower half of the pit, over the mouse, so its base sits *inside*.
        lip.addChild(new Graphics().poly(halfCircle(radius), true).fill(COLORS.pit));
        // The near rim: a ground-coloured curve that defines the hole's edge.
        lip.addChild(new Graphics().poly(halfCircle(radius + 14), false).stroke({ width: 6, color: COLORS.mound }));

        return lip;
    }
}

/** Points tracing the lower semicircle of a circle of `radius` (y grows downward). */
function halfCircle(radius: number): number[] {
    const points: number[] = [];
    const segments = 32;

    for (let i = 0; i <= segments; i++) {
        const angle = (i / segments) * Math.PI;
        points.push(Math.cos(angle) * radius, Math.sin(angle) * radius);
    }

    return points;
}

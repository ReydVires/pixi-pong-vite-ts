import { Container } from 'pixi.js';
import { COLORS, SCREEN_CENTER } from '../config';
import { createLabel } from '../core/display/label';
import { createSceneButton } from '../core/display/sceneButton';

/**
 * Vertical rhythm of the reveal, top to bottom.
 *
 * The lines above the present are packed as tightly as they are because the
 * capy has to spring out of the box *underneath* the title: its ears clear
 * `WISH_Y` even at the top of the pop's overshoot, on the lowest pass of the
 * box's hover at the same time.
 */
const NAME_Y = 64;
const WISH_Y = 128;
/**
 * The line under the present: the "tap it" hint before the reveal, the wish's
 * message after — never both.
 *
 * Exported because the screen draws its pre-reveal hint there, and the two
 * sharing a lane is what makes the hand-over read as one line replacing another.
 */
export const LOWER_TEXT_Y = 700;
/** Where the wish's primary button sits. */
const PRIMARY_Y = 860;
/** How long the wish takes to fade in once the box is open, in ms. */
const REVEAL_FADE_MS = 600;

/** Everything the wish shows. The screen passes the words; this renders them. */
export interface WishSpec {
    /** Small line above the title. */
    readonly name: string;
    readonly title: string;
    readonly message: string;
    /** The letter button was tapped. */
    readonly onReadLetter: () => void;
}

/**
 * The personal lines revealed when the present opens: name, title, message and
 * the letter button, built up front and hidden until then.
 *
 * Presentation only — the words arrive as a plain `WishSpec` (the screen reads
 * them from `CELEBRATION`), and the letter's navigation is a callback. Building
 * at open time would put text layout in the middle of the one moment that has
 * to feel smooth, so `reveal()` is a visibility flip and `update(dt)` a fade.
 *
 * Mount in `ui` where the celebration's text lives; tick `update(dt)` every
 * frame (the fade only runs once revealed).
 */
export class WishPanel {
    private readonly view = new Container();
    private revealed = false;

    constructor(ui: Container, spec: WishSpec) {
        const name = createLabel(spec.name, { fontSize: 30, fill: COLORS.star });
        name.anchor.set(0.5);
        name.position.set(SCREEN_CENTER.x, NAME_Y);
        this.view.addChild(name);

        const title = createLabel(spec.title, { fontSize: 60 });
        title.anchor.set(0.5);
        title.position.set(SCREEN_CENTER.x, WISH_Y);
        this.view.addChild(title);

        const message = createLabel(spec.message, {
            fontSize: 30,
            align: 'center',
            wordWrap: true,
            wordWrapWidth: 620,
        });
        message.anchor.set(0.5);
        message.position.set(SCREEN_CENTER.x, LOWER_TEXT_Y);
        this.view.addChild(message);

        // The letter was the promise the present made; the button now keeps it.
        // With `Menu` gone from the celebration it is the only control there, so
        // it takes the accent — opening it is also how the player leaves.
        const letter = createSceneButton('Read the letter', spec.onReadLetter, true);
        letter.position.set(SCREEN_CENTER.x, PRIMARY_Y);
        this.view.addChild(letter);

        this.view.visible = false;
        this.view.alpha = 0;
        ui.addChild(this.view);
    }

    /** Show the wish — a flip and a fade, never a rebuild. */
    reveal(): void {
        if (this.revealed) return;
        this.revealed = true;
        this.view.visible = true;
    }

    /** Tick the reveal's fade-in. */
    update(dt: number): void {
        if (this.view.visible && this.view.alpha < 1) {
            this.view.alpha = Math.min(1, this.view.alpha + dt / REVEAL_FADE_MS);
        }
    }
}

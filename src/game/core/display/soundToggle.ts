import { Container, Graphics } from 'pixi.js';
import { COLORS } from '../../config';
import type { AudioManager } from '../audio/AudioManager';

/** Sized like the pause button, so the two read as the same family. */
const WIDTH = 88;
const HEIGHT = 66;
const ICON = COLORS.white;

/**
 * A speaker button that toggles the audio manager's mute.
 *
 * It only talks to `AudioManager`, so any screen can drop one in. Muting is
 * drawn as well as switched — waves out when sound is on, a red slash across a
 * dimmed speaker when it is off — because the button has to answer "is this
 * thing on?" at a glance and without making a noise.
 *
 * Tapping it plays nothing itself: whether unmuting deserves a confirmation
 * click is the caller's call.
 */
export function createSoundToggle(audio: AudioManager): Container {
    const toggle = new Container();
    toggle.label = 'sound-toggle';
    toggle.eventMode = 'static';
    toggle.cursor = 'pointer';

    const background = new Graphics()
        .roundRect(-WIDTH / 2, -HEIGHT / 2, WIDTH, HEIGHT, 18)
        .fill({ color: COLORS.black, alpha: 0.35 })
        .stroke({ width: 3, color: ICON });

    // A cone seen from the side: the box, then the flare out to the right.
    const speaker = new Graphics()
        .poly([-23, -7, -11, -7, 4, -18, 4, 18, -11, 7, -23, 7])
        .fill(ICON);

    // One graphic per wave: a fresh path each, so `stroke()` never draws a
    // stray line joining the end of one arc to the start of the next.
    const waves = [12, 20].map((radius) =>
        new Graphics().arc(2, 0, radius, -Math.PI / 3, Math.PI / 3).stroke({ width: 4, color: ICON, cap: 'round' }),
    );

    const slash = new Graphics()
        .moveTo(-20, 20)
        .lineTo(20, -20)
        .stroke({ width: 6, color: COLORS.hazard, cap: 'round' });

    toggle.addChild(background, speaker, ...waves, slash);

    const refresh = (): void => {
        const dim = audio.muted ? 0.35 : 1;
        speaker.alpha = dim;
        for (const wave of waves) wave.alpha = dim;
        slash.visible = audio.muted;
    };
    refresh();

    toggle.on('pointerdown', () => {
        audio.toggleMuted();
        refresh();
    });

    return toggle;
}

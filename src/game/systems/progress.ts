import { FIRST_STAGE_ID, STAGES } from '../levels/stages';

/** Same naming scheme as the audio settings' key. */
const STORAGE_KEY = 'whack-a-capy:tutorial-done';

/**
 * What the player has already done, remembered across sessions.
 *
 * One flag today: whether the scripted tutorial has been *won*. Won rather
 * than merely played is deliberate — the results panel only offers to move on
 * once a star is earned, so that is the moment the handshake is over; a player
 * who is told to replay it has learned nothing that should be remembered.
 *
 * `localStorage` is the store, exactly like the audio settings, and every
 * access is wrapped: private-browsing modes and locked-down webviews throw on
 * touching it. A player with no storage simply gets the tutorial again — the
 * correct fallback, never a crash.
 */

/** Whether the tutorial has been won at least once. */
export function isTutorialDone(): boolean {
    try {
        return window.localStorage.getItem(STORAGE_KEY) === '1';
    } catch {
        return false;
    }
}

/** Remember the tutorial as won. A no-op where storage is unavailable. */
export function markTutorialDone(): void {
    try {
        window.localStorage.setItem(STORAGE_KEY, '1');
    } catch {
        // Remembering is a nicety, never a requirement.
    }
}

/**
 * The stage a fresh session starts at: the tutorial until it has been won,
 * then the first stage without script beats. Read from the table rather than
 * an index, so reordering stages — or scripting another one — needs no change
 * here.
 */
export function startingStageId(): string {
    if (!isTutorialDone()) return FIRST_STAGE_ID;
    return STAGES.find((stage) => !stage.tutorial)?.id ?? FIRST_STAGE_ID;
}

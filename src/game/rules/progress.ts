import { FIRST_STAGE_ID, STAGES } from '../levels/stages';

const TUTORIAL_KEY = 'whack-a-capy:tutorial-done';
const LETTER_KEY = 'whack-a-capy:letter-opened';

export function isTutorialDone(): boolean {
    try {
        return window.localStorage.getItem(TUTORIAL_KEY) === '1';
    } catch {
        return false;
    }
}

export function markTutorialDone(): void {
    try {
        window.localStorage.setItem(TUTORIAL_KEY, '1');
    } catch {
    }
}

export function isLetterOpened(): boolean {
    try {
        return window.localStorage.getItem(LETTER_KEY) === '1';
    } catch {
        return false;
    }
}

export function markLetterOpened(): void {
    try {
        window.localStorage.setItem(LETTER_KEY, '1');
    } catch {
    }
}

export function startingStageId(): string {
    if (!isTutorialDone()) return FIRST_STAGE_ID;
    return STAGES.find((stage) => !stage.tutorial)?.id ?? FIRST_STAGE_ID;
}

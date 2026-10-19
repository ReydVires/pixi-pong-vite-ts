import { Container } from 'pixi.js';
import type { Graphics, Text } from 'pixi.js';
import { Burst } from '../components/Burst';
import { Shockwave } from '../components/Shockwave';
import { ASSETS, COLORS, GAME_WIDTH, SCREENS, SCREEN_CENTER } from '../config';
import { createColorBackground, createTextureBackground } from '../core/display/background';
import { createButton } from '../core/display/button';
import { createLabel } from '../core/display/label';
import type { Unsubscribe } from '../core/input/PointerInput';
import { holeSlots } from '../core/layout/hexLayout';
import type { Responsive } from '../core/responsive/Responsive';
import type { Screen, ScreenContext } from '../core/screens/screen';
import { Hole } from '../entities/Hole';
import { Capy } from '../entities/Capy';
import { CAPY_TYPES } from '../levels/capyTypes';
import { findStage } from '../levels/stages';
import type { CapyTypeId, StageDef, TutorialStep } from '../levels/types';
import { ComboTracker } from '../systems/ComboTracker';
import { ScoreKeeper, starsFor, SWEEP_POINTS, tapOutcome } from '../systems/ScoreKeeper';
import type { TapOutcome } from '../systems/ScoreKeeper';
import { pickSpawn, Spawner } from '../systems/Spawner';
import type { BurstOptions } from '../systems/particles';
import { SessionClock, secondsRemaining } from '../systems/SessionClock';
import type { ResultsParams } from './ResultsScreen';

/** Centre of the honeycomb in design units — leaves room for HUD and prompt. */
const GRID_CENTER_Y = 560;
const HOLE_SPACING = 230;
const HOLE_RADIUS = 74;
/** Taps aim at hole centres, not exact pixels — keep it generous for thumbs. */
const TAP_RADIUS_SCALE = 1.1;
/** Above this line is HUD chrome (score/timer/pause), never playfield. */
const HUD_ZONE_Y = 170;
/** How long a wounded capy stays put so it can be finished off, in ms. */
const WOUND_GRACE_MS = 1500;
/**
 * Countdown drain rate — how hard the clock presses. 1 = real time; 1.5 means
 * a stage authored as 60s runs out in 40s of wall clock. Lives here rather than
 * in the stage table because it is a global feel knob, not a per-stage value.
 */
const CLOCK_RATE = 1.25;
/**
 * Extra drain rate added for every miss.
 *
 * The clock is not a metronome — it leans on you. Each whiff, escape and
 * mishit makes the rest of the stage tick away faster, so a sloppy run ends
 * sooner than a clean one. A nudge, not a cliff: ten misses turn 1.25 into 1.5.
 */
const MISS_CLOCK_STEP = 0.025;
/** Lifetime of a floating score popup, in ms. */
const POPUP_MS = 700;
/** Y of the HUD's top row — score, countdown and the pause button share it. */
const HUD_ROW_Y = 92;
/** The combo line hangs directly under the countdown, not off to one side. */
const COMBO_Y = 150;
/** How long the combo label stays punched after the multiplier steps up, in ms. */
const COMBO_PUNCH_MS = 260;
/** Extra scale at the start of that punch. */
const COMBO_PUNCH_SCALE = 0.4;
/** What a whack throws: fast and short, gone before the next capy arrives. */
const HIT_BURST = { count: 9, speed: [220, 640], lifeMs: [220, 420], size: [3, 7] } as const;
/** The lighter puff behind a wound, a hazard hit or an escape. */
const SOFT_BURST = { count: 6, speed: [140, 380], lifeMs: [200, 380], size: [2, 5] } as const;
/** What the golden's sweep throws — the largest handful in the game. */
const SWEEP_BURST = { count: 22, speed: [260, 900], lifeMs: [320, 640], size: [4, 9] } as const;
/** How long the gold wash of a sweep takes to fade, in ms. */
const SWEEP_FLASH_MS = 240;
/** How strong that wash gets: a tint over the field, not a whiteout. */
const SWEEP_FLASH_PEAK = 0.25;
/** How far a sweep's ring reaches — past the last hole on the widest layout. */
const SWEEP_RING_MS = 380;
/**
 * The kick a combo milestone gives the playfield.
 *
 * Short and small on purpose: hit testing reads the holes' own slots, so the
 * shake is decoration taps never see, and it has to be over before the player
 * needs to aim again. The amplitude dies with the square of the time left,
 * which is what makes it read as one hit rather than a wobble.
 */
const SHAKE_MS = 320;
const SHAKE_AMPLITUDE = 10;
/** Two rates, in ms per radian, so the axes never move as one neat wobble. */
const SHAKE_X_RATE = 21;
const SHAKE_Y_RATE = 14;
/** How much of the kick goes sideways — a field shakes more than it bounces. */
const SHAKE_Y_SCALE = 0.7;
/**
 * What the ladder shouts at each step up, keyed by multiplier.
 *
 * The shout replaces nothing: a milestone keeps its sparks and its score, and
 * gets this on top. There is no entry for x1, because the ladder starts there.
 */
const COMBO_WORDS: Record<number, string> = {
    2: 'NICE!',
    3: 'GREAT!',
    4: 'AWESOME!',
    5: 'UNSTOPPABLE!',
};
/** Lifetime of the shout, in ms. */
const COMBO_WORD_MS = 760;
/** Shout size — louder than the combo line it covers, quieter than a title. */
const COMBO_WORD_SIZE = 46;
/** Share of the life spent growing, so the shout erupts rather than fades in. */
const COMBO_WORD_POP = 0.22;
/** Scale it erupts from; it grows into its own size from here. */
const COMBO_WORD_FROM = 0.3;
/** Share of the life held at full strength; everything after that fades out. */
const COMBO_WORD_HOLD = 0.6;

export interface PlayParams {
    stageId: string;
}

interface Popup {
    label: Text;
    life: number;
}

/**
 * Runs one stage.
 *
 * The stage itself is data (`StageDef`); this screen owns the things data
 * can't express — which hole a capy goes in, what a tap means, and when the
 * stage is over. Scripted stages are driven by `tutorial`; random ones by
 * `Spawner` and a `SessionClock`.
 *
 * Hit testing is deliberately centralised: one `pointerdown` listener tests
 * every hittable capy, and a tap that hits none is a miss. That keeps
 * accuracy accounting honest, which a listener-per-capy would muddy.
 */
export class PlayScreen implements Screen<PlayParams> {
    private context: ScreenContext | null = null;
    private stage: StageDef | null = null;

    private readonly holes: Hole[] = [];
    private readonly capys: Capy[] = [];
    private readonly popups: Popup[] = [];
    private readonly bursts: Burst[] = [];
    private readonly shockwaves: Shockwave[] = [];
    private readonly pendingRetirement: Capy[] = [];

    private clock: SessionClock | null = null;
    private spawner: Spawner | null = null;

    private readonly score = new ScoreKeeper();
    private readonly combo = new ComboTracker();
    private hits = 0;
    private misses = 0;
    private spawned = 0;

    /** Scripted-stage progress. */
    private stepIndex = 0;
    private stepWhacks = 0;
    private stepElapsed = 0;
    private stepCooldown = 0;

    private finished = false;
    private paused = false;

    private popupLayer: Container | null = null;
    private fxLayer: Container | null = null;
    /** Everything the playfield is made of, so a milestone can kick all of it. */
    private field: Container | null = null;
    private sweepFlash: Graphics | null = null;
    /** Milliseconds left on the golden's full-screen wash. */
    private sweepFlashLeft = 0;
    /** Milliseconds left on the combo label's punch. */
    private comboPunch = 0;
    /** The ladder's shout, shown in place of the combo line while it plays. */
    private comboWord: Text | null = null;
    /** Milliseconds left on that shout; 0 means it is hidden. */
    private wordLeft = 0;
    /** Milliseconds left on the field's kick, and how far into it we are. */
    private shakeLeft = 0;
    private shakeTime = 0;
    private scoreLabel: Text | null = null;
    private comboLabel: Text | null = null;
    private timerLabel: Text | null = null;
    private promptLabel: Text | null = null;
    private pauseOverlay: Container | null = null;

    private stopTap: Unsubscribe | null = null;
    private stopPauseKey: Unsubscribe | null = null;

    init(context: ScreenContext, params: PlayParams): void {
        const { world, ui, assets, input, keyboard, responsive } = context;

        const stage = findStage(params.stageId);
        this.context = context;
        this.stage = stage;

        world.addChild(createColorBackground(COLORS.playfield, responsive));
        world.addChild(createTextureBackground(assets.texture(ASSETS.background), responsive, 0.45));

        const slots = holeSlots(stage.holes, stage.layout, {
            centerX: SCREEN_CENTER.x,
            centerY: GRID_CENTER_Y,
            spacing: HOLE_SPACING,
            radius: HOLE_RADIUS,
        });
        // Everything the whack happens *to*, in one container. This is what a
        // combo milestone kicks, which is why the backdrop stays out of it
        // (moving it would show the letterbox edges) and why the HUD lives in
        // `ui` (a shaking score is a score nobody can read).
        this.field = new Container();
        world.addChild(this.field);

        for (const slot of slots) {
            const hole = new Hole(slot);
            this.holes.push(hole);
            this.field.addChild(hole);
        }

        // Effects sit above the holes — a whack's sparks should cover the mound
        // they came out of — but below the popups, so a floating score is never
        // buried under its own explosion.
        this.fxLayer = new Container();
        this.field.addChild(this.fxLayer);

        // Added last on purpose: score popups float above the mound they rise
        // from. Adding this layer before the holes tucks every "+10" behind
        // the hole, so it vanishes as soon as it drifts over one.
        this.popupLayer = new Container();
        this.field.addChild(this.popupLayer);

        this.createHud(ui, responsive);

        if (stage.durationMs !== null) {
            this.clock = new SessionClock(stage.durationMs, CLOCK_RATE);
            this.spawner = new Spawner({
                intervalMs: stage.spawnIntervalMs,
                maxConcurrent: stage.maxConcurrent,
            });
            this.timerLabel!.visible = true;
        }

        // A stage can be timed *and* scripted — the tutorial is both.
        this.promptLabel!.text = stage.tutorial ? stage.tutorial[0].prompt : stage.title;

        this.stopTap = input.on((event) => {
            const point = responsive.toWorld(event);
            this.handleTap(point.x, point.y);
        });
        this.stopPauseKey = keyboard.onKeyDown('Escape', () => this.togglePause());

        this.updateHud();
    }

    update(dt: number): void {
        const stage = this.stage;
        if (!stage || this.paused || this.finished) return;

        if (this.clock) {
            this.clock.update(dt);
            this.updateHud();
            if (this.clock.expired) {
                this.finish();
                return;
            }
        }

        if (stage.tutorial) this.updateTutorialStage(dt, stage);
        else this.updateRandomStage(dt, stage);

        // A transition may have started above — don't touch torn-down state.
        if (this.finished) return;

        for (const capy of this.capys) capy.update(dt);
        this.flushRetired();
        this.updatePopups(dt);
        this.updateEffects(dt);
    }

    destroy(): void {
        this.stopTap?.();
        this.stopPauseKey?.();
        this.stopTap = null;
        this.stopPauseKey = null;

        for (const popup of this.popups) popup.label.destroy();
        this.popups.length = 0;
        this.bursts.length = 0;
        this.shockwaves.length = 0;
        this.pendingRetirement.length = 0;
        this.capys.length = 0;
        this.holes.length = 0;

        this.context = null;
        this.stage = null;
        this.clock = null;
        this.spawner = null;
        this.popupLayer = null;
        this.fxLayer = null;
        this.field = null;
        this.sweepFlash = null;
        this.sweepFlashLeft = 0;
        this.comboPunch = 0;
        this.comboWord = null;
        this.wordLeft = 0;
        this.shakeLeft = 0;
        this.shakeTime = 0;
        this.scoreLabel = null;
        this.comboLabel = null;
        this.timerLabel = null;
        this.promptLabel = null;
        this.pauseOverlay = null;
    }

    // --- Random stages ------------------------------------------------------

    private updateRandomStage(dt: number, stage: StageDef): void {
        const spawner = this.spawner;
        if (!spawner) return;

        if (spawner.update(dt, this.capys.length)) {
            const hole = this.pickFreeHole();
            if (hole) this.spawn(pickSpawn(stage.spawn), hole, false);
        }
    }

    // --- Scripted (tutorial) stages ----------------------------------------

    private updateTutorialStage(dt: number, stage: StageDef): void {
        const steps = stage.tutorial;
        if (!steps || this.stepIndex >= steps.length) {
            this.finish();
            return;
        }

        const step: TutorialStep = steps[this.stepIndex];
        this.stepElapsed += dt;
        this.stepCooldown -= dt;

        const quotaMet = step.quota !== undefined && this.stepWhacks >= step.quota;
        const timeMet = step.durationMs !== undefined && this.stepElapsed >= step.durationMs;
        const stepComplete = quotaMet || timeMet;

        // Stop spawning once the step is satisfied, then wait for the field to
        // clear so the next prompt never arrives on top of a live capy.
        if (!stepComplete && this.stepCooldown <= 0 && this.capys.length < step.concurrent) {
            const hole = this.pickFreeHole();
            if (hole) {
                this.spawn('normal', hole, step.hold ?? false);
                this.stepCooldown = Math.max(0, step.intervalMs);
            }
        }

        if (stepComplete && this.capys.length === 0) this.advanceStep();
    }

    private advanceStep(): void {
        const steps = this.stage?.tutorial;
        if (!steps) return;

        this.stepIndex += 1;
        this.stepWhacks = 0;
        this.stepElapsed = 0;
        this.stepCooldown = 300;

        if (this.stepIndex >= steps.length) {
            this.finish();
            return;
        }

        this.promptLabel!.text = steps[this.stepIndex].prompt;
    }

    // --- Taps ----------------------------------------------------------------

    private handleTap(x: number, y: number): void {
        if (this.paused || this.finished) return;

        const target = this.capys.find((capy) => capy.emerge.hittable && capy.near(x, y, TAP_RADIUS_SCALE));
        if (target) {
            if (target.type.harmful) this.strikeHazard(target);
            else this.whack(target);
            return;
        }

        // A whiff. Skip the HUD strip — tapping pause isn't a miss — and skip
        // the moment before the first spawn, so it doesn't poison accuracy.
        if (y < HUD_ZONE_Y || this.spawned === 0) return;

        this.recordMiss();
        // Answered, not silent: without this the tap looks ignored, because the
        // only other sign is a combo label the player may not have had. The
        // tutorial is the exception — it introduces the verb, not the scolding,
        // so the red "Miss!" arrives with Stage 1. The tally still moves.
        if (!this.stage?.tutorial) this.addPopup('Miss!', x, y - 46, COLORS.hazard);
        this.updateHud();
    }

    private whack(capy: Capy): void {
        const downed = capy.hitTarget.hit();
        capy.flash();
        // Always redraw, not just on a wound: the finishing blow has to clear
        // the last pip too, or a downed `tough` sinks away still showing one.
        capy.refreshHealth();

        // Every tap gets sparks; the finishing blow throws the bigger handful,
        // so a wound still reads as an event rather than a no-op.
        this.spray(capy, downed ? HIT_BURST : SOFT_BURST);

        if (!downed) {
            // Still ticking, so it gets a moment to be finished rather than
            // slipping away between taps. A wounded `runner` spends that
            // moment stood still — and hops the instant it is over.
            if (capy.type.staysWhenHit) capy.emerge.retain(WOUND_GRACE_MS);
            return;
        }

        capy.markSettled();
        this.apply(capy, tapOutcome(capy.type, this.combo.multiplier));

        // The whole point of a `golden`: it takes the rest of the field with it.
        if (capy.type.effect === 'clear') this.clearField(capy);

        capy.emerge.retreat();
    }

    /**
     * A tap that lands on a hazard.
     *
     * The penalty is flat rather than combo-scaled, the streak breaks, and it
     * counts against accuracy — a bad tap is still a tap. Tapping it is the
     * mistake; letting a bomb sink away again is correct play, which is why
     * `flushRetired` spares hazards the miss it charges everything else.
     */
    private strikeHazard(capy: Capy): void {
        capy.flash();
        capy.markSettled();
        this.spray(capy, SOFT_BURST, COLORS.hazard);
        this.apply(capy, tapOutcome(capy.type, this.combo.multiplier));
        capy.emerge.retreat();
    }

    /**
     * A clear effect sweeps the rest of the live field.
     *
     * Every capy still up pays the same flat, type-blind bounty — the `golden`
     * does not care what it caught, so a bomb is a payout rather than a hazard.
     * Nothing was tapped, so the sweep leaves the combo and the accuracy tally
     * alone; it is points and spectacle, nothing else.
     *
     * Only capys a tap could still have reached (`hittable`): one that has
     * already started sinking escaped on its own, and sweeping it would hand
     * back points *and* cancel the miss it has coming in `flushRetired`.
     */
    private clearField(resolved: Capy): void {
        // The payoff, all in one place: a ring out from the golden, a wash of
        // gold over the whole screen, sparks on everything it caught, and a
        // label loud enough to explain the sudden pile of points.
        const { x, y } = resolved.hole.slot;
        this.addShockwave(x, y);
        this.spray(resolved, SWEEP_BURST);
        this.sweepFlashLeft = SWEEP_FLASH_MS;
        this.addPopup('CLEAR!', x, y - HOLE_RADIUS - 46, COLORS.star, 56);

        for (const capy of [...this.capys]) {
            if (capy === resolved || !capy.emerge.hittable) continue;

            capy.markSettled();
            if (!capy.type.harmful) {
                capy.hitTarget.forceDown();
                capy.refreshHealth();
            }

            this.spray(capy, SOFT_BURST);
            this.payBounty(capy, SWEEP_POINTS);
            capy.emerge.retreat();
        }
    }

    /**
     * Apply one resolved interaction — the single place points, streak, the
     * tally and the popup all move together.
     *
     * A non-scoring outcome can only come from deliberately tapping a hazard,
     * so it counts against accuracy and breaks the streak.
     */
    private apply(capy: Capy, outcome: TapOutcome): void {
        if (outcome.hit) {
            const before = this.combo.multiplier;
            this.combo.recordHit();
            this.hits += 1;
            this.stepWhacks += 1;
            // The ladder stepping up is the moment worth answering, not just
            // reporting — so the label punches, the field kicks and the ladder
            // shouts, all from the same frame.
            if (this.combo.multiplier > before) this.celebrateCombo(this.combo.multiplier);
        } else {
            this.recordMiss();
        }

        this.payBounty(capy, outcome.points);
    }

    /**
     * Charge one miss: the tally, the streak, and the clock.
     *
     * The one place a miss is recorded, so no path can forget one — every whiff,
     * escape and mishit presses on the countdown alike, which is how a sloppy
     * run ends up shorter than a clean one.
     */
    private recordMiss(): void {
        this.misses += 1;
        this.combo.recordMiss();
        this.clock?.hurry(MISS_CLOCK_STEP);
    }

    /**
     * Bank points without touching the combo or the tally — a bounty, not a
     * tap. The one place score and popup stay in step for every payment.
     */
    private payBounty(capy: Capy, points: number): void {
        this.score.add(points);
        this.spawnPopup(capy, points);
        this.updateHud();
    }

    // --- Spawning -----------------------------------------------------------

    private pickFreeHole(): Hole | null {
        const free = this.holes.filter((hole) => hole.free);
        if (free.length === 0) return null;
        return free[Math.floor(Math.random() * free.length)];
    }

    private spawn(typeId: CapyTypeId, hole: Hole, hold: boolean): void {
        const capy = new Capy(CAPY_TYPES[typeId], hole, hold);

        capy.onRetreated = () => this.pendingRetirement.push(capy);
        hole.mount(capy);
        this.capys.push(capy);
        this.spawned += 1;
        capy.start();
    }

    /** Free holes that finished sinking away, and score any that escaped. */
    private flushRetired(): void {
        if (this.pendingRetirement.length === 0) return;

        for (const capy of this.pendingRetirement.splice(0)) {
            // A hopper that is not done yet came up *somewhere else*; the
            // retreat the screen just watched was a move, not an escape.
            if (this.tryHop(capy)) continue;

            // A hazard letting itself out is the player playing correctly, not a
            // miss — so it costs no accuracy and breaks no streak.
            // Leaving is silent on purpose: sparks belong to taps, and a capy
            // sinking on its own should not look like one landed.
            if (!capy.isSettled && !capy.type.harmful) {
                this.recordMiss();
                this.updateHud();
            }

            const index = this.capys.indexOf(capy);
            if (index !== -1) this.capys.splice(index, 1);

            capy.onRetreated = null;
            capy.parent?.removeChild(capy);
            capy.destroy({ children: true });
        }
    }

    /**
     * Let a hopper come up in a different hole rather than let it go.
     *
     * It was already sinking — that is the only reason it is in hand — so all
     * this changes is where it arrives, and the player's second tap has to
     * travel rather than repeat. `false` means it really has gone, and the
     * caller books the escape it looked like.
     */
    private tryHop(capy: Capy): boolean {
        // Only an *escape* can turn into a move. A settled capy was whacked (or
        // swept), so it is on its way down for good — if this could hop, a
        // finished runner would pop back up with no pips left.
        if (capy.isSettled || !capy.canHop) return false;

        // Nowhere to run to means the move is forfeit and it is simply gone.
        // Only reachable when the field is packed, since it frees its own hole
        // on the way out — so it is the calm fallback, not the common case.
        const free = this.holes.filter((hole) => hole.free);
        if (free.length === 0) return false;

        capy.hopTo(free[Math.floor(Math.random() * free.length)]);
        capy.start();
        return true;
    }

    // --- Stage end ----------------------------------------------------------

    /**
     * End the stage. Every path — beating it *or* running out of clock — goes
     * through Results, so the player always sees score, stars and accuracy.
     */
    private finish(): void {
        const stage = this.stage;
        if (!stage || this.finished) return;
        this.finished = true;

        const attempts = this.hits + this.misses;
        const results: ResultsParams = {
            stageId: stage.id,
            score: this.score.score,
            hits: this.hits,
            misses: this.misses,
            accuracy: attempts > 0 ? this.hits / attempts : 0,
            bestCombo: this.combo.bestCount,
            stars: starsFor(this.score.score, stage.starThresholds),
        };

        // Results owns what comes next: the next stage, or the celebration.
        void this.context?.screens.start(SCREENS.Results, results);
    }

    // --- HUD ----------------------------------------------------------------

    private createHud(ui: Container, responsive: Responsive): void {
        this.scoreLabel = createLabel('0', { fontSize: 52 });
        this.scoreLabel.anchor.set(0, 0.5);
        this.scoreLabel.position.set(56, HUD_ROW_Y);
        ui.addChild(this.scoreLabel);

        this.timerLabel = createLabel('0', { fontSize: 52 });
        this.timerLabel.anchor.set(0.5, 0.5);
        this.timerLabel.position.set(SCREEN_CENTER.x, HUD_ROW_Y);
        this.timerLabel.visible = false;
        ui.addChild(this.timerLabel);

        this.comboLabel = createLabel('', { fontSize: 26, fill: COLORS.star });
        this.comboLabel.anchor.set(0.5, 0.5);
        this.comboLabel.position.set(SCREEN_CENTER.x, COMBO_Y);
        ui.addChild(this.comboLabel);

        // The milestone's shout: the combo line's own spot, so the ladder's
        // answer arrives exactly where the ladder is read. Built once and
        // re-shown, because a shout is a visibility flip — not new text laid
        // out in the middle of a tap.
        this.comboWord = createLabel('', {
            fontSize: COMBO_WORD_SIZE,
            fill: COLORS.star,
            stroke: { width: 5 },
        });
        this.comboWord.anchor.set(0.5, 0.5);
        this.comboWord.position.set(SCREEN_CENTER.x, COMBO_Y);
        this.comboWord.visible = false;
        ui.addChild(this.comboWord);

        this.promptLabel = createLabel('', { fontSize: 30 });
        this.promptLabel.anchor.set(0.5, 0.5);
        this.promptLabel.position.set(SCREEN_CENTER.x, 950);
        ui.addChild(this.promptLabel);

        const pause = createButton('II', () => this.togglePause(), { width: 84, height: 62, fontSize: 26 });
        pause.position.set(GAME_WIDTH - 72, HUD_ROW_Y);
        ui.addChild(pause);

        // The golden's wash, invisible until a sweep fires it. Added before the
        // pause overlay so pausing still dims over the top of it, and left
        // non-interactive so it can never swallow a tap.
        this.sweepFlash = createColorBackground(COLORS.star, responsive);
        this.sweepFlash.alpha = 0;
        ui.addChild(this.sweepFlash);

        this.pauseOverlay = this.createPauseOverlay(responsive);
        this.pauseOverlay.visible = false;
        ui.addChild(this.pauseOverlay);
    }

    private createPauseOverlay(responsive: Responsive): Container {
        const overlay = new Container();

        // Full-bleed dim over the *visible* area, not the design rect — the
        // design rect is contain-scaled, so a fixed 768x1024 dim leaves the
        // letterbox margins (left/right in landscape, above/below in portrait)
        // uncovered and gameplay still visible outside the overlay.
        const dim = createColorBackground(COLORS.black, responsive, 0.65);
        dim.eventMode = 'static'; // swallow taps meant for the playfield
        overlay.addChild(dim);

        const title = createLabel('Paused', { fontSize: 64 });
        title.anchor.set(0.5);
        title.position.set(SCREEN_CENTER.x, SCREEN_CENTER.y - 140);
        overlay.addChild(title);

        const resume = createButton('Resume', () => this.togglePause());
        resume.position.set(SCREEN_CENTER.x, SCREEN_CENTER.y);
        overlay.addChild(resume);

        const quit = createButton(
            'Quit to Menu',
            () => {
                this.paused = false;
                void this.context?.screens.start(SCREENS.MainMenu);
            },
            { fill: 0x3a3f4b },
        );
        quit.position.set(SCREEN_CENTER.x, SCREEN_CENTER.y + 110);
        overlay.addChild(quit);

        return overlay;
    }

    private togglePause(): void {
        this.paused = !this.paused;
        if (this.pauseOverlay) this.pauseOverlay.visible = this.paused;
    }

    private updateHud(): void {
        if (this.scoreLabel) this.scoreLabel.text = `${this.score.score}`;

        if (this.comboLabel) {
            const { multiplier, count } = this.combo;
            this.comboLabel.text = count > 0 ? `x${multiplier}  combo ${count}` : '';
        }

        if (this.timerLabel && this.clock) {
            this.timerLabel.text = `${secondsRemaining(this.clock.remainingMs)}`;
        }
    }

    // --- Juice --------------------------------------------------------------

    /**
     * A step up the combo ladder: punch the line, kick the field, shout it.
     *
     * The whack that caused this already threw its own sparks, so a milestone
     * adds weight and a word rather than more particles — the ladder should feel
     * like a new tier, not like a slightly bigger hit. The word lands on the
     * combo line it answers, which is the one band free in every layout: under
     * the HUD, clear of the topmost hole and its own score popup.
     */
    private celebrateCombo(multiplier: number): void {
        this.comboPunch = COMBO_PUNCH_MS;
        this.shakeLeft = SHAKE_MS;
        this.shakeTime = 0;

        const label = this.comboWord;
        const word = COMBO_WORDS[multiplier];
        // A ladder longer than the table still gets its kick, just no word.
        if (!label || !word) return;

        label.text = word;
        label.visible = true;
        label.alpha = 1;
        label.scale.set(COMBO_WORD_FROM);
        this.wordLeft = COMBO_WORD_MS;
    }

    /**
     * Throw a burst of sparks out of `capy`'s hole, in its own colour.
     *
     * Position comes from the hole, not the capy, so a `runner` that just moved
     * still throws its sparks where the tap actually landed — hit testing reads
     * the same slot, so the sparks and the popup never disagree.
     */
    private spray(capy: Capy, options: Omit<BurstOptions, 'x' | 'y'>, color: number = capy.type.color): void {
        if (!this.fxLayer) return;

        const burst = new Burst(color, { ...options, x: capy.hole.slot.x, y: capy.hole.slot.y });
        this.fxLayer.addChild(burst);
        this.bursts.push(burst);
    }

    /** The ring a clear leaves behind, reaching out across the whole honeycomb. */
    private addShockwave(x: number, y: number): void {
        if (!this.fxLayer) return;

        const wave = new Shockwave({
            x,
            y,
            fromRadius: HOLE_RADIUS,
            toRadius: HOLE_SPACING * 1.7,
            ms: SWEEP_RING_MS,
            color: COLORS.star,
        });
        this.fxLayer.addChild(wave);
        this.shockwaves.push(wave);
    }

    private spawnPopup(capy: Capy, points: number): void {
        this.addPopup(
            `${points >= 0 ? '+' : ''}${points}`,
            capy.hole.slot.x,
            capy.hole.slot.y - HOLE_RADIUS - 46,
            points >= 0 ? COLORS.star : COLORS.hazard,
        );
    }

    /**
     * Float any label above the popup layer, e.g. "Miss!" for a whiff. Sharing
     * this with score popups keeps rise speed and fade identical for both.
     */
    private addPopup(text: string, x: number, y: number, fill: number, fontSize = 36): void {
        if (!this.popupLayer) return;

        const label = createLabel(text, {
            fontSize,
            fill,
            stroke: { color: COLORS.black, width: 3 },
        });
        label.anchor.set(0.5);
        label.position.set(x, y);

        this.popupLayer.addChild(label);
        this.popups.push({ label, life: 0 });
    }

    private updatePopups(dt: number): void {
        for (let i = this.popups.length - 1; i >= 0; i--) {
            const popup = this.popups[i];
            popup.life += dt;
            popup.label.y -= 0.05 * dt;
            popup.label.alpha = Math.max(0, 1 - popup.life / POPUP_MS);

            if (popup.life >= POPUP_MS) {
                popup.label.destroy();
                this.popups.splice(i, 1);
            }
        }
    }

    /**
     * Take the kick, then put the field back exactly where it belongs.
     *
     * Both axes start at zero and the amplitude dies with the clock left, so
     * the field is never snapped sideways the frame a shout lands, and never
     * left sitting off-centre once the kick is over.
     */
    private updateShake(dt: number): void {
        const field = this.field;
        if (!field) return;

        if (this.shakeLeft <= 0) {
            if (field.x !== 0 || field.y !== 0) field.position.set(0, 0);
            return;
        }

        this.shakeLeft = Math.max(0, this.shakeLeft - dt);
        this.shakeTime += dt;

        const amp = SHAKE_AMPLITUDE * (this.shakeLeft / SHAKE_MS) ** 2;
        field.position.set(
            Math.sin(this.shakeTime / SHAKE_X_RATE) * amp,
            Math.sin(this.shakeTime / SHAKE_Y_RATE) * amp * SHAKE_Y_SCALE,
        );
    }

    /**
     * Play the shout out — grow in, hold, fade — and hand the combo line back.
     *
     * The plain line is hidden while the shout is up rather than showing through
     * it, and comes back reading whatever the streak is by then, so a miss taken
     * during the shout still lands in the label.
     */
    private updateComboWord(dt: number): void {
        const label = this.comboWord;
        if (!label) return;

        if (this.wordLeft > 0) {
            this.wordLeft = Math.max(0, this.wordLeft - dt);

            const t = 1 - this.wordLeft / COMBO_WORD_MS;
            const grow = 1 - (1 - Math.min(1, t / COMBO_WORD_POP)) ** 2;
            const fade = 1 - Math.max(0, t - COMBO_WORD_HOLD) / (1 - COMBO_WORD_HOLD);

            label.scale.set(COMBO_WORD_FROM + (1 - COMBO_WORD_FROM) * grow);
            label.alpha = Math.max(0, fade);

            if (this.wordLeft === 0) label.visible = false;
        }

        if (this.comboLabel) this.comboLabel.visible = this.wordLeft <= 0;
    }

    /**
     * Tick the one-shot effects and drop the ones that have played out.
     *
     * Each effect reports its own `finished` rather than the screen timing it,
     * so adding another kind is a new array and one more loop, not a new timer.
     * The combo punch and the kick live here too: they are per-frame decoration,
     * and nothing else is guaranteed to run every frame once the countdown is
     * gone.
     */
    private updateEffects(dt: number): void {
        for (let i = this.bursts.length - 1; i >= 0; i--) {
            const burst = this.bursts[i];
            burst.update(dt);
            if (!burst.finished) continue;

            burst.destroy({ children: true });
            this.bursts.splice(i, 1);
        }

        for (let i = this.shockwaves.length - 1; i >= 0; i--) {
            const wave = this.shockwaves[i];
            wave.update(dt);
            if (!wave.finished) continue;

            wave.destroy({ children: true });
            this.shockwaves.splice(i, 1);
        }

        if (this.sweepFlashLeft > 0) {
            this.sweepFlashLeft = Math.max(0, this.sweepFlashLeft - dt);
            if (this.sweepFlash) this.sweepFlash.alpha = SWEEP_FLASH_PEAK * (this.sweepFlashLeft / SWEEP_FLASH_MS);
        }

        if (this.comboPunch > 0) this.comboPunch = Math.max(0, this.comboPunch - dt);
        if (this.comboLabel) this.comboLabel.scale.set(1 + COMBO_PUNCH_SCALE * (this.comboPunch / COMBO_PUNCH_MS));

        this.updateShake(dt);
        this.updateComboWord(dt);
    }
}

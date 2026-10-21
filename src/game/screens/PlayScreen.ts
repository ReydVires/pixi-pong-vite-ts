import { Container } from 'pixi.js';
import { SFX } from '../audio/sfx';
import { ASSETS, COLORS, SCREENS, SCREEN_CENTER } from '../config';
import { createColorBackground, createTextureBackground } from '../core/display/background';
import type { OverlayAction } from '../core/display/overlay';
import type { Unsubscribe } from '../core/input/PointerInput';
import { holeSlots } from '../core/layout/hexLayout';
import type { Screen, ScreenContext } from '../core/screens/screen';
import type { Nullable } from '../core/types';
import { PlayHud, HUD_ZONE_Y } from '../ui/PlayHud';
import { PausePanel } from '../ui/PausePanel';
import { ResultsPanel } from '../ui/ResultsPanel';
import { SweepWash } from '../ui/SweepWash';
import { Hole } from '../entities/Hole';
import { Capy } from '../entities/Capy';
import { Shake } from '../components/Shake';
import { Entity } from '../core/entities/Entity';
import { CAPY_TYPES } from '../levels/capyTypes';
import { findNextStage, findStage, isFinaleStage } from '../levels/stages';
import type { CapyTypeId, StageDef } from '../levels/types';
import { canAdvance } from '../systems/ScoreKeeper';
import { ComboTracker } from '../systems/ComboTracker';
import { markTutorialDone } from '../systems/progress';
import { ScoreKeeper, starsFor, SWEEP_POINTS, tapOutcome } from '../systems/ScoreKeeper';
import type { TapOutcome } from '../systems/ScoreKeeper';
import { EffectsSystem } from '../systems/EffectsSystem';
import { PopupsSystem } from '../systems/PopupsSystem';
import { pickSpawn, Spawner } from '../systems/Spawner';
import type { BurstOptions } from '../systems/particles';
import { SessionClock, secondsRemaining } from '../systems/SessionClock';
import { TutorialRunner } from '../systems/TutorialRunner';

/** Centre of the honeycomb in design units — leaves room for HUD and prompt. */
const GRID_CENTER_Y = 560;
const HOLE_SPACING = 230;
const HOLE_RADIUS = 74;
/** Taps aim at hole centres, not exact pixels — keep it generous for thumbs. */
const TAP_RADIUS_SCALE = 1.1;
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
/** What a whack throws: fast and short, gone before the next capy arrives. */
const HIT_BURST = { count: 9, speed: [220, 640], lifeMs: [220, 420], size: [6.9, 12.65], shape: 'star' } as const;
/** The lighter star burst behind a wound, a hazard hit or an escape. */
const SOFT_BURST = { count: 6, speed: [140, 380], lifeMs: [200, 380], size: [4, 8], shape: 'star' } as const;
/** What the golden's sweep throws — the largest handful in the game. */
const SWEEP_BURST = { count: 22, speed: [260, 900], lifeMs: [320, 640], size: [4, 9] } as const;
/** How far a sweep's ring reaches — past the last hole on the widest layout. */
const SWEEP_RING_MS = 380;
/**
 * How far below their hole the sweep's `+20`s float.
 *
 * The big "CLEAR!" is drawn at the golden's own hole, one hole-height up; at the
 * default height a swept capy's score lands on top of it and the two read as one
 * illegible smear. Dropping them a whole hole further keeps the word the
 * headline and the scores the trailing detail.
 */
const SWEEP_POPUP_DROP = 96;
/**
 * How far the "CLEAR!" headline rides above the popup lane.
 *
 * Enough to clear the golden's own `+N`, which `apply` draws at the standard
 * height before this runs. The headline is the biggest text in the game, so it
 * needs the most room.
 */
const CLEAR_TITLE_LIFT = 58;

export interface PlayParams {
    stageId: string;
}

/**
 * What the screen is doing right now.
 *
 * Three modes, and exactly one is ever held: the screen stores a single
 * `PlayMode`, not a `paused`/`finished` pair. With two booleans the combination
 * "paused *and* finished" is representable and every reader has to know which
 * one wins; one slot rules it out entirely.
 *
 * `playing` is the only mode in which the run is live: it is the only one the
 * clock, the spawner and taps move.
 */
export type PlayMode = 'playing' | 'paused' | 'finished';

/**
 * Runs one stage.
 *
 * The stage itself is data (`StageDef`); this screen owns the things data
 * can't express — which hole a capy goes in, what a tap means, and when the
 * stage is over. Scripted stages are driven by a `TutorialRunner`; random ones
 * by `Spawner` and a `SessionClock`. Presentation lives in composed units:
 * `PlayHud`, `ResultsPanel`, `PausePanel`, `SweepWash`, `PopupsSystem` and
 * `EffectsSystem` — this class reports values and rules to them rather than
 * drawing them itself.
 *
 * Hit testing is deliberately centralised: one `pointerdown` listener tests
 * every hittable capy, and a tap that hits none is a miss. That keeps
 * accuracy accounting honest, which a listener-per-capy would muddy.
 */
export class PlayScreen implements Screen<PlayParams> {
    private context: Nullable<ScreenContext> = null;
    private stage: Nullable<StageDef> = null;

    private readonly holes: Hole[] = [];
    private readonly capys: Capy[] = [];
    private readonly pendingRetirement: Capy[] = [];

    private clock: Nullable<SessionClock> = null;
    private spawner: Nullable<Spawner> = null;

    private readonly scoreKeeper = new ScoreKeeper();
    private readonly combo = new ComboTracker();
    private hits = 0;
    private misses = 0;
    private spawned = 0;

    /** Scripted-stage progress, when the stage has a script to follow. */
    private tutorial: Nullable<TutorialRunner> = null;

    /**
     * The screen's current mode, as a single stored value.
     *
     * Deliberately one field rather than a `paused`/`finished` pair: with two
     * booleans the combination `paused && finished` is representable, and every
     * reader has to know which one wins. One slot makes that combination
     * impossible to hold, not merely impossible to observe.
     *
     * Read it freely; never write it. `enter()` is the only way in.
     */
    private state: PlayMode = 'playing';

    /** The screen's current mode. */
    get mode(): PlayMode {
        return this.state;
    }

    /**
     * The one place a transition happens.
     *
     * Keeping it here means the legal moves are readable in a single spot, and
     * a mode can never be set from two places that disagree — which is how the
     * ESC-over-results bug arose when `paused` and `finished` moved apart.
     */
    private enter(next: PlayMode): void {
        this.state = next;
    }

    private popups: Nullable<PopupsSystem> = null;
    private effects: Nullable<EffectsSystem> = null;
    /** Everything the playfield is made of, so a milestone can kick all of it. */
    private field: Nullable<Entity> = null;
    /** The field's kick, composed as a component rather than timed by the screen. */
    private shake: Nullable<Shake> = null;
    /** The golden's sweep wash — presentation for the `clear` effect's rule. */
    private sweepWash: Nullable<SweepWash> = null;
    /** The pause menu — chrome around this screen's `playing`/`paused` state. */
    private pause: Nullable<PausePanel> = null;
    /** The HUD: score, countdown, combo line, prompt, pause button — and their animations. */
    private hud: Nullable<PlayHud> = null;
    /** The end-of-stage results panel, mounted when the run ends. */
    private results: Nullable<ResultsPanel> = null;

    private stopTap: Nullable<Unsubscribe> = null;
    private stopPauseKey: Nullable<Unsubscribe> = null;

    init(context: ScreenContext, params: PlayParams): void {
        const { world, ui, assets, input, keyboard, responsive } = context;

        const stage = findStage(params.stageId);
        this.context = context;
        this.stage = stage;
        if (stage.tutorial) this.tutorial = new TutorialRunner(stage.tutorial);

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
        this.field = new Entity();
        this.shake = this.field.addComponent(new Shake(this.field));
        world.addChild(this.field);

        for (const slot of slots) {
            const hole = new Hole(slot);
            this.holes.push(hole);
            this.field.addChild(hole);
        }

        // Effects sit above the holes — a whack's sparks should cover the mound
        // they came out of — but below the popups, so a floating score is never
        // buried under its own explosion.
        const fxLayer = new Container();
        this.field.addChild(fxLayer);
        this.effects = new EffectsSystem(fxLayer);

        // Added last on purpose: score popups float above the mound they rise
        // from. Adding this layer before the holes tucks every "+10" behind
        // the hole, so it vanishes as soon as it drifts over one.
        const popupLayer = new Container();
        this.field.addChild(popupLayer);
        this.popups = new PopupsSystem(popupLayer);

        this.hud = new PlayHud(ui, responsive, { onPause: () => this.togglePause() });

        if (stage.durationMs !== null) {
            this.clock = new SessionClock(stage.durationMs, CLOCK_RATE);
            this.spawner = new Spawner({
                intervalMs: stage.spawnIntervalMs,
                maxConcurrent: stage.maxConcurrent,
            });
            this.hud.setTimed(true);
        }

        // A stage can be timed *and* scripted — the tutorial is both.
        this.hud.setPrompt(stage.tutorial ? stage.tutorial[0].prompt : stage.title);

        // The golden's wash, invisible until a sweep fires it — added after the
        // HUD chrome and before the first overlay (see `SweepWash`'s doc).
        this.sweepWash = new SweepWash(ui, responsive);

        // The pause menu: the overlay is chrome, but what each button *does* is
        // rule — this screen owns `playing` vs `paused`, so it hands the HUD its
        // callbacks and keeps the state. Mounted last so a modal is never buried
        // under HUD chrome or the sweep wash.
        this.pause = new PausePanel(responsive, {
            onResume: () => this.togglePause(),
            onQuit: () => {
                // Resume before leaving, so the pause overlay is hidden
                // if this screen is ever reused rather than rebuilt.
                this.enter('playing');
                this.pause?.setPaused(false);
                void this.context?.screens.start(SCREENS.MainMenu);
            },
            onAction: () => this.context?.audio.play(SFX.tap),
        });
        this.hud.mountOverlay(this.pause.overlay);

        this.stopTap = input.on((event) => {
            const point = responsive.toWorld(event);
            this.handleTap(point.x, point.y);
        });
        this.stopPauseKey = keyboard.onKeyDown('Escape', () => this.togglePause());

        this.updateHud();
    }

    update(dt: number): void {
        const stage = this.stage;
        if (!stage) return;
        if (this.mode === 'finished') {
            // The panel and the HUD keep ticking so the score counts up and any
            // in-flight tween (or a shout caught mid-air by the whistle) plays
            // out behind the results panel.
            this.results?.update(dt);
            this.hud?.update(dt);
            return;
        }
        if (this.mode !== 'playing') return;

        if (this.clock) {
            this.clock.update(dt);
            this.updateHud();
            if (this.clock.expired) {
                this.finish();
                return;
            }
        }

        if (this.tutorial) this.updateTutorialStage(dt);
        else this.updateRandomStage(dt, stage);

        // A transition may have started above — don't touch torn-down state.
        if (this.mode !== 'playing') return;

        for (const capy of this.capys) capy.update(dt);
        this.flushRetired();
        this.popups?.update(dt);
        this.updateEffects(dt);
    }

    destroy(): void {
        this.stopTap?.();
        this.stopPauseKey?.();
        this.stopTap = null;
        this.stopPauseKey = null;

        this.popups?.destroy();
        this.popups = null;
        this.effects?.destroy();
        this.effects = null;
        this.pendingRetirement.length = 0;
        this.capys.length = 0;
        this.holes.length = 0;

        this.context = null;
        this.stage = null;
        this.clock = null;
        this.spawner = null;
        this.tutorial = null;
        this.field = null;
        this.shake = null;
        this.sweepWash = null;
        this.pause = null;
        this.results?.destroy();
        this.results = null;
        this.hud?.destroy();
        this.hud = null;
        // Back to a clean slate, through `enter()` like every other change, so a
        // reused instance could never start life mid-stage.
        this.enter('playing');
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

    private updateTutorialStage(dt: number): void {
        const runner = this.tutorial;
        if (!runner) {
            this.finish();
            return;
        }

        const outcome = runner.update(dt, this.capys.length, (hold) => {
            const hole = this.pickFreeHole();
            if (!hole) return false;
            this.spawn('normal', hole, hold);
            return true;
        });

        if (!outcome) return;
        if (outcome.finished) {
            this.finish();
            return;
        }
        if (outcome.prompt !== undefined) this.hud?.setPrompt(outcome.prompt);
    }

    // --- Taps ----------------------------------------------------------------

    private handleTap(x: number, y: number): void {
        if (this.mode !== 'playing') return;

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
        if (!this.stage?.tutorial) this.popups?.add('Miss!', x, y - 46, COLORS.hazard);
        // Only a tap makes a sound — an escape is the game's doing, not the
        // player's, so it stays silent however much it costs them.
        this.context?.audio.play(SFX.miss);
        this.updateHud();
    }

    private whack(capy: Capy): void {
        const downed = capy.hitTarget.hit();
        // Rising with the combo, so a hot streak sounds hotter as well as
        // scoring more — and a wound gets its own duller hit, so a `tough`
        // that survives still sounds like progress rather than a bug.
        this.context?.audio.play(downed ? SFX.whack : SFX.wound, {
            rate: 1 + (this.combo.multiplier - 1) * 0.06,
        });
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
        this.bookOutcome(capy, tapOutcome(capy.type, this.combo.multiplier));

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
        this.context?.audio.play(SFX.hazard);
        capy.flash();
        capy.markSettled();
        this.spray(capy, SOFT_BURST, COLORS.hazard);
        this.bookOutcome(capy, tapOutcome(capy.type, this.combo.multiplier));
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
        //
        // The word rides *above* the popup lane, not at it: `apply` has already
        // drawn the golden's own `+N` at the standard height, and the swept
        // capys' `+20`s are dropped further still. Three lanes, so the headline,
        // the tapped payout and the bounties never share a line.
        const { x, y } = resolved.hole.slot;
        this.context?.audio.play(SFX.clear);
        this.effects?.addShockwave({
            x,
            y,
            fromRadius: HOLE_RADIUS,
            toRadius: HOLE_SPACING * 1.7,
            ms: SWEEP_RING_MS,
            color: COLORS.star,
        });
        this.spray(resolved, SWEEP_BURST);
        this.sweepWash?.arm();
        this.popups?.add('CLEAR!', x, y - HOLE_RADIUS - 46 - CLEAR_TITLE_LIFT, COLORS.star, 56);

        for (const capy of [...this.capys]) {
            if (capy === resolved || !capy.emerge.hittable) continue;

            capy.markSettled();
            if (!capy.type.harmful) {
                capy.hitTarget.forceDown();
                capy.refreshHealth();
            }

            this.spray(capy, SOFT_BURST);
            this.payBounty(capy, SWEEP_POINTS, SWEEP_POPUP_DROP);
            capy.emerge.retreat();
        }
    }

    /**
     * Book one resolved interaction — the single place points, streak, the
     * tally and the popup all move together.
     *
     * A non-scoring outcome can only come from deliberately tapping a hazard,
     * so it counts against accuracy and breaks the streak.
     */
    private bookOutcome(capy: Capy, outcome: TapOutcome): void {
        if (outcome.hit) {
            const before = this.combo.multiplier;
            this.combo.recordHit();
            this.hits += 1;
            this.tutorial?.recordWhack();
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
     *
     * `popupDrop` pushes the label further down from its hole, which the sweep
     * uses: its per-capy `+20`s are a trailing detail behind the big "CLEAR!",
     * and at the default height they would be drawn straight through it.
     */
    private payBounty(capy: Capy, points: number, popupDrop = 0): void {
        this.scoreKeeper.add(points);
        this.hud?.setScore(this.scoreKeeper.score);
        this.spawnPopup(capy, points, popupDrop);
    }

    // --- Spawning -----------------------------------------------------------

    private pickFreeHole(): Nullable<Hole> {
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
     * End the stage, in place.
     *
     * The run is over but the screen is not: results are a modal over the frozen
     * playfield, so the last frame of the stage stays visible behind the panel
     * instead of being destroyed for a separate screen. That is why every path
     * out of a stage — beating it *or* running out of clock — ends here.
     */
    private finish(): void {
        const stage = this.stage;
        if (!stage || this.mode === 'finished') return;
        this.enter('finished');
        this.hud?.hideScore();

        const attempts = this.hits + this.misses;
        const accuracy = attempts > 0 ? this.hits / attempts : 0;
        const stars = starsFor(this.scoreKeeper.score, stage.starThresholds);
        const next = findNextStage(stage.id);

        // Earn a star to move on. Advance is the reward for engaging with the
        // stage; coming up empty repeats it rather than dead-ending the run.
        const advanced = canAdvance(stars);

        // Winning a scripted stage ends the handshake for good: later sessions
        // start past the tutorial (see `progress.ts`).
        if (stage.tutorial && advanced) markTutorialDone();

        // The bottom of the table has no next stage, so its "Next" is the one
        // that leaves the game: it opens the celebration. Same label, same
        // colour, same place as every other stage's — the present is not
        // announced, and the button is the only way out either way.
        const finale = isFinaleStage(stage.id);

        const actions: OverlayAction[] = [];
        if (advanced && finale) {
            actions.push({ label: 'Next', onTap: () => void this.context?.screens.start(SCREENS.Celebration) });
        } else if (advanced && next) {
            actions.push({ label: 'Next', onTap: () => void this.context?.screens.start(SCREENS.Play, { stageId: next.id }) });
        }
        // Replay restarts the same stage without leaving it: a fresh PlayScreen
        // is the cleanest reset, since the old one has a frozen field to unwind.
        // The tutorial is the exception — its beats are meant to be seen once,
        // so a retry comes back through Menu → Play rather than this button.
        if (!stage.tutorial) {
            actions.push({ label: 'Replay', onTap: () => void this.context?.screens.start(SCREENS.Play, { stageId: stage.id }) });
        }
        actions.push({ label: 'Menu', onTap: () => void this.context?.screens.start(SCREENS.MainMenu) });

        const lines = [
            `Accuracy ${Math.round(accuracy * 100)}%   ·   Best Combo ${this.combo.bestCount}`,
        ];
        if (!advanced) {
            lines.push(`Score ${stage.starThresholds[0]} to earn a star and continue`);
        }

        this.results = new ResultsPanel(this.context!.responsive, {
            title: `${stage.title} complete`,
            stars,
            score: this.scoreKeeper.score,
            lines,
            actions,
            onAction: () => this.context?.audio.play(SFX.tap),
        });
        this.hud?.mountOverlay(this.results.overlay);
    }

    /**
     * Pause or resume the run.
     *
     * Only meaningful while `playing` or `paused`: a finished stage has no run
     * left to freeze, and pausing it would leave two modals on screen — the
     * `finished` mode makes that transition impossible to request at all.
     */
    private togglePause(): void {
        if (this.mode === 'finished') return;

        const next = this.mode === 'playing' ? 'paused' : 'playing';
        this.enter(next);
        // One click covers pause, resume and the ESC key, which are the same
        // action as far as the player is concerned.
        this.context?.audio.play(SFX.tap);
        this.pause?.setPaused(next === 'paused');
    }

    /** Restate the HUD from the current rules: the combo line, and the countdown if there is one. */
    private updateHud(): void {
        const hud = this.hud;
        if (!hud) return;

        hud.setCombo(this.combo.multiplier, this.combo.count);

        if (this.clock) {
            hud.setTime(secondsRemaining(this.clock.remainingMs), this.clock.remainingMs / this.clock.durationMs);
        }
    }

    // --- Juice --------------------------------------------------------------

    /**
     * A step up the combo ladder: the sound of the tier.
     *
     * The whack that caused this already threw its own sparks, so a milestone
     * adds weight and a word rather than more particles — the ladder should feel
     * like a new tier, not like a slightly bigger hit. The rest of the beat is
     * delegated: the field's kick is the `Shake` component, and the punch and
     * word are `PlayHud.shout` (where the word's placement rule lives).
     */
    private celebrateCombo(multiplier: number): void {
        // Same beat as the kick and the shout — the tier, heard. The ladder
        // tops out at x5, so the pitch climbs two semitones a step and stops.
        this.context?.audio.play(SFX.combo, { rate: 1 + (multiplier - 2) * 0.18 });
        // The three channels of one milestone: field kicks (a component), the
        // line punches and the ladder shouts (the HUD), and this — the sound.
        this.shake?.kick();
        this.hud?.shout(multiplier);
    }

    /**
     * Throw a burst of sparks out of `capy`'s hole, in its own colour.
     *
     * Position comes from the hole, not the capy, so a `runner` that just moved
     * still throws its sparks where the tap actually landed — hit testing reads
     * the same slot, so the sparks and the popup never disagree.
     */
    private spray(capy: Capy, options: Omit<BurstOptions, 'x' | 'y'>, color: number = capy.type.color): void {
        this.effects?.addBurst(color, {
            ...options,
            x: capy.hole.slot.x,
            y: capy.hole.slot.y,
        });
    }

    private spawnPopup(capy: Capy, points: number, drop = 0): void {
        this.popups?.add(
            `${points >= 0 ? '+' : ''}${points}`,
            capy.hole.slot.x,
            capy.hole.slot.y - HOLE_RADIUS - 46 + drop,
            points >= 0 ? COLORS.star : COLORS.hazard,
        );
    }

    /**
     * Tick the one-shot effects and drop the ones that have played out.
     *
     * Each effect reports its own `finished` rather than the screen timing it,
     * so adding another kind is a new array and one more loop, not a new timer.
     * The HUD (score tween, combo punch, shout) and the field's kick live here
     * too: they are per-frame decoration, and nothing else is guaranteed to run
     * every frame once the countdown is gone.
     */
    private updateEffects(dt: number): void {
        this.effects?.update(dt);
        this.sweepWash?.update(dt);
        this.hud?.update(dt);

        // The field's kick is a composed component — ticked here only because
        // this is the loop guaranteed to run every frame.
        this.field?.update(dt);
    }
}

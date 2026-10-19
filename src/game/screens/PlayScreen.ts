import { Container } from 'pixi.js';
import type { Text } from 'pixi.js';
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
import { ScoreKeeper, starsFor } from '../systems/ScoreKeeper';
import { pickSpawn, Spawner } from '../systems/Spawner';
import { SessionClock } from '../systems/SessionClock';
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
/** Lifetime of a floating score popup, in ms. */
const POPUP_MS = 700;

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
        for (const slot of slots) {
            const hole = new Hole(slot);
            this.holes.push(hole);
            world.addChild(hole);
        }

        // Added last on purpose: score popups float above the mound they rise
        // from. Adding this layer before the holes tucks every "+10" behind
        // the hole, so it vanishes as soon as it drifts over one.
        this.popupLayer = new Container();
        world.addChild(this.popupLayer);

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
    }

    destroy(): void {
        this.stopTap?.();
        this.stopPauseKey?.();
        this.stopTap = null;
        this.stopPauseKey = null;

        for (const popup of this.popups) popup.label.destroy();
        this.popups.length = 0;
        this.pendingRetirement.length = 0;
        this.capys.length = 0;
        this.holes.length = 0;

        this.context = null;
        this.stage = null;
        this.clock = null;
        this.spawner = null;
        this.popupLayer = null;
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
            this.whack(target);
            return;
        }

        // A whiff. Skip the HUD strip — tapping pause isn't a miss — and skip
        // the moment before the first spawn, so it doesn't poison accuracy.
        if (y < HUD_ZONE_Y || this.spawned === 0) return;

        this.misses += 1;
        this.combo.recordMiss();
        // Answered, not silent: without this the tap looks ignored, because the
        // only other sign is a combo label the player may not have had.
        this.addPopup('Miss!', x, y - 46, COLORS.hazard);
        this.updateHud();
    }

    private whack(capy: Capy): void {
        const downed = capy.hitTarget.hit();
        capy.flash();

        if (!downed) {
            // Still ticking: give it a grace window rather than fleeing mid-fight.
            if (capy.type.staysWhenHit) capy.emerge.retain(WOUND_GRACE_MS);
            capy.refreshHealth();
            return;
        }

        capy.markSettled();
        this.award(capy);

        if (capy.type.effect === 'clear') this.clearField(capy);

        capy.emerge.retreat();
    }

    /** A clear effect resolves everything else on the field. */
    private clearField(resolved: Capy): void {
        for (const capy of [...this.capys]) {
            if (capy === resolved) continue;

            capy.markSettled();
            if (!capy.type.harmful) {
                capy.hitTarget.forceDown();
                capy.refreshHealth();
                this.award(capy);
            }
            capy.emerge.retreat();
        }
    }

    private award(capy: Capy): void {
        const points = capy.type.points * this.combo.multiplier;

        this.score.add(points);
        this.combo.recordHit();
        this.hits += 1;
        this.stepWhacks += 1;

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
            if (!capy.isSettled) {
                this.misses += 1;
                this.combo.recordMiss();
                this.updateHud();
            }

            const index = this.capys.indexOf(capy);
            if (index !== -1) this.capys.splice(index, 1);

            capy.onRetreated = null;
            capy.parent?.removeChild(capy);
            capy.destroy({ children: true });
        }
    }

    // --- Stage end ----------------------------------------------------------

    /**
     * End the stage. Every path — beating it *or* running out of clock — goes
     * through Results, so the player always sees score, stars and accuracy.
     * Stage 1 starts from there, when the player taps Next.
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

        void this.context?.screens.start(SCREENS.Results, results);
    }

    // --- HUD ----------------------------------------------------------------

    private createHud(ui: Container, responsive: Responsive): void {
        this.scoreLabel = createLabel('0', { fontSize: 52 });
        this.scoreLabel.anchor.set(0, 0.5);
        this.scoreLabel.position.set(56, 92);
        ui.addChild(this.scoreLabel);

        this.timerLabel = createLabel('0', { fontSize: 52 });
        this.timerLabel.anchor.set(0.5, 0.5);
        this.timerLabel.position.set(SCREEN_CENTER.x, 92);
        this.timerLabel.visible = false;
        ui.addChild(this.timerLabel);

        this.comboLabel = createLabel('', { fontSize: 26, fill: COLORS.star });
        this.comboLabel.anchor.set(1, 0.5);
        this.comboLabel.position.set(GAME_WIDTH - 150, 92);
        ui.addChild(this.comboLabel);

        this.promptLabel = createLabel('', { fontSize: 30 });
        this.promptLabel.anchor.set(0.5, 0.5);
        this.promptLabel.position.set(SCREEN_CENTER.x, 950);
        ui.addChild(this.promptLabel);

        const pause = createButton('II', () => this.togglePause(), { width: 84, height: 62, fontSize: 26 });
        pause.position.set(GAME_WIDTH - 72, 92);
        ui.addChild(pause);

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
            this.timerLabel.text = `${Math.ceil(this.clock.remainingMs / 1000)}`;
        }
    }

    // --- Juice --------------------------------------------------------------

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
    private addPopup(text: string, x: number, y: number, fill: number): void {
        if (!this.popupLayer) return;

        const label = createLabel(text, {
            fontSize: 36,
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
}

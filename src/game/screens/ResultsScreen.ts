import { Container, Graphics } from 'pixi.js';
import { SFX } from '../audio/sfx';
import { ASSETS, COLORS, SCREENS, SCREEN_CENTER } from '../config';
import { createColorBackground, createTextureBackground } from '../core/display/background';
import { createButton } from '../core/display/button';
import { createLabel } from '../core/display/label';
import type { Screen, ScreenContext } from '../core/screens/screen';
import { findNextStage, findStage, isFinaleStage } from '../levels/stages';
import { canAdvance } from '../systems/ScoreKeeper';

/** Data carried across Play → Results. */
export interface ResultsParams {
    stageId: string;
    score: number;
    hits: number;
    misses: number;
    accuracy: number;
    bestCombo: number;
    stars: number;
}

const STAR_OUTER = 30;
const STAR_INNER = 13;

/**
 * Vertical rhythm of the summary, top to bottom.
 *
 * The star row sits close under the title, the score and stats take the roomier
 * gaps below it, and the goal line gets a row of its own above the buttons.
 * Buttons are a fixed 72px tall centred on `BUTTON_START_Y`, so the first one
 * starts at y=634 — `GOAL_Y` keeps the copy clear of that.
 */
const TITLE_Y = 276;
const STARS_Y = 362;
const SCORE_Y = 476;
const STATS_Y = 551;
const GOAL_Y = 601;
const BUTTON_START_Y = 670;
const BUTTON_STEP_Y = 96;

/** Post-stage summary: stars, score, accuracy, best combo, and what's next. */
export class ResultsScreen implements Screen<ResultsParams> {
    init(context: ScreenContext, params: ResultsParams): void {
        const { world, ui, assets, responsive, screens, audio } = context;

        world.addChild(createColorBackground(COLORS.results, responsive));
        world.addChild(createTextureBackground(assets.texture(ASSETS.background), responsive, 0.3));

        const stage = findStage(params.stageId);
        const next = findNextStage(params.stageId);

        const title = createLabel(`${stage.title} complete`, { fontSize: 56 });
        title.anchor.set(0.5);
        title.position.set(SCREEN_CENTER.x, TITLE_Y);
        ui.addChild(title);

        // The star row sits a little way above the midpoint of the gap the
        // title and the score leave, so it reads as earned by the title rather
        // than as a caption on the score underneath it.
        ui.addChild(this.createStars(params.stars));

        const score = createLabel(`${params.score}`, { fontSize: 84, fill: COLORS.star });
        score.anchor.set(0.5);
        score.position.set(SCREEN_CENTER.x, SCORE_Y);
        ui.addChild(score);

        const stats = createLabel(
            `Accuracy ${Math.round(params.accuracy * 100)}%   ·   Best Combo ${params.bestCombo}`,
            { fontSize: 26 },
        );
        stats.anchor.set(0.5);
        stats.position.set(SCREEN_CENTER.x, STATS_Y);
        ui.addChild(stats);

        // Earn a star to move on. Advance is the reward for engaging with the
        // stage; coming up empty repeats it rather than dead-ending the run.
        const advanced = canAdvance(params.stars);

        // The bottom of the table has no next stage, so its "Next" is the one
        // that leaves the game: it opens the celebration. Same label, same
        // colour, same place as every other stage's — the present is not
        // announced, and the button is the only way out either way.
        const finale = isFinaleStage(stage.id);

        // The primary button is always the furthest forward: "Next" as soon as a
        // star was earned — into the following stage, or out of the game on the
        // finale — otherwise straight back into the same one, which is why
        // Replay takes the accent in that case.
        const actions: { label: string; onTap: () => void }[] = [];
        if (advanced && finale) {
            actions.push({ label: 'Next', onTap: () => void screens.start(SCREENS.Celebration) });
        } else if (advanced && next) {
            actions.push({ label: 'Next', onTap: () => void screens.start(SCREENS.Play, { stageId: next.id }) });
        }
        actions.push({ label: 'Replay', onTap: () => void screens.start(SCREENS.Play, { stageId: stage.id }) });
        actions.push({ label: 'Menu', onTap: () => void screens.start(SCREENS.MainMenu) });

        actions.forEach((action, index) => {
            // Wrapped here, once, rather than in every action: whatever the
            // button does, it clicks first.
            const button = createButton(action.label, () => {
                audio.play(SFX.tap);
                action.onTap();
            }, {
                fill: index === 0 ? COLORS.accent : 0x3a3f4b,
            });
            button.position.set(SCREEN_CENTER.x, BUTTON_START_Y + index * BUTTON_STEP_Y);
            ui.addChild(button);
        });

        // Explain the missing button, and name the target — without this the
        // next stage (or the ending) just looks absent.
        if (!advanced) {
            const goal = createLabel(`Score ${stage.starThresholds[0]} to earn a star and continue`, {
                fontSize: 24,
                fill: COLORS.star,
            });
            goal.anchor.set(0.5);
            goal.position.set(SCREEN_CENTER.x, GOAL_Y);
            ui.addChild(goal);
        }
    }

    /** A row of three stars, filled according to how well the stage went. */
    private createStars(earned: number): Container {
        const row = new Container();

        for (let i = 0; i < 3; i++) {
            const star = this.createStar(i < earned);
            star.position.set((i - 1) * 84, 0);
            row.addChild(star);
        }

        row.position.set(SCREEN_CENTER.x, STARS_Y);
        return row;
    }

    private createStar(filled: boolean): Graphics {
        const points: number[] = [];
        for (let i = 0; i < 10; i++) {
            const angle = (Math.PI / 5) * i - Math.PI / 2;
            const radius = i % 2 === 0 ? STAR_OUTER : STAR_INNER;
            points.push(Math.cos(angle) * radius, Math.sin(angle) * radius);
        }

        return new Graphics()
            .poly(points, true)
            .fill(filled ? COLORS.star : 0x3a3f4b)
            .stroke({ width: 3, color: COLORS.black });
    }
}

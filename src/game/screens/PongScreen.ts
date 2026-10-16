import { Graphics } from 'pixi.js';
import { Ball } from '../components/Ball';
import { Paddle } from '../components/Paddle';
import { PaddleAI } from '../components/PaddleAI';
import { PaddleController } from '../components/PaddleController';
import { COLORS, GAME_HEIGHT, GAME_WIDTH, SCREENS, SCREEN_CENTER } from '../config';
import { createColorBackground } from '../core/display/Background';
import { createLabel } from '../core/display/Label';
import { Entity } from '../core/entities/Entity';
import type { Unsubscribe } from '../core/input/PointerInput';
import type { ViewportMetrics } from '../core/responsive/Responsive';
import type { Screen, ScreenContext } from '../core/screens/Screen';

/** Points needed to win. */
const WIN_SCORE = 5;
/** Design-space inset so paddles sit just inside the playfield edges. */
const PADDLE_INSET = 60;

/**
 * Pong — a concrete demo of the template's composition model.
 *
 * One screen, three entities, five components:
 * - ball: `Ball` (motion + wall bounces)
 * - player paddle: `Paddle` + `PaddleController` (pointer-driven)
 * - AI paddle: `Paddle` + `PaddleAI` (tracks the ball, capped speed)
 *
 * The screen itself only does what no component can: collision checks,
 * scoring, serving and the win/lose transition.
 */
export class PongScreen implements Screen {
    private readonly entities: Entity[] = [];
    private stopMove: Unsubscribe | null = null;
    private stopServe: Unsubscribe | null = null;
    private screens: ScreenContext['screens'] | null = null;

    private ballMotion: Ball | null = null;
    private ballEntity: Entity | null = null;
    private playerEntity: Entity | null = null;
    private aiEntity: Entity | null = null;
    private playerPaddle: Paddle | null = null;
    private aiPaddle: Paddle | null = null;

    private scoreLabel: ReturnType<typeof createLabel> | null = null;
    private hintLabel: ReturnType<typeof createLabel> | null = null;
    private score = { player: 0, ai: 0 };
    private serving = true;
    /** ms remaining before the ball auto-serves. */
    private serveCountdown = 1200;

    init(context: ScreenContext, _params: void): void {
        const { world, ui, input, responsive, screens } = context;
        this.screens = screens;

        world.addChild(createColorBackground(COLORS.pong, responsive));
        world.addChild(this.createSideWalls());
        ui.addChild(this.createCenterLine());

        // --- Ball -----------------------------------------------------------
        const ball = new Entity();
        ball.addChild(this.createBallVisual());
        ball.position.set(SCREEN_CENTER.x, SCREEN_CENTER.y);
        this.ballMotion = ball.addComponent(new Ball(ball, { speedX: 320, speedY: 320 }));
        this.ballEntity = ball;
        this.entities.push(ball);
        world.addChild(ball);

        // --- Player paddle (bottom) ----------------------------------------
        const player = new Entity();
        player.addChild(this.createPaddleVisual());
        player.position.set(SCREEN_CENTER.x, GAME_HEIGHT - PADDLE_INSET);
        this.playerPaddle = player.addComponent(
            new Paddle(player, { bounds: { minX: 0, maxX: GAME_WIDTH } }),
        );
        const controller = player.addComponent(new PaddleController(this.playerPaddle));
        this.entities.push(player);
        this.playerEntity = player;
        world.addChild(player);

        // --- AI paddle (top) -------------------------------------------------
        const ai = new Entity();
        ai.addChild(this.createPaddleVisual());
        ai.position.set(SCREEN_CENTER.x, PADDLE_INSET);
        this.aiPaddle = ai.addComponent(
            new Paddle(ai, { bounds: { minX: 0, maxX: GAME_WIDTH } }),
        );
        ai.addComponent(
            new PaddleAI(this.aiPaddle, this.ballMotion, ball.position, true, {
                homeX: SCREEN_CENTER.x,
            }),
        );
        this.entities.push(ai);
        this.aiEntity = ai;
        world.addChild(ai);

        // --- HUD -------------------------------------------------------------
        this.scoreLabel = createLabel('0 : 0', { fontSize: 56 });
        this.scoreLabel.anchor.set(0.5);
        this.scoreLabel.position.set(SCREEN_CENTER.x, SCREEN_CENTER.y - 260);
        ui.addChild(this.scoreLabel);

        this.hintLabel = createLabel('Portrait court · sides are walls · first to 5', { fontSize: 22 });
        this.hintLabel.anchor.set(0.5);
        this.hintLabel.position.set(SCREEN_CENTER.x, SCREEN_CENTER.y + 260);
        ui.addChild(this.hintLabel);

        // --- Input -----------------------------------------------------------
        this.stopMove = input.onMove((event) => {
            controller.moveTo(responsive.toWorld(event).x);
        });
        this.stopServe = input.on(() => {
            if (this.serving) this.serve();
        });

        // Ball waits on the center line until the player taps to serve.
        this.ballMotion.velocityX = 0;
        this.ballMotion.velocityY = 0;
    }

    update(dt: number): void {
        for (const entity of this.entities) {
            entity.update(dt);
        }

        if (this.serving) {
            // Auto-serve after a short countdown so play never stalls.
            this.serveCountdown -= dt;
            if (this.serveCountdown <= 0) this.serve();
        } else if (this.ballMotion) {
            this.handleWallBounce();
            this.handlePaddleHits();
            this.handleScoring();
        }
    }

    onResize(_viewport: ViewportMetrics): void {
        // Playfield is fixed to the portrait design area; walls stay visible.
        this.playerPaddle?.setBounds({ minX: 0, maxX: GAME_WIDTH });
        this.aiPaddle?.setBounds({ minX: 0, maxX: GAME_WIDTH });
    }

    destroy(): void {
        this.stopMove?.();
        this.stopServe?.();
        this.stopMove = null;
        this.stopServe = null;
        this.screens = null;
        this.entities.length = 0;
        this.ballMotion = null;
        this.ballEntity = null;
        this.playerEntity = null;
        this.aiEntity = null;
        this.playerPaddle = null;
        this.aiPaddle = null;
        this.scoreLabel = null;
        this.hintLabel = null;
    }

    /** Launch the ball from the center toward the player. */
    private serve(): void {
        if (!this.ballMotion) return;

        this.serving = false;
        this.serveCountdown = 1200;
        // Random horizontal direction keeps serves unpredictable.
        this.ballMotion.velocityX = (Math.random() < 0.5 ? -1 : 1) * 320;
        this.ballMotion.velocityY = 320;
        if (this.hintLabel) {
            this.hintLabel.destroy();
            this.hintLabel = null;
        }
    }

    /** Bounce off the left/right walls (the screen's edges of the playfield). */
    private handleWallBounce(): void {
        const ball = this.ballMotion;
        const entity = this.ballEntity;
        if (!ball || !entity) return;

        if (entity.x - ball.radius < 0 && ball.directionX < 0) {
            entity.x = ball.radius;
            ball.bounceX();
        } else if (entity.x + ball.radius > GAME_WIDTH && ball.directionX > 0) {
            entity.x = GAME_WIDTH - ball.radius;
            ball.bounceX();
        }
    }

    /** Simple AABB check against both paddles; bounce the ball away. */
    private handlePaddleHits(): void {
        const ball = this.ballMotion;
        const ballEntity = this.ballEntity;
        if (!ball || !ballEntity) return;

        for (const [paddleEntity, paddle] of [
            [this.playerEntity, this.playerPaddle],
            [this.aiEntity, this.aiPaddle],
        ] as const) {
            if (!paddleEntity || !paddle) continue;

            const dx = Math.abs(ballEntity.x - paddleEntity.x);
            const dy = Math.abs(ballEntity.y - paddleEntity.y);

            if (dx < paddle.halfWidth + ball.radius && dy < paddle.height / 2 + ball.radius) {
                // Push the ball out so it doesn't stick, then bounce.
                ballEntity.y =
                    paddleEntity.y + Math.sign(ballEntity.y - paddleEntity.y) * (paddle.height / 2 + ball.radius);
                ball.bounceY();
                // Angle the return based on where it hit the paddle.
                ball.velocityX += ((ballEntity.x - paddleEntity.x) / paddle.halfWidth) * 160;
            }
        }
    }

    /** Score when the ball leaves the top/bottom; end the game at WIN_SCORE. */
    private handleScoring(): void {
        const ball = this.ballMotion;
        const entity = this.ballEntity;
        if (!ball || !entity || !this.scoreLabel) return;

        if (entity.y - ball.radius > GAME_HEIGHT) {
            this.score.ai += 1;
            this.resetAfterPoint();
        } else if (entity.y + ball.radius < 0) {
            this.score.player += 1;
            this.resetAfterPoint();
        }

        this.scoreLabel.text = `${this.score.player} : ${this.score.ai}`;

        if (this.score.player >= WIN_SCORE || this.score.ai >= WIN_SCORE) {
            void this.screens?.start(SCREENS.GameOver, {
                playerScore: this.score.player,
                aiScore: this.score.ai,
            });
        }
    }

    /** Re-center the ball and wait for the next tap to serve. */
    private resetAfterPoint(): void {
        const entity = this.ballEntity;
        const ball = this.ballMotion;
        if (!entity || !ball) return;

        entity.position.set(SCREEN_CENTER.x, SCREEN_CENTER.y);
        ball.velocityX = 0;
        ball.velocityY = 0;
        this.serving = true;
        this.serveCountdown = 1200;
    }

    private createBallVisual(): Graphics {
        return new Graphics().circle(0, 0, this.ballMotion?.radius ?? 12).fill(COLORS.white);
    }

    private createPaddleVisual(): Graphics {
        return new Graphics().roundRect(-70, -12, 140, 24, 12).fill(COLORS.pongAccent);
    }

    private createCenterLine(): Graphics {
        const line = new Graphics();
        for (let y = 0; y < GAME_HEIGHT; y += 48) {
            line.rect(SCREEN_CENTER.x - 3, y, 6, 24).fill({ color: COLORS.white, alpha: 0.25 });
        }
        return line;
    }

    /**
     * Visible side walls. The playfield is always the portrait design area,
     * so in landscape the letterbox margins are dead space — drawing the walls
     * makes that constraint obvious instead of an invisible surprise.
     */
    private createSideWalls(): Graphics {
        const wall = new Graphics()
            .rect(-6, 0, 6, GAME_HEIGHT)
            .rect(GAME_WIDTH, 0, 6, GAME_HEIGHT)
            .fill(COLORS.pongAccent);
        return wall;
    }
}

import { Container, Graphics, Ticker } from 'pixi.js';
import type { Application } from 'pixi.js';
import { COLORS, SCREEN_CENTER } from '../../config';
import { createColorBackground } from '../display/background';
import { createLabel } from '../display/label';
import type { Responsive } from '../responsive/Responsive';
import type { Nullable } from '../types';

const TRANSITION_LOADER_DELAY_MS = 160;
/** Roughly one turn per second, in radians per millisecond. */
const SPINNER_RADIANS_PER_MS = 0.006;

export class TransitionOverlay {
    private loader: Nullable<Container> = null;
    private spinner: Nullable<Container> = null;
    private timer: Nullable<number> = null;

    arm(app: Application, responsive: Responsive, isStale: () => boolean): void {
        this.cancel();
        this.timer = window.setTimeout(() => {
            if (isStale()) return;
            this.show(app, responsive);
        }, TRANSITION_LOADER_DELAY_MS);
    }

    cancel(): void {
        if (this.timer === null) return;
        window.clearTimeout(this.timer);
        this.timer = null;
    }

    hide(app: Application): void {
        this.cancel();
        if (!this.loader) return;
        app.ticker.remove(this.tick);
        this.loader.removeFromParent();
        this.loader.destroy({ children: true });
        this.loader = null;
        this.spinner = null;
    }

    private show(app: Application, responsive: Responsive): void {
        if (this.loader) return;

        const overlay = new Container();
        overlay.label = 'transition-loader';

        const dim = createColorBackground(COLORS.black, responsive, 0.72);
        dim.eventMode = 'static';
        overlay.addChild(dim);

        const spinner = new Container();
        spinner.position.set(SCREEN_CENTER.x, SCREEN_CENTER.y - 20);

        const track = new Graphics().circle(0, 0, 24).stroke({ width: 5, color: 0x3a3f4b });
        const arc = new Graphics()
            .moveTo(0, -24)
            .arc(0, 0, 24, -Math.PI / 2, Math.PI * 0.8)
            .stroke({ width: 5, color: COLORS.accent, cap: 'round' });

        spinner.addChild(track, arc);
        overlay.addChild(spinner);

        const label = createLabel('Please wait...', { fontSize: 28, fill: COLORS.white });
        label.anchor.set(0.5);
        label.position.set(SCREEN_CENTER.x, SCREEN_CENTER.y + 32);
        overlay.addChild(label);

        this.loader = overlay;
        this.spinner = spinner;
        responsive.ui.addChild(overlay);
        app.ticker.add(this.tick);
    }

    private readonly tick = (ticker: Ticker): void => {
        if (this.spinner) this.spinner.rotation += ticker.deltaMS * SPINNER_RADIANS_PER_MS;
    };
}
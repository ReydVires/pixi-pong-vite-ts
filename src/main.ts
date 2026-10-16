import { Game } from './game/Game';

document.addEventListener('DOMContentLoaded', () => {
    const instance = new Game();
    void instance.start('game-container');
});
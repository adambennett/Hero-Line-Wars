import "./style.css";
import { Game } from "./game/Game";

const canvas = document.querySelector<HTMLCanvasElement>("#game");
if (!canvas) throw new Error("#game canvas missing");

const game = new Game(canvas);
game.start();

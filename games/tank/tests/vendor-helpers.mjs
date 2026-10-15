// Upstream MIT tests; see ../public/assets/battle-city-license.html
import { STEP_MS } from "../src/vendor/engine/Game";
import GameSession from "../src/vendor/engine/GameSession";
import { PLAYER_SPAWN_POS } from "../src/vendor/engine/constants";
import { seededRandom } from "../src/vendor/engine/random";
import InputManager from "../src/vendor/input/InputManager";
import { PLAYER1_CONTROL, PLAYER2_CONTROL } from "../src/vendor/input/bindings";
function makeStage(name, bots = ["1*basic"], overrides = {}) {
  const map = [];
  for (let row = 0; row < 13; row += 1) {
    const items = [];
    for (let col = 0; col < 13; col += 1) {
      items.push(overrides[`${row},${col}`] ?? (row === 12 && col === 6 ? "E" : "X"));
    }
    map.push(items.join(" "));
  }
  return { name, difficulty: 1, map, bots };
}
const P1 = {
  control: PLAYER1_CONTROL,
  color: "yellow",
  spawnPos: PLAYER_SPAWN_POS.player1
};
const P2 = {
  control: PLAYER2_CONTROL,
  color: "green",
  spawnPos: PLAYER_SPAWN_POS.player2
};
function setup(stages, players = [P1], autopilot = false) {
  const sounds = [];
  const session = new GameSession(
    stages,
    0,
    players,
    { play: (name) => sounds.push(name) },
    { autopilot, random: seededRandom(1) }
  );
  const input = new InputManager();
  const run = (ms) => {
    for (let t = 0; t < ms; t += STEP_MS) {
      session.step(STEP_MS, input);
      input.endTick();
    }
  };
  return { session, sounds, run, input };
}
function runUntilPlaying(session, run) {
  while (session.phase !== "playing") {
    run(STEP_MS);
  }
}
function runUntilSpawned(session, run) {
  const tanks = () => session.scene.tanks;
  while (!tanks().some((t) => t.side === "player") || !tanks().some((t) => t.side === "bot")) {
    run(STEP_MS);
  }
}
function killAllBots(session) {
  for (const t of session.scene.tanks) {
    if (t.side === "bot") t.alive = false;
  }
}
export {
  P1,
  P2,
  killAllBots,
  makeStage,
  runUntilPlaying,
  runUntilSpawned,
  setup
};

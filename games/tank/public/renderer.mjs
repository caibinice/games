// Battle City adaptation. Upstream MIT: assets/battle-city-license.html

// games/tank/src/vendor/render/sprites/draw.ts
function rect(ctx, x, y, w, h, color) {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w, h);
}
function pixel(ctx, x, y, color) {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, 1, 1);
}
function path(ctx, d, color) {
  ctx.fillStyle = color;
  ctx.fill(new Path2D(d));
}
function bitmap(ctx, d, scheme4, ox = 0, oy = 0) {
  for (let dy = 0; dy < d.length; dy += 1) {
    const row = d[dy];
    for (let dx = 0; dx < row.length; dx += 1) {
      const color = scheme4[row[dx]];
      if (color && color !== "none") {
        pixel(ctx, ox + dx, oy + dy, color);
      }
    }
  }
}

// games/tank/src/vendor/render/sprites/terrain.ts
function drawBrick(ctx, shape) {
  rect(ctx, 0, 0, 4, 4, "#636363");
  rect(ctx, shape ? 0 : 1, 0, shape ? 4 : 3, 3, "#6B0800");
  rect(ctx, shape ? 0 : 2, 1, shape ? 4 : 2, 2, "#9C4A00");
}
function drawSteel(ctx) {
  rect(ctx, 0, 0, 8, 8, "#ADADAD");
  rect(ctx, 2, 2, 4, 4, "#FFFFFF");
  path(ctx, "M6,2 h1 v-1 h1 v7 h-7 v-1 h1 v-1 h4 v-4", "#636363");
}
var riverCoords = [
  [
    [5, 0],
    [0, 2],
    [1, 3],
    [4, 3],
    [3, 4],
    [5, 4],
    [1, 6],
    [2, 7],
    [6, 7]
  ],
  [
    [7, 0],
    [1, 1],
    [2, 2],
    [3, 3],
    [6, 3],
    [7, 4],
    [3, 5],
    [2, 6],
    [4, 6],
    [0, 7]
  ]
];
function drawRiverPart(ctx, shape, dx, dy) {
  rect(ctx, dx, dy, 8, 8, "#4242FF");
  for (const [x, y] of riverCoords[shape]) {
    pixel(ctx, dx + x, dy + y, "#B5EFEF");
  }
}
function drawRiver(ctx, shape) {
  drawRiverPart(ctx, shape, 0, 0);
  drawRiverPart(ctx, shape, 8, 0);
  drawRiverPart(ctx, shape, 8, 8);
  drawRiverPart(ctx, shape, 0, 8);
}
var forestScheme = { a: "#8CD600", b: "#005208", c: "#084A00", d: "none" };
var forestGrid = [
  "dbbbcbad",
  "bbcacaca",
  "bbbccaaa",
  "cbbaabca",
  "bbacaaac",
  "bcbaaaaa",
  "aaaaacaa",
  "daacaaad"
];
function drawForest(ctx) {
  bitmap(ctx, forestGrid, forestScheme, 0, 0);
  bitmap(ctx, forestGrid, forestScheme, 8, 0);
  bitmap(ctx, forestGrid, forestScheme, 0, 8);
  bitmap(ctx, forestGrid, forestScheme, 8, 8);
}
var SNOW_A = "#ffffff";
var SNOW_B = "#adadad";
var SNOW_C = "#636363";
function drawSnowPart(ctx, dx, dy) {
  rect(ctx, dx, dy, 8, 8, SNOW_B);
  pixel(ctx, dx + 0, dy + 0, SNOW_C);
  pixel(ctx, dx + 3, dy + 0, SNOW_A);
  pixel(ctx, dx + 4, dy + 0, SNOW_C);
  pixel(ctx, dx + 0, dy + 3, SNOW_A);
  pixel(ctx, dx + 0, dy + 4, SNOW_C);
  for (let t = 0; t < 8; t += 1) pixel(ctx, dx + t, dy + 7 - t, SNOW_A);
  for (let t = 0; t < 7; t += 1) pixel(ctx, dx + 1 + t, dy + 7 - t, SNOW_C);
  for (let t = 0; t < 4; t += 1) pixel(ctx, dx + 4 + t, dy + 7 - t, SNOW_A);
  for (let t = 0; t < 3; t += 1) pixel(ctx, dx + 5 + t, dy + 7 - t, SNOW_C);
}
function drawSnow(ctx) {
  drawSnowPart(ctx, 0, 0);
  drawSnowPart(ctx, 8, 0);
  drawSnowPart(ctx, 8, 8);
  drawSnowPart(ctx, 0, 8);
}
var eaglePoints = [
  [8, 3],
  [3, 6],
  [4, 7],
  [6, 8],
  [9, 8],
  [11, 7],
  [12, 6]
];
function drawEagleInitial(ctx) {
  path(
    ctx,
    "M0,1 h2 v1 h1 v1 h1 v2 h2 v1 h1 v-3 h-1 v-1 h3 v1 h1 v1 h-1 v2 h1 v-1 h2 v-2 h1 v-1 h1 v-1 h2 v1 h-1 v1 h1 v1 h-1 v1 h1 v1 h-2 v1 h1 v1 h-1 v2 h-1 v1 h-3 v-1 h-1 v2 h1 v1 h2 v2 h-2 v-1 h-1 v1 h-2 v-1 h-1 v1 h-2 v-2 h2 v-1 h1 v-2 h-1 v1 h-3 v-1 h-1 v-2 h-1 v-1 h1 v-1 h-2 v-1 h1 v-1 h-1 v-1 h1 v-1 h-1 v-1",
    "#636363"
  );
  for (const [x, y] of eaglePoints) {
    pixel(ctx, x, y, "#6b0800");
  }
}
function drawEagleBroken(ctx) {
  path(ctx, "M1,8 h1 v-2 h1 v-1 h1 v-2 h1 v-1 h1 v2 h-1 v1 h-1 v2 h-1 v2 h-1 v7 h-1 v-8", "#9C4A00");
  path(
    ctx,
    "M7,3 h1 v1 h1 v1 h1 v1 h3 v1 h1 v2 h1 v2 h-1 v2 h-1 v-4 h-1 v2 h-1 v-1 h-2 v1 h-1 v2 h-1 v-1 h-2 v-1 h-2 v-1 h1 v-3 h1 v-2 h1 v-1 h1 v-1",
    "#636363"
  );
}

// games/tank/src/vendor/engine/constants.ts
var frame = (n) => 1e3 / 60 * n;
var BLOCK_SIZE = 16;
var FIELD_BLOCK_SIZE = 13;
var FIELD_SIZE = BLOCK_SIZE * FIELD_BLOCK_SIZE;
var SCREEN_WIDTH = 16 * BLOCK_SIZE;
var SCREEN_HEIGHT = 15 * BLOCK_SIZE;
var TANK_COLOR_SCHEMES = {
  yellow: { a: "#E7E794", b: "#E79C21", c: "#6B6B00" },
  green: { a: "#B5F7CE", b: "#008C31", c: "#005200" },
  silver: { a: "#FFFFFF", b: "#ADADAD", c: "#00424A" },
  red: { a: "#FFFFFF", b: "#B53121", c: "#5A007B" }
};
var ITEM_SIZE_MAP = {
  BRICK: 4,
  STEEL: 8,
  RIVER: BLOCK_SIZE,
  SNOW: BLOCK_SIZE,
  FOREST: BLOCK_SIZE
};
var N_MAP = {
  BRICK: FIELD_SIZE / ITEM_SIZE_MAP.BRICK,
  // 52
  STEEL: FIELD_SIZE / ITEM_SIZE_MAP.STEEL,
  // 26
  RIVER: FIELD_SIZE / ITEM_SIZE_MAP.RIVER,
  // 13
  SNOW: FIELD_SIZE / ITEM_SIZE_MAP.SNOW,
  // 13
  FOREST: FIELD_SIZE / ITEM_SIZE_MAP.FOREST
  // 13
};
var PLAYER_SPAWN_POS = {
  player1: { x: 4 * BLOCK_SIZE, y: 12 * BLOCK_SIZE },
  player2: { x: 8 * BLOCK_SIZE, y: 12 * BLOCK_SIZE }
};
var BOT_SPAWN_X = [6 * BLOCK_SIZE, 12 * BLOCK_SIZE, 0];
var BOT_FLICKER_DURATION = frame(56);
var SCORE_POPUP_DURATION = frame(48);
var SPAWN_HELMET_DURATION = frame(135);
var TIMER_FREEZE_TICK = frame(64);
var HELMET_POWERUP_DURATION = frame(630);
var SHOVEL_STEEL_DURATION = frame(1076);
var SHOVEL_BLINK_INTERVAL = frame(16);

// games/tank/src/vendor/render/sprites/tank.ts
function scheme(color) {
  const { a, b, c } = TANK_COLOR_SCHEMES[color];
  return { a, b, c };
}
function drawBasicTank(ctx, color, shape) {
  const s = scheme(color);
  const { a, b, c } = s;
  rect(ctx, 1, 5, 3, 9, a);
  rect(ctx, 2, 5, 1, 9, b);
  if (shape === 0) {
    bitmap(ctx, ["abb"], s, 1, 4);
    bitmap(ctx, ["abb"], s, 1, 14);
    for (let i = 0; i < 5; i += 1) rect(ctx, 1, 5 + 2 * i, 2, 1, c);
  } else {
    bitmap(ctx, ["acc"], s, 1, 4);
    bitmap(ctx, ["bcc"], s, 1, 14);
    for (let i = 0; i < 4; i += 1) rect(ctx, 1, 6 + 2 * i, 2, 1, c);
  }
  rect(ctx, 11, 4, 3, 11, c);
  pixel(ctx, 11, 4, a);
  if (shape === 0) {
    for (let i = 0; i < 6; i += 1) rect(ctx, 12, 4 + 2 * i, 2, 1, b);
  } else {
    for (let i = 0; i < 5; i += 1) rect(ctx, 12, 5 + 2 * i, 2, 1, b);
  }
  path(ctx, "M4,7 h1 v-1 h1 v2 h-1 v3 h1 v1 h1 v1 h-2 v-1 h-1 v-5", a);
  pixel(ctx, 4, 12, c);
  path(ctx, "M6,6 h1 v1 h3 v1 h1 v4 h-1 v1 h-3 v-1 h-1 v-1 h-1 v-3 h1 v-2", b);
  pixel(ctx, 10, 12, c);
  rect(ctx, 5, 13, 5, 1, c);
  rect(ctx, 8, 6, 2, 1, c);
  pixel(ctx, 10, 7, c);
  path(ctx, "M6,8 h2 v1 h-1 v2 h-1 v-3", a);
  path(ctx, "M8,9 h1 v3 h-2 v-1 h1 v-2", c);
  rect(ctx, 7, 2, 1, 5, a);
}
function drawFastPlayerTank(ctx, color, shape) {
  const s = scheme(color);
  const { a, b, c } = s;
  rect(ctx, 1, 5, 3, 11, a);
  rect(ctx, 2, 5, 2, 11, b);
  pixel(ctx, 3, 5, a);
  pixel(ctx, 3, 14, a);
  if (shape === 0) {
    bitmap(ctx, ["abb"], s, 1, 4);
    bitmap(ctx, ["ccc"], s, 1, 15);
    for (let i = 0; i < 5; i += 1) rect(ctx, 1, 5 + 2 * i, 2, 1, c);
  } else {
    bitmap(ctx, ["bcc"], s, 1, 4);
    bitmap(ctx, ["abb"], s, 1, 15);
    for (let i = 0; i < 5; i += 1) rect(ctx, 1, 6 + 2 * i, 2, 1, c);
  }
  rect(ctx, 11, 4, 3, 12, c);
  pixel(ctx, 11, 4, a);
  if (shape === 0) {
    for (let i = 0; i < 6; i += 1) rect(ctx, 12, 4 + 2 * i, 2, 1, b);
  } else {
    for (let i = 0; i < 6; i += 1) rect(ctx, 12, 5 + 2 * i, 2, 1, b);
    pixel(ctx, 11, 15, b);
  }
  path(ctx, "M4,5 h2 v3 h-1 v5 h1 v1 h-2 v-9", a);
  rect(ctx, 6, 4, 1, 2, c);
  path(ctx, "M8,4 h1 v1 h2 v10 h-7 v-1 h5 v-1 h1 v-5 h-1 v-2 h-1 v-2", c);
  path(ctx, "M6,6 h1 v1 h1 v-1 h1 v2 h1 v5 h-1 v1 h-3 v-1 h-1 v-5 h1 v-2", b);
  path(ctx, "M6,8 h2 v1 h-1 v3 h-1 v-4", a);
  path(ctx, "M8,9 h1 v4 h-2 v-1 h1 v-3", c);
  rect(ctx, 7, 0, 1, 7, a);
}
function drawPowerPlayerTank(ctx, color, shape) {
  const s = scheme(color);
  const { a, b, c } = s;
  rect(ctx, 1, 3, 1, 12, a);
  rect(ctx, 2, 3, 2, 12, b);
  if (shape === 0) {
    bitmap(ctx, ["bcc"], s, 1, 3);
    for (let i = 0; i < 5; i += 1) rect(ctx, 1, 5 + 2 * i, 1, 1, c);
  } else {
    bitmap(ctx, ["aaa"], s, 1, 3);
    for (let i = 0; i < 5; i += 1) rect(ctx, 1, 4 + 2 * i, 1, 1, c);
  }
  rect(ctx, 11, 3, 3, 12, c);
  if (shape === 0) {
    bitmap(ctx, ["a"], s, 11, 3);
    for (let i = 0; i < 6; i += 1) rect(ctx, 13, 4 + 2 * i, 1, 1, b);
  } else {
    bitmap(ctx, ["ab"], s, 11, 3);
    for (let i = 0; i < 6; i += 1) rect(ctx, 13, 3 + 2 * i, 1, 1, b);
  }
  path(ctx, "M3,5 h2 v1 h-1 v5 h1 v1 h1 v1 h-2 v-1 h-1 v-7", a);
  pixel(ctx, 4, 4, c);
  rect(ctx, 5, 3, 1, 2, a);
  rect(ctx, 6, 3, 1, 2, c);
  path(ctx, "M8,3 h2 v1 h1 v2 h-1 v-1 h-2 v-2", c);
  path(ctx, "M10,11 h1 v3 h-7 v-1 h5 v-1 h1 v-1 h1", c);
  path(ctx, "M5,5 h5 v1 h1 v5 h-1 v1 h-1 v1 h-3 v-1 h-1 v-1 h-1 v-5 h1 v-1", b);
  path(ctx, "M6,6 h2 v1 h-1 v4 h-1 v-5", a);
  path(ctx, "M8,7 h1 v5 h-2 v-1 h1 v-4", c);
  path(ctx, "M6,0 h3 v2 h-1 v3 h-1 v-3 h-1 v-2", a);
  path(ctx, "M8,0 h1 v2 h-2 v-1 h1 v-1", b);
}
function drawArmorPlayerTank(ctx, color, shape) {
  const s = scheme(color);
  const { a, b, c } = s;
  rect(ctx, 1, 1, 1, 14, a);
  rect(ctx, 2, 1, 2, 14, b);
  if (shape === 0) {
    for (let i = 0; i < 7; i += 1) rect(ctx, 1, 2 * i + 2, 1, 1, c);
    rect(ctx, 2, 14, 2, 1, c);
  } else {
    bitmap(ctx, ["bcc"], s, 1, 1);
    for (let i = 0; i < 6; i += 1) rect(ctx, 1, 2 * i + 3, 1, 1, c);
  }
  rect(ctx, 12, 1, 3, 14, b);
  pixel(ctx, 12, 1, a);
  if (shape === 0) {
    for (let i = 0; i < 6; i += 1) rect(ctx, 14, 2 * i + 2, 1, 1, c);
    rect(ctx, 13, 14, 2, 1, c);
  } else {
    for (let i = 0; i < 7; i += 1) rect(ctx, 14, 2 * i + 1, 1, 1, c);
    pixel(ctx, 13, 1, c);
  }
  path(ctx, "M4,2 h3 v-2 h2 v2 h3 v3 h-1 v7 h-7 v-10", b);
  path(ctx, "M3,2 h3 v3 h1 v-5 h1 v6 h-3 v6 h-1 v-9 h-1 v-1", a);
  rect(ctx, 9, 2, 1, 3, c);
  path(ctx, "M6,7 h3 v1 h-2 v2 h-1 v-3", a);
  path(ctx, "M9,8 h1 v3 h-3 v-1 h2 v-2", c);
  path(ctx, "M12,3 h1 v10 h-1 v-1 h-1 v-7 h1 v-2", c);
  path(ctx, "M4,12 h7 v1 h1 v1 h-9 v-1 h1 v-1", c);
  pixel(ctx, 11, 12, b);
  pixel(ctx, 12, 13, b);
  pixel(ctx, 13, 2, c);
  pixel(ctx, 12, 14, c);
  pixel(ctx, 13, 13, c);
}
function drawBasicBotTank(ctx, color, shape) {
  const s = scheme(color);
  const { a, b, c } = s;
  rect(ctx, 1, 3, 1, 11, a);
  rect(ctx, 2, 3, 2, 11, b);
  if (shape === 0) {
    for (let i = 0; i < 5; i += 1) rect(ctx, 1, 2 * i + 4, 2, 1, c);
  } else {
    bitmap(ctx, ["bcc"], s, 1, 3);
    for (let i = 0; i < 5; i += 1) rect(ctx, 1, 2 * i + 5, 2, 1, c);
  }
  rect(ctx, 11, 3, 3, 11, b);
  pixel(ctx, 11, 3, a);
  if (shape === 0) {
    for (let i = 0; i < 5; i += 1) rect(ctx, 12, 2 * i + 4, 2, 1, c);
    pixel(ctx, 7, 14, b);
  } else {
    for (let i = 0; i < 6; i += 1) rect(ctx, 12, 2 * i + 3, 2, 1, c);
    pixel(ctx, 7, 14, c);
  }
  path(ctx, "M5,4 h1 v3 h-1 v4 h1 v2 h-1 v-1 h-1 v-7 h1 v-1", a);
  path(ctx, "M8,3 h1 v1 h1 v1 h1 v7 h-1 v1 h-1 v1 h-3 v-1 h2 v-1 h1 v-1 h1 v-4 h-1 v-1 h-1 v-3", c);
  path(ctx, "M6,3 h1 v3 h2 v1 h1 v4 h-1 v1 h-1 v1 h-2 v-2 h-1 v-4 h1 v-4", b);
  path(ctx, "M7,7 h1 v2 h-1 v1 h-1 v-2 h1 v-1", c);
  path(ctx, "M8,8 h1 v2 h-2 v-1 h1 v-1", a);
  rect(ctx, 7, 0, 1, 6, a);
}
function drawFastBotTank(ctx, color, shape) {
  const s = scheme(color);
  const { a, b, c } = s;
  rect(ctx, 1, 2, 2, 3, c);
  rect(ctx, 1, 7, 2, 3, c);
  rect(ctx, 1, 12, 2, 3, c);
  if (shape === 0) {
    for (let i = 0; i < 3; i += 1) rect(ctx, 1, 5 * i + 2, 1, 1, b);
  } else {
    for (let i = 0; i < 3; i += 1) rect(ctx, 1, 5 * i + 3, 1, 1, b);
  }
  rect(ctx, 12, 2, 2, 3, c);
  rect(ctx, 12, 7, 2, 3, c);
  rect(ctx, 12, 12, 2, 3, c);
  if (shape === 0) {
    for (let i = 0; i < 3; i += 1) rect(ctx, 12, 5 * i + 2, 1, 1, b);
    pixel(ctx, 7, 14, a);
  } else {
    for (let i = 0; i < 3; i += 1) rect(ctx, 12, 5 * i + 3, 1, 1, b);
    pixel(ctx, 7, 14, b);
  }
  path(ctx, "M4,2 h2 v4 h-1 v5 h1 v1 h3 v1 h-5 v1 h-1 v-11 h1 v-1", a);
  pixel(ctx, 9, 11, a);
  path(ctx, "M3,4 h1 v1 h1 v1 h-1 v6 h2 v1 h-2 v1 h-1 v-10", b);
  rect(ctx, 6, 2, 1, 3, c);
  path(ctx, "M8,2 h1 v2 h2 v11 h-3 v-1 h-1 v1 h-3 v-2 h5 v-1 h1 v-6 h-1 v-1 h-1 v-3", c);
  rect(ctx, 9, 2, 2, 2, b);
  rect(ctx, 11, 3, 1, 11, b);
  path(ctx, "M6,5 h1 v1 h1 v-1 h1 v1 h1 v5 h-1 v1 h-3 v-1 h-1 v-5 h1 v-1", b);
  path(ctx, "M7,7 h1 v2 h-1 v1 h-1 v-2 h1 v-1", c);
  path(ctx, "M8,8 h1 v2 h-2 v-1 h1 v-1", a);
  rect(ctx, 7, 0, 1, 6, a);
}
function drawPowerBotTank(ctx, color, shape) {
  const s = scheme(color);
  const { a, b, c } = s;
  rect(ctx, 1, 3, 1, 12, a);
  rect(ctx, 2, 3, 2, 12, b);
  if (shape === 0) {
    for (let i = 0; i < 6; i += 1) rect(ctx, 1, 2 * i + 4, 2, 1, c);
  } else {
    bitmap(ctx, ["bcc"], s, 1, 3);
    for (let i = 0; i < 5; i += 1) rect(ctx, 1, 2 * i + 5, 2, 1, c);
  }
  rect(ctx, 11, 3, 3, 12, b);
  pixel(ctx, 11, 3, a);
  if (shape === 0) {
    for (let i = 0; i < 6; i += 1) rect(ctx, 12, 2 * i + 4, 2, 1, c);
    pixel(ctx, 7, 14, a);
  } else {
    for (let i = 0; i < 6; i += 1) rect(ctx, 12, 2 * i + 3, 2, 1, c);
    pixel(ctx, 7, 14, b);
  }
  path(ctx, "M5,4 h1 v3 h-1 v4 h1 v1 h1 v2 h-2 v-2 h-1 v-7 h1 v-1", a);
  pixel(ctx, 6, 14, b);
  path(ctx, "M6,3 h1 v3 h2 v1 h1 v4 h-1 v1 h-1 v1 h-1 v-1 h-1 v-1 h-1 v-4 h1 v-4", b);
  path(
    ctx,
    "M8,3 h1 v1 h1 v1 h1 v7 h-1 v2 h-1 v1 h-1 v-1 h-1 v-1 h1 v-1 h1 v-1 h1 v-4 h-1 v-1 h-1 v-3",
    c
  );
  path(ctx, "M7,7 h1 v2 h-1 v1 h-1 v-2 h1 v-1", c);
  path(ctx, "M8,8 h1 v2 h-2 v-1 h1 v-1", a);
  path(ctx, "M6,0 h2 v6 h-1 v-5 h-1 v-1", a);
  pixel(ctx, 8, 0, b);
}
function drawArmorBotTank(ctx, color, shape) {
  const s = scheme(color);
  const { a, b, c } = s;
  rect(ctx, 1, 0, 1, 15, a);
  rect(ctx, 2, 0, 2, 15, b);
  if (shape === 0) {
    for (let i = 0; i < 7; i += 1) rect(ctx, 1, 2 * i + 1, 2, 1, c);
  } else {
    bitmap(ctx, ["bc"], s, 1, 0);
    for (let i = 0; i < 7; i += 1) rect(ctx, 1, 2 * i + 2, 2, 1, c);
  }
  rect(ctx, 11, 0, 3, 15, b);
  pixel(ctx, 11, 0, a);
  pixel(ctx, 11, 14, c);
  if (shape === 0) {
    for (let i = 0; i < 7; i += 1) rect(ctx, 12, 2 * i + 1, 2, 1, c);
    pixel(ctx, 7, 14, b);
  } else {
    for (let i = 0; i < 8; i += 1) rect(ctx, 12, 2 * i, 2, 1, c);
    pixel(ctx, 7, 14, a);
  }
  path(ctx, "M4,1 h2 v-1 h3 v1 h2 v4 h-1 v7 h-5 v1 h-1 v-12", b);
  path(ctx, "M6,0 h2 v6 h1 v-2 h1 v3 h-5 v5 h-1 v-9 h1 v2 h1 v1 h1 v-4 h-1 v-2", a);
  pixel(ctx, 5, 1, c);
  pixel(ctx, 9, 1, c);
  rect(ctx, 8, 2, 1, 4, c);
  path(ctx, "M11,3 h1 v10 h-1 v-1 h-1 v-7 h1 v-2", c);
  path(ctx, "M4,13 h1 v-1 h5 v1 h1 v1 h-7 v-1", c);
  pixel(ctx, 10, 12, b);
  path(ctx, "M7,7 h1 v2 h-1 v1 h-1 v-2 h1 v-1", c);
  path(ctx, "M8,8 h1 v2 h-2 v-1 h1 v-1", a);
}
var PLAYER_DRAWERS = {
  basic: drawBasicTank,
  fast: drawFastPlayerTank,
  power: drawPowerPlayerTank,
  armor: drawArmorPlayerTank
};
var BOT_DRAWERS = {
  basic: drawBasicBotTank,
  fast: drawFastBotTank,
  power: drawPowerBotTank,
  armor: drawArmorBotTank
};
function drawTank(ctx, side, level, color, shape) {
  const drawer = side === "player" ? PLAYER_DRAWERS[level] : BOT_DRAWERS[level];
  drawer(ctx, color, shape);
}

// games/tank/src/vendor/render/sprites/helmet.ts
var CORNERS = [
  "M0,8 v-2 h1 v-1 h1 v-1 h2 v-2 h1 v-1 h1 v-1 h2 v1 h-2 v1 h-1 v2 h-1 v1 h-2 v1 h-1 v2 h-1",
  "M0,2 h1 v-1 h1 v-1 h2 v1 h1 v1 h2 v1 h1 v1 h-1 v-1 h-2 v-1 h-1 v-1 h-2 v1 h-1 v2 h1 v1 h1 v2 h1 v1 h-1 v-1 h-1 v-2 h-1 v-1 h-1 v-2"
];
function drawHelmet(ctx, index) {
  const transforms = [
    [0, 0, 0],
    [16, 0, 90],
    [16, 16, 180],
    [0, 16, 270]
  ];
  for (const [dx, dy, deg] of transforms) {
    ctx.save();
    ctx.translate(dx, dy);
    ctx.rotate(deg * Math.PI / 180);
    path(ctx, CORNERS[index], "#ffffff");
    ctx.restore();
  }
}

// games/tank/src/vendor/render/sprites/flicker.ts
var SHAPES = {
  0: [
    [3, 7, 9, 1],
    [6, 6, 3, 3],
    [7, 3, 1, 9]
  ],
  1: [
    [2, 7, 11, 1],
    [5, 6, 5, 3],
    [6, 5, 3, 5],
    [7, 2, 1, 11]
  ],
  2: [
    [1, 7, 13, 1],
    [4, 6, 7, 3],
    [6, 4, 3, 7],
    [7, 1, 1, 13]
  ],
  3: [
    [0, 7, 15, 1],
    [3, 6, 9, 3],
    [5, 5, 5, 5],
    [6, 3, 3, 9],
    [7, 0, 1, 15]
  ]
};
function drawFlicker(ctx, shape) {
  for (const [x, y, w, h] of SHAPES[shape]) {
    rect(ctx, x, y, w, h, "#ffffff");
  }
}

// games/tank/src/vendor/render/sprites/powerup.ts
var scheme2 = { " ": "none", w: "#FFFFFF", g: "#ADADAD", b: "#00424A" };
var DATA = {
  tank: [
    " wwwwwwwwwwwwwg ",
    "w             wb",
    "w bbbbbbbbbbbbwb",
    "w bbbbbwgg bbbwb",
    "w bwwwwgggb bbwb",
    "w b    gggb bbwb",
    "w bbbwggbbgb bwb",
    "w bbwgggggbb bwb",
    "w bgbg      g wb",
    "w bggwwwwgggb wb",
    "w b w w w wbg wb",
    "w bb ggggggg bwb",
    "w bbb       bbwb",
    "gwwwwwwwwwwwwwwg",
    " bbbbbbbbbbbbbb ",
    "                "
  ],
  star: [
    " wwwwwwwwwwwwwg ",
    "w             wb",
    "w bbbbbw bbbbbwb",
    "w bbbbwwg bbbbwb",
    "w bbbbwwg bbbbwb",
    "w wwwwwggwwww wb",
    "w bgggwgwggg  wb",
    "w bbgwwwwgg  wwb",
    "w bbwwggwwg bbwb",
    "w bgwgg ggwg bwb",
    "w bwgg   ggw bwb",
    "w bg   bb  g bwb",
    "w b  bbbbbb  bwb",
    "gwwwwwwwwwwwwwgb",
    " bbbbbbbbbbbbbb ",
    "                "
  ],
  grenade: [
    " wwwwwwwwwwwwwg ",
    "w             wb",
    "w bbbwwwgg bbbwb",
    "w bbbwgb  g bbwb",
    "w bbwgggb  g bwb",
    "w bwgbwgbg g bwb",
    "w bg g  g  g bwb",
    "w bwgbwgbg g bwb",
    "w bg g  g  g bwb",
    "w bwgbwgbg g bwb",
    "w bbgb  g bbbbwb",
    "w bbbwgg bbbbbwb",
    "w bbb   bbbbbbwb",
    "gwwwwwwwwwwwwwgb",
    " bbbbbbbbbbbbbb ",
    "                "
  ],
  timer: [
    " wwwwwwwwwwwwwg ",
    "w             wb",
    "w bbbbwgwg bbbwb",
    "w bbbbg   wg bwb",
    "w bbbgggg    bwb",
    "w bbgwwwwg bbbwb",
    "w bgwwbwwwg bbwb",
    "w bgwwbwwwg bbwb",
    "w bgwwwbwwg bbwb",
    "w b gwwwwg bbbwb",
    "w bb gggg bbbbwb",
    "w bbb    bbbbbwb",
    "w bbbbbbbbbbbbwb",
    "gwwwwwwwwwwwwwgb",
    " bbbbbbbbbbbbbb ",
    "                "
  ],
  helmet: [
    " wwwwwwwwwwwwwg ",
    "w             wb",
    "w bbbbbbbbbbbbwb",
    "w bbbbbbbbbbbbwb",
    "w bbbwwwgg bbbwb",
    "w bbwwggggg bbwb",
    "w bbwgggggg bbwb",
    "w bbggggggg bbwb",
    "w bgggggggg bbwb",
    "w b     gggg bwb",
    "w bbbbbb     bwb",
    "w bbbbbbbbbbbbwb",
    "w bbbbbbbbbbbbwb",
    "gwwwwwwwwwwwwwgb",
    " bbbbbbbbbbbbbb ",
    "                "
  ],
  shovel: [
    " wwwwwwwwwwwwwg ",
    "w             wb",
    "w bbbbbbbbwbbbwb",
    "w bbbbbbbbwgbbwb",
    "w bbbbbbbbgggbwb",
    "w bbbbbbbw   bwb",
    "w bbbwbbw bbbbwb",
    "w bbwwgw bbbbbwb",
    "w bwwgbw bbbbbwb",
    "w bwgbggg bbbbwb",
    "w bggggg bbbbbwb",
    "w bgggg bbbbbbwb",
    "w b    bbbbbbbwb",
    "gwwwwwwwwwwwwwgb",
    " bbbbbbbbbbbbbb ",
    "                "
  ]
};
function drawPowerUp(ctx, name) {
  bitmap(ctx, DATA[name], scheme2);
}

// games/tank/src/vendor/render/sprites/explosion.ts
var scheme3 = { " ": "none", W: "#fffffe", P: "#590d79", R: "#b53121" };
var SMALL = {
  s0: [
    "                ",
    "                ",
    "       W     W  ",
    "   W   W  W W   ",
    "   PWW PW WWP   ",
    "    PPWWPPWP    ",
    "     PWRWRWPWW  ",
    "   WWWPWR RPP   ",
    "     PW RRWP    ",
    "     WWRWPRWP   ",
    "    WP WPWWPWP  ",
    "   WP PW PW  W  ",
    "      W   P     ",
    "                ",
    "                "
  ],
  s1: [
    "                ",
    "      P   W     ",
    " W  P WP WP   W ",
    " PWW  PW WP WWP ",
    "  PPWPPWWWPWPP  ",
    "   PWRWWWPRWW P ",
    " P  PWR RWWPP   ",
    "   WWWWRRR PWWW ",
    "WW WPW RR WWPP  ",
    "  PPWWPRRRWPP P ",
    "    WRWP PWRW   ",
    "  P PWRWWWRPWW  ",
    "   PWPWPPWW PPW ",
    "   WPPWP PW   P ",
    "  WP  W P PP    ",
    "                "
  ],
  s2: [
    "    P P    P  P ",
    " W   W  W P  WP ",
    " PPWW  WW   WP  ",
    "  PPWPPWPP WWP  ",
    "   PRWWWWPWWPP P",
    " W PWWRW WWRP   ",
    "WWWW WR  RWWWWWW",
    " PPPWWPR RWPPP  ",
    "   PPP WR PPWW  ",
    " WPPWWPW WRWPPW ",
    "  WWWRWPWPWW    ",
    " PWPPWPWWPPWW P ",
    " WP  P PWP PPW  ",
    "WP  P   W    PW ",
    "        W P   P "
  ]
};
var BIG = {
  b0: [
    "                                ",
    "                     W       W  ",
    "  W       W          W       W  ",
    "   W  W  W   PPP WWP  W     W   ",
    "    P  W   WWWPPPWWPP W W  P    ",
    "     W P  WPWWW W  WPPW W WW    ",
    "      W   WWPW WPPP WWWW W      ",
    "    WW   WWWWWWWWWPWWWWWW W     ",
    "       PPPW  WWWPWWPWW PW    PW ",
    "      WPPPWWWWWPWW WW WWPW   W  ",
    "P    WW WPWWWRWWRWWWPWWWPWWW    ",
    " WP PW WWWRRWWWWRPWWWPWPW WPW   ",
    "  W WW WWWWRRWRWRWWRRPWW WPPW   ",
    " W   WW WPWRWRRRRRRWRWWWW WW    ",
    "  W WPWWPPWWRWRWWRWRPWWWWW WW   ",
    "    PP PWPWWRRWP WRWWWW W WPP   ",
    "      WWPWRRRW WPW RW PWWW PP   ",
    "     WWWWWWWRRWRPRRRWPPPWWWP  W ",
    "     WW WWWWRWRRPRWWRWW WWPP   W",
    "    PW WWPWRWWWRWRPWWWWWPPPP    ",
    "    PPWPPPWWWWPRRWWWWPWWW P W   ",
    "  W  PPPPWWWWPPWRWWWWWPWW WW    ",
    "   W    PW WPPWWWW WW PW WP     ",
    "        WW WWW WWWW  PPWWPP     ",
    "      WP WW W PPWWWWPPWW P      ",
    "     P W WWWWWPP  PPP W W WW    ",
    "    W      PPPP         W  P    ",
    "   W     W        W  W     WP   ",
    "  P        W       PWP      WP  ",
    "  W                W W       W  ",
    "                                ",
    "                                "
  ],
  b1: [
    "W                               ",
    "PW   W             PPWW       W ",
    " PW   P     WPPP PWWWWPP    WP  ",
    "  PP    WW WWWP PWWW  WPP  WP   ",
    "   PP  WPWWWRWWW WW WP WPP  P   ",
    "   P  WWPPRPWWWWWWWWWWP WP      ",
    "      WPWWWWPWWWWWWPPWW WP WW   ",
    "    PPWWWWWWWWWPPWWWWPWWWPPWWP  ",
    "    PWWWW WPPWWWWPWWWWWWPPWWPPP ",
    "     WW  WWWWWRWWWWRWWWWPWW WPP ",
    "   WWW WWWRWWWRRWWRRWRWPWWWW WP ",
    "  PWWWWWWWRRRWRWRRRWRWWWWPWW WPW",
    "  WPWW WWWR RRWPRRWRWWWWWPW WPPP",
    "   PW PWWWWRWWR RWRWWWRWPW WPPW ",
    "   PP PWWWWRRRRWPRRRWRWWWWWWP   ",
    " W WWW PWRRRRRWWW WRWWWWWWPPWW  ",
    " WWWWWWWWWWRRP WWRRRRWWWWPWWWPP ",
    "WWWRPWWWWRWRWWRPWWR WRRRWWWWWWP ",
    "WWWWPWWWRWWRRRR RRWRWWWWWWW WWPW",
    "PWWPWRWWWWRRWRRWRRRRWWWWWPWW WWP",
    "PPPPWWPPWRRPPWRRRWWRRWWPPWWWW W ",
    " PP WWWWWWWWWWRWWWWWWRWWWPWW WPW",
    "     WWWWWWWPWWWWWWPWWWWWWWWW WP",
    "    WW WW WWWWWWW PP WWWWWWWPWPW",
    "    WWW  PPWWWPWWW  WWWP WW  PWW",
    "    WWWWWWPPWWW WWWWPWWPP  WPPW ",
    "    PWWWWP WWWW WWWPPPWWPPPPPW  ",
    "  W  PWPP  PPPWW PPP WRWWPPW    ",
    "   W  PP      WWW   WWWPP    W  ",
    "  P P     WP   WWWWWWWPPW  P P  ",
    " W  P       W   WWPPWPPP    P W ",
    "W          W     PPP P         P"
  ]
};
function explosionSize(shape) {
  return shape === "b0" || shape === "b1" ? 32 : 16;
}
function drawExplosion(ctx, shape) {
  if (shape === "b0" || shape === "b1") {
    bitmap(ctx, BIG[shape], scheme3);
  } else {
    bitmap(ctx, SMALL[shape], scheme3);
  }
}

// games/tank/src/vendor/render/tankColor.ts
var WITH_POWER_UP_COLORS = [
  ["red", 8],
  ["silver", 8]
];
var ARMOR_COLORS = {
  2: [
    ["green", 3],
    ["yellow", 1],
    ["green", 1],
    ["yellow", 1]
  ],
  3: [
    ["silver", 3],
    ["yellow", 1],
    ["silver", 1],
    ["yellow", 1]
  ],
  4: [
    ["silver", 3],
    ["green", 1],
    ["silver", 1],
    ["green", 1]
  ]
};
function pickColor(timing, elapsed) {
  const period = timing.reduce((sum, [, n]) => sum + frame(n), 0);
  let t = elapsed % period;
  for (const [color, n] of timing) {
    t -= frame(n);
    if (t < 0) {
      return color;
    }
  }
  return timing[timing.length - 1][0];
}
function tankColor(tank, time) {
  if (tank.side === "player") {
    return tank.color;
  }
  const elapsed = time - tank.bornAt;
  if (tank.withPowerUp) {
    return pickColor(WITH_POWER_UP_COLORS, elapsed);
  }
  const armor = tank.level === "armor" ? ARMOR_COLORS[tank.hp] : void 0;
  return armor != null ? pickColor(armor, elapsed) : tank.color;
}

// games/tank/src/renderer.ts
var spriteCache = /* @__PURE__ */ new Map();
function sprite(ctx, key, w, h, x, y, paint) {
  let canvas = spriteCache.get(key);
  if (!canvas) {
    canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    paint(canvas.getContext("2d"));
    spriteCache.set(key, canvas);
  }
  ctx.drawImage(canvas, Math.round(x), Math.round(y));
}
async function loadAssets() {
  return {};
}
function draw(canvas, g) {
  const c = canvas.getContext("2d");
  c.imageSmoothingEnabled = false;
  c.fillStyle = "#636363";
  c.fillRect(0, 0, 256, 240);
  c.save();
  c.translate(8, 16);
  c.fillStyle = "#000";
  c.fillRect(0, 0, 208, 208);
  const s = g.session, scene = s.scene;
  if (scene) {
    const m = scene.map, time = scene.time;
    m.forEachBrick((x, y) => sprite(c, "brick" + (x + y) / 4 % 2, 4, 4, x, y, (a) => drawBrick(a, (x + y) / 4 % 2 === 0)));
    m.forEachSteel((x, y) => sprite(c, "steel", 8, 8, x, y, drawSteel));
    m.forEachSnow((x, y) => sprite(c, "snow", 16, 16, x, y, drawSnow));
    const water = Math.floor(time / 600) % 2;
    m.forEachRiver((x, y) => sprite(c, "river" + water, 16, 16, x, y, (a) => drawRiver(a, water)));
    if (m.eagle) sprite(c, "eagle" + m.eagleBroken, 16, 16, m.eagle.x, m.eagle.y, m.eagleBroken ? drawEagleBroken : drawEagleInitial);
    for (const p of scene.powerUps) if (p.visible) sprite(c, "item" + p.name, 16, 16, p.x, p.y, (a) => drawPowerUp(a, p.name));
    for (const t of scene.tanks) {
      if (!t.alive || !t.visible) continue;
      const color = tankColor(t, time), shape = t.moving ? Math.floor(time / 80) % 2 : 0;
      c.save();
      c.translate(Math.round(t.x) + 8, Math.round(t.y) + 8);
      c.rotate({ up: 0, right: 1, down: 2, left: 3 }[t.direction] * Math.PI / 2);
      sprite(c, `tank/${t.side}/${t.level}/${color}/${shape}`, 16, 16, -8, -8, (a) => drawTank(a, t.side, t.level, color, shape));
      c.restore();
      if (t.helmetDuration > 0) {
        const h = Math.floor(time / (1e3 / 30)) % 2;
        sprite(c, "helmet" + h, 16, 16, t.x, t.y, (a) => drawHelmet(a, h));
      }
    }
    for (const b of scene.bullets) {
      c.fillStyle = "#fff";
      c.fillRect(Math.round(b.x), Math.round(b.y), 3, 3);
    }
    for (const f of scene.flickers) {
      const shape = f.shape();
      sprite(c, "spawn" + shape, 16, 16, f.x, f.y, (a) => drawFlicker(a, shape));
    }
    m.forEachForest((x, y) => sprite(c, "forest", 16, 16, x, y, drawForest));
    for (const e of scene.explosions) {
      const shape = e.shape(), size = explosionSize(shape);
      sprite(c, "explosion" + shape, size, size, e.cx - size / 2, e.cy - size / 2, (a) => drawExplosion(a, shape));
    }
    c.font = "7px monospace";
    c.fillStyle = "#fff";
    for (const p of scene.scorePopups) if (p.visible) c.fillText(String(p.score), p.x, p.y + 6);
  }
  c.restore();
  c.font = "bold 9px monospace";
  c.fillStyle = "#000";
  c.fillText("IP", 225, 150);
  c.fillText(g.cheats?.infiniteLives ? "\u221E" : String(Math.max(0, g.lives - 1)), g.cheats?.infiniteLives ? 229 : 237, 161);
  const remaining = scene?.remainingBotCount ?? 20;
  for (let i = 0; i < remaining; i++) {
    const x = 225 + i % 2 * 9, y = 18 + Math.floor(i / 2) * 10;
    c.fillStyle = "#000";
    c.fillRect(x, y, 6, 7);
    c.fillRect(x + 2, y - 2, 2, 4);
    c.fillStyle = "#636363";
    c.fillRect(x + 2, y + 3, 2, 2);
  }
  c.fillStyle = "#000";
  c.fillRect(226, 184, 2, 17);
  c.fillStyle = "#000";
  c.fillRect(228, 184, 12, 8);
  c.fillStyle = "#636363";
  c.fillRect(231, 186, 7, 4);
  c.fillStyle = "#000";
  c.fillText(String(g.level).padStart(2, "0"), 229, 213);
  if (s.phase === "enter") {
    const h = s.curtain * 104;
    c.fillStyle = "#636363";
    c.fillRect(8, 16, 208, h);
    c.fillRect(8, 224 - h, 208, h);
    if (s.curtain > 0.95) {
      c.fillStyle = "#000";
      c.font = "bold 12px monospace";
      c.textAlign = "center";
      c.fillText(`STAGE ${g.level}`, 112, 124);
      c.textAlign = "left";
    }
  }
  if (s.phase === "statistics") {
    c.fillStyle = "#000";
    c.fillRect(0, 0, 256, 240);
    c.textAlign = "center";
    c.font = "bold 12px monospace";
    c.fillStyle = "#e79c21";
    c.fillText("STAGE " + g.level, 128, 35);
    c.fillStyle = "#fff";
    c.fillText("BATTLE REPORT", 128, 60);
    c.fillStyle = "#e79c21";
    c.fillText(String(g.score).padStart(6, "0"), 128, 85);
    const kills = scene?.killInfo[0] || {};
    ["basic", "fast", "power", "armor"].forEach((type, i) => {
      sprite(c, "report" + type, 16, 16, 65, 105 + i * 24, (a) => drawTank(a, "bot", type, "silver", 0));
      c.fillStyle = "#fff";
      c.fillText(String(kills[type] || 0).padStart(2, "0") + "  HITS", 151, 118 + i * 24);
    });
    c.textAlign = "left";
  }
  if (s.phase === "gameover") {
    c.fillStyle = "#d64b36";
    c.textAlign = "center";
    c.font = "bold 14px monospace";
    c.fillText("GAME", 112, 218 - s.gameoverProgress * 96);
    c.fillText("OVER", 112, 234 - s.gameoverProgress * 96);
    c.textAlign = "left";
  }
}
export {
  draw,
  loadAssets
};

// Run this function through playwright-cli run-code in an isolated browser
// session. It exercises real DOM controls, never calls the app's handlers.
export async function browserSmoke(page) {
  const base = new URL('/games/lianliankan/', page.url()).href;
  const results = [], errors = [];
  page.on('pageerror', error => errors.push(error.message));
  const assert = (value, message) => { if (!value) throw Error(message); };
  const state = platform => page.evaluate(platform => {
    const envelope = JSON.parse(localStorage.getItem(`fish-lianliankan:${platform}:v1`));
    return {envelope, game: JSON.parse(envelope.game)};
  }, platform);
  const untilStatus = async status => {
    await page.waitForFunction(status => JSON.parse(JSON.parse(localStorage.getItem(`fish-lianliankan:${document.body.dataset.platform}:v1`)).game).status === status, status);
  };
  const clickPair = async platform => {
    const move = await page.evaluate(async platform => {
      const {findMove} = await import('./engine.mjs');
      const game = JSON.parse(JSON.parse(localStorage.getItem(`fish-lianliankan:${platform}:v1`)).game);
      return findMove(game);
    }, platform);
    assert(move, 'Playable board has no move');
    const before = (await state(platform)).game.removed;
    await page.locator(`.tile[data-index="${move.a}"]`).click();
    await page.locator(`.tile[data-index="${move.b}"]`).click();
    await page.waitForTimeout(330);
    assert((await state(platform)).game.removed === before + 2, 'DOM pair did not disappear');
  };
  await page.setViewportSize({width:390, height:844});
  await page.goto(base+'assets/icon.svg');
  await page.evaluate(() => {
    for (const platform of ['pc','mobile']) localStorage.removeItem(`fish-lianliankan:${platform}:v1`);
  });
  await page.goto(base);
  await page.waitForURL('**/mobile.html');
  const pcBefore = await page.evaluate(() => localStorage.getItem('fish-lianliankan:pc:v1'));
  await page.getByRole('button', {name:'开始收获', exact:true}).click();
  await untilStatus('running');
  await page.locator('#hint-button').click();
  assert((await state('mobile')).game.hints === 2, 'Hint count');
  assert(await page.locator('.tile.hinted').count() === 2, 'Hint highlights');
  const hinted = await page.locator('.tile.hinted').evaluateAll(tiles => tiles.map(t => t.dataset.index));
  for (const index of hinted) await page.locator(`.tile[data-index="${index}"]`).click();
  await page.waitForTimeout(330);
  assert((await state('mobile')).game.removed === 2, 'Hinted pair match');
  const beforeShuffle = (await state('mobile')).game;
  await page.locator('#shuffle-button').click();
  const afterShuffle = (await state('mobile')).game;
  assert(afterShuffle.shuffles === 2, 'Shuffle count');
  assert(JSON.stringify([...beforeShuffle.board].sort()) === JSON.stringify([...afterShuffle.board].sort()), 'Shuffle changed inventory');
  const timeBefore = afterShuffle.remainingMs;
  await page.locator('#extend-button').click();
  const afterExtend = (await state('mobile')).game;
  assert(afterExtend.extensions === 1 && afterExtend.remainingMs - timeBefore > 29000, 'Extension count/time');
  await page.locator('#pause-button').click();
  await untilStatus('paused');
  const pausedTimer = await page.locator('#timer').textContent();
  await page.waitForTimeout(800);
  assert(await page.locator('#timer').textContent() === pausedTimer, 'Paused clock changed');
  await page.locator('#overlay-content [data-action="start"]').click();
  await untilStatus('running');
  await page.getByRole('button', {name:'重新开始', exact:true}).click();
  assert(await page.locator('#confirm-dialog').isVisible(), 'Restart has no confirmation');
  await page.getByRole('button', {name:'继续本局', exact:true}).click();
  await untilStatus('running');
  assert((await state('mobile')).game.removed === 2, 'Cancel restart lost progress');
  await page.getByRole('button', {name:'自在慢玩', exact:true}).click();
  await page.getByRole('button', {name:'开启新一局', exact:true}).click();
  await untilStatus('ready');
  assert((await state('mobile')).game.mode === 'zen', 'Mode did not change');
  await page.getByRole('button', {name:'开始收获', exact:true}).click();
  for (let i = 0; i < 24; i++) await clickPair('mobile');
  await untilStatus('won');
  const won = await state('mobile');
  assert(won.game.board.every(v => v === 0) && won.envelope.records['normal:zen'].unlocked === 2, 'Win/unlock');
  assert(await page.getByRole('button', {name:'再收获一关', exact:true}).isVisible(), 'Missing victory action');
  await page.getByRole('button', {name:'再收获一关', exact:true}).click();
  await untilStatus('ready');
  assert((await state('mobile')).game.level === 2, 'Next level');
  await page.getByRole('button', {name:'开始收获', exact:true}).click();
  await clickPair('mobile');
  await page.locator('#pause-button').click();
  const savedRound = (await state('mobile')).game;
  await page.reload();
  await untilStatus('paused');
  const restored = (await state('mobile')).game;
  assert(JSON.stringify(restored.board) === JSON.stringify(savedRound.board) && restored.score === savedRound.score, 'Reload lost progress');
  await page.locator('[data-action="levels"]').first().click();
  assert(await page.locator('#level-grid button:disabled').count() === 28, 'Locked levels');
  await page.locator('[data-close="levels-dialog"]').click();
  assert(await page.evaluate(() => localStorage.getItem('fish-lianliankan:pc:v1')) === pcBefore, 'Mobile modified PC save');
  results.push({platform:'mobile', fullRound:true, tools:true, pause:true, confirm:true, nextLevel:true, restore:true, isolated:true});

  // Seed a short countdown in this test session to check the timeout UI and revival.
  const mobileBackup = await page.evaluate(() => localStorage.getItem('fish-lianliankan:mobile:v1'));
  // Leave the app before editing fixtures: its pagehide handler saves its round.
  await page.goto(base+'assets/icon.svg');
  await page.evaluate(async base => {
    const {newGame, serialize} = await import(base+'engine.mjs');
    const game = newGame({platform:'mobile', seed:123}); game.status='paused'; game.remainingMs=150;
    localStorage.setItem('fish-lianliankan:mobile:v1', JSON.stringify({game:serialize(game), sound:false}));
  }, base);
  await page.goto(base+'mobile.html');
  await page.locator('#overlay-content [data-action="start"]').click();
  await untilStatus('lost');
  await page.waitForTimeout(100);
  assert(await page.locator('.tile:not(.empty):enabled').count() === 0, 'Expired board accepts input');
  await page.getByRole('button', {name:'加时 30 秒 · 剩余 2 次', exact:true}).click();
  await untilStatus('running');
  assert((await state('mobile')).game.extensions === 1, 'Timeout revival');
  await page.goto(base+'assets/icon.svg');
  await page.evaluate(value => localStorage.setItem('fish-lianliankan:mobile:v1', value), mobileBackup);
  await page.goto(base+'mobile.html');
  results.push({timeout:true, revival:true});

  for (const [width, height] of [[320,658],[375,812],[390,844],[430,932],[768,1024]]) {
    await page.setViewportSize({width,height});
    const sizes = await page.evaluate(() => ({viewport:innerWidth,content:document.documentElement.scrollWidth,tile:document.querySelector('.tile').getBoundingClientRect().width}));
    assert(sizes.content <= sizes.viewport && sizes.tile >= 30, `Mobile overflow at ${width}`);
    results.push({viewport:`${width}x${height}`, overflow:false, tile:Math.round(sizes.tile)});
  }
  await page.setViewportSize({width:1366,height:900});
  await page.goto(base);
  await page.waitForURL('**/pc.html');
  const pcOverlayAction = page.locator('#overlay-content .primary-button');
  if (await pcOverlayAction.isVisible()) await pcOverlayAction.click();
  await untilStatus('running');
  const firstTile = page.locator('.tile:not(.empty)').first();
  await firstTile.focus(); await page.keyboard.press('ArrowRight');
  assert(await page.evaluate(() => document.activeElement.dataset.index) !== await firstTile.getAttribute('data-index'), 'Keyboard navigation');
  const hintsBefore = (await state('pc')).game.hints;
  await page.keyboard.press('h');
  assert((await state('pc')).game.hints === hintsBefore - 1, 'Keyboard hint');
  await page.keyboard.press('Space'); await untilStatus('paused');
  await page.locator('#overlay-content [data-action="start"]').click();
  while ((await state('pc')).game.status === 'running') await clickPair('pc');
  await untilStatus('won');
  assert((await state('pc')).game.removed === 80, 'Desktop full round');
  await page.locator('[data-difficulty="hard"]').click();
  await untilStatus('ready');
  assert((await state('pc')).game.board.length === 96, 'Desktop hard board');
  const desktopSizes = await page.evaluate(() => ({viewport:innerWidth,content:document.documentElement.scrollWidth,toolsBottom:document.querySelector('.toolbelt').getBoundingClientRect().bottom,height:innerHeight}));
  assert(desktopSizes.content <= desktopSizes.viewport, 'Desktop overflow');
  assert(desktopSizes.toolsBottom <= desktopSizes.height, 'Desktop tools below fold');
  results.push({platform:'pc', fullRound:true, keyboard:true, hardBoard:true, overflow:false, toolsVisible:true});
  assert(errors.length === 0, errors.join('; '));
  return {result:'PASS', results, pageErrors:errors};
}

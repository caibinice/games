async(page,phase='setup')=>{
 if(!/^http:\/\/(127\.0\.0\.1|localhost):/.test(page.url()))throw Error('Local QA only');
 const read=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('fish-zombie-meta-v1')).native.operations.xunxing);
 if(phase==='setup'){
  const proof=await page.context().newPage();await proof.goto('chrome://version');const flags=await proof.locator('#command_line').textContent();await proof.close();if(!flags.includes('--mute-audio'))throw Error('Muted browser required');
  await page.addInitScript(()=>{window.__starErrors=[];window.addEventListener('error',e=>window.__starErrors.push(e.message));window.addEventListener('unhandledrejection',e=>window.__starErrors.push(String(e.reason)));});
  await page.setViewportSize({width:390,height:844});
  await page.evaluate(async()=>{const {createMeta,META_KEY}=await import('./progression.mjs'),{defaultProfile,SAVE_KEY}=await import('./profile.mjs'),{operationState,selectStarReward}=await import('./operations.mjs'),{starOptions}=await import('./board-lotteries.mjs');const p=createMeta(20);p.entered=true;operationState(p,'xunxing').skipAnimation=true;selectStarReward(p,1,starOptions(1)[1].booty);localStorage.setItem(META_KEY,JSON.stringify(p));localStorage.setItem(SAVE_KEY,JSON.stringify({...defaultProfile(),sound:false,music:false}));});
  await page.reload();await page.locator('[data-operation="xunxing"]').click();await page.locator('.star-mode').waitFor();
  if(await page.locator('[data-star-cell]').count()!==14)throw Error('Source moon/star slots');
  if(await page.locator('[data-star-skip]').getAttribute('aria-pressed')!=='true')throw Error('Skip preference');
  return {phase,muted:true,state:await read()};
 }
 const draw=async()=>{
  const before=await read();await page.locator('[data-op-draw="7"]').click();
  await page.waitForFunction(()=>['transfer','big-sweep','big-result'].includes(document.querySelector('.star-mode')?.dataset.starPhase),null,{timeout:3000});
  await page.locator('#overlay:not([hidden]) .op-reward-cards').waitFor({timeout:10000});
  const after=await read();if(after.draws<=before.draws||after.draws-before.draws>7)throw Error('Invalid consecutive draw length');
  if(before.big.length===6){if(after.big.length||after.reset!==before.reset+1||new Set(after.lastRound).size!==7)throw Error('Seventh-prize reset');}
  else if(after.big.length!==before.big.length+1||after.reset!==before.reset)throw Error('Moon prize did not advance');
  if(after.last.filter(r=>r.starBigCell).length!==1)throw Error('Missing final moon reward');
  await page.getByRole('button',{name:'关闭',exact:true}).click();
  if(await page.locator('.star-active').count())throw Error('Highlight leaked after result');
  return {draws:after.draws,big:after.big,reset:after.reset,lastRound:after.lastRound};
 };
 if(phase==='draw2'||phase==='draw1'){
  const draws=[];for(let i=0;i<(phase==='draw2'?2:1);i++)draws.push(await draw());
  const errors=await page.evaluate(()=>window.__starErrors||[]);if(errors.length)throw Error(errors.join(';'));return {phase,draws,pageErrors:errors};
 }
 if(phase==='verify'){
  let s=await read();if(s.reset!==1||s.big.length||s.lastRound.length!==7)throw Error('First round did not finish');
  const next=await draw();if(next.reset!==1||next.big.length!==1)throw Error('Next round unreachable');
  const choice=(await read()).choices[1];await page.reload();await page.locator('[data-operation="xunxing"]').click();await page.locator('.star-mode').waitFor();s=await read();if(s.reset!==1||s.big.length!==1||s.choices[1]!==choice||!s.skipAnimation)throw Error('Reload lost state');
  await page.screenshot({path:'E:/Documents/AI/codex/tmp/zombie-star-round-20261030/web/star-second-round.png'});
  const viewports=[{width:390,height:844},{width:844,height:390},{width:1366,height:768}];
  for(const viewport of viewports){await page.setViewportSize(viewport);await page.waitForFunction(()=>['.op-buttons','.star-skip'].every(s=>{const b=document.querySelector(s)?.getBoundingClientRect();return b&&b.x>=-.5&&b.y>=-.5&&b.right<=innerWidth+.5&&b.bottom<=innerHeight+.5;}),null,{timeout:3000});}
  const errors=await page.evaluate(()=>window.__starErrors||[]);if(errors.length)throw Error(errors.join(';'));
  return {phase,muted:true,completedRound:true,nextRound:true,selectionPreserved:true,reload:true,viewports,pageErrors:errors};
 }
 throw Error('Unknown QA phase');
}

export const GUIDE_STEPS = [
  '点金框里的奶油色小方块，选中这一组错色豆。',
  '点暂存盒空格，把奶油豆收起来，画板会出现橘色空格。',
  '点金框里的橘色豆。这次直接搬回画板，不经过暂存盒。',
  '点橘色凹槽空格，拿起的橘色豆会直接归位。',
  '点暂存盒里的奶油色豆，拿起同色的一组。',
  '点金框里的奶油色空格，把暂存豆放回画板。',
  '点左上角设置，了解音效、颜色编号和自动全屏；右上角可以手动全屏。',
];
export function inferGuideStep(game,level) {
  if(!level.tutorialPairs)return null;
  const [a,b]=level.tutorialPairs[0],s=game.selection;
  if(a.every(i=>game.board[i]===level.target[i])&&b.every(i=>game.board[i]===level.target[i]))return 6;
  if(s?.source==='board'&&s.color===4&&s.indices.some(i=>a.includes(i)))return 1;
  if(s?.source==='board'&&s.color===3&&s.indices.some(i=>b.includes(i)))return 3;
  if(s?.source==='tray'&&s.color===4)return 5;
  if(a.some(i=>game.board[i]===null))return 2;
  if(b.some(i=>game.board[i]===null)&&game.tray.includes(4))return 4;
  return 0;
}
export function advanceGuideStep(step,result,game,level) {
  if(!level.tutorialPairs||!result.ok)return step;
  const [a,b]=level.tutorialPairs[0],s=game.selection;
  if(step===0&&s?.source==='board'&&s.color===4&&s.indices.some(i=>a.includes(i)))return 1;
  if(step===1&&result.route==='store'&&a.some(i=>game.board[i]===null))return 2;
  if(step===2&&s?.source==='board'&&s.color===3&&s.indices.some(i=>b.includes(i)))return 3;
  if(step===3&&result.route==='direct'&&result.color===3&&a.every(i=>game.board[i]===level.target[i]))return 4;
  if(step===4&&s?.source==='tray'&&s.color===4)return 5;
  if(step===5&&result.route==='tray'&&result.color===4&&a.every(i=>game.board[i]===level.target[i])&&b.every(i=>game.board[i]===level.target[i]))return 6;
  return inferGuideStep(game,level);
}
export function highlightedGuideCells(step,game,level) {
  if(!level.tutorialPairs)return [];
  const [a,b]=level.tutorialPairs[0];
  if(step===0)return a.filter(i=>game.board[i]===4);
  if(step===2)return b.filter(i=>game.board[i]===3);
  if(step===3)return a.filter(i=>game.board[i]===null);
  if(step===5)return b.filter(i=>game.board[i]===null);
  return [];
}

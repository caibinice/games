import {describe,it,expect} from 'vitest';
import {battleStars,battleHealthPercent,defaultProfile,recordWin} from '../public/profile.mjs';
const game=hp=>({status:'won',client:{},hp,maxHp:100,info:{level:1,reward:20},score:100});
describe('native battle star and health display consistency',()=>{
 it.each([[100,3],[99.99,2],[80,2],[50,2],[49.99,1],[1,1]])('native health %s yields %s stars',(hp,stars)=>expect(battleStars(game(hp))).toBe(stars));
 it('does not display damaged walls as a perfect 100% clear',()=>{expect(battleHealthPercent(game(99.99))).toBe(99.9);expect(battleHealthPercent(game(100))).toBe(100);expect(battleHealthPercent({...game(1),maxHp:0})).toBe(0);});
 it('persists the same star result once and retains the best result across runs',()=>{const p=defaultProfile(),g=game(80);expect(recordWin(p,g)).toBe(true);expect(p.stars[1]).toBe(2);expect(recordWin(p,g)).toBe(false);expect(p.coins).toBe(20);recordWin(p,game(100));recordWin(p,game(40));expect(p.stars[1]).toBe(3);});
 it('preserves classic-mode scoring and does not award stars to losses or unfinished games',()=>{expect(battleStars({...game(80),client:null})).toBe(3);expect(battleStars({...game(40),client:null})).toBe(2);for(const status of ['running','paused','upgrade','lost'])expect(battleStars({...game(100),status})).toBe(0);});
});

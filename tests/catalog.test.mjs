import {it,expect} from 'vitest';
import {listGames,selectGames,gameArgument} from '../scripts/catalog.mjs';
it('discovers independent peers and selects all/one/a batch without duplicates',()=>{const games=[{id:'pindou'},{id:'goose'}];expect(selectGames('all',games)).toEqual(games);expect(selectGames('pindou',games)).toEqual([games[0]]);expect(selectGames('goose,pindou,goose',games)).toEqual([games[1],games[0]]);expect(gameArgument(['--game','pindou'])).toBe('pindou');expect(listGames().find(g=>g.id==='pindou').base).toBe('/games/pindou/');});
it('rejects unknown selections before build/deletion/network',()=>{for(const selection of ['','unknown','../credentials','pindou,unknown'])expect(()=>selectGames(selection)).toThrow();});

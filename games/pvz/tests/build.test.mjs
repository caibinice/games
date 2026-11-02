import {it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {ROOT,EXTENSIONS,runtimeEntries} from '../../../scripts/build.mjs';
import {selectGames} from '../../../scripts/catalog.mjs';
it('packages animated original sprites as unchanged GIF bytes and isolates the new game',()=>{expect(EXTENSIONS.has('.gif')).toBe(true);const entries=runtimeEntries(selectGames('pvz'));for(const key of entries.keys())expect(!key.startsWith('games/zombie/')&&!key.startsWith('games/contra/')).toBe(true);const path='games/pvz/assets/plants/peashooter.gif';expect(entries.get(path).equals(readFileSync(join(ROOT,'games/pvz/public/assets/plants/peashooter.gif')))).toBe(true);expect(entries.get(path).subarray(0,3).toString()).toBe('GIF');expect(readFileSync(join(ROOT,'deploy/nginx/games.conf'),'utf8')).toContain('image/gif gif;');});

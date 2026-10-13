import {describe,it,expect} from 'vitest';
import {mkdtempSync,mkdirSync,readFileSync,writeFileSync,rmSync,existsSync,symlinkSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {tmpdir} from 'node:os';
import {gunzipSync} from 'node:zlib';
import {ROOT,build,sha256,validateRuntime,runtimeEntries} from '../scripts/build.mjs';
import {listGames,selectGames} from '../scripts/catalog.mjs';
const work=process.env.GAMES_WORK_ROOT||(process.platform==='win32'?'E:/Documents/AI/codex':tmpdir());
mkdirSync(join(work,'tmp'),{recursive:true});
describe('Independent game build',()=>{
  it('packs only the 35 public runtime files, preserving every module/asset byte',()=>{
    const temp=mkdtempSync(join(work,'tmp/games-build-test-'));
    try{
      const out=join(temp,'test-dist'),manifest=build({output:out,games:"pindou"});expect(manifest.files.filter(f=>f.path.startsWith("games/pindou/"))).toHaveLength(35);expect(manifest.games[0].facts).toEqual({levels:100,patterns:40});
      // Native Buffer equality checks every byte without walking millions of
      // numeric properties in Vitest's object comparator on slower CI runners.
      const expected=runtimeEntries(selectGames('pindou'));
      for(const item of manifest.files){const bytes=readFileSync(join(out,item.path));expect(sha256(bytes)).toBe(item.sha256);expect(bytes.equals(expected.get(item.path))).toBe(true);if(existsSync(join(out,item.path+'.gz')))expect(gunzipSync(readFileSync(join(out,item.path+'.gz'))).equals(bytes)).toBe(true);}
      expect(existsSync(join(out,'credentials'))).toBe(false);expect(existsSync(join(out,'scripts'))).toBe(false);expect(existsSync(join(out,'tests'))).toBe(false);
    }finally{if(!resolve(temp).startsWith(resolve(work,'tmp')+'/')&&!resolve(temp).startsWith(resolve(work,'tmp')+'\\'))throw Error('Test cleanup escaped work root');rmSync(temp,{recursive:true,force:true});}
  });
  it('refuses to clean the repository/source or an unexpected build target',()=>{
    for(const output of [ROOT,join(ROOT,'games/pindou/public'),join(ROOT,'credentials'),resolve('/')])expect(()=>build({output})).toThrow('Invalid build target');
  });
  it('builds one 3D game or both peers with self-hosted vendors and a complete lobby',()=>{
    const temp=mkdtempSync(join(work,'tmp/games-batch-test-'));
    try{
      const out=join(temp,'test-dist');
      const single=build({output:out,games:'goose'});expect(single.games.map(g=>g.id)).toEqual(['goose']);expect(existsSync(join(out,'games/pindou'))).toBe(false);
      expect(JSON.parse(readFileSync(join(out,'games/catalog.json'),'utf8')).map(g=>g.id)).toEqual(listGames().map(g=>g.id));
      for(const name of ['three.module.js','three.core.js','cannon-es.js','three.LICENSE.txt','cannon-es.LICENSE.txt'])expect(existsSync(join(out,'games/goose/vendor',name))).toBe(true);
      const batch=build({output:out,games:'pindou,goose'});expect(batch.games.map(g=>g.id)).toEqual(['pindou','goose']);expect(batch.files).toHaveLength(56);expect(existsSync(join(out,'games/goose/physics.mjs'))).toBe(true);
      expect(existsSync(join(out,'games/goose/assets/audio/music-home.mp3'))).toBe(true);expect(existsSync(join(out,'games/goose/assets/audio/music-home.mp3.gz'))).toBe(false);
      for(const id of ['pindou','goose']){expect(existsSync(join(out,`games/${id}/music.mjs`))).toBe(true);expect(existsSync(join(out,`games/${id}/assets/audio/music-loop.mp3`))).toBe(true);expect(existsSync(join(out,`games/${id}/assets/audio/music-loop.mp3.gz`))).toBe(false);}
      const expected=runtimeEntries(selectGames('pindou,goose'));for(const item of batch.files)expect(readFileSync(join(out,item.path)).equals(expected.get(item.path))).toBe(true);
      for(const name of ['three.module.js','three.core.js','cannon-es.js'])expect(gunzipSync(readFileSync(join(out,'games/goose/vendor',name+'.gz'))).equals(readFileSync(join(out,'games/goose/vendor',name)))).toBe(true);
    }finally{rmSync(temp,{recursive:true,force:true});}
  });
  it.each(['lianliankan','paopaotang'])('builds only %s, with dedicated PC/mobile pages and the full lobby catalogue',id=>{
    const temp=mkdtempSync(join(work,'tmp/games-fruit-link-test-'));
    try{
      const out=join(temp,'test-dist'),manifest=build({output:out,games:id});
      expect(manifest.games.map(g=>g.id)).toEqual([id]);
      for(const page of ['index.html','pc.html','mobile.html'])expect(existsSync(join(out,`games/${id}`,page))).toBe(true);
      for(const id of ['pindou','goose'])expect(existsSync(join(out,'games',id))).toBe(false);
      expect(JSON.parse(readFileSync(join(out,'games/catalog.json'),'utf8')).map(g=>g.id)).toEqual(listGames().map(g=>g.id));
      for(const file of manifest.files)expect(file.path.startsWith(`games/${id}/`)||file.path.split('/').length===2).toBe(true);
    }finally{rmSync(temp,{recursive:true,force:true});}
  });
  it('rejects a credentials file in the public runtime before packaging',()=>{
    const temp=mkdtempSync(join(work,'tmp/games-runtime-test-'));try{writeFileSync(join(temp,'credentials.txt'),'TOKEN_PLACEHOLDER');expect(()=>validateRuntime(temp)).toThrow('Non-runtime file');}finally{rmSync(temp,{recursive:true,force:true});}
  });
  it('credential templates are ignored-exception examples, and no source imports secrets',()=>{
    const ignore=readFileSync(join(ROOT,'.gitignore'),'utf8');expect(ignore).toContain('credentials/*');expect(ignore).toContain('!credentials/config.example.ini');expect(ignore).toContain('.venv/');
    for(const file of validateRuntime(join(ROOT,'games/pindou/public')).filter(f=>f.endsWith('.mjs')))expect(readFileSync(file,'utf8')).not.toMatch(/credentials\/|config\.ini/);
  });
});

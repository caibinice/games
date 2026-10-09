import {describe,it,expect} from 'vitest';
import {mkdtempSync,mkdirSync,readFileSync,writeFileSync,rmSync,existsSync,symlinkSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {tmpdir} from 'node:os';
import {gunzipSync} from 'node:zlib';
import {ROOT,build,sha256,validateRuntime} from '../scripts/build.mjs';
const work=process.env.GAMES_WORK_ROOT||(process.platform==='win32'?'E:/Documents/AI/codex':tmpdir());
mkdirSync(join(work,'tmp'),{recursive:true});
describe('Independent game build',()=>{
  it('packs only the 33 public runtime files, preserving every module/asset byte',()=>{
    const temp=mkdtempSync(join(work,'tmp/games-build-test-'));
    try{
      const out=join(temp,'test-dist'),manifest=build({output:out});expect(manifest.files).toHaveLength(33);expect(manifest.levels).toBe(100);expect(manifest.patterns).toBe(40);
      // Native Buffer equality checks every byte without walking millions of
      // numeric properties in Vitest's object comparator on slower CI runners.
      for(const item of manifest.files){const bytes=readFileSync(join(out,item.path));expect(sha256(bytes)).toBe(item.sha256);expect(bytes.equals(readFileSync(join(ROOT,'public',item.path)))).toBe(true);if(existsSync(join(out,item.path+'.gz')))expect(gunzipSync(readFileSync(join(out,item.path+'.gz'))).equals(bytes)).toBe(true);}
      expect(existsSync(join(out,'credentials'))).toBe(false);expect(existsSync(join(out,'scripts'))).toBe(false);expect(existsSync(join(out,'tests'))).toBe(false);
    }finally{if(!resolve(temp).startsWith(resolve(work,'tmp')+'/')&&!resolve(temp).startsWith(resolve(work,'tmp')+'\\'))throw Error('Test cleanup escaped work root');rmSync(temp,{recursive:true,force:true});}
  });
  it('refuses to clean the repository/source or an unexpected build target',()=>{
    for(const output of [ROOT,join(ROOT,'public'),join(ROOT,'credentials'),resolve('/')])expect(()=>build({output})).toThrow('Invalid build target');
  });
  it('rejects a credentials file in the public runtime before packaging',()=>{
    const temp=mkdtempSync(join(work,'tmp/games-runtime-test-'));try{writeFileSync(join(temp,'credentials.txt'),'TOKEN_PLACEHOLDER');expect(()=>validateRuntime(temp)).toThrow('Non-runtime file');}finally{rmSync(temp,{recursive:true,force:true});}
  });
  it('credential templates are ignored-exception examples, and no source imports secrets',()=>{
    const ignore=readFileSync(join(ROOT,'.gitignore'),'utf8');expect(ignore).toContain('credentials/*');expect(ignore).toContain('!credentials/config.example.ini');expect(ignore).toContain('.venv/');
    for(const file of validateRuntime(join(ROOT,'public')).filter(f=>f.endsWith('.mjs')))expect(readFileSync(file,'utf8')).not.toMatch(/credentials\/|config\.ini/);
  });
});

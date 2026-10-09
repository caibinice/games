import {readFileSync,existsSync} from 'node:fs';
import {join,relative,resolve} from 'node:path';
import {spawnSync} from 'node:child_process';
import {ROOT,filesIn} from './build.mjs';
const credentials=resolve(process.env.GAMES_CREDENTIALS_FILE||join(ROOT,'credentials/config.ini'));
const secrets=[];
if(existsSync(credentials))for(const line of readFileSync(credentials,'utf8').split(/\r?\n/)){
  const m=line.match(/^\s*(token|password|root_password)\s*=\s*(.+?)\s*$/i);
  if(m&&m[2].length>=8&&!/^(GITHUB_TOKEN|SSH_PASSWORD|ROOT_PASSWORD)$/.test(m[2]))secrets.push(m[2]);
}
const git=spawnSync('git',['ls-files','--cached','--others','--exclude-standard','-z'],{cwd:ROOT,encoding:'utf8'});
if(git.status!==0)throw Error('Git file inventory failed');
const named=git.stdout.split('\0').filter(Boolean);
if(named.some(n=>/^credentials\/(?!README\.md$|config\.example\.ini$)/.test(n)))throw Error('Private credentials present in Git file inventory');
const files=new Set([...named.map(n=>join(ROOT,n)),...filesIn(join(ROOT,'public')),...(existsSync(join(ROOT,'dist'))?filesIn(join(ROOT,'dist')):[])]);
for(const file of files){if(!existsSync(file))continue;const bytes=readFileSync(file);for(const secret of secrets)if(bytes.includes(Buffer.from(secret)))throw Error('Credential found in public/build/Git file: '+relative(ROOT,file));}
console.log(`PASS: ${files.size} files audited; private credentials excluded; ${secrets.length} configured secrets checked (values hidden).`);

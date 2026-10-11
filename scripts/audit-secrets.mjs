import {readFileSync,existsSync} from 'node:fs';
import {join,relative,resolve} from 'node:path';
import {spawnSync} from 'node:child_process';
import {ROOT,filesIn,runtimeEntries} from './build.mjs';
const credentials=resolve(process.env.GAMES_CREDENTIALS_FILE||join(ROOT,'credentials/config.ini')),secrets=[];
if(existsSync(credentials))for(const line of readFileSync(credentials,'utf8').split(/\r?\n/)){const m=line.match(/^\s*(token|password|root_password)\s*=\s*(.+?)\s*$/i);if(m&&m[2].length>=8&&!/^(GITHUB_TOKEN|SSH_PASSWORD|ROOT_PASSWORD)$/.test(m[2]))secrets.push(m[2]);}
const git=spawnSync('git',['ls-files','--cached','--others','--exclude-standard','-z'],{cwd:ROOT,encoding:'utf8'});if(git.status!==0)throw Error('Git inventory failed');const named=git.stdout.split('\0').filter(Boolean);
if(named.some(n=>/^credentials\/(?!README\.md$|config\.example\.ini$)/.test(n)))throw Error('Private credentials in Git inventory');
const files=new Set([...named.map(n=>join(ROOT,n)),...(existsSync(join(ROOT,'dist'))?filesIn(join(ROOT,'dist')):[])]);
function audit(bytes,name){for(const secret of secrets)if(bytes.includes(Buffer.from(secret)))throw Error('Credential found: '+name);}
for(const file of files)if(existsSync(file))audit(readFileSync(file),relative(ROOT,file));
for(const[name,bytes]of runtimeEntries())audit(bytes,name);
console.log(`PASS: ${files.size} files audited; private credentials excluded (${secrets.length} hidden values).`);

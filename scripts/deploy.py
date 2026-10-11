"""Atomic multi-game/selected-game deployments, using validated dist only."""
from __future__ import annotations
import argparse,gzip,hashlib,json,re,subprocess,tarfile
from datetime import UTC,datetime,timedelta,timezone
from pathlib import Path
from config import ROOT,work_root
ROUTES='/etc/nginx/snippets/ai-platform-routes.conf'
URL='https://caibinice.com/'
BLOCK=re.compile(r'^[ \t]*# begin-(?:games-static-app|pindou-static-game)\r?\n.*?^[ \t]*# end-(?:games-static-app|pindou-static-game)[^\r\n]*',re.M|re.S)
TEXT={'.html','.css','.mjs','.js','.svg','.json','.webmanifest','.txt'}
VENDORS={'three':[('build/three.module.js','three.module.js'),('build/three.core.js','three.core.js'),('LICENSE','three.LICENSE.txt')],'cannon-es':[('dist/cannon-es.js','cannon-es.js'),('LICENSE','cannon-es.LICENSE.txt')]}

def catalogue(root=None):
 root=root or ROOT
 result=[]
 for folder in sorted((root/'games').iterdir()):
  if not folder.is_dir():continue
  if folder.is_symlink() or not re.fullmatch('[a-z][a-z0-9-]*',folder.name):raise RuntimeError('Invalid game directory')
  g=json.loads((folder/'game.json').read_text(encoding='utf-8'))
  if g.get('id')!=folder.name or not g.get('name') or not g.get('version'):raise RuntimeError('Invalid game metadata')
  if any(v not in VENDORS for v in g.get('vendors',[])):raise RuntimeError('Unregistered vendor')
  g['base']='/games/'+g['id']+'/'
  result.append(g)
 return result

def merge_routes(current,fragment):
 matches=list(BLOCK.finditer(current))
 if len(matches)>1:raise RuntimeError('Duplicate game route markers')
 if matches:
  m=matches[0];return current[:m.start()]+fragment.rstrip('\r\n')+current[m.end():]
 return current.rstrip()+'\n\n'+fragment.rstrip()+'\n'

def source_files(games):
 files={}
 for g in games:
  folder=ROOT/'games'/g['id']/'public'
  for path in folder.rglob('*'):
   if path.is_symlink():raise RuntimeError('Symlink in game source')
   if path.is_file():files['games/'+g['id']+'/'+path.relative_to(folder).as_posix()]=path.read_bytes()
  for vendor in g.get('vendors',[]):
   for source,name in VENDORS[vendor]:files[f"games/{g['id']}/vendor/{name}"]=(ROOT/'node_modules'/vendor/source).read_bytes()
 for path in (ROOT/'site').rglob('*'):
  if path.is_symlink():raise RuntimeError('Symlink in shared site')
  if path.is_file():files['games/'+path.relative_to(ROOT/'site').as_posix()]=path.read_bytes()
 return files

def validate_dist(dist):
 manifest=json.loads((dist/'release-manifest.json').read_text(encoding='utf-8'))
 catalog=catalogue();by_id={g['id']:g for g in catalog}
 if manifest.get('version')!=2 or manifest.get('base')!='/games/' or not manifest.get('games'):raise RuntimeError('Build manifest mismatch; rebuild first')
 games=manifest['games'];ids=[g.get('id') for g in games]
 if len(ids)!=len(set(ids)) or any(g!=by_id.get(g.get('id')) for g in games):raise RuntimeError('Build game metadata is stale')
 source=source_files(games);source['games/catalog.json']=(dist/'games/catalog.json').read_bytes()
 if json.loads(source['games/catalog.json'])!=catalog:raise RuntimeError('Build catalogue is stale')
 expected={'release-manifest.json'};names=[]
 for item in manifest['files']:
  name=item['path']
  if not re.fullmatch(r'[A-Za-z0-9._/-]+',name) or not name.startswith('games/') or any(p.startswith('.') or p.lower().startswith('credentials') for p in Path(name).parts):raise RuntimeError('Unexpected runtime path')
  file=dist/name
  if file.is_symlink() or not file.resolve().is_relative_to(dist.resolve()):raise RuntimeError('Build file escapes dist')
  content=file.read_bytes()
  if len(content)!=item['bytes'] or hashlib.sha256(content).hexdigest()!=item['sha256']:raise RuntimeError('Build hash mismatch: '+name)
  if content!=source.get(name):raise RuntimeError('Build is stale or contains unexpected source: '+name)
  names.append(name);expected.add(name)
  if file.suffix in TEXT:
   compressed=Path(str(file)+'.gz')
   if compressed.is_symlink() or not compressed.exists() or gzip.decompress(compressed.read_bytes())!=content:raise RuntimeError('Precompressed file differs: '+name)
   expected.add(name+'.gz')
 for path in dist.rglob('*'):
  if path.is_symlink():raise RuntimeError('Symlink in dist')
 actual={p.relative_to(dist).as_posix() for p in dist.rglob('*') if p.is_file()}
 if len(names)!=len(set(names)) or set(names)!=set(source) or actual!=expected:raise RuntimeError('Unexpected/missing build file')
 return manifest

def package_dist(dist,archive):
 manifest=validate_dist(dist)
 with tarfile.open(archive,'w:gz') as tar:
  for path in sorted(dist.rglob('*')):
   if path.is_file():tar.add(path,arcname=(Path('www')/path.relative_to(dist)).as_posix())
 return manifest

def main():
 parser=argparse.ArgumentParser();parser.add_argument('--games','--game',default='all');parser.add_argument('--dry-run',action='store_true');parser.add_argument('--blog-root',type=Path,default=ROOT.parent/'ai-blog');args=parser.parse_args()
 all_ids=[g['id'] for g in catalogue()];ids=all_ids if args.games=='all' else list(dict.fromkeys(args.games.split(',')))
 if not ids or any(i not in all_ids for i in ids):raise RuntimeError('Unknown game selection')
 commit=subprocess.run(['git','-C',str(ROOT),'rev-parse','--short=10','HEAD'],capture_output=True,text=True).stdout.strip() or 'working'
 if not re.fullmatch('[a-z0-9]+',commit):raise RuntimeError('Invalid commit identifier')
 stamp=datetime.now(timezone(timedelta(hours=8))).strftime('%Y%m%d-%H%M%S-%f');release=datetime.now(UTC).strftime('%Y%m%d%H%M%S')+'-'+commit
 backup=work_root()/'backups'/f'games-{stamp}';staging=work_root()/'tmp'/f'games-release-{stamp}';staging.mkdir(parents=True,exist_ok=False)
 archive=staging/f'games-{release}.tar.gz';manifest=package_dist(ROOT/'dist',archive)
 if [g['id'] for g in manifest['games']]!=ids:raise RuntimeError('Built game selection differs; rebuild requested games')
 package={'release':release,'repository':'https://github.com/caibinice/games','commit':commit,'games':ids,'url':URL+'games/','archive':str(archive),'sha256':hashlib.sha256(archive.read_bytes()).hexdigest(),'runtime_files':len(manifest['files'])}
 (staging/'package.json').write_text(json.dumps(package,indent=2),encoding='utf-8')
 if args.dry_run:print(json.dumps({'result':'PASS','mode':'dry-run',**package}));return
 from remote_client import RemoteClient
 backup.mkdir(parents=True,exist_ok=False);remote=RemoteClient()
 try:
  with remote.client.open_sftp() as sftp:
   with sftp.open(ROUTES,'rb') as f:original=f.read()
  (backup/'ai-platform-routes.before.conf').write_bytes(original);digest=hashlib.sha256(original).hexdigest();fragment=(ROOT/'deploy/nginx/games.conf').read_text(encoding='utf-8');merged=merge_routes(original.decode(),fragment)
  previous=remote.run('test -L /opt/games/www && readlink -f /opt/games/www || true',timeout=30).strip()
  rollback={**package,'previous':previous,'legacy_pindou':'/opt/pindou/www','local_backup':str(backup),'remote_backup':f'/opt/games/backups/{release}','routes_sha256_before':digest}
  (backup/'rollback.json').write_text(json.dumps(rollback,indent=2),encoding='utf-8')
  upload=f'/tmp/games-{release}.tar.gz';next_conf=f'/tmp/games-routes-{release}.conf';remote.upload_file(archive,upload,0o600);remote.upload_bytes(merged.encode(),next_conf,0o600)
  paths=' '.join(i['path'] for i in manifest['files']);selection=' '.join(ids)
  remote.run(f'''
set -euo pipefail
root=/opt/games
mkdir -p "$root"
exec 9>"$root/publish.lock"
flock -n 9 || {{ echo 'Another games deployment is active'; exit 1; }}
[[ "$(sha256sum {ROUTES} | cut -d' ' -f1)" = '{digest}' ]] || {{ echo 'Shared routes changed'; exit 1; }}
previous=""; if [[ -L "$root/www" ]]; then previous="$(readlink -f "$root/www")"; fi
[[ ! -e "$root/www" || -L "$root/www" ]] || {{ echo 'Expected games symlink'; exit 1; }}
[[ -z "$previous" || "$previous" = "$root/releases/"* ]] || {{ echo 'Unexpected games root'; exit 1; }}
target="$root/releases/{release}"
backup="$root/backups/{release}"
[[ ! -e "$target" ]]
mkdir -p "$target/www/games" "$backup"
cp {ROUTES} "$backup/ai-platform-routes.before.conf"
printf '%s\\n' "$previous" > "$backup/previous-release.txt"
rollback() {{
 trap - ERR
 cp "$backup/ai-platform-routes.before.conf" {ROUTES}
 if [[ -n "$previous" && -d "$previous" ]]; then ln -sfn "$previous" "$root/www.rollback"; mv -Tf "$root/www.rollback" "$root/www"; else rm -f "$root/www"; fi
 nginx -t && systemctl reload nginx
 echo 'Games release rolled back'
}}
trap rollback ERR
if [[ -n "$previous" && -d "$previous" ]]; then cp -a "$previous/." "$target/www/"; fi
for game in {selection}; do rm -rf "$target/www/games/$game"; done
printf '' > "$backup/inherited-sha256.txt"
(cd "$target/www/games" && find . -mindepth 2 -type f -exec sha256sum {{}} + | sort) > "$backup/inherited-sha256.txt"
tar -xzf {upload} -C "$target"
(cd "$target/www/games" && while read -r hash path; do [[ "$(sha256sum "$path" | cut -d' ' -f1)" = "$hash" ]]; done < "$backup/inherited-sha256.txt")
chown -R aiapps:aiapps "$target"
find "$target" -type d -exec chmod 755 {{}} +
find "$target" -type f -exec chmod 644 {{}} +
ln -sfn "$target/www" "$root/www.next"
mv -Tf "$root/www.next" "$root/www"
install -m 644 {next_conf} {ROUTES}
nginx -t
systemctl reload nginx
systemctl is-active --quiet nginx
for path in {paths}; do curl -fsS --resolve caibinice.com:443:127.0.0.1 "{URL}$path" >/dev/null; done
for game in {selection}; do
 curl -fsSI --resolve caibinice.com:443:127.0.0.1 "{URL}games/$game/app.mjs" | grep -qi 'content-type: application/javascript'
 [[ "$(curl -sS -o /dev/null -w '%{{http_code}}' --resolve caibinice.com:443:127.0.0.1 "{URL}games/$game/not-found.mjs")" = 404 ]]
done
curl -fsS --resolve caibinice.com:443:127.0.0.1 {URL} >/dev/null
curl -fsS --resolve caibinice.com:443:127.0.0.1 {URL}smartParking/ >/dev/null
trap - ERR
rm -f {upload} {next_conf}
echo 'Games release activated: {release}; selected: {selection}'
''',root=True,timeout=240)
  mirror=args.blog_root/'deploy/nginx/ai-platform-routes.conf'
  if mirror.exists():
   before=mirror.read_bytes();(backup/'ai-platform-routes.blog.before.conf').write_bytes(before);mirror.write_bytes(merge_routes(before.decode(),fragment).encode())
   (args.blog_root/'deploy/nginx/games.conf').write_text(fragment,encoding='utf-8')
  (staging/'deployment.json').write_text(json.dumps(rollback,indent=2),encoding='utf-8')
  print('Local rollback: '+str(backup/'rollback.json'));print('Games: '+URL+'games/')
 finally:remote.close()
if __name__=='__main__':main()

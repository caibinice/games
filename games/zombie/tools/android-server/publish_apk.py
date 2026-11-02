"""Publish one signed APK at an unlisted URL, with progress and range validation."""
import argparse
import hashlib
import json
from pathlib import Path
import secrets
import sys
import time
from urllib.request import Request,urlopen

ROOT=Path(__file__).resolve().parents[4]
sys.path.insert(0,str(ROOT/'scripts'))
from remote_client import RemoteClient


def publish(apk,proof):
    size=apk.stat().st_size;digest=hashlib.sha256(apk.read_bytes()).hexdigest();name=secrets.token_hex(24)+'.apk'
    temporary='/tmp/games-native-'+name+'.part';target='/opt/zombie-native/downloads/'+name
    remote=RemoteClient();started=time.monotonic();last=[0.0]
    try:
        def progress(sent,total):
            now=time.monotonic()
            if now-started>240:raise TimeoutError('APK upload deadline exceeded; inspect partial file')
            if now-last[0]>=3 or sent==total:
                print(f'APK upload {sent//1048576}/{total//1048576} MiB',flush=True);last[0]=now
        with remote.client.open_sftp() as s:
            s.get_channel().settimeout(12);s.put(str(apk),temporary,callback=progress,confirm=True);s.chmod(temporary,0o600)
        remote.run(f"set -eu; echo '{digest}  {temporary}' | sha256sum -c -; test ! -e {target}; install -m 0644 {temporary} {target}; rm -- {temporary}",root=True,timeout=12)
        url='https://caibinice.com/native-zombie-install/'+name
        with urlopen(Request(url,headers={'Range':'bytes=0-63'}),timeout=8) as r:
            data=r.read(64)
            if r.status!=206 or not data.startswith(b'PK\x03\x04'):raise RuntimeError('APK range verification failed')
        proof.parent.mkdir(parents=True,exist_ok=True)
        proof.write_text(json.dumps({'url':url,'remotePath':target,'bytes':size,'sha256':digest,'rangeVerified':True,'phoneVerified':False},indent=2),encoding='utf-8')
        print('Signed APK published; hash and HTTPS range check passed',flush=True)
    finally:remote.close()


if __name__=='__main__':
    p=argparse.ArgumentParser(description=__doc__);p.add_argument('apk',type=Path);p.add_argument('--proof',type=Path,required=True);a=p.parse_args();publish(a.apk,a.proof)

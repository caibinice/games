"""Scoped GitHub push with process-only authentication and explicit files."""
from __future__ import annotations

import argparse
import base64
import os
import subprocess
from config import ROOT, read_credentials


def git(*args: str, env: dict | None = None, check: bool = True) -> str:
    result = subprocess.run(['git', '-C', str(ROOT), *args], env=env, capture_output=True, text=True, encoding='utf-8', errors='replace')
    if check and result.returncode:
        # Do not forward verbose Git auth output to the console.
        raise RuntimeError(f'Git command {args[0]} failed (exit {result.returncode}).')
    return result.stdout.strip() if result.returncode == 0 else ''


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument('--message')
    parser.add_argument('--files', nargs='+')
    parser.add_argument('--push-only', action='store_true')
    parser.add_argument('--validate-only', action='store_true')
    args = parser.parse_args()
    cfg = read_credentials()
    section = cfg['github']
    token = section.get('token', '')
    if not token or token == 'GITHUB_TOKEN':
        raise RuntimeError('Fill [github] token in credentials/config.ini.')
    if git('branch', '--show-current') != 'main' or git('remote', 'get-url', 'origin') != 'https://github.com/caibinice/games.git':
        raise RuntimeError('Expected games origin and main branch.')
    env = {k: v for k, v in os.environ.items() if not k.startswith(('GIT_TRACE', 'GIT_CONFIG_')) and k != 'GIT_CURL_VERBOSE'}
    basic = base64.b64encode(f'x-access-token:{token}'.encode()).decode()
    config = [('http.https://github.com/.extraheader', f'AUTHORIZATION: basic {basic}'),
              ('user.name', section.get('user_name', 'caibinice')),
              ('user.email', section.get('user_email', 'caibinice@users.noreply.github.com')),
              ('http.proxy', section.get('proxy', ''))]
    env['GIT_CONFIG_COUNT'] = str(len(config))
    for i, (key, value) in enumerate(config):
        env[f'GIT_CONFIG_KEY_{i}'] = key
        env[f'GIT_CONFIG_VALUE_{i}'] = value
    remote = git('ls-remote', '--heads', 'origin', 'main', env=env)
    ahead = 0
    if remote:
        git('fetch', 'origin', 'main', env=env)
        divergence = git('rev-list', '--left-right', '--count', 'HEAD...origin/main').split()
        ahead, behind = map(int, divergence)
        if behind:
            raise RuntimeError('Remote main has new commits; sync before pushing.')
    elif git('rev-parse', '--verify', 'HEAD', check=False):
        ahead = 1
    if args.validate_only:
        print(f'PASS origin/branch/auth; localAhead={ahead}; token=loaded (hidden)')
        return
    if not args.push_only:
        if ahead or git('diff', '--cached', '--name-only'):
            raise RuntimeError('Handle existing local commits or staged files before a scoped commit.')
        if not args.message or not args.files:
            raise RuntimeError('Specify --message and --files, or --push-only.')
        git('add', '--', *args.files)
        staged = git('diff', '--cached', '--name-only').splitlines()
        if not staged or any(n.startswith('credentials/') and n not in ['credentials/README.md', 'credentials/config.example.ini'] for n in staged):
            raise RuntimeError('No scoped changes or unexpected private credential file.')
        git('diff', '--cached', '--check')
        audit = subprocess.run(['node', str(ROOT / 'scripts/audit-secrets.mjs')], cwd=ROOT)
        if audit.returncode:
            raise RuntimeError('Credential audit failed.')
        git('commit', '-m', args.message, env=env)
    git('push', '--set-upstream', 'origin', 'main', env=env)
    print('Pushed games/main: ' + git('rev-parse', 'HEAD'))


if __name__ == '__main__':
    main()

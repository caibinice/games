"""Repository-local credentials; never use another project's secret file."""
from __future__ import annotations

import configparser
import os
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def read_credentials() -> configparser.ConfigParser:
    path = Path(os.environ.get('GAMES_CREDENTIALS_FILE', ROOT / 'credentials' / 'config.ini'))
    if not path.is_file():
        raise RuntimeError('Missing credentials/config.ini; copy the example and fill it locally.')
    parser = configparser.ConfigParser(interpolation=None)
    try:
        with path.open(encoding='utf-8-sig') as source:
            parser.read_file(source)
    except configparser.Error:
        raise RuntimeError('Credentials INI format is invalid; check section/key structure.') from None
    return parser


def work_root() -> Path:
    default = Path('E:/Documents/AI/codex') if os.name == 'nt' else Path.home() / '.local/state/games'
    return Path(os.environ.get('GAMES_WORK_ROOT', default)).resolve()

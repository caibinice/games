"""Prepare ImageGen originals as local WebP scenes and deterministic bead grids.

With --sources, reads a local JSON array of key/title/prompt/source entries.
Without it, rebuilds numerical grids from the checked-in scene assets.
"""
import argparse
import hashlib
import json
from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
GAME = ROOT / 'public'
ASSETS = GAME / 'assets/scenes'
PALETTE = ['#bae5cd', '#57bca6', '#99d566', '#f3aa47', '#fff1cf',
           '#ef7aaa', '#65bce8', '#f28d80', '#b29ae5', '#f6d749']
SIZES = [(20 + c * 2, 22 + c * 2) for c in range(5)]


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--sources', type=Path)
    parser.add_argument('--gallery', type=Path)
    args = parser.parse_args()
    ASSETS.mkdir(parents=True, exist_ok=True)
    if args.sources:
        entries = json.loads(args.sources.read_text(encoding='utf-8-sig'))
        manifest = []
        for entry in entries:
            original = Image.open(entry['source']).convert('RGB')
            original.thumbnail((1000, 1100), Image.Resampling.NEAREST)
            filename = f"{entry['key']}.webp"
            original.save(ASSETS / filename, 'WEBP', quality=88, method=6)
            manifest.append({**{k: entry[k] for k in ('key', 'title', 'prompt')},
                             'file': filename, 'generator': 'built-in ImageGen',
                             'sha256': hashlib.sha256((ASSETS / filename).read_bytes()).hexdigest()})
        (ASSETS / 'manifest.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    manifest = json.loads((ASSETS / 'manifest.json').read_text(encoding='utf-8'))
    colors = [tuple(bytes.fromhex(c[1:])) for c in PALETTE]
    scenes = []
    # BOX samples whole cell areas; closest bright palette color defines its bead.
    # No dark pixels from the illustration can become dark interactive beads.
    for entry in manifest:
        image = Image.open(ASSETS / entry['file']).convert('RGB')
        grids = {}
        for width, height in SIZES:
            sampled = image.resize((width, height), Image.Resampling.BOX)
            digits = ''.join(str(min(range(len(colors)), key=lambda i:
                                    sum((pixel[k] - colors[i][k]) ** 2 for k in range(3))))
                             for pixel in getattr(sampled, 'get_flattened_data', sampled.getdata)())
            grids[f'{width}x{height}'] = [digits[y * width:(y + 1) * width] for y in range(height)]
        scenes.append({'key': entry['key'], 'title': entry['title'],
                       'image': f"scenes/{entry['file']}", 'grids': grids})
    (GAME / 'artwork-data.mjs').write_text(
        '// Generated from assets/scenes/*.webp by scripts/generate-pindou-artworks.py.\n'
        f'export const SCENE_PALETTE = {json.dumps(PALETTE)};\n'
        f'export const SCENES = {json.dumps(scenes, ensure_ascii=False, separators=(",", ":"))};\n', encoding='utf-8')
    if args.gallery:
        gallery = Image.new('RGB', (5 * 240, 2 * 310), '#f6f5ed')
        draw = ImageDraw.Draw(gallery)
        for n, scene in enumerate(scenes):
            width, height = SIZES[0]
            tile = Image.new('RGB', (width, height))
            tile.putdata([colors[int(c)] for c in ''.join(scene['grids'][f'{width}x{height}'])])
            x, y = n % 5 * 240, n // 5 * 310
            gallery.paste(tile.resize((220, 242), Image.Resampling.NEAREST), (x + 10, y + 36))
            draw.text((x + 10, y + 12), scene['key'], fill='#345846')
        gallery.save(args.gallery)
    print(f'Prepared {len(scenes)} distinct scenes, {len(SIZES)} grid sizes each.')


if __name__ == '__main__':
    main()

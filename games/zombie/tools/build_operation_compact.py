"""Keep only native operation nodes used by the browser renderer.

The full, verified APK export remains available beside this derived file. This
does not rasterize or alter the source UI components.
"""
import json
import re
from pathlib import Path

root = Path(__file__).resolve().parents[1] / 'public' / 'assets' / 'native-operations'
full = json.loads((root / 'layouts.json').read_text(encoding='utf8'))
pages = ('luckwheelactui', 'bihaiturntableui', 'timelimitboxui', 'luckyeggui', 'treasurehuntpage', 'xunxinglottreryui', 'turntabnewyearpage', 'sixoneluckyeggpage')
compact = {}
for name in pages:
    page = full[name]
    nodes = {n['rectId']: n for n in page['nodes']}
    keep = set(page['rootRectIds'])
    for n in page['nodes']:
        path = n.get('path', '')
        egg_node = name in ('luckyeggui', 'sixoneluckyeggpage') and (n.get('name') in ('m_itemLayerFinal', 'm_scrollViewLayer') or re.search(r'/bgNode/(?:BG|Bg)$|/RoundsRandomNode/bg$', path))
        star_node = name == 'xunxinglottreryui' and (re.fullmatch(r'm_itemBooty(?:[1-8]| \([1-6]\))?', n.get('name', '')) or re.search(r'/m_itemBooty[^/]*/Bottom/m_imgChose$', path))
        bihai_node = name == 'bihaiturntableui' and path == 'BiHaiTurnTableUI/Bottom/BG'
        if bihai_node or egg_node or star_node or n.get('name') == 'm_tfTurnCentre' or re.fullmatch(r'BoxItem(?: \(\d+\))?', n.get('name', '')) or re.fullmatch(r'[^/]+/[Bb][Gg]', path) or '/m_goTurnObj' in path or re.fullmatch(r'm_itemChildNode(?: \(\d+\))?', n.get('name', '')):
            current = n['rectId']
            while current in nodes and current not in keep:
                keep.add(current)
                current = nodes[current]['parentRectId']
    compact[name] = {**page, 'nodes': [{**n, 'children': [c for c in n['children'] if c in keep]} for n in page['nodes'] if n['rectId'] in keep]}
out = root / 'layouts-compact.json'
out.write_text(json.dumps(compact, ensure_ascii=False, separators=(',', ':')), encoding='utf8')
print(f'{len(pages)} pages; {sum(len(p["nodes"]) for p in compact.values())} nodes; {out.stat().st_size} bytes')

"""Extract the complete home/play recording audio and gently enhance it.

Requires FFmpeg and Python's standard library only, never source-separation
libraries. Work files stay outside public/. Runtime only ships the two MP3s.
"""
import argparse
from array import array
import hashlib
import json
import math
from pathlib import Path
import subprocess
import sys


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('--home-video', type=Path, required=True)
    p.add_argument('--play-video', type=Path, required=True)
    p.add_argument('--work', type=Path, required=True)
    p.add_argument('--output-dir', type=Path, required=True)
    p.add_argument('--ffmpeg', required=True)
    args = p.parse_args()
    args.output_dir.mkdir(parents=True, exist_ok=True)

    def run(params):
        return subprocess.run([args.ffmpeg, '-y', '-hide_banner', *params],
                              check=True, stdout=subprocess.PIPE,
                              stderr=subprocess.PIPE)

    def measure(path):
        log = run(['-i', str(path), '-af',
                   'loudnorm=I=-18:TP=-1.2:LRA=11:print_format=json',
                   '-f', 'null', '-']).stderr.decode(errors='replace')
        data = json.loads(log[log.rfind('{'):log.rfind('}')+1])
        # Measurement only; loudnorm output is discarded, not deployed.
        return {k: float(data[k]) for k in ('input_i', 'input_tp', 'input_lra')}

    def pcm(path):
        data = run(['-i', str(path), '-vn', '-ar', '48000', '-ac', '1',
                    '-f', 'f32le', 'pipe:1']).stdout
        a = array('f', data)
        if sys.byteorder != 'little':
            a.byteswap()
        return a

    reports = []
    for name, source, filename in [('home', args.home_video, 'music-home.mp3'),
                                    ('play', args.play_video, 'music-loop.mp3')]:
        work = args.work/name
        work.mkdir(parents=True, exist_ok=True)
        original, eq = work/'original.wav', work/'enhanced-eq.wav'
        run(['-i', str(source), '-map', '0:a:0', '-c:a', 'copy',
             str(work/'original.m4a')])
        run(['-i', str(source), '-vn', '-c:a', 'pcm_f32le', str(original)])
        run(['-i', str(original), '-af',
             'highpass=f=28,equalizer=f=160:t=q:w=0.7:g=0.8,equalizer=f=3500:t=q:w=0.7:g=0.6',
             '-c:a', 'pcm_f32le', str(eq)])
        gain = -18-measure(eq)['input_i']
        a = pcm(eq)
        duration, limit = len(a)/48000, 10**(-1.2/20)
        filters = (f'volume={gain}dB,alimiter=limit={limit}:attack=5:release=60:'
                   f'level=false:latency=true,afade=t=in:d=0.008,'
                   f'afade=t=out:st={duration-0.008}:d=0.008')
        target = args.output_dir/filename
        run(['-i', str(eq), '-af', filters, '-ar', '48000', '-ac', '1',
             '-c:a', 'libmp3lame', '-b:a', '192k', '-write_xing', '1',
             '-id3v2_version', '3', '-map_metadata', '-1', '-metadata',
             f'title=Goose market - recorded {name} BGM', '-metadata',
             'comment=Extracted from user-provided 2026-10-12 recording; fixed EQ, gain and peak protection',
             str(target)])
        b = pcm(target)
        if len(a) != len(b):
            raise RuntimeError('Duration changed; check encoder gapless metadata')
        report = {'scene': name, 'source': str(source),
                  'source_sha256': hashlib.sha256(source.read_bytes()).hexdigest(),
                  'duration': duration, 'channels': 1, 'rate': 48000,
                  'gain_db': gain, 'original_loudness': measure(original),
                  'published_loudness': measure(target),
                  'peak_protected_sample_percent':
                  100*sum(abs(v)*10**(gain/20)>limit for v in a)/len(a),
                  'peak_dbfs': 20*math.log10(max(map(abs, b))),
                  'sha256': hashlib.sha256(target.read_bytes()).hexdigest(),
                  'bytes': target.stat().st_size}
        reports.append(report)
    (args.work/'report.json').write_text(json.dumps(reports, indent=2)+'\n',
                                       encoding='utf-8')
    print(json.dumps(reports, indent=2))


if __name__ == '__main__':
    main()

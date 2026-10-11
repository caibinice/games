"""Prepare a clean music excerpt, without spectral masking or dynamic gain.

Only Python's standard library and FFmpeg are needed. Source downloads and
intermediates belong outside public/. See docs/music-replacement-20261011.md.
Use a complete musical phrase; the short, phase-aligned seam is not a fade
to silence. Preserve both original stereo channels throughout processing.
"""
import argparse
from array import array
import hashlib
import json
import math
from pathlib import Path
import subprocess
import sys


def run(ffmpeg, args):
    return subprocess.run([ffmpeg, '-hide_banner', '-loglevel', 'info', *args],
                          check=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)


def decode(ffmpeg, source, start=None, duration=None):
    args = ['-i', str(source)]
    if start is not None:
        args += ['-ss', str(start), '-t', str(duration)]
    result = run(ffmpeg, args + ['-vn', '-ar', '44100', '-ac', '2',
                                '-f', 'f32le', 'pipe:1'])
    samples = array('f', result.stdout)
    if sys.byteorder != 'little':
        samples.byteswap()
    return samples


def pcm_bytes(samples):
    if sys.byteorder == 'little':
        return samples.tobytes()
    copy = array('f', samples)
    copy.byteswap()
    return copy.tobytes()


def stats(samples):
    count = len(samples) // 2
    left, right = samples[::2], samples[1::2]
    power = [sum(x*x for x in channel) / count for channel in (left, right)]
    peak = max(map(abs, samples))
    dot = sum(l*r for l, r in zip(left, right)) / count
    mono = sum(((l+r)/2)**2 for l, r in zip(left, right)) / count
    return {'duration': count / 44100, 'channels': 2,
            'rms_dbfs': 10*math.log10(sum(power)/2),
            'channel_rms_dbfs': [10*math.log10(p) for p in power],
            'peak_dbfs': 20*math.log10(peak),
            'stereo_correlation': dot / math.sqrt(power[0]*power[1]),
            'mono_rms_dbfs': 10*math.log10(mono),
            'seam_jump': max(abs(samples[c]-samples[-2+c]) for c in (0, 1))}


def loudness(ffmpeg, source):
    # This invocation only measures: its output is discarded, never published.
    result = run(ffmpeg, ['-i', str(source), '-af',
                         'loudnorm=I=-19:TP=-2:LRA=11:print_format=json',
                         '-f', 'null', '-'])
    log = result.stderr.decode(errors='replace')
    report = json.loads(log[log.rfind('{'):log.rfind('}')+1])
    return {key: float(report[key]) for key in
            ('input_i', 'input_tp', 'input_lra')}


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('--source', type=Path, required=True)
    p.add_argument('--ffmpeg', required=True)
    p.add_argument('--work', type=Path, required=True)
    p.add_argument('--output', type=Path, required=True)
    p.add_argument('--start', type=float, required=True)
    p.add_argument('--bpm', type=float, required=True)
    p.add_argument('--bars', type=int, default=16)
    p.add_argument('--seam-ms', type=float, default=80)
    p.add_argument('--target-lufs', type=float, default=-18)
    p.add_argument('--title', required=True)
    args = p.parse_args()
    if not 0 < args.bpm < 300 or args.bars < 1 or args.start < 0:
        p.error('Invalid musical phrase')
    args.work.mkdir(parents=True, exist_ok=True)
    duration = args.bars * 4 * 60 / args.bpm
    frames, seam = round(duration*44100), round(args.seam_ms/1000*44100)
    if not 0 < seam < frames/4:
        p.error('Seam must be short compared with the musical phrase')
    source = decode(args.ffmpeg, args.source, args.start,
                    (frames+seam)/44100)
    if len(source) < (frames+seam)*2:
        p.error('Source is shorter than the requested phrase')
    # Middle, then tail->head crossfade. End->start is the original pair of
    # consecutive PCM samples, so there is no hard jump or silent loop gap.
    loop = source[seam*2:frames*2]
    for i in range(seam):
        weight = .5 - .5*math.cos(math.pi*i/(seam-1))
        for c in (0, 1):
            loop.append(source[(frames+i)*2+c]*(1-weight) +
                        source[i*2+c]*weight)
    # Put the encoded boundary at a nearby low-amplitude point in BOTH
    # channels; a circular shift leaves the musical phrase and duration intact.
    shift = 2*min(range(min(frames, 11025)), key=lambda i: sum(
        loop[2*i+c]**2 + loop[(2*i+c-2) % len(loop)]**2 for c in (0, 1)))
    loop = loop[shift:] + loop[:shift]
    raw = args.work/'phrase.f32'
    raw.write_bytes(pcm_bytes(loop))
    phrase = args.work/'phrase.wav'
    run(args.ffmpeg, ['-y', '-f', 'f32le', '-ar', '44100', '-ac', '2',
                     '-i', str(raw), '-c:a', 'pcm_f32le', str(phrase)])
    before = loudness(args.ffmpeg, phrase)
    # Constant gain, capped using measured inter-sample true peak. No limiter,
    # compressor, gate, ducking, denoiser or channel subtraction is applied.
    gain_db = min(args.target_lufs-before['input_i'], -2-before['input_tp'])
    args.output.parent.mkdir(parents=True, exist_ok=True)
    run(args.ffmpeg, ['-y', '-i', str(phrase), '-af', f'volume={gain_db}dB',
                     '-ar', '44100', '-ac', '2', '-c:a', 'libmp3lame',
                     '-b:a', '160k', '-write_xing', '1', '-id3v2_version', '3',
                     '-metadata', f'title={args.title} (game loop)',
                     '-metadata', 'artist=Kevin MacLeod',
                     '-metadata', 'copyright=CC BY 4.0; incompetech.com; excerpt and constant gain',
                     str(args.output)])
    decoded = decode(args.ffmpeg, args.output)
    report = {'source': args.source.name, 'title': args.title,
              'author': 'Kevin MacLeod', 'license': 'CC BY 4.0',
              'source_sha256': hashlib.sha256(args.source.read_bytes()).hexdigest(),
              'source_start_seconds': args.start, 'bpm': args.bpm,
              'bars': args.bars, 'seam_ms': args.seam_ms,
              'circular_shift_seconds': shift/2/44100,
              'constant_gain_db': gain_db, 'original_loudness': before,
              'output_loudness': loudness(args.ffmpeg, args.output),
              'output': str(args.output), 'bytes': args.output.stat().st_size,
              'sha256': hashlib.sha256(args.output.read_bytes()).hexdigest(),
              **stats(decoded)}
    (args.work/'report.json').write_text(json.dumps(report, indent=2)+'\n',
                                       encoding='utf-8')
    print(json.dumps(report, indent=2))


if __name__ == '__main__':
    main()

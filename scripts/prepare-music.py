"""Legacy recording experiment; not used by the current published music.

Spectral separation audibly damaged the instruments. Do not reuse these outputs
for releases. Use prepare-clean-music.py; see docs/music-replacement-20261011.md.

Install scripts/audio-requirements.txt in a task-local environment. Inputs and
intermediate WAVs stay outside public/. Only the final MP3 is deployed.
See docs/music-20261011.md for the source recordings and reproducible commands.
"""
import argparse
import hashlib
import json
import subprocess
from pathlib import Path

import librosa
import numpy as np
import soundfile as sf
from scipy.ndimage import median_filter


def extract(source, target, ffmpeg):
    subprocess.run([ffmpeg, '-y', '-hide_banner', '-loglevel', 'error',
                    '-i', str(source), '-vn', '-ac', '1', '-ar', '22050',
                    str(target)], check=True)
    return sf.read(target)[0].astype(np.float32)


def separate(samples, reference=None, neighbors=24, margin=2.5):
    """REPET-SIM: shared musical spectra survive, sporadic foreground does not.

    Compare non-local frames at least 2 seconds apart, never simply low-pass
    the mixed recording. A second recording supplies additional repetitions.
    Median + a soft Wiener mask suppress nonrepeating UI/interaction sounds.
    This is spectral suppression, not a promise of perfect source recovery.
    """
    full = samples if reference is None else np.r_[samples, np.zeros(22050), reference]
    spectrum = librosa.stft(full, n_fft=2048, hop_length=256)
    magnitude, phase = librosa.magphase(spectrum)
    background = librosa.decompose.nn_filter(
        magnitude, aggregate=np.median, metric='cosine', k=neighbors,
        width=int(librosa.time_to_frames(2, sr=22050, hop_length=256)))
    background = np.minimum(background, magnitude)
    mask = librosa.util.softmask(background, margin * (magnitude - background), power=2)
    mask = median_filter(mask, size=(1, 3))
    # Retain the recording's musical phase, with no synthetic replacement tune.
    music = librosa.istft(mask * magnitude * phase, hop_length=256, length=len(full))[:len(samples)]
    foreground = samples - music
    return music, foreground, mask[:, :int(np.ceil(len(samples)/256))]


def loop_crossfade(samples, rate, seconds=1):
    count = round(seconds * rate)
    if len(samples) < 3 * count:
        raise ValueError('Need at least three crossfade lengths')
    weight = .5 - .5 * np.cos(np.linspace(0, np.pi, count))
    joint = samples[-count:] * (1-weight) + samples[:count] * weight
    # Rotation makes the *file seam* adjacent original samples. The tail/head
    # overlap is inside the loop, rather than a silent fade at every repeat.
    return np.r_[joint, samples[count:-count]].astype(np.float32)


def main():
    p = argparse.ArgumentParser()
    p.add_argument('--source', type=Path, required=True)
    p.add_argument('--reference', type=Path)
    p.add_argument('--ffmpeg', required=True)
    p.add_argument('--work', type=Path, required=True)
    p.add_argument('--output', type=Path, required=True)
    p.add_argument('--start', type=float, default=.4)
    p.add_argument('--end', type=float, required=True)
    p.add_argument('--crossfade', type=float, default=1)
    p.add_argument('--margin', type=float, default=2.5)
    args = p.parse_args()
    args.work.mkdir(parents=True, exist_ok=True)
    rate = 22050
    raw = extract(args.source, args.work/'input.wav', args.ffmpeg)
    reference = extract(args.reference, args.work/'reference.wav', args.ffmpeg) if args.reference else None
    music, foreground, mask = separate(raw, reference, margin=args.margin)
    sf.write(args.work/'music-separated.wav', music, rate, subtype='PCM_24')
    sf.write(args.work/'foreground-removed.wav', foreground, rate, subtype='PCM_24')
    if not 0 <= args.start < args.end <= len(raw)/rate:
        raise ValueError('Crop outside recording')
    crop = music[round(args.start*rate):round(args.end*rate)]
    loop = loop_crossfade(crop, rate, args.crossfade)
    rms = np.sqrt(np.mean(loop**2))
    if rms < 1e-5:
        raise ValueError('Separated music is silent')
    # -22 dBFS RMS, peak ceiling -2 dBFS; game gain is additionally 0.55.
    gain = min(10**(-22/20)/rms, 10**(-2/20)/np.max(np.abs(loop)))
    loop *= gain
    wav = args.work/'loop.wav'
    sf.write(wav, loop, rate, subtype='PCM_24')
    args.output.parent.mkdir(parents=True, exist_ok=True)
    subprocess.run([args.ffmpeg, '-y', '-hide_banner', '-loglevel', 'error',
                    '-i', str(wav), '-ar', '44100', '-ac', '1', '-c:a', 'libmp3lame',
                    '-b:a', '96k', '-write_xing', '1', '-id3v2_version', '3',
                    '-map_metadata', '-1', str(args.output)], check=True)
    report = {
        'source': args.source.name, 'source_sha256': hashlib.sha256(args.source.read_bytes()).hexdigest(),
        'reference': args.reference.name if args.reference else None,
        'reference_sha256': hashlib.sha256(args.reference.read_bytes()).hexdigest() if args.reference else None,
        'recorded_audio_seconds': len(raw)/rate, 'crop': [args.start, args.end],
        'loop_seconds': len(loop)/rate, 'crossfade_seconds': args.crossfade,
        'method': 'REPET-SIM, 24 nonlocal spectral neighbors, median, soft Wiener mask',
        'margin': args.margin, 'median_mask': float(np.median(mask)),
        'removed_energy_fraction': float(np.mean(foreground**2)/np.mean(raw**2)),
        'rms_dbfs': float(20*np.log10(np.sqrt(np.mean(loop**2)))),
        'peak_dbfs': float(20*np.log10(np.max(np.abs(loop)))),
        'seam_sample_jump': float(abs(loop[-1]-loop[0])),
        'output_sha256': hashlib.sha256(args.output.read_bytes()).hexdigest(),
        'output_bytes': args.output.stat().st_size,
    }
    (args.work/'report.json').write_text(json.dumps(report, indent=2), encoding='utf-8')
    print(json.dumps(report))


if __name__ == '__main__':
    main()

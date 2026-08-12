from __future__ import annotations

import json
import sys
from pathlib import Path

import librosa
import numpy as np
from scipy.signal import butter, sosfilt


def analyze(path: Path) -> dict[str, object]:
    y, sr = librosa.load(path, sr=None, mono=True)
    harmonic, percussive = librosa.effects.hpss(y)
    tempo, beats = librosa.beat.beat_track(
        y=percussive,
        sr=sr,
        tightness=400,
        units='time',
    )
    beat_times = np.asarray(beats, dtype=float)
    if len(beat_times) >= 4:
        indices = np.arange(len(beat_times), dtype=float)
        matrix = np.vstack([indices, np.ones_like(indices)]).T
        (beat_interval, beat_zero), *_ = np.linalg.lstsq(matrix, beat_times, rcond=None)
        residual = beat_times - (beat_zero + indices * beat_interval)
        fitted_bpm = 60.0 / beat_interval
        max_residual_ms = float(np.abs(residual).max() * 1000)
    else:
        beat_interval = 0.0
        beat_zero = 0.0
        fitted_bpm = float(np.asarray(tempo).reshape(-1)[0])
        max_residual_ms = 0.0

    sos = butter(4, [40, 160], btype='band', fs=sr, output='sos')
    kick = sosfilt(sos, y)
    onset = librosa.onset.onset_strength(y=kick, sr=sr)
    onset_times = librosa.times_like(onset, sr=sr)
    top_indices = np.argsort(onset)[-12:][::-1]
    top_hits = sorted(round(float(onset_times[index]), 3) for index in top_indices)

    rms = librosa.feature.rms(y=y)[0]
    rms_times = librosa.times_like(rms, sr=sr)
    segments = []
    for start in np.arange(0, min(len(y) / sr, 125), 10):
        mask = (rms_times >= start) & (rms_times < start + 10)
        segments.append({
            'from': round(float(start), 1),
            'rms': round(float(np.mean(rms[mask])) if mask.any() else 0.0, 5),
        })

    return {
        'file': str(path),
        'duration_seconds': round(float(len(y) / sr), 3),
        'sample_rate': sr,
        'detected_bpm': round(float(np.asarray(tempo).reshape(-1)[0]), 3),
        'fitted_bpm': round(float(fitted_bpm), 3),
        'beat_zero_seconds': round(float(beat_zero), 4),
        'beat_interval_seconds': round(float(beat_interval), 5),
        'max_grid_residual_ms': round(max_residual_ms, 2),
        'top_low_frequency_hits_seconds': top_hits,
        'ten_second_rms': segments,
    }


if __name__ == '__main__':
    paths = [Path(item).resolve() for item in sys.argv[1:]]
    print(json.dumps([analyze(path) for path in paths], ensure_ascii=False, indent=2))

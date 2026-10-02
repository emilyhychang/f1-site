"""Build bundled animation paths from the MIT-licensed bacinger/f1-circuits data.
Usage: python data_pipeline/build_circuits.py /path/to/f1-circuits.geojson
Formula Timer is the venue guide; vector geometry is independently licensed.
"""
import json
import math
from pathlib import Path
import sys

IDS = {
    'albert_park': ('au-1953', 'melbourne'), 'bahrain': ('bh-2002', 'bahrain'),
    'shanghai': ('cn-2004', 'shanghai'), 'catalunya': ('es-1991', 'barcelona'),
    'monaco': ('mc-1929', 'monaco'), 'villeneuve': ('ca-1978', 'montreal'),
    'red_bull_ring': ('at-1969', 'spielberg'), 'silverstone': ('gb-1948', 'silverstone'),
    'hungaroring': ('hu-1986', 'hungaroring'), 'spa': ('be-1925', 'spa'),
    'monza': ('it-1922', 'monza'), 'marina_bay': ('sg-2008', 'singapore'),
    'suzuka': ('jp-1962', 'suzuka'), 'americas': ('us-2012', 'austin'),
    'rodriguez': ('mx-1962', 'mexico-city'), 'interlagos': ('br-1940', 'interlagos'),
    'yas_marina': ('ae-2009', 'abu-dhabi'), 'imola': ('it-1953', 'imola'),
    'sepang': ('my-1999', 'sepang'), 'zandvoort': ('nl-1948', 'zandvoort'),
    'jeddah': ('sa-2021', 'jeddah'), 'miami': ('us-2022', 'miami'),
    'losail': ('qa-2004', 'lusail'), 'madring': ('es-2026', 'madrid'),
    'vegas': ('us-2023', 'las-vegas'), 'baku': ('az-2016', 'baku'),
}


def build(features):
    by_id = {f['properties']['id']: f for f in features}
    tracks = {}
    for circuit_id, (source_id, guide) in IDS.items():
        feature = by_id[source_id]
        coords = feature['geometry']['coordinates']
        latitude = sum(c[1] for c in coords) / len(coords)
        points = [(c[0] * math.cos(math.radians(latitude)), -c[1]) for c in coords]
        xs, ys = zip(*points)
        width, height = max(xs) - min(xs), max(ys) - min(ys)
        scale = min(480 / width, 275 / height)
        ox, oy = (540 - width * scale) / 2, (320 - height * scale) / 2
        projected = [(ox + (x - min(xs)) * scale, oy + (y - min(ys)) * scale) for x, y in points]
        path = ' '.join(f'{"M" if i == 0 else "L"}{x:.2f},{y:.2f}' for i, (x, y) in enumerate(projected)) + ' Z'
        tracks[circuit_id] = {
            'label': feature['properties']['Name'], 'path': path,
            'viewBox': '0 0 540 320',
            'lengthKm': feature['properties']['length'] / 1000,
            'guide': 'https://formula-timer.com/circuit/' + ('madrid' if circuit_id == 'madring' else circuit_id),
        }
    return tracks


if __name__ == '__main__':
    features = json.loads(Path(sys.argv[1]).read_text())['features']
    Path('docs/data/circuits.json').write_text(json.dumps(build(features), indent=2) + '\n')

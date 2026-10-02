"""Refresh the lightweight, atomic schedule/completion snapshot independently of telemetry."""
from datetime import datetime, timezone
import json
from pathlib import Path
from urllib.request import urlopen

YEAR = 2026
API = f'https://api.jolpi.ca/ergast/f1/{YEAR}'


def read_feed(url):
    with urlopen(url, timeout=30) as response:
        return json.load(response)


def build_snapshot(schedule, results, now=None):
    now = now or datetime.now(timezone.utc)
    for feed in (schedule, results):
        data = feed['MRData']
        if int(data['RaceTable']['season']) != YEAR or int(data['total']) != len(data['RaceTable']['Races']):
            raise ValueError('Incomplete or wrong-season feed; keeping last snapshot')
    races = schedule['MRData']['RaceTable']['Races']
    if not races:
        raise ValueError('Empty schedule')
    by_round = {int(r['round']): r for r in races}
    if len(by_round) != len(races):
        raise ValueError('Duplicate schedule rounds')
    completed = []
    for race in results['MRData']['RaceTable']['Races']:
        event = by_round.get(int(race['round']))
        if not event or event['Circuit']['circuitId'] != race['Circuit']['circuitId']:
            raise ValueError('Results do not match schedule')
        start = datetime.fromisoformat(event['date'] + 'T' + event.get('time', '23:59:59Z').replace('Z', '+00:00'))
        if start <= now and any(int(r['position']) == 1 and int(r.get('laps', 0)) > 0 for r in race.get('Results', [])):
            completed.append(int(race['round']))
    return {'season': YEAR, 'schedule': races, 'completedRounds': completed, 'updatedAt': now.isoformat()}


def refresh():
    snapshot = build_snapshot(read_feed(f'{API}/?limit=100'), read_feed(f'{API}/results/1/?limit=100'))
    destination = Path('docs/data/race_status.json')
    if destination.exists():
        previous = json.loads(destination.read_text())
        if previous.get('season') == YEAR:
            valid = {int(r['round']) for r in snapshot['schedule']}
            snapshot['completedRounds'] = sorted((set(previous['completedRounds']) | set(snapshot['completedRounds'])) & valid)
            if all(previous.get(key) == snapshot[key] for key in ('season', 'schedule', 'completedRounds')):
                print('Race status unchanged')
                return
    temporary = destination.with_suffix('.tmp')
    temporary.write_text(json.dumps(snapshot, indent=2) + '\n')
    temporary.replace(destination)
    print('Race status refreshed')


if __name__ == '__main__':
    refresh()

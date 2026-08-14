import json
from pathlib import Path


DATA_DIR = Path('docs/data')


def load(relative_path):
    with (DATA_DIR / relative_path).open() as file:
        return json.load(file)


standings = load('standings_2026.json')
drivers = load('model/driver_summary_2026.json')
teams = load('model/team_summary_2026.json')
next_race = load('next_race.json')

if not isinstance(standings, list) or len(standings) < 10:
    raise ValueError('Standings validation failed: fewer than 10 drivers')

if not isinstance(drivers, dict) or len(drivers) < 10:
    raise ValueError('Fantasy driver validation failed: fewer than 10 drivers')

if not isinstance(teams, dict) or len(teams) < 5:
    raise ValueError('Fantasy team validation failed: fewer than 5 teams')

required_next_race_fields = {'round', 'eventName', 'location', 'country', 'date'}
if not required_next_race_fields.issubset(next_race):
    raise ValueError('Next-race validation failed: required fields are missing')

print('Generated F1 data passed safety checks.')

import json
from pathlib import Path


DATA_DIR = Path('docs/data')


def load(relative_path):
    with (DATA_DIR / relative_path).open() as file:
        return json.load(file)


standings = load('standings_2026.json')
drivers = load('model/driver_summary_2026.json')
teams = load('model/team_summary_2026.json')
prediction = load('model/race_prediction_2026.json')
next_race = load('next_race.json')
career_stats = load('career_stats.json')

if not isinstance(standings, list) or len(standings) < 10:
    raise ValueError('Standings validation failed: fewer than 10 drivers')

if not isinstance(drivers, dict) or len(drivers) < 10:
    raise ValueError('Fantasy driver validation failed: fewer than 10 drivers')

if not isinstance(teams, dict) or len(teams) < 5:
    raise ValueError('Fantasy team validation failed: fewer than 5 teams')

predicted_drivers = prediction.get('drivers', [])
predicted_finishes = [driver.get('predictedFinish') for driver in predicted_drivers]
expected_finishes = list(range(1, len(predicted_drivers) + 1))
if (
    len(predicted_drivers) < 10
    or sorted(predicted_finishes) != expected_finishes
    or prediction.get('race', {}).get('round') != next_race.get('round')
):
    raise ValueError('Race prediction validation failed: missing drivers or duplicate finishes')

required_next_race_fields = {'round', 'eventName', 'location', 'country', 'date'}
if not required_next_race_fields.issubset(next_race):
    raise ValueError('Next-race validation failed: required fields are missing')

required_career_fields = {
    'Grands Prix Entered',
    'Career Points',
    'Highest Race Finish',
    'Podiums',
    'Pole Positions',
    'Fastest Laps',
    'source',
}
if not required_career_fields.issubset(career_stats):
    raise ValueError('Career-stat validation failed: official fields are missing')

print('Generated F1 data passed safety checks.')

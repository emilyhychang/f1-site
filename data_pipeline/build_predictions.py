"""Build a transparent, data-driven forecast for the next Formula 1 race."""

import json
import math
from pathlib import Path


YEAR = 2026
DATA_DIR = Path('docs/data')
MODEL_DIR = DATA_DIR / 'model'


def load(path):
    with path.open() as file:
        return json.load(file)


def mean(values, fallback=20.0):
    clean = [float(value) for value in values if value is not None]
    return sum(clean) / len(clean) if clean else fallback


def normalize_team(name):
    aliases = {
        'Red Bull': 'Red Bull Racing',
        'RB F1 Team': 'Racing Bulls',
        'Alpine F1 Team': 'Alpine',
        'Cadillac F1 Team': 'Cadillac',
    }
    return aliases.get(name, name)


def completed(status):
    text = str(status or '').lower()
    return text == 'finished' or text.startswith('+') or 'lap' in text


next_race = load(DATA_DIR / 'next_race.json')
schedule = load(DATA_DIR / f'schedule_{YEAR}.json')
weekend_path = DATA_DIR / f'weekend_context_{YEAR}.json'
weekend = load(weekend_path) if weekend_path.exists() else {}
if int(weekend.get('round', -1)) != int(next_race['round']):
    weekend = {}
sprint_positions = {
    row['code']: float(row['position']) for row in (weekend.get('sprint') or [])
}
qualifying_positions = {
    row['code']: float(row['position']) for row in (weekend.get('qualifying') or [])
}
completed_rounds = []

for event in schedule:
    round_number = int(event['RoundNumber'])
    path = DATA_DIR / f'results_{YEAR}_r{round_number}.json'
    if path.exists() and round_number < int(next_race['round']):
        completed_rounds.append((round_number, load(path)))

history = {}
for round_number, rows in completed_rounds:
    for row in rows:
        code = row['Abbreviation']
        history.setdefault(code, []).append({
            'round': round_number,
            'position': float(row['Position']),
            'points': float(row.get('Points') or 0),
            'completed': completed(row.get('Status')),
            'team': normalize_team(row['TeamName']),
        })

team_positions = {}
for races in history.values():
    current_team = races[-1]['team']
    team_positions.setdefault(current_team, []).extend(
        race['position'] for race in races[-5:]
    )
team_form = {team: mean(positions) for team, positions in team_positions.items()}

# Match the same location in the previous season. Missing/new drivers fall back
# to their own form, so circuit history can never dominate or exclude a driver.
prior_schedule = load(DATA_DIR / f'schedule_{YEAR - 1}.json')
prior_event = next(
    (event for event in prior_schedule if event['Location'] == next_race['location']),
    None,
)
prior_positions = {}
if prior_event:
    prior_path = DATA_DIR / f"results_{YEAR - 1}_r{int(prior_event['RoundNumber'])}.json"
    if prior_path.exists():
        prior_positions = {
            row['Abbreviation']: float(row['Position']) for row in load(prior_path)
        }

ratings = []
for code, races in history.items():
    recent = races[-5:]
    recent_position = mean([race['position'] for race in recent])
    season_position = mean([race['position'] for race in races])
    constructor_position = team_form[races[-1]['team']]
    circuit_position = prior_positions.get(code)
    circuit_input = circuit_position if circuit_position is not None else recent_position
    completion_rate = mean([1 if race['completed'] else 0 for race in races], 1)
    recent_variance = mean(
        [(race['position'] - recent_position) ** 2 for race in recent], 0
    )

    # Lower is better. Recent form carries most weight; the other features
    # stabilize small samples and add car, reliability, and circuit context.
    base_performance = (
        recent_position * 0.45
        + season_position * 0.20
        + constructor_position * 0.20
        + circuit_input * 0.15
        + (1 - completion_rate) * 4.0
    )
    sprint_position = sprint_positions.get(code)
    performance_after_sprint = (
        base_performance * 0.80 + sprint_position * 0.20
        if sprint_position is not None
        else base_performance
    )
    qualifying_position = qualifying_positions.get(code)
    performance = (
        performance_after_sprint * 0.55 + qualifying_position * 0.45
        if qualifying_position is not None
        else performance_after_sprint
    )
    qualifying = (
        recent_position * 0.55
        + season_position * 0.25
        + constructor_position * 0.20
    )
    confidence = max(
        35,
        min(95, 55 + min(len(races), 10) * 2 + (8 if circuit_position else 0) + (5 if sprint_position else 0) + (10 if qualifying_position else 0) - math.sqrt(recent_variance) * 2),
    )
    ratings.append({
        'code': code,
        'name': next((row['FullName'] for _, rows in reversed(completed_rounds) for row in rows if row['Abbreviation'] == code), code),
        'team': races[-1]['team'],
        'recentPosition': round(recent_position, 2),
        'seasonPosition': round(season_position, 2),
        'constructorPosition': round(constructor_position, 2),
        'circuitPosition': circuit_position,
        'sprintPosition': sprint_position,
        'qualifyingPosition': qualifying_position,
        'completionRate': round(completion_rate, 3),
        'performanceRating': round(performance, 3),
        'qualifyingRating': round(qualifying, 3),
        'confidence': round(confidence),
    })

finish_order = sorted(ratings, key=lambda item: (item['performanceRating'], item['code']))
grid_order = sorted(
    ratings,
    key=lambda item: (
        item['qualifyingPosition']
        if item['qualifyingPosition'] is not None
        else item['qualifyingRating'],
        item['code'],
    ),
)
finish_positions = {item['code']: index + 1 for index, item in enumerate(finish_order)}
grid_positions = {item['code']: index + 1 for index, item in enumerate(grid_order)}

for item in ratings:
    item['predictedGrid'] = grid_positions[item['code']]
    item['predictedFinish'] = finish_positions[item['code']]

output = {
    'race': next_race,
    'model': {
        'version': 1,
        'weights': {
            'recentForm': 0.45,
            'seasonForm': 0.20,
            'constructorForm': 0.20,
            'sameCircuitHistory': 0.15,
        },
        'reliabilityPenaltyPositions': 4.0,
        'sprintResultWeight': 0.20,
        'qualifyingResultWeight': 0.45,
        'lookbackRaces': 5,
        'trainedThroughRound': max((round_number for round_number, _ in completed_rounds), default=0),
    },
    'sessions': {
        'sprintIncluded': bool(sprint_positions),
        'qualifyingIncluded': bool(qualifying_positions),
    },
    'drivers': sorted(ratings, key=lambda item: item['predictedFinish']),
}

MODEL_DIR.mkdir(parents=True, exist_ok=True)
with (MODEL_DIR / f'race_prediction_{YEAR}.json').open('w') as file:
    json.dump(output, file, indent=2)

print(f"Prediction built for {next_race['eventName']} using {len(completed_rounds)} completed races.")

import fastf1
import glob
import html
import json
import os
import pandas as pd
import re
import requests
from datetime import datetime, timedelta, timezone

os.makedirs('data_pipeline/cache', exist_ok=True)
fastf1.Cache.enable_cache('data_pipeline/cache')  # avoids re-downloading

YEAR = 2026
OUT_DIR = 'docs/data'
os.makedirs(OUT_DIR, exist_ok=True)

schedule = fastf1.get_event_schedule(YEAR, include_testing=False)
schedule['EventDate'] = pd.to_datetime(schedule['EventDate'], utc=True)
now = datetime.now(timezone.utc)


def race_data_should_be_available(event):
    """Wait six hours after the scheduled race time before requesting results."""
    race_time = event.get('Session5DateUtc')
    if pd.isna(race_time):
        race_time = event['EventDate'] + timedelta(hours=18)
    else:
        race_time = pd.to_datetime(race_time, utc=True)
    return race_time + timedelta(hours=6) <= now

schedule_out = schedule[
    ['RoundNumber', 'EventName', 'Location', 'Country', 'EventDate', 'Session5DateUtc']
].copy()
schedule_out['EventDate'] = schedule_out['EventDate'].astype(str)
schedule_out['Session5DateUtc'] = schedule_out['Session5DateUtc'].astype(str)
schedule_out.to_json(f'{OUT_DIR}/schedule_{YEAR}.json', orient='records', indent=2)

standings = {}

for _, event in schedule.iterrows():
    rnd = int(event['RoundNumber'])
    if rnd == 0 or not race_data_should_be_available(event):
        continue
    try:
        session = fastf1.get_session(YEAR, rnd, 'R')
        session.load(laps=False, telemetry=False, weather=False)
    except Exception as e:
        print(f"Skipping round {rnd} ({event['EventName']}): {e}")
        continue

    results = session.results[
        ['DriverNumber', 'Abbreviation', 'FullName', 'TeamName', 'Position', 'Points', 'Status']
    ]
    results.to_json(f'{OUT_DIR}/results_{YEAR}_r{rnd}.json', orient='records', indent=2)

    for _, row in results.iterrows():
        drv = row['Abbreviation']
        standings.setdefault(drv, {'driver': row['FullName'], 'team': row['TeamName'], 'points': 0})
        standings[drv]['points'] += float(row['Points'] or 0)

standings_list = sorted(standings.values(), key=lambda x: -x['points'])
if standings_list:
    with open(f'{OUT_DIR}/standings_{YEAR}.json', 'w') as f:
        json.dump(standings_list, f, indent=2)
else:
    print('No completed-race standings returned; keeping the existing file.')

# --- Find the next race and pull its track shape ---
schedule_dates = schedule.copy()

print("DEBUG — current time:", now)
print("DEBUG — schedule dates:\n", schedule_dates[['RoundNumber', 'EventName', 'EventDate']].to_string())
upcoming = schedule_dates[
    ~schedule_dates.apply(race_data_should_be_available, axis=1)
].sort_values('EventDate')

if not upcoming.empty:
    next_event = upcoming.iloc[0]
    next_race_info = {
        'round': int(next_event['RoundNumber']),
        'eventName': next_event['EventName'],
        'location': next_event['Location'],
        'country': next_event['Country'],
        'date': str(next_event['EventDate']),
        'raceStart': str(next_event['Session5DateUtc'])
    }
    with open(f'{OUT_DIR}/next_race.json', 'w') as f:
        json.dump(next_race_info, f, indent=2)

    try:
        prev_session = fastf1.get_session(YEAR - 1, next_event['EventName'], 'R')
        prev_session.load(telemetry=True, weather=False)
        fastest_lap = prev_session.laps.pick_fastest()
        tel = fastest_lap.get_telemetry()
        track_shape = tel[['X', 'Y']].dropna().to_dict(orient='records')
        with open(f'{OUT_DIR}/track_shape.json', 'w') as f:
            json.dump(track_shape, f)
        print(f"Track shape saved for {next_event['EventName']}")
    except Exception as e:
        print(f"Could not fetch track shape: {e}")
else:
    print("No upcoming races found in schedule.")

# --- Official Formula 1 career statistics for Charles Leclerc ---
CAREER_STATS_URL = 'https://www.formula1.com/en/drivers/charles-leclerc'
CAREER_FIELDS = (
    'Grands Prix Entered',
    'Career Points',
    'Highest Race Finish',
    'Podiums',
    'Pole Positions',
    'World Championships',
)

try:
    response = requests.get(
        CAREER_STATS_URL,
        headers={'User-Agent': 'Mozilla/5.0 (compatible; Scuderia16DataBot/1.0)'},
        timeout=30,
    )
    response.raise_for_status()
    official_stats = {}

    for field in CAREER_FIELDS:
        match = re.search(
            rf'<dt[^>]*>\s*{re.escape(field)}\s*</dt>\s*<dd[^>]*>(.*?)</dd>',
            response.text,
            flags=re.IGNORECASE | re.DOTALL,
        )
        if not match:
            raise ValueError(f'Official F1 field not found: {field}')
        value = re.sub(r'<[^>]+>', '', match.group(1)).strip()
        official_stats[field] = html.unescape(value)

    official_stats['source'] = CAREER_STATS_URL
    official_stats['updatedAt'] = now.isoformat()
    with open(f'{OUT_DIR}/career_stats.json', 'w') as file:
        json.dump(official_stats, file, indent=2)
    print('Official Charles Leclerc career statistics updated.')
except Exception as error:
    print(f'Could not refresh official career statistics; keeping existing file: {error}')
# --- Deeper race analysis: lap times, tire strategy, fastest laps, telemetry ---
ANALYSIS_DIR = f'{OUT_DIR}/analysis'
os.makedirs(ANALYSIS_DIR, exist_ok=True)
LECLERC_FASTEST_LAPS_BEFORE_2026 = 11

for _, event in schedule.iterrows():
    rnd = int(event['RoundNumber'])
    if rnd == 0 or not race_data_should_be_available(event):
        continue

    try:
        session = fastf1.get_session(YEAR, rnd, 'R')
        session.load(telemetry=True, weather=False)

        if session.laps.empty:
            continue

        # Lap times per driver
        laps = session.laps[['Driver', 'LapNumber', 'LapTime', 'Compound', 'Stint']].copy()
        laps['LapTime'] = laps['LapTime'].dt.total_seconds()
        laps_clean = laps.dropna(subset=['LapTime'])
        with open(f'{ANALYSIS_DIR}/laps_{YEAR}_r{rnd}.json', 'w') as f:
            json.dump(laps_clean.to_dict(orient='records'), f)

        # Tire stints — one row per driver/stint with compound + lap range
        stints = laps.groupby(['Driver', 'Stint', 'Compound']).agg(
            StartLap=('LapNumber', 'min'), EndLap=('LapNumber', 'max')
        ).reset_index()
        with open(f'{ANALYSIS_DIR}/stints_{YEAR}_r{rnd}.json', 'w') as f:
            json.dump(stints.to_dict(orient='records'), f)

        # Fastest lap leaderboard
        fastest_laps = []
        for drv in session.laps['Driver'].unique():
            fastest = session.laps.pick_driver(drv).pick_fastest()
            if fastest is not None and not pd.isna(fastest['LapTime']):
                fastest_laps.append({
                    'driver': drv,
                    'lapTime': fastest['LapTime'].total_seconds(),
                    'lapNumber': int(fastest['LapNumber']),
                    'compound': fastest['Compound']
                })
        fastest_laps.sort(key=lambda x: x['lapTime'])
        with open(f'{ANALYSIS_DIR}/fastest_laps_{YEAR}_r{rnd}.json', 'w') as f:
            json.dump(fastest_laps, f)

        # Telemetry (speed/throttle/brake) for the two fastest drivers
        top_drivers = [d['driver'] for d in fastest_laps[:2]]
        if 'LEC' not in top_drivers:
            top_drivers.append('LEC')

        for drv in top_drivers:
            try:
                fastest = session.laps.pick_driver(drv).pick_fastest()
                tel = fastest.get_telemetry().add_distance()
                tel_small = tel[['Distance', 'Speed', 'Throttle', 'Brake', 'nGear']].iloc[::3]
                tel_small.to_json(f'{ANALYSIS_DIR}/telemetry_{YEAR}_r{rnd}_{drv}.json', orient='records')
            except Exception as e:
                print(f"Telemetry failed for {drv} round {rnd}: {e}")

    except Exception as e:
        print(f"Skipping analysis for round {rnd} ({event['EventName']}): {e}")
        continue

print("Analysis data pipeline complete.")

try:
    leclerc_fastest_laps_2026 = 0
    for fastest_lap_file in glob.glob(f'{ANALYSIS_DIR}/fastest_laps_{YEAR}_r*.json'):
        with open(fastest_lap_file) as file:
            race_fastest_laps = json.load(file)
        if race_fastest_laps and race_fastest_laps[0].get('driver') == 'LEC':
            leclerc_fastest_laps_2026 += 1

    with open(f'{OUT_DIR}/career_stats.json') as file:
        career_stats = json.load(file)
    career_stats['Fastest Laps'] = str(
        LECLERC_FASTEST_LAPS_BEFORE_2026 + leclerc_fastest_laps_2026
    )
    with open(f'{OUT_DIR}/career_stats.json', 'w') as file:
        json.dump(career_stats, file, indent=2)
except Exception as error:
    print(f'Could not update career fastest-lap total: {error}')

# --- Fantasy model inputs ---
MODEL_DIR = f'{OUT_DIR}/model'
os.makedirs(MODEL_DIR, exist_ok=True)

driver_race_history = {}

for _, event in schedule.iterrows():
    rnd = int(event['RoundNumber'])
    if rnd == 0 or not race_data_should_be_available(event):
        continue

    try:
        with open(f'{OUT_DIR}/results_{YEAR}_r{rnd}.json') as f:
            results_rows = json.load(f)

        for row in results_rows:
            drv = row['Abbreviation']
            pos = row['Position']
            pts = row['Points']
            driver_race_history.setdefault(drv, []).append({
                'round': rnd,
                'position': float(pos) if pd.notna(pos) else None,
                'points': float(pts) if pd.notna(pts) else 0,
                'wet': False,
                'team': row['TeamName']
            })
    except Exception as e:
        print(f"Skipping model data for round {rnd}: {e}")
        continue

driver_summary = {}
for drv, races in driver_race_history.items():
    races_sorted = sorted(races, key=lambda r: r['round'])
    recent = races_sorted[-5:]
    recent_positions = [r['position'] for r in recent if r['position'] is not None]
    recent_points = [r['points'] for r in recent]

    dry_positions = [r['position'] for r in races_sorted if not r['wet'] and r['position'] is not None]
    wet_positions = [r['position'] for r in races_sorted if r['wet'] and r['position'] is not None]

    team = races_sorted[-1]['team'] if races_sorted else None

    driver_summary[drv] = {
        'team': team,
        'avgRecentPosition': sum(recent_positions) / len(recent_positions) if recent_positions else None,
        'avgRecentPoints': sum(recent_points) / len(recent_points) if recent_points else 0,
        'avgDryPosition': sum(dry_positions) / len(dry_positions) if dry_positions else None,
        'avgWetPosition': sum(wet_positions) / len(wet_positions) if wet_positions else None,
        'wetRaceCount': len(wet_positions),
        'racesCount': len(races_sorted)
    }

if driver_summary:
    with open(f'{MODEL_DIR}/driver_summary_{YEAR}.json', 'w') as f:
        json.dump(driver_summary, f, indent=2)
else:
    print('No model inputs returned; keeping the existing driver summary.')

team_race_points = {}
for drv, summary in driver_summary.items():
    team = summary['team']
    if team is None:
        continue
    team_race_points.setdefault(team, []).append(summary['avgRecentPoints'])

team_summary = {team: sum(pts) / len(pts) for team, pts in team_race_points.items()}
if team_summary:
    with open(f'{MODEL_DIR}/team_summary_{YEAR}.json', 'w') as f:
        json.dump(team_summary, f, indent=2)
else:
    print('No model inputs returned; keeping the existing team summary.')

print("Fantasy model data pipeline complete.")

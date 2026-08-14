import fastf1
import json
import os
import pandas as pd
from datetime import datetime, timezone

fastf1.Cache.enable_cache('data_pipeline/cache')  # avoids re-downloading

YEAR = 2026
OUT_DIR = 'docs/data'
os.makedirs(OUT_DIR, exist_ok=True)

schedule = fastf1.get_event_schedule(YEAR, include_testing=False)

schedule_out = schedule[['RoundNumber', 'EventName', 'Location', 'Country', 'EventDate']].copy()
schedule_out['EventDate'] = schedule_out['EventDate'].astype(str)
schedule_out.to_json(f'{OUT_DIR}/schedule_{YEAR}.json', orient='records', indent=2)

standings = {}

for _, event in schedule.iterrows():
    rnd = int(event['RoundNumber'])
    if rnd == 0:
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
with open(f'{OUT_DIR}/standings_{YEAR}.json', 'w') as f:
    json.dump(standings_list, f, indent=2)

from datetime import datetime, timezone

# --- Find the next race and pull its track shape ---
schedule_dates = schedule.copy()
schedule_dates['EventDate'] = pd.to_datetime(schedule_dates['EventDate'], utc=True)
now = datetime.now(timezone.utc)

print("DEBUG — current time:", now)
print("DEBUG — schedule dates:\n", schedule_dates[['RoundNumber', 'EventName', 'EventDate']].to_string())
upcoming = schedule_dates[schedule_dates['EventDate'] > now].sort_values('EventDate')

if not upcoming.empty:
    next_event = upcoming.iloc[0]
    next_race_info = {
        'round': int(next_event['RoundNumber']),
        'eventName': next_event['EventName'],
        'location': next_event['Location'],
        'country': next_event['Country'],
        'date': str(next_event['EventDate'])
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
# --- Deeper race analysis: lap times, tire strategy, fastest laps, telemetry ---
ANALYSIS_DIR = f'{OUT_DIR}/analysis'
os.makedirs(ANALYSIS_DIR, exist_ok=True)

for _, event in schedule.iterrows():
    rnd = int(event['RoundNumber'])
    if rnd == 0:
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
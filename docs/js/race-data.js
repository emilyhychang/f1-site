/* Shared next-race state. A published race result, never a time estimate,
   advances the calendar. The bundled snapshot works if the live API is down. */
(function (root) {
  const YEAR = 2026;
  const API = `https://api.jolpi.ca/ergast/f1/${YEAR}`;
  const listeners = new Set();
  let state = null;
  let pending = null;
  let started = false;

  function validateSnapshot(value) {
    if (value.season !== YEAR || !Array.isArray(value.schedule) || !value.schedule.length ||
        !Array.isArray(value.completedRounds)) throw new Error('Invalid race snapshot');
    const rounds = new Set();
    for (const race of value.schedule) {
      if (Number(race.season) !== YEAR || !Number.isInteger(Number(race.round)) || Number(race.round) < 1 ||
          rounds.has(Number(race.round)) || !race.raceName || !race.Circuit?.circuitId ||
          !race.Circuit.Location?.locality || !race.Circuit.Location?.country ||
          !Number.isFinite(Date.parse(race.date + 'T' + (race.time || '00:00:00Z')))) {
        throw new Error('Invalid schedule');
      }
      rounds.add(Number(race.round));
    }
    if (value.completedRounds.some(round => !rounds.has(round))) throw new Error('Invalid completed round');
    return value;
  }

  function fromResponses(schedule, results, now = Date.now()) {
    const races = schedule.MRData?.RaceTable?.Races;
    const finished = results.MRData?.RaceTable?.Races;
    if (!Array.isArray(races) || !Array.isArray(finished) ||
        Number(schedule.MRData.total) !== races.length || Number(results.MRData.total) !== finished.length ||
        String(schedule.MRData.RaceTable.season) !== String(YEAR) ||
        String(results.MRData.RaceTable.season) !== String(YEAR)) throw new Error('Incomplete race feed');
    const completedRounds = finished.filter(race => {
      const scheduled = races.find(item => item.round === race.round && item.Circuit.circuitId === race.Circuit.circuitId);
      return scheduled && Date.parse(scheduled.date + 'T' + (scheduled.time || '23:59:59Z')) <= now &&
        race.Results?.some(result => Number(result.position) === 1 && Number(result.laps) > 0);
    }).map(race => Number(race.round));
    return validateSnapshot({season: YEAR, schedule: races, completedRounds, updatedAt: new Date(now).toISOString()});
  }

  function selectNextRace(value) {
    return [...value.schedule].sort((a, b) => Number(a.round) - Number(b.round))
      .find(race => !value.completedRounds.includes(Number(race.round))) || null;
  }

  async function json(url) {
    const response = await fetch(url, {cache: 'no-store', signal: AbortSignal.timeout(15000)});
    if (!response.ok) throw new Error(`Race feed returned ${response.status}`);
    return response.json();
  }

  function publish(value, live) {
    validateSnapshot(value);
    // A stale CDN/API response must never undo a confirmed finish.
    if (state) {
      const valid = new Set(value.schedule.map(race => Number(race.round)));
      value.completedRounds = [...new Set([...value.completedRounds, ...state.completedRounds])].filter(r => valid.has(r));
    }
    state = {...value, live, nextRace: selectNextRace(value)};
    listeners.forEach(listener => listener(state));
  }

  async function refresh() {
    if (pending) return pending;
    pending = (async () => {
      if (!state) {
        try { publish(await json('data/race_status.json'), false); } catch (error) { console.warn(error.message); }
      }
      try {
        const [schedule, results] = await Promise.all([
          json(`${API}/?limit=100`), json(`${API}/results/1/?limit=100`)
        ]);
        publish(fromResponses(schedule, results), true);
      } catch (error) {
        console.warn('Live race update unavailable:', error.message);
        try { publish(await json('data/race_status.json'), false); }
        catch { if (state) publish(state, false); else listeners.forEach(listener => listener(null)); }
      }
    })().finally(() => { pending = null; });
    return pending;
  }

  function subscribe(listener) {
    listeners.add(listener);
    if (state) listener(state);
    if (!started) {
      started = true;
      refresh();
      setInterval(() => { if (!document.hidden) refresh(); }, 60000);
      document.addEventListener('visibilitychange', () => { if (!document.hidden) refresh(); });
    }
    return () => listeners.delete(listener);
  }
  root.F1RaceData = {subscribe, refresh, selectNextRace, fromResponses, validateSnapshot};
})(typeof window === 'undefined' ? globalThis : window);

// Known circuit coordinates + a rough type label, keyed by race Location
const CIRCUITS = {
    'Melbourne': { lat: -37.8497, lon: 144.968, type: 'Permanent — high-speed' },
    'Shanghai': { lat: 31.3389, lon: 121.2198, type: 'Permanent — technical' },
    'Suzuka': { lat: 34.8431, lon: 136.5410, type: 'Permanent — technical' },
    'Sakhir': { lat: 26.0325, lon: 50.5106, type: 'Permanent — balanced' },
    'Jeddah': { lat: 21.6319, lon: 39.1044, type: 'Street — high-speed' },
    'Miami': { lat: 25.9581, lon: -80.2389, type: 'Street — mixed' },
    'Imola': { lat: 44.3439, lon: 11.7167, type: 'Permanent — technical' },
    'Monaco': { lat: 43.7347, lon: 7.4206, type: 'Street — low-speed, technical' },
    'Barcelona': { lat: 41.5700, lon: 2.2611, type: 'Permanent — balanced' },
    'Montreal': { lat: 45.5000, lon: -73.5228, type: 'Semi-street — stop/start' },
    'Spielberg': { lat: 47.2197, lon: 14.7647, type: 'Permanent — high-speed' },
    'Silverstone': { lat: 52.0786, lon: -1.0169, type: 'Permanent — high-speed' },
    'Spa-Francorchamps': { lat: 50.4372, lon: 5.9714, type: 'Permanent — high-speed' },
    'Zandvoort': { lat: 52.3888, lon: 4.5409, type: 'Permanent — technical' },
    'Monza': { lat: 45.6156, lon: 9.2811, type: 'Permanent — very high-speed' },
    'Baku': { lat: 40.3725, lon: 49.8533, type: 'Street — high-speed' },
    'Singapore': { lat: 1.2914, lon: 103.8640, type: 'Street — low-speed, technical' },
    'Austin': { lat: 30.1328, lon: -97.6411, type: 'Permanent — balanced' },
    'Mexico City': { lat: 19.4042, lon: -99.0907, type: 'Permanent — high-altitude' },
    'Sao Paulo': { lat: -23.7036, lon: -46.6997, type: 'Permanent — technical' },
    'Las Vegas': { lat: 36.1147, lon: -115.1728, type: 'Street — very high-speed' },
    'Lusail': { lat: 25.4900, lon: 51.4542, type: 'Permanent — high-speed' },
    'Yas Island': { lat: 24.4672, lon: 54.6031, type: 'Permanent — balanced' },
  };
  
  const FERRARI_DRIVERS = ['LEC', 'HAM'];
  const MAX_TEAM_SIZE = 5;
  let selected = new Set();
  let driverScores = {};
  
  Promise.all([
    fetch('data/next_race.json').then(r => r.ok ? r.json() : null).catch(() => null),
    fetch('data/model/driver_summary_2026.json').then(r => r.json()),
    fetch('data/model/team_summary_2026.json').then(r => r.json())
  ]).then(([nextRace, driverSummary, teamSummary]) => {
    let isWet = false;
  
    const renderDrivers = () => {
      computeScores(driverSummary, teamSummary, isWet);
      renderPicks();
    };
  
    if (nextRace) {
      const circuit = CIRCUITS[nextRace.location];
      if (circuit) {
        fetchWeather(circuit, nextRace.date).then(wet => {
          isWet = wet;
          renderWeatherBadge(nextRace, circuit, wet);
          renderDrivers();
        });
      } else {
        document.getElementById('weather-badge').textContent =
          `${nextRace.eventName} — track location not in our lookup, using dry-weather form.`;
        renderDrivers();
      }
    } else {
      document.getElementById('weather-badge').textContent = 'No upcoming race found — showing season-long form.';
      renderDrivers();
    }
  });
  
  function fetchWeather(circuit, dateStr) {
    const date = dateStr.split('T')[0].split(' ')[0];
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${circuit.lat}&longitude=${circuit.lon}&daily=precipitation_probability_max&timezone=auto&start_date=${date}&end_date=${date}`;
    return fetch(url)
      .then(r => r.json())
      .then(data => {
        const prob = data?.daily?.precipitation_probability_max?.[0];
        window.__rainProb = prob;
        return typeof prob === 'number' && prob >= 50;
      })
      .catch(() => false);
  }
  
  function renderWeatherBadge(nextRace, circuit, isWet) {
    const badge = document.getElementById('weather-badge');
    const prob = window.__rainProb;
    badge.className = 'weather-badge' + (isWet ? ' wet' : '');
    if (typeof prob === 'number') {
      badge.textContent = `${nextRace.eventName} (${circuit.type}) — ${prob}% chance of rain. ${isWet ? 'Wet-weather form is being used for scoring.' : 'Dry-weather form is being used.'}`;
    } else {
      badge.textContent = `${nextRace.eventName} (${circuit.type}) — forecast not available yet (too far out). Using dry-weather form.`;
    }
  }
  
  function computeScores(driverSummary, teamSummary, isWet) {
    driverScores = {};
    const raw = {};
  
    Object.entries(driverSummary).forEach(([drv, d]) => {
      let positionForScore = d.avgRecentPosition;
      let usedWet = false;
      if (isWet && d.avgWetPosition !== null && d.wetRaceCount >= 1) {
        positionForScore = d.avgWetPosition;
        usedWet = true;
      }
      if (positionForScore === null || positionForScore === undefined) return;
  
      const formScore = Math.max(0, 21 - positionForScore);
      const teamScore = teamSummary[d.team] || 0;
      const total = formScore * 0.6 + teamScore * 0.4;
  
      raw[drv] = { total, formScore, teamScore, team: d.team, usedWet, avgRecentPosition: d.avgRecentPosition };
    });
  
    const totals = Object.values(raw).map(r => r.total);
    const min = Math.min(...totals), max = Math.max(...totals);
    Object.entries(raw).forEach(([drv, r]) => {
      const normalized = max > min ? (r.total - min) / (max - min) : 0.5;
      driverScores[drv] = { ...r, projected: (normalized * 25).toFixed(1) };
    });
  }
  
  function renderPicks() {
    const container = document.getElementById('driver-picks');
    container.innerHTML = '';
  
    const sorted = Object.entries(driverScores).sort((a, b) => b[1].projected - a[1].projected);
  
    sorted.forEach(([drv, s]) => {
      const row = document.createElement('div');
      row.className = 'driver-pick-row' + (selected.has(drv) ? ' selected' : '') + (FERRARI_DRIVERS.includes(drv) ? ' ferrari-row' : '');
      row.innerHTML = `
        <span class="abbr">${drv}</span>
        <span class="team">${s.team || '—'}</span>
        <span class="reasoning">Recent avg finish: P${s.avgRecentPosition?.toFixed(1) ?? '?'}${s.usedWet ? ' (wet-weather avg used)' : ''} · Team form factor: ${s.teamScore.toFixed(1)}</span>
        <span class="score">${s.projected} pts</span>
      `;
      row.addEventListener('click', () => toggleDriver(drv));
      container.appendChild(row);
    });
  }
  
  function toggleDriver(drv) {
    if (selected.has(drv)) {
      selected.delete(drv);
    } else {
      if (selected.size >= MAX_TEAM_SIZE) return;
      selected.add(drv);
    }
    renderPicks();
    updateSummaryBar();
  }
  
  function updateSummaryBar() {
    const bar = document.getElementById('team-summary-bar');
    const total = [...selected].reduce((sum, drv) => sum + parseFloat(driverScores[drv]?.projected || 0), 0);
    bar.textContent = `Selected: ${selected.size}/${MAX_TEAM_SIZE} · Projected total: ${total.toFixed(1)} pts`;
  }
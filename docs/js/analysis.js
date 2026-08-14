const TIRE_COLORS = {
    SOFT: '#ff3333', MEDIUM: '#ffd700', HARD: '#e8e8e8',
    INTERMEDIATE: '#43b02a', WET: '#0067ff'
  };
  const FERRARI_DRIVERS = ['LEC', 'HAM']; // update if lineup changes
  
  let laptimeChart, speedChart, tbChart;
  
  fetch('data/schedule_2026.json')
    .then(r => r.json())
    .then(schedule => {
      const picker = document.getElementById('round-picker');
      schedule.filter(e => e.RoundNumber > 0).forEach(e => {
        const opt = document.createElement('option');
        opt.value = e.RoundNumber;
        opt.textContent = `Round ${e.RoundNumber} - ${e.EventName}`;
        picker.appendChild(opt);
      });
      picker.addEventListener('change', () => loadRound(picker.value));
      if (picker.value) loadRound(picker.value);
    });
  
  function loadRound(round) {
    loadFastestLaps(round);
    loadLapTimes(round);
    loadTireStints(round);
    loadTelemetry(round);
  }
  
  function loadFastestLaps(round) {
    fetch(`data/analysis/fastest_laps_2026_r${round}.json`)
      .then(r => r.json())
      .then(data => {
        const tbody = document.querySelector('#fastest-table tbody');
        tbody.innerHTML = '';
        data.forEach((d, i) => {
          const isFerrari = FERRARI_DRIVERS.includes(d.driver);
          tbody.innerHTML += `<tr class="${isFerrari ? 'ferrari-row' : ''}">
            <td>${i + 1}</td><td>${d.driver}</td><td>${d.lapTime.toFixed(3)}s</td>
            <td>${d.lapNumber}</td><td>${d.compound}</td></tr>`;
        });
      })
      .catch(() => document.querySelector('#fastest-table tbody').innerHTML = '<tr><td colspan="5">No data yet</td></tr>');
  }
  
  function loadLapTimes(round) {
    fetch(`data/analysis/laps_2026_r${round}.json`)
      .then(r => r.json())
      .then(laps => {
        const drivers = [...new Set(laps.map(l => l.Driver))];
        const focusDrivers = drivers.filter(d => FERRARI_DRIVERS.includes(d));
        const others = drivers.filter(d => !FERRARI_DRIVERS.includes(d)).slice(0, 4);
        const shown = [...focusDrivers, ...others];
  
        const maxLap = Math.max(...laps.map(l => l.LapNumber));
        const datasets = shown.map(drv => {
          const drvLaps = laps.filter(l => l.Driver === drv);
          const isFerrari = FERRARI_DRIVERS.includes(drv);
          return {
            label: drv,
            data: drvLaps.map(l => ({ x: l.LapNumber, y: l.LapTime })),
            borderColor: isFerrari ? '#e10600' : '#666',
            borderWidth: isFerrari ? 3 : 1.5,
            pointRadius: 0,
            tension: 0.1
          };
        });
  
        if (laptimeChart) laptimeChart.destroy();
        laptimeChart = new Chart(document.getElementById('laptime-chart'), {
          type: 'line',
          data: { datasets },
          options: {
            scales: {
              x: { type: 'linear', title: { display: true, text: 'Lap' }, max: maxLap },
              y: { title: { display: true, text: 'Lap Time (s)' } }
            }
          }
        });
      });
  }
  
  function loadTireStints(round) {
    fetch(`data/analysis/stints_2026_r${round}.json`)
      .then(r => r.json())
      .then(stints => {
        const drivers = [...new Set(stints.map(s => s.Driver))];
        const container = document.getElementById('tire-chart');
        container.innerHTML = '';
        const maxLap = Math.max(...stints.map(s => s.EndLap));
  
        drivers.forEach(drv => {
          const drvStints = stints.filter(s => s.Driver === drv).sort((a, b) => a.Stint - b.Stint);
          const row = document.createElement('div');
          row.className = 'stint-row';
          const track = document.createElement('div');
          track.className = 'stint-bar-track';
          drvStints.forEach(s => {
            const seg = document.createElement('div');
            const laps = s.EndLap - s.StartLap + 1;
            seg.className = 'stint-segment';
            seg.style.width = `${(laps / maxLap) * 100}%`;
            seg.style.background = TIRE_COLORS[s.Compound] || '#888';
            seg.title = `${s.Compound}: laps ${s.StartLap}-${s.EndLap}`;
            track.appendChild(seg);
          });
          row.innerHTML = `<div class="driver-label">${drv}</div>`;
          row.appendChild(track);
          container.appendChild(row);
        });
      })
      .catch(() => container.innerHTML = 'No tire data yet');
  }
  
  function loadTelemetry(round) {
    Promise.all(
      FERRARI_DRIVERS.map(drv =>
        fetch(`data/analysis/telemetry_2026_r${round}_${drv}.json`).then(r => r.ok ? r.json() : null).catch(() => null)
      )
    ).then(results => {
      const datasets = [];
      const speedSets = [], throttleSets = [], brakeSets = [];
  
      results.forEach((tel, i) => {
        if (!tel) return;
        const drv = FERRARI_DRIVERS[i];
        const color = i === 0 ? '#e10600' : '#ff8c8c';
        speedSets.push({ label: `${drv} Speed`, data: tel.map(t => ({ x: t.Distance, y: t.Speed })), borderColor: color, pointRadius: 0 });
        throttleSets.push({ label: `${drv} Throttle`, data: tel.map(t => ({ x: t.Distance, y: t.Throttle })), borderColor: color, pointRadius: 0 });
        brakeSets.push({ label: `${drv} Brake`, data: tel.map(t => ({ x: t.Distance, y: t.Brake ? 100 : 0 })), borderColor: color, borderDash: [4, 2], pointRadius: 0 });
      });
  
      if (speedChart) speedChart.destroy();
      speedChart = new Chart(document.getElementById('speed-chart'), {
        type: 'line',
        data: { datasets: speedSets },
        options: { scales: { x: { type: 'linear', title: { display: true, text: 'Distance (m)' } }, y: { title: { display: true, text: 'Speed (km/h)' } } } }
      });
  
      if (tbChart) tbChart.destroy();
      tbChart = new Chart(document.getElementById('throttle-brake-chart'), {
        type: 'line',
        data: { datasets: [...throttleSets, ...brakeSets] },
        options: { scales: { x: { type: 'linear', title: { display: true, text: 'Distance (m)' } }, y: { title: { display: true, text: 'Throttle % / Brake' } } } }
      });
    });
  }
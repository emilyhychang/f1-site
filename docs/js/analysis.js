const TIRE_COLORS = {
  SOFT: '#ff3333',
  MEDIUM: '#ffd21f',
  HARD: '#e8e8e8',
  INTERMEDIATE: '#43b02a',
  WET: '#0067ff',
  UNKNOWN: '#777'
};

const TEAM_COLORS = {
  Mercedes: '#27f4d2',
  McLaren: '#ff8000',
  'Red Bull Racing': '#3671c6',
  Ferrari: '#e10600',
  'Aston Martin': '#229971',
  Alpine: '#0093cc',
  Williams: '#64c4ff',
  'Racing Bulls': '#6692ff',
  'Haas F1 Team': '#b6babd',
  Audi: '#52e252',
  Cadillac: '#c0c0c0'
};

const DRIVER_TEAMS = {
  RUS: 'Mercedes',
  ANT: 'Mercedes',
  LEC: 'Ferrari',
  HAM: 'Ferrari',
  NOR: 'McLaren',
  PIA: 'McLaren',
  VER: 'Red Bull Racing',
  HAD: 'Red Bull Racing',
  ALO: 'Aston Martin',
  STR: 'Aston Martin',
  GAS: 'Alpine',
  COL: 'Alpine',
  ALB: 'Williams',
  SAI: 'Williams',
  LAW: 'Racing Bulls',
  LIN: 'Racing Bulls',
  BEA: 'Haas F1 Team',
  OCO: 'Haas F1 Team',
  HUL: 'Audi',
  BOR: 'Audi',
  PER: 'Cadillac',
  BOT: 'Cadillac'
};

const FERRARI_DRIVERS = ['LEC', 'HAM'];

let laptimeChart;
let speedChart;
let tbChart;

fetch('data/schedule_2026.json')
  .then(response => response.json())
  .then(schedule => {
    const picker = document.getElementById('round-picker');

    schedule
      .filter(event => event.RoundNumber > 0)
      .forEach(event => {
        const option = document.createElement('option');
        option.value = event.RoundNumber;
        option.textContent = `Round ${event.RoundNumber} - ${event.EventName}`;
        picker.appendChild(option);
      });

    const requestedRound = new URLSearchParams(location.search).get('round');
    if (
      requestedRound &&
      [...picker.options].some(option => option.value === requestedRound)
    ) {
      picker.value = requestedRound;
    }

    picker.addEventListener('change', () => loadRound(picker.value));
    loadRound(picker.value || schedule.find(event => event.RoundNumber > 0)?.RoundNumber || 1);
  })
  .catch(() => {});

function teamColor(driver) {
  return TEAM_COLORS[DRIVER_TEAMS[driver]] || '#888';
}

function addLegend() {
  const panel = document.querySelector('#laptime-chart')?.closest('.panel');
  if (!panel || panel.querySelector('.analysis-legend')) return;

  const legend = document.createElement('div');
  legend.className = 'analysis-legend';

  Object.entries(TEAM_COLORS).forEach(([team, color]) => {
    const item = document.createElement('span');
    item.innerHTML = `<i style="background:${color}"></i>${team
      .replace('Red Bull Racing', 'Red Bull')
      .replace('Haas F1 Team', 'Haas')}`;
    legend.appendChild(item);
  });

  panel.querySelector('.panel-title').after(legend);
}

function loadRound(round) {
  loadFastestLaps(round);
  loadLapTimes(round);
  loadTireStints(round);
  loadTelemetry(round);
}

function loadFastestLaps(round) {
  fetch(`data/analysis/fastest_laps_2026_r${round}.json`)
    .then(response => response.json())
    .then(data => {
      const tbody = document.querySelector('#fastest-table tbody');
      tbody.innerHTML = '';

      data.forEach((driver, index) => {
        const color = teamColor(driver.driver);
        tbody.innerHTML += `
          <tr style="box-shadow:inset 3px 0 ${color}">
            <td>${index + 1}</td>
            <td style="color:${color};font-weight:800">${driver.driver}</td>
            <td>${Number(driver.lapTime).toFixed(3)}s</td>
            <td>${driver.lapNumber}</td>
            <td>${driver.compound}</td>
          </tr>`;
      });
    })
    .catch(() => {
      document.querySelector('#fastest-table tbody').innerHTML =
        '<tr><td colspan="5">No data yet</td></tr>';
    });
}

function loadLapTimes(round) {
  fetch(`data/analysis/laps_2026_r${round}.json`)
    .then(response => response.json())
    .then(laps => {
      const drivers = [...new Set(laps.map(lap => lap.Driver))];
      const others = drivers
        .filter(driver => !FERRARI_DRIVERS.includes(driver))
        .slice(0, 6);
      const shownDrivers = [
        ...FERRARI_DRIVERS.filter(driver => drivers.includes(driver)),
        ...others
      ];
      const maxLap = Math.max(...laps.map(lap => Number(lap.LapNumber) || 0));

      const datasets = shownDrivers.map(driver => {
        const driverLaps = laps.filter(
          lap => lap.Driver === driver && Number.isFinite(Number(lap.LapTime))
        );
        const color = teamColor(driver);

        return {
          label: driver,
          data: driverLaps.map(lap => ({
            x: Number(lap.LapNumber),
            y: Number(lap.LapTime)
          })),
          borderColor: color,
          backgroundColor: color,
          borderWidth: FERRARI_DRIVERS.includes(driver) ? 3 : 2,
          pointRadius: 0,
          tension: 0.12,
          spanGaps: true
        };
      });

      if (laptimeChart) laptimeChart.destroy();

      laptimeChart = new Chart(document.getElementById('laptime-chart'), {
        type: 'line',
        data: { datasets },
        options: {
          responsive: true,
          interaction: {
            mode: 'nearest',
            intersect: false
          },
          plugins: {
            legend: {
              position: 'bottom'
            }
          },
          scales: {
            x: {
              type: 'linear',
              title: {
                display: true,
                text: 'Lap'
              },
              max: maxLap
            },
            y: {
              title: {
                display: true,
                text: 'Lap Time (s)'
              }
            }
          }
        }
      });

      addLegend();
    })
    .catch(() => {});
}

function loadTireStints(round) {
  const container = document.getElementById('tire-chart');
  container.innerHTML = '<div class="muted">Loading stint strategy…</div>';

  fetch(`data/analysis/stints_2026_r${round}.json`)
    .then(response => response.json())
    .then(stints => {
      const validStints = stints.filter(
        stint =>
          Number(stint.StartLap) >= 1 &&
          Number(stint.EndLap) >= Number(stint.StartLap)
      );
      const maxLap = Math.max(
        ...validStints.map(stint => Number(stint.EndLap)),
        1
      );
      const drivers = [...new Set(validStints.map(stint => stint.Driver))].sort(
        (a, b) => {
          const aFerrari = FERRARI_DRIVERS.includes(a) ? 0 : 1;
          const bFerrari = FERRARI_DRIVERS.includes(b) ? 0 : 1;
          return aFerrari - bFerrari || a.localeCompare(b);
        }
      );

      container.innerHTML = '';

      const shell = document.createElement('div');
      shell.className = 'stint-shell';

      drivers.forEach(driver => {
        const row = document.createElement('div');
        row.className = 'stint-row';

        const label = document.createElement('div');
        label.className = 'driver-label';
        label.textContent = driver;

        const track = document.createElement('div');
        track.className = 'stint-bar-track';

        validStints
          .filter(stint => stint.Driver === driver)
          .sort((a, b) => Number(a.Stint) - Number(b.Stint))
          .forEach(stint => {
            const startLap = Number(stint.StartLap);
            const endLap = Number(stint.EndLap);
            const lapCount = endLap - startLap + 1;
            const compound = String(stint.Compound || 'UNKNOWN').toUpperCase();
            const segment = document.createElement('div');

            segment.className = 'stint-segment';
            segment.dataset.compound = compound;
            segment.style.width = `${(lapCount / maxLap) * 100}%`;
            segment.style.background =
              TIRE_COLORS[compound] || TIRE_COLORS.UNKNOWN;
            segment.title = `${compound}: laps ${startLap}–${endLap} (${lapCount} laps)`;

            if (lapCount >= 4) {
              segment.innerHTML = `<span>${compound[0]}</span>`;
            }

            track.appendChild(segment);
          });

        row.append(label, track);
        shell.appendChild(row);
      });

      container.appendChild(shell);

      const scale = document.createElement('div');
      scale.className = 'stint-scale';
      [0, 0.25, 0.5, 0.75, 1].forEach(fraction => {
        const item = document.createElement('span');
        item.textContent = Math.round(maxLap * fraction);
        scale.appendChild(item);
      });
      container.appendChild(scale);

      const legend = document.createElement('div');
      legend.className = 'tire-legend';
      Object.entries(TIRE_COLORS)
        .filter(([name]) => name !== 'UNKNOWN')
        .forEach(([name, color]) => {
          const item = document.createElement('span');
          item.innerHTML = `<i style="background:${color}"></i>${name}`;
          legend.appendChild(item);
        });
      container.appendChild(legend);
    })
    .catch(() => {
      container.innerHTML =
        '<div class="muted">No tire strategy data available for this round.</div>';
    });
}

function loadTelemetry(round) {
  Promise.all(
    FERRARI_DRIVERS.map(driver =>
      fetch(`data/analysis/telemetry_2026_r${round}_${driver}.json`)
        .then(response => (response.ok ? response.json() : null))
        .catch(() => null)
    )
  ).then(results => {
    const speedSets = [];
    const throttleSets = [];
    const brakeSets = [];

    results.forEach((telemetry, index) => {
      if (!telemetry) return;

      const driver = FERRARI_DRIVERS[index];
      const color = index === 0 ? '#e10600' : '#ff7b75';

      speedSets.push({
        label: `${driver} Speed`,
        data: telemetry.map(point => ({
          x: Number(point.Distance),
          y: Number(point.Speed)
        })),
        borderColor: color,
        pointRadius: 0
      });

      throttleSets.push({
        label: `${driver} Throttle`,
        data: telemetry.map(point => ({
          x: Number(point.Distance),
          y: Number(point.Throttle)
        })),
        borderColor: color,
        pointRadius: 0
      });

      brakeSets.push({
        label: `${driver} Brake`,
        data: telemetry.map(point => ({
          x: Number(point.Distance),
          y: point.Brake ? 100 : 0
        })),
        borderColor: color,
        borderDash: [4, 2],
        pointRadius: 0
      });
    });

    if (speedChart) speedChart.destroy();

    speedChart = new Chart(document.getElementById('speed-chart'), {
      type: 'line',
      data: { datasets: speedSets },
      options: {
        responsive: true,
        interaction: {
          mode: 'nearest',
          intersect: false
        },
        scales: {
          x: {
            type: 'linear',
            title: {
              display: true,
              text: 'Distance (m)'
            }
          },
          y: {
            title: {
              display: true,
              text: 'Speed (km/h)'
            }
          }
        }
      }
    });

    if (tbChart) tbChart.destroy();

    tbChart = new Chart(document.getElementById('throttle-brake-chart'), {
      type: 'line',
      data: {
        datasets: [...throttleSets, ...brakeSets]
      },
      options: {
        responsive: true,
        interaction: {
          mode: 'nearest',
          intersect: false
        },
        scales: {
          x: {
            type: 'linear',
            title: {
              display: true,
              text: 'Distance (m)'
            }
          },
          y: {
            title: {
              display: true,
              text: 'Throttle % / Brake'
            }
          }
        }
      }
    });
  });
}

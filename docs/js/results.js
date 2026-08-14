let pointsChart;
let cumulativeChart;
let positionChart;

const TEAM_COLORS = {
  Ferrari: '#e10600',
  Mercedes: '#27f4d2',
  McLaren: '#ff8000',
  'Red Bull Racing': '#3671c6',
  'Aston Martin': '#229971',
  Alpine: '#0093cc',
  Williams: '#64c4ff',
  'Racing Bulls': '#6692ff',
  'Haas F1 Team': '#b6babd',
  Audi: '#52e252',
  Cadillac: '#c0c0c0'
};

const TRACKED_DRIVERS = {
  LEC: { name: 'LEC', color: '#e10600' },
  HAM: { name: 'HAM', color: '#ff7770' },
  ANT: { name: 'ANT', color: '#27f4d2' },
  RUS: { name: 'RUS', color: '#75dcca' },
  NOR: { name: 'NOR', color: '#ff8000' },
  VER: { name: 'VER', color: '#3671c6' }
};

fetch('data/schedule_2026.json')
  .then(response => response.json())
  .then(schedule => {
    const picker = document.getElementById('round-picker');
    const races = schedule.filter(event => event.RoundNumber > 0);

    races.forEach(event => {
      const option = document.createElement('option');
      option.value = event.RoundNumber;
      option.textContent = `Round ${event.RoundNumber} - ${event.EventName}`;
      picker.appendChild(option);
    });

    const requested = new URLSearchParams(location.search).get('round');
    if (requested && races.some(race => String(race.RoundNumber) === requested)) {
      picker.value = requested;
    }

    picker.addEventListener('change', () => {
      history.replaceState({}, '', `results.html?round=${picker.value}`);
      loadRound(picker.value);
    });

    loadRound(picker.value || races[0]?.RoundNumber || 1);
  })
  .catch(() => {});

function prettyStatus(status) {
  const raw = String(status || '').trim();

  if (/did not start|dns/i.test(raw)) {
    return 'Did Not Start (DNS)';
  }

  if (/retired|did not finish|dnf/i.test(raw)) {
    return 'Did Not Finish (DNF)';
  }

  return raw || 'Classified';
}

function statusClass(status) {
  return /DNF|DNS/.test(status) ? 'result-status-dnf' : '';
}

function teamColor(team) {
  return TEAM_COLORS[team] || '#777';
}

function loadRound(round) {
  fetch(`data/results_2026_r${round}.json`)
    .then(response => response.json())
    .then(results => {
      renderClassification(results);
      renderPoints(results, round);
      loadHistory(round);
    })
    .catch(() => {
      document.querySelector('#results-table tbody').innerHTML =
        '<tr><td colspan="5">Results are not available for this round yet.</td></tr>';
    });
}

function renderClassification(results) {
  const tbody = document.querySelector('#results-table tbody');
  tbody.innerHTML = '';

  results.forEach(result => {
    const status = prettyStatus(result.Status);
    const color = teamColor(result.TeamName);

    tbody.innerHTML += `
      <tr style="box-shadow: inset 3px 0 ${color}">
        <td>${result.Position}</td>
        <td>${result.FullName}</td>
        <td style="color:${color}">${result.TeamName}</td>
        <td>${result.Points}</td>
        <td class="${statusClass(status)}">${status}</td>
      </tr>`;
  });
}

function renderPoints(results, round) {
  document.getElementById('chart-round-label').textContent = `ROUND ${String(round).padStart(2, '0')}`;

  if (pointsChart) {
    pointsChart.destroy();
  }

  pointsChart = new Chart(document.getElementById('points-chart'), {
    type: 'bar',
    data: {
      labels: results.map(result => result.Abbreviation),
      datasets: [
        {
          label: 'Points',
          data: results.map(result => result.Points),
          backgroundColor: results.map(result => teamColor(result.TeamName)),
          borderRadius: 5
        }
      ]
    },
    options: {
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false }
      },
      scales: {
        x: {
          ticks: {
            color: '#777',
            maxRotation: 55,
            minRotation: 55,
            font: { size: 9 }
          },
          grid: { color: '#202027' }
        },
        y: {
          beginAtZero: true,
          ticks: { color: '#777' },
          grid: { color: '#202027' }
        }
      }
    }
  });
}

async function loadHistory(round) {
  const rounds = Array.from(
    { length: Number(round) },
    (_, index) => index + 1
  );

  const datasets = await Promise.all(
    rounds.map(async currentRound => {
      try {
        const response = await fetch(
          `data/results_2026_r${currentRound}.json`
        );
        if (!response.ok) return null;
        return {
          round: currentRound,
          results: await response.json()
        };
      } catch {
        return null;
      }
    })
  );

  const history = datasets.filter(Boolean);
  const labels = history.map(item => `R${item.round}`);
  const cumulative = {};
  const positions = {};

  Object.keys(TRACKED_DRIVERS).forEach(code => {
    cumulative[code] = [];
    positions[code] = [];
  });

  Object.keys(TRACKED_DRIVERS).forEach(code => {
    let total = 0;

    history.forEach(item => {
      const result = item.results.find(
        driver => driver.Abbreviation === code
      );

      total += Number(result?.Points || 0);
      cumulative[code].push(total);
      positions[code].push(Number(result?.Position || null));
    });
  });

  if (cumulativeChart) cumulativeChart.destroy();
  if (positionChart) positionChart.destroy();

  cumulativeChart = new Chart(document.getElementById('cumulative-chart'), {
    type: 'line',
    data: {
      labels,
      datasets: Object.entries(TRACKED_DRIVERS).map(([code, meta]) => ({
        label: meta.name,
        data: cumulative[code],
        borderColor: meta.color,
        backgroundColor: meta.color,
        borderWidth: code === 'LEC' ? 3 : 2,
        pointRadius: 0,
        tension: 0.25
      }))
    },
    options: chartOptions('Points')
  });

  positionChart = new Chart(document.getElementById('position-chart'), {
    type: 'line',
    data: {
      labels,
      datasets: Object.entries(TRACKED_DRIVERS).map(([code, meta]) => ({
        label: meta.name,
        data: positions[code],
        borderColor: meta.color,
        backgroundColor: meta.color,
        borderWidth: code === 'LEC' ? 3 : 2,
        pointRadius: 0,
        tension: 0.25,
        spanGaps: true
      }))
    },
    options: {
      ...chartOptions('Finishing position'),
      scales: {
        x: chartOptions('').scales.x,
        y: {
          reverse: true,
          min: 1,
          max: 22,
          ticks: { color: '#777', stepSize: 5 },
          grid: { color: '#202027' },
          title: {
            display: true,
            text: 'Position'
          }
        }
      }
    }
  });
}

function chartOptions(yTitle) {
  return {
    maintainAspectRatio: false,
    interaction: {
      mode: 'index',
      intersect: false
    },
    plugins: {
      legend: {
        position: 'bottom',
        labels: {
          color: '#888',
          boxWidth: 8,
          font: { size: 9 }
        }
      }
    },
    scales: {
      x: {
        ticks: { color: '#777', font: { size: 9 } },
        grid: { color: '#202027' }
      },
      y: {
        ticks: { color: '#777', font: { size: 9 } },
        grid: { color: '#202027' },
        title: {
          display: true,
          text: yTitle
        }
      }
    }
  };
}

let chart;

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
  fetch(`data/results_2026_r${round}.json`)
    .then(r => r.json())
    .then(results => {
      const tbody = document.querySelector('#results-table tbody');
      tbody.innerHTML = '';
      results.forEach(r => {
        tbody.innerHTML += `<tr><td>${r.Position}</td><td>${r.FullName}</td><td>${r.TeamName}</td><td>${r.Points}</td><td>${r.Status}</td></tr>`;
      });

      const ctx = document.getElementById('points-chart');
      if (chart) chart.destroy();
      chart = new Chart(ctx, {
        type: 'bar',
        data: {
          labels: results.map(r => r.Abbreviation),
          datasets: [{ label: 'Points', data: results.map(r => r.Points), backgroundColor: '#e10600' }]
        }
      });
    })
    .catch(() => console.warn('No data for this round yet'));
}
// --- Next race badge ---
fetch('data/next_race.json')
  .then(r => r.json())
  .then(race => {
    document.getElementById('next-race-name').textContent =
      `${race.eventName} — ${race.location}, ${race.country}`;
    const daysAway = Math.max(0, Math.ceil((new Date(race.date) - new Date()) / 86400000));
    document.getElementById('next-race-countdown').textContent = `${daysAway} days away`;
  })
  .catch(() => {
    document.getElementById('next-race-name').textContent = 'Season complete';
  });

// --- Animated track ---
fetch('data/track_shape.json')
  .then(r => r.json())
  .then(points => {
    if (!points.length) return;

    const xs = points.map(p => p.X), ys = points.map(p => p.Y);
    const minX = Math.min(...xs), maxX = Math.max(...xs);
    const minY = Math.min(...ys), maxY = Math.max(...ys);
    const pad = 30, w = 600 - 2 * pad, h = 400 - 2 * pad;
    const scale = Math.min(w / (maxX - minX), h / (maxY - minY));

    const drawnW = (maxX - minX) * scale;
    const drawnH = (maxY - minY) * scale;
    const offsetX = pad + (w - drawnW) / 2;
    const offsetY = pad + (h - drawnH) / 2;

    const toSvg = (x, y) => [
      offsetX + (x - minX) * scale,
      offsetY + (drawnH - (y - minY) * scale) // flip Y so the shape isn't mirrored
    ];

    let d = '';
    points.forEach((p, i) => {
      const [sx, sy] = toSvg(p.X, p.Y);
      d += (i === 0 ? 'M' : 'L') + sx.toFixed(1) + ',' + sy.toFixed(1) + ' ';
    });
    d += 'Z';

    document.getElementById('track-path').setAttribute('d', d);
    document.getElementById('car-marker').innerHTML =
      '<animateMotion dur="8s" repeatCount="indefinite" rotate="auto"><mpath href="#track-path"/></animateMotion>';
  })
  .catch(() => console.warn('No track shape data available yet'));

// --- Standings table, with Ferrari highlighted ---
fetch('data/standings_2026.json')
  .then(r => r.json())
  .then(data => {
    const tbody = document.querySelector('#standings-table tbody');
    data.forEach((d, i) => {
      const isFerrari = d.team && d.team.toLowerCase().includes('ferrari');
      tbody.innerHTML += `<tr class="${isFerrari ? 'ferrari-row' : ''}">
        <td>${i + 1}</td><td>${d.driver}</td><td>${d.team}</td><td>${d.points}</td>
      </tr>`;
    });
  });
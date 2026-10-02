let circuitCatalog = {};
let lastRender = '';
let latestState = null;
const escapeHTML = value => String(value).replace(/[&<>"']/g, char => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[char]));

function renderCalendar(state) {
  const root = document.getElementById('calendar');
  if (!state) {
    root.innerHTML = '<div class="panel">Race updates are temporarily unavailable. Please try again shortly.</div>';
    return;
  }
  latestState = state;
  // Do not restart the car animation every time an unchanged poll finishes.
  const signature = JSON.stringify([state.schedule, state.completedRounds, Object.keys(circuitCatalog)]);
  if (signature !== lastRender) {
    lastRender = signature;
    const race = state.nextRace;
    let hero = '<section class="panel"><div class="eyebrow">Season complete</div><h2>See you next season.</h2></section>';
    if (race) {
      const circuit = race.Circuit;
      const track = circuitCatalog[circuit.circuitId];
      const date = new Date(race.date + 'T' + (race.time || '00:00:00Z'));
      const map = track ? `
        <svg viewBox="${track.viewBox}" role="img" aria-label="Animated ${escapeHTML(circuit.circuitName)}" preserveAspectRatio="xMidYMid meet">
          <path class="track-inner" fill="none" d="${track.path}" />
          <path class="track-outline" fill="none" d="${track.path}" />
          <circle class="track-racer" r="5">
            <animateMotion dur="12s" repeatCount="indefinite" calcMode="paced" path="${track.path}" />
          </circle>
        </svg>` : '<p class="circuit-unavailable">Circuit outline unavailable for this venue.</p>';
      hero = `<div class="calendar-hero">
        <section class="panel next-race-card">
          <div class="eyebrow">Round ${String(race.round).padStart(2, '0')} / Up Next</div>
          <div class="next-round">R${String(race.round).padStart(2, '0')}</div>
          <h2>${escapeHTML(race.raceName.replace('Grand Prix', 'GP'))}</h2>
          <div class="next-meta">${escapeHTML(circuit.Location.locality)}, ${escapeHTML(circuit.Location.country)}<br />
            ${escapeHTML(date.toLocaleString(undefined, {weekday: 'long', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZoneName: 'short'}))}
          </div>
        </section>
        <section class="panel track-preview">
          <div class="eyebrow">Animated circuit</div>${map}
          <div class="circuit-caption">${escapeHTML(circuit.circuitName)} · NEXT RACE</div>
          <a class="circuit-guide" href="${track?.guide || 'https://formula-timer.com/circuit'}" target="_blank" rel="noopener noreferrer">Circuit guide on Formula Timer ↗</a>
        </section>
      </div>`;
    }
    const timeline = [...state.schedule].sort((a, b) => Number(a.round) - Number(b.round)).map(event => `
      <div class="panel timeline-item${event.round === race?.round ? ' next-round' : ''}">
        <a class="race-link" href="results.html?round=${Number(event.round)}">
          <div class="round">R${String(event.round).padStart(2, '0')}</div>
          <div class="event">${escapeHTML(event.raceName)}<div class="date">${escapeHTML(event.Circuit.Location.locality)}, ${escapeHTML(event.Circuit.Location.country)}</div></div>
          <div class="date">${new Date(event.date + 'T12:00:00Z').toLocaleDateString(undefined, {month: 'short', day: 'numeric', timeZone: 'UTC'})}</div>
        </a>
      </div>`).join('');
    root.innerHTML = hero + '<p id="circuit-update-status" class="circuit-update-status" role="status"></p><div class="timeline">' + timeline + '</div>';
  }
  const status = document.getElementById('circuit-update-status');
  status.textContent = state.live ? 'Checks every minute · advances when race results are published' :
    `Showing last confirmed update · ${new Date(state.updatedAt).toLocaleString()}`;
}

fetch('data/circuits.json')
  .then(response => { if (!response.ok) throw new Error('Circuit maps unavailable'); return response.json(); })
  .then(catalog => { circuitCatalog = catalog; if (latestState) renderCalendar(latestState); })
  .catch(error => console.warn(error.message));
F1RaceData.subscribe(renderCalendar);

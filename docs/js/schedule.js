const TRACKS = {
  Zandvoort: {
    label: 'CIRCUIT ZANDVOORT',
    path: 'M102 150 C86 128 82 101 96 82 C111 62 139 59 166 65 C195 72 210 94 237 91 C263 88 269 60 293 48 C317 35 351 38 370 53 C390 69 393 94 378 111 C362 130 332 130 312 119 C291 107 280 87 261 83 C241 79 226 93 226 112 C226 133 248 147 271 153 C302 161 329 151 354 137 C379 123 407 117 432 127 C456 137 465 157 450 173 C433 192 396 190 367 181 C338 172 320 158 293 161 C267 164 253 188 228 196 C199 206 166 196 151 176 C139 160 124 156 102 150 Z'
  },
  Monaco: {
    label: 'CIRCUIT DE MONACO',
    path: 'M110 150 C72 122 82 71 119 56 C154 42 175 61 204 72 C231 82 248 66 270 46 C300 20 349 28 361 60 C373 91 351 104 328 113 C303 123 296 145 319 162 C347 182 326 205 291 201 C259 197 248 174 225 163 C202 152 180 168 156 177 C136 184 119 171 110 150 Z'
  },
  Silverstone: {
    label: 'SILVERSTONE CIRCUIT',
    path: 'M104 54 C174 25 270 24 340 55 C408 85 474 65 520 103 C556 133 542 174 496 180 C443 188 412 151 364 151 C309 151 279 187 224 180 C168 172 129 142 104 113 C91 98 91 69 104 54 Z'
  }
};

const FALLBACK = {
  label: 'RACE CIRCUIT',
  path: 'M120 145 C75 85 145 25 220 55 C285 81 305 145 370 159 C442 174 486 110 455 64 C426 20 350 28 312 66 C270 109 291 165 355 176 C427 189 502 157 525 108'
};

fetch('data/next_race.json')
  .then(response => response.json())
  .then(nextRace =>
    fetch('data/schedule_2026.json')
      .then(response => response.json())
      .then(schedule => renderCalendar(schedule, nextRace))
  )
  .catch(() => {
    document.getElementById('calendar').innerHTML =
      '<div class="panel">Calendar data unavailable.</div>';
  });

function trackKey(location) {
  if (location === 'Zandvoort') return 'Zandvoort';
  if (location === 'Monte Carlo') return 'Monaco';
  if (location === 'Silverstone') return 'Silverstone';
  return null;
}

function renderCalendar(data, nextRace) {
  const element = document.getElementById('calendar');
  element.innerHTML = '';

  const nextRound = Number(nextRace?.round);
  const race =
    data.find(event => Number(event.RoundNumber) === nextRound) ||
    data.find(event => new Date(event.EventDate) >= new Date());

  if (race) {
    const track = TRACKS[trackKey(race.Location)] || FALLBACK;
    const circuitLength = race.Location === 'Zandvoort' ? '4.259 km' : '—';
    const lapCount = race.Location === 'Zandvoort' ? '72 laps' : '—';

    const hero = document.createElement('div');
    hero.className = 'calendar-hero';
    hero.innerHTML = `
      <section class="panel next-race-card">
        <div class="eyebrow">
          Round ${String(race.RoundNumber).padStart(2, '0')} / Up Next
        </div>
        <div class="next-round">R${String(race.RoundNumber).padStart(2, '0')}</div>
        <h2>${race.EventName.replace(' Grand Prix', ' GP')}</h2>
        <div class="next-meta">
          ${race.Location}, ${race.Country}<br />
          ${new Date(race.EventDate).toLocaleDateString(undefined, {
            weekday: 'long',
            month: 'long',
            day: 'numeric'
          })}<br />
          ${circuitLength} · ${lapCount}
        </div>
      </section>

      <section class="panel track-preview">
        <div class="eyebrow">Animated circuit</div>
        <svg
          viewBox="0 0 540 220"
          aria-label="Animated ${track.label}"
          preserveAspectRatio="xMidYMid meet"
        >
          <path class="track-inner" d="${track.path}" />
          <path class="track-outline" d="${track.path}" />
          <path
            class="track-glow"
            d="${track.path}"
            pathLength="1"
          />
          <circle class="track-racer" r="7">
            <animateMotion
              dur="5.8s"
              repeatCount="indefinite"
              rotate="auto"
              path="${track.path}"
            />
          </circle>
          <text
            class="track-label"
            x="270"
            y="215"
            text-anchor="middle"
          >
            ${track.label} · NEXT RACE
          </text>
        </svg>
      </section>`;

    element.appendChild(hero);
  }

  const timeline = document.createElement('div');
  timeline.className = 'timeline';

  data
    .filter(event => event.RoundNumber > 0)
    .forEach(event => {
      const isNext = Number(event.RoundNumber) === nextRound;
      const row = document.createElement('div');
      row.className = `panel timeline-item${isNext ? ' next-round' : ''}`;

      const date = new Date(event.EventDate).toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric'
      });

      row.innerHTML = `
        <a class="race-link" href="results.html?round=${event.RoundNumber}">
          <div class="round">R${String(event.RoundNumber).padStart(2, '0')}</div>
          <div class="event">
            ${event.EventName}
            <div class="date">${event.Location}, ${event.Country}</div>
          </div>
          <div class="date">${date}</div>
        </a>`;

      timeline.appendChild(row);
    });

  element.appendChild(timeline);
}

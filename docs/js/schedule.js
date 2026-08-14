const TRACKS = {
  Zandvoort: {
    label: 'CIRCUIT ZANDVOORT',
    path: 'M97.2 258.9C97.2 258.9 225.9 41 231.1 31.7S244.9 20.9 254.6 27.2C264.3 33.5 260.6 46.6 258.7 49.6C252.6 58.8 238.4 83 234.8 89.9C231.1 96.8 226.3 109.5 225 120.9C223.7 132.3 223.5 132.8 223.2 135.2C222.9 137.7 220 144.6 210.2 146.8S188 151.9 182.2 153.5S173 160.8 174.4 169.2S186.1 181.1 196.2 178.7C206.3 176.4 228.8 170.9 254.4 172.8S304.3 192.7 325.2 192.4C343.8 192.1 361.1 182 367.5 178.6C373.9 175.2 388.1 169.8 407 173.2C425.9 176.6 447.7 181.2 456.6 183.2S480.6 195.6 484.4 212.8C489.1 233.8 473.4 249.7 469 254.1S450.3 272.5 443.4 283.1C436.5 293.6 426.7 308.6 424.4 311.3C422.1 314.1 418.7 317.7 412 317.2C405.3 316.6 382.6 312.1 370.4 303.6C358.3 295.1 349 283.1 347.3 280C345.5 276.9 346 270.6 350.8 267.1C355.6 263.6 361.5 258.9 379.2 258.9C396.9 258.9 401.7 258.3 412.6 255.4C423.4 252.5 429.7 247.5 430.7 239.6C432 229.9 429.8 220.7 416.2 217.5C402.6 214.3 377.1 208.6 362.3 207.3C347.5 206 319.7 206.3 301.3 208.8C282.9 211.3 254.6 216.8 243.8 220.2C233 223.6 223.8 227.4 222 228.2C220.2 229.1 216.1 229.7 214.5 225S209.5 208.6 197.2 210.2C184.9 211.8 185.3 221.3 185.3 226.7C185.3 232.1 188.2 308.2 188.2 314.8C188.2 323.7 185.9 341.3 166.8 341.3S130.2 336.6 122.5 334.1C115 331.7 90 314.9 90 289.4C90 280 91.7 268.2 97.2 258.9Z',
    viewBox: '0 0 550 370'
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
          viewBox="${track.viewBox || '0 0 540 220'}"
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
            y="${track.viewBox ? '365' : '215'}"
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

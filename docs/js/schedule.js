const TRACKS = {
  Zandvoort: {
    label: "CIRCUIT ZANDVOORT",
    path: "M130 150 C90 118 84 67 123 39 C162 11 225 18 267 43 C302 64 333 67 362 49 C398 27 432 26 468 43 C505 61 529 97 516 128 C503 160 462 177 425 169 C388 161 369 133 340 119 C310 105 281 111 263 136 C241 166 207 188 171 181 C151 177 138 164 130 150 Z",
  },
  Monaco: {
    label: "CIRCUIT DE MONACO",
    path: "M110 150 C72 122 82 71 119 56 C154 42 175 61 204 72 C231 82 248 66 270 46 C300 20 349 28 361 60 C373 91 351 104 328 113 C303 123 296 145 319 162 C347 182 326 205 291 201 C259 197 248 174 225 163 C202 152 180 168 156 177 C136 184 119 171 110 150 Z",
  },
  Silverstone: {
    label: "SILVERSTONE CIRCUIT",
    path: "M104 54 C174 25 270 24 340 55 C408 85 474 65 520 103 C556 133 542 174 496 180 C443 188 412 151 364 151 C309 151 279 187 224 180 C168 172 129 142 104 113 C91 98 91 69 104 54 Z",
  },
};
const FALLBACK = {
  label: "RACE CIRCUIT",
  path: "M120 145 C75 85 145 25 220 55 C285 81 305 145 370 159 C442 174 486 110 455 64 C426 20 350 28 312 66 C270 109 291 165 355 176 C427 189 502 157 525 108",
};
fetch("data/next_race.json")
  .then((r) => r.json())
  .then((nextRace) =>
    fetch("data/schedule_2026.json")
      .then((r) => r.json())
      .then((schedule) => renderCalendar(schedule, nextRace)),
  )
  .catch(() => {
    document.getElementById("calendar").innerHTML =
      '<div class="panel">Calendar data unavailable.</div>';
  });
function trackKey(location) {
  return location === "Zandvoort"
    ? "Zandvoort"
    : location === "Monte Carlo"
      ? "Monaco"
      : location === "Silverstone"
        ? "Silverstone"
        : null;
}
function renderCalendar(data, nextRace) {
  const el = document.getElementById("calendar");
  el.innerHTML = "";
  const nextRound = Number(nextRace?.round);
  const race =
    data.find((r) => Number(r.RoundNumber) === nextRound) ||
    data.find((r) => new Date(r.EventDate) >= new Date());
  if (race) {
    const track = TRACKS[trackKey(race.Location)] || FALLBACK;
    const hero = document.createElement("div");
    hero.className = "calendar-hero";
    hero.innerHTML = `<section class="panel next-race-card"><div class="eyebrow">Round ${String(race.RoundNumber).padStart(2, "0")} / Up Next</div><div class="next-round">R${String(race.RoundNumber).padStart(2, "0")}</div><h2>${race.EventName.replace(" Grand Prix", " GP")}</h2><div class="next-meta">${race.Location}, ${race.Country}<br>${new Date(race.EventDate).toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}<br>4.259 km · 72 laps · Zandvoort</div></section><section class="panel track-preview"><div class="eyebrow">Animated circuit</div><svg viewBox="0 0 620 220" aria-label="Animated ${track.label}"><path class="track-inner" d="${track.path}"/><path class="track-outline" d="${track.path}"/><circle class="track-racer" r="7"><animateMotion dur="5.8s" repeatCount="indefinite" rotate="auto" path="${track.path}"/></circle><text class="track-label" x="310" y="205" text-anchor="middle">${track.label} · NEXT RACE</text></svg></section>`;
    el.appendChild(hero);
  }
  const timeline = document.createElement("div");
  timeline.className = "timeline";
  data
    .filter((x) => x.RoundNumber > 0)
    .forEach((r) => {
      const isNext = Number(r.RoundNumber) === nextRound;
      const row = document.createElement("div");
      row.className = `panel timeline-item${isNext ? " next-round" : ""}`;
      const date = new Date(r.EventDate).toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
      });
      row.innerHTML = `<a class="race-link" href="results.html?round=${r.RoundNumber}"><div class="round">R${String(r.RoundNumber).padStart(2, "0")}</div><div class="event">${r.EventName}<div class="date">${r.Location}, ${r.Country}</div></div><div class="date">${date}</div></a>`;
      timeline.appendChild(row);
    });
  el.appendChild(timeline);
}

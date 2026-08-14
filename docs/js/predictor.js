const DRIVER_PRICES = {
  RUS: 27.9,
  VER: 27.6,
  NOR: 26.1,
  ANT: 25.7,
  PIA: 24.4,
  HAM: 25.0,
  LEC: 23.9,
  HAD: 14.5,
  GAS: 13.0,
  SAI: 10.0,
  ALB: 5.8,
  ALO: 6.2,
  STR: 3.0,
  BEA: 7.6,
  OCO: 10.7,
  HUL: 3.0,
  LAW: 10.3,
  BOR: 7.8,
  LIN: 8.0,
  COL: 11.2,
  PER: 3.8,
  BOT: 3.0,
};
const DRIVER_NAMES = {
  RUS: "George Russell",
  VER: "Max Verstappen",
  NOR: "Lando Norris",
  ANT: "Kimi Antonelli",
  PIA: "Oscar Piastri",
  HAM: "Lewis Hamilton",
  LEC: "Charles Leclerc",
  HAD: "Isack Hadjar",
  GAS: "Pierre Gasly",
  SAI: "Carlos Sainz",
  ALB: "Alex Albon",
  ALO: "Fernando Alonso",
  STR: "Lance Stroll",
  BEA: "Oliver Bearman",
  OCO: "Esteban Ocon",
  HUL: "Nico Hulkenberg",
  LAW: "Liam Lawson",
  BOR: "Gabriel Bortoleto",
  LIN: "Arvid Lindblad",
  COL: "Franco Colapinto",
  PER: "Sergio Perez",
  BOT: "Valtteri Bottas",
};
const TEAM_PRICES = {
  Mercedes: 32.6,
  McLaren: 31.0,
  "Red Bull Racing": 30.9,
  Ferrari: 26.6,
  "Racing Bulls": 12.9,
  Audi: 6.8,
  Alpine: 18.8,
  "Haas F1 Team": 12.0,
  Williams: 13.0,
  "Aston Martin": 5.7,
  Cadillac: 3.0,
};
const TEAM_CODES = {
  Mercedes: "MER",
  McLaren: "MCL",
  "Red Bull Racing": "RED",
  Ferrari: "FER",
  "Racing Bulls": "VRB",
  Audi: "AUD",
  Alpine: "ALP",
  "Haas F1 Team": "HAA",
  Williams: "WIL",
  "Aston Martin": "AST",
  Cadillac: "CAD",
};
const TEAM_COLORS = {
  Mercedes: "#27f4d2",
  McLaren: "#ff8000",
  "Red Bull Racing": "#3671c6",
  Ferrari: "#e10600",
  "Racing Bulls": "#6692ff",
  Audi: "#52e252",
  Alpine: "#0093cc",
  "Haas F1 Team": "#b6babd",
  Williams: "#64c4ff",
  "Aston Martin": "#229971",
  Cadillac: "#c0c0c0",
};
const SPRINT_ROUNDS = new Set([2, 4, 5, 9, 12, 17]);
const selectedDrivers = new Set(),
  selectedConstructors = new Set();
let boostDriver = null,
  driverModels = {},
  constructorModels = {},
  nextRace = null;
const FINISH_POINTS = [0, 25, 18, 15, 12, 10, 8, 6, 4, 2, 1],
  SPRINT_POINTS = [0, 8, 7, 6, 5, 4, 3, 2, 1];
const QUALI_POINTS = (p) => (p >= 1 && p <= 10 ? 11 - p : 0);
const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
function roundPosition(v) {
  return clamp(Math.round(Number(v) || 20), 1, 20);
}
function projectDriver(code, d) {
  const q = roundPosition(d.avgRecentPosition),
    teamAdj = (Number(d.avgRecentPoints) || 0) / 8,
    finish = clamp(Math.round(q - teamAdj * 0.35), 1, 20),
    gained = Math.max(0, q - finish),
    lost = Math.min(0, q - finish),
    overtakes = Math.round(Math.max(0, 10 - finish) * 0.12),
    fastest = finish <= 3 ? 0.18 : finish <= 6 ? 0.08 : 0.02,
    dotd = finish <= 3 ? 0.12 : finish <= 8 ? 0.04 : 0.01,
    raceBase = FINISH_POINTS[finish] || 0,
    race =
      Math.round(
        (raceBase + gained + lost + overtakes + fastest * 10 + dotd * 10) * 10,
      ) / 10,
    quali = QUALI_POINTS(q);
  let sprint = 0;
  if (SPRINT_ROUNDS.has(Number(nextRace?.round))) {
    const sGained = Math.max(0, q - finish),
      sLost = Math.min(0, q - finish);
    sprint =
      Math.round(
        ((SPRINT_POINTS[finish] || 0) +
          sGained +
          Math.max(-10, sLost) +
          overtakes +
          fastest * 5) *
          10,
      ) / 10;
  }
  return {
    code,
    name: DRIVER_NAMES[code] || code,
    team: d.team,
    price: DRIVER_PRICES[code],
    qualifying: quali,
    sprint,
    race,
    total: Math.round((quali + sprint + race) * 10) / 10,
    grid: q,
    finish,
    gained,
    overtakes,
    fastest: Math.round(fastest * 100),
    dotd: Math.round(dotd * 100),
  };
}
function constructorScore(team, drivers) {
  const ds = Object.values(drivers).filter((d) => d.team === team);
  if (ds.length < 2) return null;
  const quali = ds.reduce((a, d) => a + d.qualifying, 0),
    bothQ2 = ds.filter((d) => d.grid <= 15).length,
    bothQ3 = ds.filter((d) => d.grid <= 10).length,
    qBonus =
      bothQ3 === 2
        ? 10
        : bothQ3 === 1
          ? 5
          : bothQ2 === 2
            ? 3
            : bothQ2 === 1
              ? 1
              : -1,
    sprint = ds.reduce((a, d) => a + d.sprint, 0),
    race = ds.reduce((a, d) => a + d.race - (d.dotd / 100) * 10, 0),
    pitstop = 5,
    fastestPitstop = 0;
  return {
    team,
    code: TEAM_CODES[team],
    price: TEAM_PRICES[team],
    qualifying: Math.round((quali + qBonus) * 10) / 10,
    sprint: Math.round(sprint * 10) / 10,
    race: Math.round((race + pitstop + fastestPitstop) * 10) / 10,
    total:
      Math.round(
        (quali + qBonus + sprint + race + pitstop + fastestPitstop) * 10,
      ) / 10,
    qBonus,
    pitstop,
    fastestPitstop,
  };
}
Promise.all([
  fetch("data/next_race.json").then((r) => r.json()),
  fetch("data/model/driver_summary_2026.json").then((r) => r.json()),
])
  .then(([race, drivers]) => {
    nextRace = race;
    driverModels = {};
    Object.entries(drivers).forEach(
      ([code, d]) => (driverModels[code] = projectDriver(code, d)),
    );
    Object.keys(TEAM_PRICES).forEach((team) => {
      constructorModels[team] = constructorScore(team, driverModels);
    });
    document.getElementById("race-context").textContent =
      `${race.eventName} · ${SPRINT_ROUNDS.has(Number(race.round)) ? "SPRINT WEEKEND · " : ""}${race.location}`;
    renderDrivers();
    renderConstructors();
    updateSummary();
  })
  .catch(() => {
    document.getElementById("driver-list").innerHTML =
      '<div class="muted">Projection data unavailable.</div>';
  });
function renderDrivers() {
  const el = document.getElementById("driver-list");
  el.innerHTML = "";
  Object.values(driverModels)
    .sort((a, b) => b.total - a.total)
    .forEach((d, i) => {
      const row = document.createElement("div");
      row.className = `fantasy-row${selectedDrivers.has(d.code) ? " selected" : ""}${d.team === "Ferrari" ? " fantasy-driver-ferrari" : ""}`;
      row.innerHTML = `<div class="rank">${String(i + 1).padStart(2, "0")}</div><div class="name"><b>${d.name}</b><small style="color:${TEAM_COLORS[d.team] || "#777"}">${d.code} · ${d.team} · P${d.finish} projected</small></div><div class="price">$${d.price.toFixed(1)}M<small>price snapshot</small></div><div class="xpts">${(d.total + (boostDriver === d.code ? d.total : 0)).toFixed(1)}<small>projected pts</small></div><div class="pick-state">${boostDriver === d.code ? "2X BOOST" : selectedDrivers.has(d.code) ? "SELECTED" : "ADD"}</div>`;
      row.addEventListener("click", () => toggleDriver(d.code));
      el.appendChild(row);
    });
}
function renderConstructors() {
  const el = document.getElementById("constructor-list");
  el.innerHTML = "";
  Object.values(constructorModels)
    .sort((a, b) => b.total - a.total)
    .forEach((c, i) => {
      const row = document.createElement("div");
      row.className = `fantasy-row${selectedConstructors.has(c.team) ? " selected" : ""}${c.team === "Ferrari" ? " fantasy-constructor-ferrari" : ""}`;
      row.innerHTML = `<div class="rank">${String(i + 1).padStart(2, "0")}</div><div class="name"><b>${c.team}</b><small style="color:${TEAM_COLORS[c.team] || "#777"}">${c.code} · two-car constructor score</small></div><div class="price">$${c.price.toFixed(1)}M<small>price snapshot</small></div><div class="xpts">${c.total.toFixed(1)}<small>projected pts</small></div><div class="pick-state">${selectedConstructors.has(c.team) ? "SELECTED" : "ADD"}</div>`;
      row.addEventListener("click", () => toggleConstructor(c.team));
      el.appendChild(row);
    });
}
function toggleDriver(code) {
  if (selectedDrivers.has(code)) {
    selectedDrivers.delete(code);
    if (boostDriver === code) boostDriver = null;
  } else if (selectedDrivers.size < 5) selectedDrivers.add(code);
  renderDrivers();
  updateSummary();
}
function toggleConstructor(team) {
  if (selectedConstructors.has(team)) selectedConstructors.delete(team);
  else if (selectedConstructors.size < 2) selectedConstructors.add(team);
  renderConstructors();
  updateSummary();
}
document.getElementById("boost-driver").addEventListener("change", (e) => {
  boostDriver = e.target.value || null;
  if (boostDriver && !selectedDrivers.has(boostDriver)) {
    if (selectedDrivers.size < 5) selectedDrivers.add(boostDriver);
    else {
      boostDriver = null;
      e.target.value = "";
    }
  }
  renderDrivers();
  updateSummary();
});
function updateSummary() {
  const driverCost = [...selectedDrivers].reduce(
      (a, c) => a + (DRIVER_PRICES[c] || 0),
      0,
    ),
    constructorCost = [...selectedConstructors].reduce(
      (a, c) => a + (TEAM_PRICES[c] || 0),
      0,
    ),
    cost = driverCost + constructorCost,
    driverPts = [...selectedDrivers].reduce(
      (a, c) =>
        a +
        (driverModels[c]?.total || 0) +
        (boostDriver === c ? driverModels[c]?.total || 0 : 0),
      0,
    ),
    constructorPts = [...selectedConstructors].reduce(
      (a, c) => a + (constructorModels[c]?.total || 0),
      0,
    ),
    total = driverPts + constructorPts;
  document.getElementById("budget-used").textContent = `$${cost.toFixed(1)}M`;
  document.getElementById("budget-left").textContent =
    `$${(100 - cost).toFixed(1)}M`;
  document.getElementById("driver-count-top").textContent =
    `${selectedDrivers.size}/5`;
  document.getElementById("driver-count-side").textContent =
    `${selectedDrivers.size}/5`;
  document.getElementById("constructor-count-top").textContent =
    `${selectedConstructors.size}/2`;
  document.getElementById("constructor-count-side").textContent =
    `${selectedConstructors.size}/2`;
  document.getElementById("projected-total").textContent = total.toFixed(1);
  const valid =
    selectedDrivers.size === 5 &&
    selectedConstructors.size === 2 &&
    cost <= 100;
  document.getElementById("team-status").textContent = valid
    ? "READY TO LOCK"
    : "BUILD INCOMPLETE";
  document.getElementById("team-status").className = valid
    ? "badge red"
    : "badge";
  document.getElementById("budget-warning").textContent =
    cost > 100
      ? "Over the $100M cap — remove an asset."
      : `$${(100 - cost).toFixed(1)}M remaining`;
  const selected = document.getElementById("selected-assets");
  selected.innerHTML =
    [...selectedDrivers]
      .map(
        (c) =>
          `<div class="selected-chip"><span>${c}${boostDriver === c ? " · 2X" : ""}</span><b>${driverModels[c]?.total.toFixed(1)}</b></div>`,
      )
      .concat(
        [...selectedConstructors].map(
          (t) =>
            `<div class="selected-chip"><span>${TEAM_CODES[t]}</span><b>${constructorModels[t]?.total.toFixed(1)}</b></div>`,
        ),
      )
      .join("") ||
    '<div class="muted" style="font-size:.8rem">Select five drivers and two constructors.</div>';
}

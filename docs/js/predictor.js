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
  BOT: 3.0
};

const DRIVER_NAMES = {
  RUS: 'George Russell',
  VER: 'Max Verstappen',
  NOR: 'Lando Norris',
  ANT: 'Kimi Antonelli',
  PIA: 'Oscar Piastri',
  HAM: 'Lewis Hamilton',
  LEC: 'Charles Leclerc',
  HAD: 'Isack Hadjar',
  GAS: 'Pierre Gasly',
  SAI: 'Carlos Sainz',
  ALB: 'Alex Albon',
  ALO: 'Fernando Alonso',
  STR: 'Lance Stroll',
  BEA: 'Oliver Bearman',
  OCO: 'Esteban Ocon',
  HUL: 'Nico Hulkenberg',
  LAW: 'Liam Lawson',
  BOR: 'Gabriel Bortoleto',
  LIN: 'Arvid Lindblad',
  COL: 'Franco Colapinto',
  PER: 'Sergio Perez',
  BOT: 'Valtteri Bottas'
};

const TEAM_PRICES = {
  Mercedes: 32.6,
  McLaren: 31.0,
  'Red Bull Racing': 30.9,
  Ferrari: 26.6,
  'Racing Bulls': 12.9,
  Audi: 6.8,
  Alpine: 18.8,
  'Haas F1 Team': 12.0,
  Williams: 13.0,
  'Aston Martin': 5.7,
  Cadillac: 3.0
};

const TEAM_CODES = {
  Mercedes: 'MER',
  McLaren: 'MCL',
  'Red Bull Racing': 'RED',
  Ferrari: 'FER',
  'Racing Bulls': 'VRB',
  Audi: 'AUD',
  Alpine: 'ALP',
  'Haas F1 Team': 'HAA',
  Williams: 'WIL',
  'Aston Martin': 'AST',
  Cadillac: 'CAD'
};

const TEAM_COLORS = {
  Mercedes: '#27f4d2',
  McLaren: '#ff8000',
  'Red Bull Racing': '#3671c6',
  Ferrari: '#e10600',
  'Racing Bulls': '#6692ff',
  Audi: '#52e252',
  Alpine: '#0093cc',
  'Haas F1 Team': '#b6babd',
  Williams: '#64c4ff',
  'Aston Martin': '#229971',
  Cadillac: '#c0c0c0'
};

const SPRINT_ROUNDS = new Set([2, 4, 5, 9, 12, 17]);
const selectedDrivers = new Set();
const selectedConstructors = new Set();

let boostDriver = null;
let driverModels = {};
let constructorModels = {};
let nextRace = null;

const FINISH_POINTS = [0, 25, 18, 15, 12, 10, 8, 6, 4, 2, 1];
const SPRINT_POINTS = [0, 8, 7, 6, 5, 4, 3, 2, 1];
const QUALI_POINTS = position =>
  position >= 1 && position <= 10 ? 11 - position : 0;
const clamp = (number, min, max) => Math.max(min, Math.min(max, number));

const budgetInput = document.getElementById('budget-cap');
const savedBudget = Number(localStorage.getItem('scuderia16-budget'));
let budgetCap =
  Number.isFinite(savedBudget) && savedBudget >= 50 && savedBudget <= 250
    ? savedBudget
    : Number(budgetInput?.value) || 100;

if (budgetInput) {
  budgetInput.value = budgetCap.toFixed(1).replace('.0', '');
  budgetInput.addEventListener('input', () => {
    const next = Number(budgetInput.value);
    if (!Number.isFinite(next) || next < 50 || next > 250) return;
    budgetCap = next;
    localStorage.setItem('scuderia16-budget', String(next));
    document.getElementById('budget-mode').textContent =
      next === 100
        ? 'Official cap: $100M · edit for custom scenarios'
        : `Custom simulator cap: $${next.toFixed(1)}M`;
    updateSummary();
  });
  budgetInput.addEventListener('change', () => {
    budgetCap = clamp(Number(budgetInput.value) || 100, 50, 250);
    budgetInput.value = budgetCap.toFixed(1).replace('.0', '');
    localStorage.setItem('scuderia16-budget', String(budgetCap));
    updateSummary();
  });
}

function roundPosition(value) {
  return clamp(Math.round(Number(value) || 22), 1, 22);
}

function projectDriver(code, data) {
  const qualifyingGrid = roundPosition(data.predictedGrid);
  const finish = roundPosition(data.predictedFinish);
  const gained = Math.max(0, qualifyingGrid - finish);
  const lost = Math.min(0, qualifyingGrid - finish);
  const overtakes = Math.round(Math.max(0, 10 - finish) * 0.12);
  const fastest = finish <= 3 ? 0.18 : finish <= 6 ? 0.08 : 0.02;
  const dotd = finish <= 3 ? 0.12 : finish <= 8 ? 0.04 : 0.01;
  const raceBase = FINISH_POINTS[finish] || 0;
  const race =
    Math.round(
      (raceBase + gained + lost + overtakes + fastest * 10 + dotd * 10) * 10
    ) / 10;
  const qualifying = QUALI_POINTS(qualifyingGrid);
  let sprint = 0;

  if (SPRINT_ROUNDS.has(Number(nextRace?.round))) {
    const sprintGained = Math.max(0, qualifyingGrid - finish);
    const sprintLost = Math.min(0, qualifyingGrid - finish);
    sprint =
      Math.round(
        ((SPRINT_POINTS[finish] || 0) +
          sprintGained +
          Math.max(-10, sprintLost) +
          overtakes +
          fastest * 5) *
          10
      ) / 10;
  }

  return {
    code,
    name: data.name || DRIVER_NAMES[code] || code,
    team: data.team,
    price: DRIVER_PRICES[code],
    qualifying,
    sprint,
    race,
    total: Math.round((qualifying + sprint + race) * 10) / 10,
    grid: qualifyingGrid,
    finish,
    gained,
    overtakes,
    fastest: Math.round(fastest * 100),
    dotd: Math.round(dotd * 100),
    confidence: Number(data.confidence) || 50,
    features: data
  };
}

function constructorScore(team, drivers) {
  const teamDrivers = Object.values(drivers).filter(
    driver => driver.team === team
  );

  if (teamDrivers.length < 2) return null;

  const qualifying = teamDrivers.reduce(
    (sum, driver) => sum + driver.qualifying,
    0
  );
  const bothQ2 = teamDrivers.filter(driver => driver.grid <= 15).length;
  const bothQ3 = teamDrivers.filter(driver => driver.grid <= 10).length;
  const qualifyingBonus =
    bothQ3 === 2
      ? 10
      : bothQ3 === 1
        ? 5
        : bothQ2 === 2
          ? 3
          : bothQ2 === 1
            ? 1
            : -1;
  const sprint = teamDrivers.reduce((sum, driver) => sum + driver.sprint, 0);
  const race = teamDrivers.reduce(
    (sum, driver) => sum + driver.race - (driver.dotd / 100) * 10,
    0
  );
  const pitstop = 5;
  const fastestPitstop = 0;

  return {
    team,
    code: TEAM_CODES[team],
    price: TEAM_PRICES[team],
    qualifying: Math.round((qualifying + qualifyingBonus) * 10) / 10,
    sprint: Math.round(sprint * 10) / 10,
    race: Math.round((race + pitstop + fastestPitstop) * 10) / 10,
    total:
      Math.round(
        (qualifying + qualifyingBonus + sprint + race + pitstop + fastestPitstop) *
          10
      ) / 10,
    qBonus: qualifyingBonus,
    pitstop,
    fastestPitstop
  };
}

Promise.all([
  fetch('data/next_race.json').then(response => response.json()),
  fetch('data/model/race_prediction_2026.json').then(response => response.json())
])
  .then(([race, prediction]) => {
    nextRace = race;
    driverModels = {};

    prediction.drivers.forEach(data => {
      driverModels[data.code] = projectDriver(data.code, data);
    });

    Object.keys(TEAM_PRICES).forEach(team => {
      constructorModels[team] = constructorScore(team, driverModels);
    });

    const includedSessions = [
      prediction.sessions?.sprintIncluded ? 'SPRINT INCLUDED' : '',
      prediction.sessions?.qualifyingIncluded ? 'QUALIFYING INCLUDED' : ''
    ].filter(Boolean);
    document.getElementById('race-context').textContent =
      `${race.eventName} · ${SPRINT_ROUNDS.has(Number(race.round)) ? 'SPRINT WEEKEND · ' : ''}${race.location}${includedSessions.length ? ` · ${includedSessions.join(' · ')}` : ''}`;

    renderDrivers();
    renderConstructors();
    updateSummary();
  })
  .catch(() => {
    document.getElementById('driver-list').innerHTML =
      '<div class="muted">Projection data unavailable.</div>';
  });

function renderDrivers() {
  const element = document.getElementById('driver-list');
  element.innerHTML = '';

  Object.values(driverModels)
    .sort((a, b) => b.total - a.total)
    .forEach((driver, index) => {
      const row = document.createElement('div');
      row.className = `fantasy-row${
        selectedDrivers.has(driver.code) ? ' selected' : ''
      }${driver.team === 'Ferrari' ? ' fantasy-driver-ferrari' : ''}`;

      row.innerHTML = `
        <div class="rank">${String(index + 1).padStart(2, '0')}</div>
        <div class="name">
          <b>${driver.name}</b>
          <small style="color:${TEAM_COLORS[driver.team] || '#777'}">
            ${driver.code} · ${driver.team} · P${driver.finish} projected · ${driver.confidence}% confidence
          </small>
        </div>
        <div class="price">
          $${driver.price.toFixed(1)}M
          <small>price snapshot</small>
        </div>
        <div class="xpts">
          ${(driver.total + (boostDriver === driver.code ? driver.total : 0)).toFixed(1)}
          <small>projected pts</small>
        </div>
        <div class="pick-state">
          ${
            boostDriver === driver.code
              ? '2X BOOST'
              : selectedDrivers.has(driver.code)
                ? 'SELECTED'
                : 'ADD'
          }
        </div>`;

      row.addEventListener('click', () => toggleDriver(driver.code));
      element.appendChild(row);
    });
}

function renderConstructors() {
  const element = document.getElementById('constructor-list');
  element.innerHTML = '';

  Object.values(constructorModels)
    .filter(Boolean)
    .sort((a, b) => b.total - a.total)
    .forEach((constructor, index) => {
      const row = document.createElement('div');
      row.className = `fantasy-row${
        selectedConstructors.has(constructor.team) ? ' selected' : ''
      }${
        constructor.team === 'Ferrari' ? ' fantasy-constructor-ferrari' : ''
      }`;

      row.innerHTML = `
        <div class="rank">${String(index + 1).padStart(2, '0')}</div>
        <div class="name">
          <b>${constructor.team}</b>
          <small style="color:${TEAM_COLORS[constructor.team] || '#777'}">
            ${constructor.code} · two-car constructor score
          </small>
        </div>
        <div class="price">
          $${constructor.price.toFixed(1)}M
          <small>price snapshot</small>
        </div>
        <div class="xpts">
          ${constructor.total.toFixed(1)}
          <small>projected pts</small>
        </div>
        <div class="pick-state">
          ${selectedConstructors.has(constructor.team) ? 'SELECTED' : 'ADD'}
        </div>`;

      row.addEventListener('click', () => toggleConstructor(constructor.team));
      element.appendChild(row);
    });
}

function toggleDriver(code) {
  if (selectedDrivers.has(code)) {
    selectedDrivers.delete(code);

    if (boostDriver === code) {
      boostDriver = null;
      document.getElementById('boost-driver').value = '';
    }
  } else if (selectedDrivers.size < 5) {
    selectedDrivers.add(code);
  }

  renderDrivers();
  updateSummary();
}

function toggleConstructor(team) {
  if (selectedConstructors.has(team)) {
    selectedConstructors.delete(team);
  } else if (selectedConstructors.size < 2) {
    selectedConstructors.add(team);
  }

  renderConstructors();
  updateSummary();
}

document.getElementById('boost-driver').addEventListener('change', event => {
  boostDriver = event.target.value || null;

  if (boostDriver && !selectedDrivers.has(boostDriver)) {
    if (selectedDrivers.size < 5) {
      selectedDrivers.add(boostDriver);
    } else {
      boostDriver = null;
      event.target.value = '';
    }
  }

  renderDrivers();
  updateSummary();
});

function updateSummary() {
  const driverCost = [...selectedDrivers].reduce(
    (sum, code) => sum + (DRIVER_PRICES[code] || 0),
    0
  );
  const constructorCost = [...selectedConstructors].reduce(
    (sum, team) => sum + (TEAM_PRICES[team] || 0),
    0
  );
  const cost = driverCost + constructorCost;
  const driverPoints = [...selectedDrivers].reduce(
    (sum, code) =>
      sum +
      (driverModels[code]?.total || 0) +
      (boostDriver === code ? driverModels[code]?.total || 0 : 0),
    0
  );
  const constructorPoints = [...selectedConstructors].reduce(
    (sum, team) => sum + (constructorModels[team]?.total || 0),
    0
  );
  const total = driverPoints + constructorPoints;
  const remaining = budgetCap - cost;

  document.getElementById('budget-used').textContent = `$${cost.toFixed(1)}M`;
  document.getElementById('budget-left').textContent = `$${remaining.toFixed(1)}M`;
  document.getElementById('driver-count-top').textContent = `${selectedDrivers.size}/5`;
  document.getElementById('driver-count-side').textContent = `${selectedDrivers.size}/5`;
  document.getElementById('constructor-count-top').textContent = `${selectedConstructors.size}/2`;
  document.getElementById('constructor-count-side').textContent = `${selectedConstructors.size}/2`;
  document.getElementById('projected-total').textContent = total.toFixed(1);

  const valid =
    selectedDrivers.size === 5 &&
    selectedConstructors.size === 2 &&
    cost <= budgetCap;

  document.getElementById('team-status').textContent = valid
    ? 'READY TO LOCK'
    : 'BUILD INCOMPLETE';
  document.getElementById('team-status').className = valid
    ? 'badge red'
    : 'badge';

  document.getElementById('budget-warning').textContent =
    remaining < 0
      ? `Over by $${Math.abs(remaining).toFixed(1)}M`
      : `$${remaining.toFixed(1)}M remaining`;

  const selected = document.getElementById('selected-assets');
  selected.innerHTML =
    [...selectedDrivers]
      .map(
        code =>
          `<div class="selected-chip"><span>${code}${
            boostDriver === code ? ' · 2X' : ''
          }</span><b>${driverModels[code]?.total.toFixed(1)}</b></div>`
      )
      .concat(
        [...selectedConstructors].map(
          team =>
            `<div class="selected-chip"><span>${TEAM_CODES[team]}</span><b>${constructorModels[team]?.total.toFixed(1)}</b></div>`
        )
      )
      .join('') ||
    '<div class="muted" style="font-size:.8rem">Select five drivers and two constructors.</div>';
}

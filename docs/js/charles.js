const charlesResultsStrip = document.querySelector('[data-charles-results]');

fetch('data/career_stats.json')
  .then(response => {
    if (!response.ok) throw new Error('Could not load official career stats');
    return response.json();
  })
  .then(stats => {
    document.querySelectorAll('[data-career-stat]').forEach(element => {
      const value = stats[element.dataset.careerStat];
      if (value !== undefined) element.textContent = value;
    });
  })
  .catch(error => {
    console.warn('Using the embedded official career totals.', error);
  });

function raceLabel(eventName) {
  const label = eventName.replace(/ Grand Prix$/i, '');
  const familiarNames = {
    Australian: 'Australia',
    Chinese: 'China',
    Japanese: 'Japan',
    Canadian: 'Canada',
    Austrian: 'Austria',
    British: 'Great Britain',
    Belgian: 'Belgium',
    Hungarian: 'Hungary',
  };
  return familiarNames[label] || label;
}

function resultLabel(result) {
  const didNotFinish = ['Retired', 'Disqualified', 'Did not start'].includes(
    result.Status,
  );
  return didNotFinish ? 'DNF' : `P${Number(result.Position)}`;
}

function renderCharlesResults(results) {
  const fragment = document.createDocumentFragment();

  results.forEach(({ event, result }) => {
    const chip = document.createElement('div');
    chip.className = 'result-chip';

    const race = document.createElement('small');
    race.textContent = raceLabel(event.EventName);

    const position = document.createElement('b');
    position.textContent = resultLabel(result);

    const points = document.createElement('span');
    const pointTotal = Number(result.Points);
    points.textContent = `${pointTotal} ${pointTotal === 1 ? 'pt' : 'pts'}`;

    chip.append(race, position, points);
    fragment.append(chip);
  });

  charlesResultsStrip.replaceChildren(fragment);
}

if (charlesResultsStrip) {
  fetch('data/schedule_2026.json')
    .then(response => {
      if (!response.ok) throw new Error('Could not load the 2026 schedule');
      return response.json();
    })
    .then(schedule =>
      Promise.all(
        schedule
          .sort((a, b) => Number(a.RoundNumber) - Number(b.RoundNumber))
          .map(event =>
            fetch(`data/results_2026_r${event.RoundNumber}.json`)
              .then(response => (response.ok ? response.json() : []))
              .then(classification => ({
                event,
                result: classification.find(driver => driver.Abbreviation === 'LEC'),
              })),
          ),
      ),
    )
    .then(results => results.filter(item => item.result))
    .then(results => {
      if (results.length) renderCharlesResults(results);
    })
    .catch(error => {
      console.warn('Using the embedded 2026 Charles Leclerc results.', error);
    });
}

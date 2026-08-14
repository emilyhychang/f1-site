const NAV = `<nav class="site-nav"><a class="brand" href="index.html">SCUDERIA <span>16</span></a><div class="nav-links"><a href="index.html">Race Control</a><a href="schedule.html">Calendar</a><a href="results.html">Results</a><a href="analysis.html">Analysis</a><a href="fantasy.html">Predictor</a><a href="ferrari.html">Ferrari</a><a href="charles.html">Charles</a></div><div class="nav-16">LEC / 16</div></nav>`;
document.addEventListener('DOMContentLoaded', () => {
  if (!document.querySelector('link[data-enhancements]')) {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'css/enhancements.css';
    link.dataset.enhancements = '1';
    document.head.appendChild(link);
  }
  document.body.insertAdjacentHTML('afterbegin', NAV);
  const current = location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('.nav-links a').forEach(a => {
    if (a.getAttribute('href') === current) a.classList.add('active');
  });
  if (window.Chart) {
    Chart.defaults.color = '#8e8e98';
    Chart.defaults.borderColor = '#292930';
    Chart.defaults.font.family = 'Inter,system-ui,sans-serif';
    Chart.defaults.plugins.legend.labels.usePointStyle = true;
  }
  if (window.LECLERC_CUTOUT) {
    document.querySelectorAll('[data-leclerc-image]').forEach(img => {
      img.src = window.LECLERC_CUTOUT;
      img.removeAttribute('data-leclerc-image');
    });
  }
  document.querySelectorAll('[data-count]').forEach(el => {
    const target = parseFloat(el.dataset.count);
    let start = 0;
    const step = Math.max(target / 40, 0.1);
    const tick = () => {
      start = Math.min(target, start + step);
      el.textContent = Number.isInteger(target)
        ? Math.round(start)
        : start.toFixed(1);
      if (start < target) requestAnimationFrame(tick);
    };
    tick();
  });
  const secret = document.querySelector('.secret');
  if (secret)
    secret.addEventListener('click', () => {
      secret.textContent = secret.dataset.message || 'FORZA FERRARI.';
    });
});

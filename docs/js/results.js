let chart;
fetch("data/schedule_2026.json")
  .then((r) => r.json())
  .then((schedule) => {
    const picker = document.getElementById("round-picker");
    const races = schedule.filter((e) => e.RoundNumber > 0);
    races.forEach((e) => {
      const opt = document.createElement("option");
      opt.value = e.RoundNumber;
      opt.textContent = `Round ${e.RoundNumber} - ${e.EventName}`;
      picker.appendChild(opt);
    });
    const requested = new URLSearchParams(location.search).get("round");
    if (requested && races.some((r) => String(r.RoundNumber) === requested))
      picker.value = requested;
    picker.addEventListener("change", () => {
      history.replaceState({}, "", `results.html?round=${picker.value}`);
      loadRound(picker.value);
    });
    loadRound(picker.value || races[0]?.RoundNumber || 1);
  })
  .catch(() => {});
function prettyStatus(status) {
  const raw = String(status || "").trim();
  if (/retired|did not finish|dnf/i.test(raw)) return "Did Not Finish (DNF)";
  return raw || "Classified";
}
function loadRound(round) {
  fetch(`data/results_2026_r${round}.json`)
    .then((r) => r.json())
    .then((results) => {
      const tbody = document.querySelector("#results-table tbody");
      tbody.innerHTML = "";
      results.forEach((r) => {
        const status = prettyStatus(r.Status);
        const dnf = status.includes("DNF");
        const teamColor =
          {
            Ferrari: "#e10600",
            Mercedes: "#27f4d2",
            McLaren: "#ff8000",
            "Red Bull Racing": "#3671c6",
            "Aston Martin": "#229971",
            Alpine: "#0093cc",
            Williams: "#64c4ff",
            "Racing Bulls": "#6692ff",
            "Haas F1 Team": "#b6babd",
            Audi: "#52e252",
            Cadillac: "#c0c0c0",
          }[r.TeamName] || "#777";
        tbody.innerHTML += `<tr style="box-shadow:inset 3px 0 ${teamColor}"><td>${r.Position}</td><td>${r.FullName}</td><td style="color:${teamColor}">${r.TeamName}</td><td>${r.Points}</td><td class="${dnf ? "result-status-dnf" : ""}">${status}</td></tr>`;
      });
      const ctx = document.getElementById("points-chart");
      if (chart) chart.destroy();
      chart = new Chart(ctx, {
        type: "bar",
        data: {
          labels: results.map((r) => r.Abbreviation),
          datasets: [
            {
              label: "Points",
              data: results.map((r) => r.Points),
              backgroundColor: results.map(
                (r) =>
                  ({
                    Ferrari: "#e10600",
                    Mercedes: "#27f4d2",
                    McLaren: "#ff8000",
                    "Red Bull Racing": "#3671c6",
                    "Aston Martin": "#229971",
                    Alpine: "#0093cc",
                    Williams: "#64c4ff",
                    "Racing Bulls": "#6692ff",
                    "Haas F1 Team": "#b6babd",
                    Audi: "#52e252",
                    Cadillac: "#c0c0c0",
                  })[r.TeamName] || "#666",
              ),
              borderRadius: 5,
            },
          ],
        },
        options: {
          plugins: { legend: { display: false } },
          scales: { y: { beginAtZero: true } },
        },
      });
    })
    .catch(() => {
      document.querySelector("#results-table tbody").innerHTML =
        '<tr><td colspan="5">Results are not available for this round yet.</td></tr>';
    });
}

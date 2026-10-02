# F1 Site

## Automatic race updates

The `Update F1 race data` GitHub Actions workflow refreshes results,
standings, analysis, fantasy-model inputs, the next race, and track data every
six hours on Saturdays, Sundays, and Mondays. It commits only when the
generated files actually change, which automatically triggers the GitHub Pages
deployment.

Before committing, the workflow validates the generated standings, fantasy
inputs, and next-race data. If an upstream API is unavailable or returns an
incomplete dataset, the run stops without replacing the site's existing data.

The workflow can also be run at any time from the repository's **Actions** tab
with **Run workflow**.

## Automatic next-race circuits

The homepage and calendar use `docs/js/race-data.js`. They check the Jolpica
schedule and race-winner results every minute while the page is visible and
refresh when a tab is reopened. A race remains selected until a published race
result confirms completion; elapsed time alone never advances it during a delay
or red flag. Publication latency depends on Jolpica (its responses currently advertise a
10-minute cache lifetime), so this is not a live
chequered-flag signal. The final completed round displays “Season complete.”

Circuits are selected by the schedule's `circuitId`, not event name or country.
This handles the 2026 Bahrain Grand Prix in Malaysia at Sepang correctly.
Every venue on the current 23-race calendar has a bundled, closed SVG outline.
Unknown future venues display an unavailable message instead of a fake track.
The card links to the matching [Formula Timer circuit guide](https://formula-timer.com/circuit).
Formula Timer's raster illustrations are not the animation geometry: the paths
are projected from [Tomislav Bacinger's MIT-licensed circuit coordinates](https://github.com/bacinger/f1-circuits)
at revision `394d8fbe70ef2c0b0c8d23ff7bee61fa09606055`. The license is bundled
in `docs/data/licenses/f1-circuits-MIT.txt`. Rebuild with:

```sh
python3 data_pipeline/build_circuits.py /path/to/f1-circuits.geojson
```

The lightweight `Refresh next race` workflow refreshes the bundled fallback
snapshot approximately every 15 minutes (GitHub schedules can be delayed),
independently of the slow telemetry job. It retains the previous snapshot on
failure and explicitly deploys `docs` to GitHub Pages; bot commits alone do not
trigger a Pages build. This workflow requires GitHub Pages **Source: GitHub
Actions** and the `github-pages` environment to permit the main branch.
Browser updates work directly through Jolpica even between deployments. When
live requests fail, both pages display the last confirmed snapshot and its
status rather than falsely claiming that the season ended.

Run regression checks with:

```sh
node --test tests/race-data.test.cjs
python3 -m unittest discover -s tests -p 'test_*.py'
```

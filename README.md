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

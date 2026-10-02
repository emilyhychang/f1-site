import copy
from datetime import datetime, timezone
import json
from pathlib import Path
import unittest
from data_pipeline.refresh_race_status import build_snapshot

SNAPSHOT = json.loads(Path('docs/data/race_status.json').read_text())


def feed(races):
    return {'MRData': {'total': str(len(races)), 'RaceTable': {'season': '2026', 'Races': races}}}


def results(rounds):
    return feed([{**race, 'Results': [{'position': '1', 'laps': '56'}]} for race in SNAPSHOT['schedule'] if int(race['round']) in rounds])


class RaceStatusTests(unittest.TestCase):
    def test_finish_changes_completion_without_time_heuristic(self):
        now = datetime(2026, 10, 5, tzinfo=timezone.utc)
        before = build_snapshot(feed(SNAPSHOT['schedule']), results(range(1, 16)), now)
        after = build_snapshot(feed(SNAPSHOT['schedule']), results(range(1, 17)), now)
        self.assertNotIn(16, before['completedRounds'])
        self.assertIn(16, after['completedRounds'])

    def test_future_results_do_not_skip_race(self):
        now = datetime(2026, 10, 1, tzinfo=timezone.utc)
        state = build_snapshot(feed(SNAPSHOT['schedule']), results(range(1, 24)), now)
        self.assertEqual(state['completedRounds'], list(range(1, 16)))

    def test_partial_feed_rejected(self):
        partial = feed(SNAPSHOT['schedule'])
        partial['MRData']['total'] = '100'
        with self.assertRaises(ValueError):
            build_snapshot(partial, results([]))

    def test_mismatched_venue_rejected(self):
        mismatched = copy.deepcopy(results([16]))
        mismatched['MRData']['RaceTable']['Races'][0]['Circuit']['circuitId'] = 'bahrain'
        with self.assertRaises(ValueError):
            build_snapshot(feed(SNAPSHOT['schedule']), mismatched)


if __name__ == '__main__':
    unittest.main()

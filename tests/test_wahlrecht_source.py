import json
import tempfile
import unittest
from datetime import datetime, timezone, timedelta
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "tools"))

import verify_wahlrecht_source as V

FIX = ROOT / "tests" / "fixtures" / "wahlrecht" / "unit"

class WahlrechtParserTests(unittest.TestCase):
    def setUp(self):
        self.main = (FIX / "main.html").read_text(encoding="utf-8")
        self.other = (FIX / "weitere-umfragen.html").read_text(encoding="utf-8")

    def test_main_parser_extracts_all_canonical_primary_institutes(self):
        obs, profile = V.parse_main_page(self.main)
        got = {x["institute"]: x["date"] for x in obs}
        self.assertEqual(got["Allensbach"], "2026-08-21")
        self.assertEqual(got["Verian"], "2026-08-28")
        self.assertEqual(got["Forsa"], "2026-08-25")
        self.assertEqual(got["Forschungsgruppe Wahlen"], "2026-08-20")
        self.assertEqual(got["GMS"], "2026-07-20")
        self.assertEqual(got["Infratest dimap"], "2026-08-06")
        self.assertEqual(got["INSA"], "2026-08-25")
        self.assertEqual(got["YouGov"], "2026-08-18")
        self.assertEqual(set(profile["primaryInstitutes"]), set(V.REQUIRED_PRIMARY))

    def test_other_parser_extracts_all_dated_poll_rows(self):
        obs, profile = V.parse_other_page(self.other)
        self.assertIn({"institute": "pollytix", "date": "2026-08-21"}, obs)
        self.assertGreaterEqual(profile["pollRows"], 3)
        self.assertIn("pollytix", profile["institutes"])

    def test_eligible_window_is_anchored_to_latest_canonical_poll(self):
        main, _ = V.parse_main_page(self.main)
        other, _ = V.parse_other_page(self.other)
        as_of, eligible = V.build_eligible(main + other, window_days=14)
        self.assertEqual(as_of, "2026-08-28")
        self.assertEqual(
            [(x["institute"], x["date"]) for x in eligible],
            [
                ("Allensbach", "2026-08-21"),
                ("Verian", "2026-08-28"),
                ("Forsa", "2026-08-25"),
                ("Forschungsgruppe Wahlen", "2026-08-20"),
                ("INSA", "2026-08-25"),
                ("YouGov", "2026-08-18"),
                ("pollytix", "2026-08-21"),
            ],
        )

    def test_sanity_check_fails_closed_on_partial_primary_parse(self):
        main, mp = V.parse_main_page(self.main)
        other, op = V.parse_other_page(self.other)
        broken = [x for x in main if x["institute"] != "Verian"]
        with self.assertRaises(V.ParserSanityError):
            V.validate_snapshot(
                broken, other, mp, op,
                now=datetime(2026, 8, 28, 20, 0, tzinfo=timezone.utc)
            )

    def test_sanity_check_rejects_too_few_eligible_institutes(self):
        main, mp = V.parse_main_page(self.main)
        other, op = V.parse_other_page(self.other)
        tiny = [x for x in main if x["institute"] in {"INSA","Forsa"}]
        with self.assertRaises(V.ParserSanityError):
            V.validate_snapshot(
                tiny, [], mp, op,
                now=datetime(2026, 8, 28, 20, 0, tzinfo=timezone.utc)
            )

    def test_structural_drift_fails_beyond_tolerance(self):
        main, mp = V.parse_main_page(self.main)
        other, op = V.parse_other_page(self.other)
        baseline = {"main": mp, "other": op}
        live = json.loads(json.dumps(baseline))
        live["main"]["headerColumns"] += 5
        with self.assertRaises(V.MarkupDriftError):
            V.compare_profiles(live, baseline)

    def test_manifest_is_automated_and_uses_canonical_asof(self):
        main, mp = V.parse_main_page(self.main)
        other, op = V.parse_other_page(self.other)
        snap = V.validate_snapshot(
            main, other, mp, op,
            now=datetime(2026, 8, 28, 20, 0, tzinfo=timezone.utc)
        )
        manifest = V.build_manifest(
            snap,
            verified_at=datetime(2026, 8, 28, 20, 0, tzinfo=timezone.utc),
            fixture_baseline="2026-08-28",
        )
        self.assertEqual(manifest["mode"], "automated")
        self.assertEqual(manifest["status"], "verified")
        self.assertEqual(manifest["asOfDate"], "2026-08-28")
        self.assertEqual(len(manifest["eligible"]), 7)
        self.assertEqual(manifest["parserVersion"], V.PARSER_VERSION)

    def test_conditional_refresh_on_first_automation_change_or_24h(self):
        now = datetime(2026, 8, 29, 18, 0, tzinfo=timezone.utc)
        candidate = {
            "mode": "automated", "status": "verified",
            "verifiedAt": now.isoformat().replace("+00:00","Z"),
            "asOfDate": "2026-08-28",
            "eligible": [{"institute":"Verian","date":"2026-08-28"}],
            "parserVersion": 1,
        }
        manual = dict(candidate, mode="manual", verifiedAt="2026-08-29T17:00:00Z")
        self.assertTrue(V.should_refresh_manifest(manual, candidate, now, 24))

        same_recent = dict(candidate, verifiedAt=(now-timedelta(hours=6)).isoformat().replace("+00:00","Z"))
        self.assertFalse(V.should_refresh_manifest(same_recent, candidate, now, 24))

        same_old = dict(candidate, verifiedAt=(now-timedelta(hours=24, minutes=1)).isoformat().replace("+00:00","Z"))
        self.assertTrue(V.should_refresh_manifest(same_old, candidate, now, 24))

        changed = json.loads(json.dumps(same_recent))
        changed["eligible"].append({"institute":"pollytix","date":"2026-08-21"})
        self.assertTrue(V.should_refresh_manifest(same_recent, changed, now, 24))

    def test_http_429_and_503_are_source_unavailable_not_parser_failures(self):
        self.assertEqual(V.classify_http_failure(429), "source-unavailable")
        self.assertEqual(V.classify_http_failure(503), "source-unavailable")
        self.assertEqual(V.EXIT_SOURCE_UNAVAILABLE, 20)
        self.assertNotEqual(V.EXIT_SOURCE_UNAVAILABLE, V.EXIT_PARSER_FAILURE)

if __name__ == "__main__":
    unittest.main()

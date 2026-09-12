import hashlib
import unittest

from date_normalization import normalize_candidate_dates, normalize_date_range, normalize_single_date


class DateNormalizationTests(unittest.TestCase):
    def test_same_month_range(self):
        self.assertEqual(
            ("2026-12-15", "2026-12-17"),
            normalize_date_range("15-17 Dec 2026 Upcoming"),
        )

    def test_cross_month_range(self):
        self.assertEqual(
            ("2026-11-30", "2026-12-05"),
            normalize_date_range("30 Nov - 05 Dec 2026"),
        )

    def test_isprs_calendar_range(self):
        self.assertEqual(
            ("2027-04-06", "2027-04-09"),
            normalize_date_range("06-09 Apr 2027"),
        )

    def test_hyphenated_job_date(self):
        self.assertEqual("2026-08-31", normalize_single_date("31-Aug-2026"))

    def test_egu_timestamp(self):
        self.assertEqual("2026-07-15", normalize_single_date("15 July 2026 14:26"))

    def test_event_candidate_enrichment(self):
        candidate = {
            "entity_type": "event",
            "data": {"date_text": "15-17 Dec 2026"},
        }
        normalized = normalize_candidate_dates(candidate)
        self.assertEqual("2026-12-15", normalized["data"]["start_date"])
        self.assertEqual("2026-12-17", normalized["data"]["end_date"])

    def test_calendar_badge_and_clean_row_share_identity(self):
        source_url = "https://www.isprs.org/calendar/2027.aspx"
        title = "JISDM 2027"
        stable_date = "14-16 Apr 2027"
        expected_key = hashlib.sha256(
            f"event|{source_url}|{title}|{stable_date}".encode("utf-8")
        ).hexdigest()

        clean = {
            "entity_type": "event",
            "external_key": "extractor-clean-key",
            "title": title,
            "source_url": source_url,
            "data": {
                "extractor": "calendar_table_v1",
                "date_text": stable_date,
                "evidence": f"{title} | Delft, The Netherlands | {stable_date}",
            },
        }
        badged = {
            "entity_type": "event",
            "external_key": "extractor-badged-key",
            "title": title,
            "source_url": source_url,
            "data": {
                "extractor": "calendar_table_v1",
                "date_text": f"{stable_date} New",
                "evidence": f"{title} | Delft, The Netherlands | {stable_date} New",
            },
        }

        normalized_clean = normalize_candidate_dates(clean)
        normalized_badged = normalize_candidate_dates(badged)

        self.assertEqual(expected_key, normalized_clean["external_key"])
        self.assertEqual(expected_key, normalized_badged["external_key"])
        self.assertEqual(stable_date, normalized_clean["data"]["date_text"])
        self.assertEqual(stable_date, normalized_badged["data"]["date_text"])
        self.assertEqual(normalized_clean["data"]["evidence"], normalized_badged["data"]["evidence"])
        self.assertEqual("2027-04-14", normalized_badged["data"]["start_date"])
        self.assertEqual("2027-04-16", normalized_badged["data"]["end_date"])

    def test_opportunity_candidate_enrichment(self):
        candidate = {
            "entity_type": "opportunity",
            "data": {
                "posted_date_text": "28-May-2026",
                "deadline_text": "31-Aug-2026",
            },
        }
        normalized = normalize_candidate_dates(candidate)
        self.assertEqual("2026-05-28", normalized["data"]["posted_date"])
        self.assertEqual("2026-08-31", normalized["data"]["deadline_date"])


if __name__ == "__main__":
    unittest.main()

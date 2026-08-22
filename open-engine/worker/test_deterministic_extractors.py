import unittest

from deterministic_extractors import extract_event_list_candidates


class EventListExtractorTests(unittest.TestCase):
    def test_geo_style_h1_event_cards(self):
        html = """
        <html>
          <head><title>Events - GEO</title></head>
          <body>
            <main>
              <h1>Events list</h1>
              <article>
                <h1>18th AOGEO Symposium</h1>
                <p>Tsukuba, Japan</p>
                <p>15-17 Dec 2026 Upcoming</p>
              </article>
              <article>
                <h1>AmeriGEO Week 2026</h1>
                <p>Guatemala</p>
                <p>30 Nov - 05 Dec 2026 Upcoming</p>
              </article>
            </main>
          </body>
        </html>
        """

        candidates = extract_event_list_candidates(
            html,
            "https://earthobservations.org/about-us/events",
        )

        self.assertEqual(2, len(candidates))
        self.assertEqual("18th AOGEO Symposium", candidates[0]["title"])
        self.assertEqual("Japan", candidates[0]["country"])
        self.assertEqual("15-17 Dec 2026", candidates[0]["data"]["date_text"])
        self.assertEqual("AmeriGEO Week 2026", candidates[1]["title"])
        self.assertEqual("Guatemala", candidates[1]["country"])
        self.assertEqual("30 Nov - 05 Dec 2026", candidates[1]["data"]["date_text"])


if __name__ == "__main__":
    unittest.main()

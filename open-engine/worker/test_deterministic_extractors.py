import unittest

from deterministic_extractors import extract_deterministic_candidates


class DeterministicExtractorTests(unittest.TestCase):
    def test_geo_style_h1_event_cards(self):
        html = """
        <html><head><title>Events - GEO</title></head><body><main>
          <h1>Events list</h1>
          <article><h1>18th AOGEO Symposium</h1><p>Tsukuba, Japan</p><p>15-17 Dec 2026 Upcoming</p></article>
          <article><h1>AmeriGEO Week 2026</h1><p>Guatemala</p><p>30 Nov - 05 Dec 2026 Upcoming</p></article>
        </main></body></html>
        """
        candidates = extract_deterministic_candidates(
            html, "https://earthobservations.org/about-us/events"
        )
        self.assertEqual(2, len(candidates))
        self.assertEqual("18th AOGEO Symposium", candidates[0]["title"])
        self.assertEqual("Japan", candidates[0]["country"])

    def test_isprs_calendar_table(self):
        html = """
        <html><body><table>
          <tr><th>Date</th><th>Event</th><th>Site</th><th>Contact</th></tr>
          <tr>
            <td>06-09 Apr 2027</td>
            <td>60th Photogrammetric Week <a href='https://example.org'>website</a></td>
            <td>Stuttgart<br/>Germany</td><td>phowo@example.org</td>
          </tr>
        </table></body></html>
        """
        candidates = extract_deterministic_candidates(
            html, "https://www.isprs.org/calendar/2027.aspx"
        )
        self.assertEqual(1, len(candidates))
        self.assertEqual("event", candidates[0]["entity_type"])
        self.assertEqual("60th Photogrammetric Week", candidates[0]["title"])
        self.assertEqual("Germany", candidates[0]["country"])
        self.assertEqual("calendar_table_v1", candidates[0]["data"]["extractor"])

    def test_event_range_with_em_dash(self):
        html = """
        <html><head><title>Events</title></head><body><main>
          <article>
            <h1>Earth Observation Symposium</h1>
            <p>Berlin, Germany</p>
            <p>30 Nov — 05 Dec 2026 Upcoming</p>
          </article>
        </main></body></html>
        """
        candidates = extract_deterministic_candidates(
            html, "https://example.org/events"
        )
        self.assertEqual(1, len(candidates))
        self.assertEqual("30 Nov — 05 Dec 2026", candidates[0]["data"]["date_text"])

    def test_isprs_job_table(self):
        html = """
        <html><head><title>ISPRS Employment Opportunities Archive</title></head><body>
        <table>
          <tr><th>Date</th><th>Contact</th><th>Job</th></tr>
          <tr>
            <td>28-May-2026</td><td>Rastislav Jakus</td>
            <td>PhD position in forest ecology and remote sensing (Slovakia)<br/>
                Location: Zvolen, Slovakia<br/>Deadline: 31-Aug-2026</td>
          </tr>
        </table></body></html>
        """
        candidates = extract_deterministic_candidates(
            html, "https://www.isprs.org/job_opportunities/default.aspx"
        )
        self.assertEqual(1, len(candidates))
        self.assertEqual("opportunity", candidates[0]["entity_type"])
        self.assertEqual("PhD position in forest ecology and remote sensing (Slovakia)", candidates[0]["title"])
        self.assertEqual("Slovakia", candidates[0]["country"])
        self.assertEqual("job_table_v1", candidates[0]["data"]["extractor"])

    def test_egu_heading_job_cards(self):
        html = """
        <html><head><title>EGU - Division on Geodesy - Jobs</title></head><body><main>
          <h2><a href='/jobs/123'>Postdoc - Global Delta Dynamics from Satellite Observations</a></h2>
          <ul>
            <li>University of Bucharest - DELTA-Hub project, Horizon Europe</li>
            <li>Bucharest, Romania</li>
            <li>15 July 2026 14:26</li>
          </ul>
          <p>The DELTA-Hub project invites applications for a two-year postdoctoral position.</p>
          <hr/>
        </main></body></html>
        """
        candidates = extract_deterministic_candidates(
            html, "https://www.egu.eu/g/jobs/"
        )
        self.assertEqual(1, len(candidates))
        self.assertEqual("opportunity", candidates[0]["entity_type"])
        self.assertEqual("Postdoc - Global Delta Dynamics from Satellite Observations", candidates[0]["title"])
        self.assertEqual("Romania", candidates[0]["country"])
        self.assertEqual("heading_job_list_v1", candidates[0]["data"]["extractor"])


if __name__ == "__main__":
    unittest.main()

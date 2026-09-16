import unittest
from datetime import date, timedelta

from ats_enrichment import GEO_TERMS, _opportunity_type, _status, _topic_names


class AtsEnrichmentTest(unittest.TestCase):
    def test_geo_scope_filter(self):
        self.assertIsNotNone(GEO_TERMS.search("PhD in InSAR deformation monitoring"))
        self.assertIsNotNone(GEO_TERMS.search("Researcher for UAV mapping and point clouds"))
        self.assertIsNone(GEO_TERMS.search("Senior payroll administrator"))

    def test_opportunity_type(self):
        self.assertEqual("phd", _opportunity_type("PhD position in remote sensing"))
        self.assertEqual("doctoral_researcher", _opportunity_type("Doctoral Researcher in GeoAI"))
        self.assertEqual("postdoc", _opportunity_type("Postdoctoral Fellow - LiDAR"))
        self.assertEqual("research_assistant", _opportunity_type("Research Assistant GIS"))
        self.assertEqual("other", _opportunity_type("Research Scientist Earth Observation"))

    def test_deadline_status(self):
        today = date.today()
        self.assertEqual("possibly_open", _status(None))
        self.assertEqual("closed", _status(today - timedelta(days=1)))
        self.assertEqual("closing_soon", _status(today + timedelta(days=7)))
        self.assertEqual("open", _status(today + timedelta(days=30)))

    def test_topics(self):
        names = _topic_names("Multimodal Earth observation with UAV mapping for urban digital twins")
        self.assertIn("Environmental Remote Sensing", names)
        self.assertIn("Multimodal Earth Observation", names)
        self.assertIn("UAV Mapping", names)
        self.assertIn("Urban Digital Twins", names)


if __name__ == "__main__":
    unittest.main()

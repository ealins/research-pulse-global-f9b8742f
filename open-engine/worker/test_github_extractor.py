
import unittest
from deterministic_extractors import extract_github_project_candidates

class GitHubExtractorTests(unittest.TestCase):
    def test_github_extraction(self):
        html = """
        <html>
        <head>
            <meta property="og:title" content="alice/geospatial-tool: A tool for mapping">
            <meta property="og:description" content="This is a great tool for doing geospatial things.">
        </head>
        <body></body>
        </html>
        """
        candidates = extract_github_project_candidates(html, "https://github.com/alice/geospatial-tool")
        self.assertEqual(len(candidates), 1)
        self.assertEqual(candidates[0]["entity_type"], "project")
        self.assertEqual(candidates[0]["title"], "A tool for mapping")
        self.assertEqual(candidates[0]["summary"], "This is a great tool for doing geospatial things.")
        self.assertEqual(candidates[0]["link_url"], "https://github.com/alice/geospatial-tool")
        
        # Test without OG tags
        html_basic = """
        <html><head><title>bob/lidar-parser: Lidar parser</title></head></html>
        """
        c2 = extract_github_project_candidates(html_basic, "https://github.com/bob/lidar-parser")
        self.assertEqual(len(c2), 1)
        self.assertEqual(c2[0]["title"], "Lidar parser")

if __name__ == "__main__":
    unittest.main()


import unittest

from exa_discovery import (
    DiscoveryQuery,
    ExaSettings,
    build_search_payload,
    canonicalize_url,
    candidate_from_result,
)


class ExaDiscoveryTests(unittest.TestCase):
    def test_canonicalize_url_removes_tracking_and_fragment(self) -> None:
        self.assertEqual(
            "https://example.edu/jobs/?position=123",
            canonicalize_url(
                "https://Example.edu/jobs/?utm_source=exa&position=123&utm_campaign=test#apply"
            ),
        )

    def test_canonicalize_url_rejects_non_public_targets(self) -> None:
        self.assertIsNone(canonicalize_url("http://127.0.0.1/admin"))
        self.assertIsNone(canonicalize_url("https://localhost/jobs"))
        self.assertIsNone(canonicalize_url("file:///etc/passwd"))

    def test_candidate_requires_a_safe_url(self) -> None:
        query = DiscoveryQuery("remote sensing positions", "opportunity", 720)
        candidate = candidate_from_result(
            {"url": "https://research.example.edu/jobs/42", "title": " PhD  in  Remote Sensing "},
            query,
        )
        self.assertIsNotNone(candidate)
        assert candidate is not None
        self.assertEqual("PhD in Remote Sensing", candidate.title)
        self.assertEqual("opportunity", candidate.entity_hint)
        self.assertIsNone(candidate_from_result({"url": "http://10.0.0.2/"}, query))

    def test_search_payload_is_bounded_and_server_side(self) -> None:
        settings = ExaSettings(
            api_key="not-used-in-unit-test",
            enabled=True,
            interval_minutes=720,
            retry_minutes=60,
            lease_minutes=20,
            max_queries=3,
            results_per_query=8,
            max_characters=800,
            timeout_seconds=20,
            search_type="auto",
            include_domains=("example.edu",),
            exclude_domains=("linkedin.com",),
        )
        payload = build_search_payload(
            settings,
            DiscoveryQuery("remote sensing positions", "opportunity", 720),
        )
        self.assertEqual("auto", payload["type"])
        self.assertEqual(8, payload["numResults"])
        self.assertEqual(800, payload["contents"]["text"]["maxCharacters"])
        self.assertEqual(["example.edu"], payload["includeDomains"])
        self.assertEqual(["linkedin.com"], payload["excludeDomains"])


if __name__ == "__main__":
    unittest.main()
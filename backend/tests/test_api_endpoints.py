import unittest
from fastapi.testclient import TestClient
from backend.main import app

class TestApiEndpoints(unittest.TestCase):

    @classmethod
    def setUpClass(cls):
        cls.client = TestClient(app)

    def test_health_check(self):
        res = self.client.get("/api/health")
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(data["status"], "healthy")
        self.assertIn("git_binary", data)

    def test_samples(self):
        res = self.client.get("/api/samples")
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertTrue(len(data) >= 3)
        self.assertEqual(data[0]["title"], "Flask")

    def test_invalid_url_400(self):
        res = self.client.post("/api/analyze", json={"repo_url": "invalid://not-github"})
        self.assertEqual(res.status_code, 400)
        self.assertIn("Invalid GitHub URL", res.json()["detail"])

    def test_inaccessible_repo_404(self):
        res = self.client.post("/api/analyze", json={"repo_url": "https://github.com/nonexistent-org-xyz123/nonexistent-repo-404"})
        self.assertEqual(res.status_code, 404)
        self.assertIn("inaccessible or does not exist", res.json()["detail"])

    def test_analyze_real_octocat_repo(self):
        # Test analyzing real public repo
        res = self.client.post("/api/analyze", json={"repo_url": "https://github.com/octocat/Hello-World"})
        self.assertEqual(res.status_code, 200)
        data = res.json()
        
        self.assertIn("overview", data)
        self.assertIn("tree", data)
        overview = data["overview"]
        self.assertEqual(overview["owner"], "octocat")
        self.assertEqual(overview["name"], "Hello-World")
        self.assertTrue(len(overview["recent_commits"]) > 0)

        # Test commit detail
        first_commit = overview["recent_commits"][0]
        c_res = self.client.get(f"/api/commit/{first_commit['hash']}")
        self.assertEqual(c_res.status_code, 200)
        c_data = c_res.json()
        self.assertIn("analysis", c_data)
        self.assertIn("file_diffs", c_data)
        self.assertIn("facts", c_data["analysis"])

        # Test file evolution for README
        evo_res = self.client.get("/api/file/evolution?path=README")
        self.assertEqual(evo_res.status_code, 200)
        evo_data = evo_res.json()
        self.assertEqual(evo_data["path"], "README")
        self.assertTrue(evo_data["total_revisions"] >= 1)
        self.assertIsNotNone(evo_data["current_content"])

        # Test detective symbols endpoint
        sym_res = self.client.get("/api/detective/symbols?path=README")
        self.assertEqual(sym_res.status_code, 200)
        sym_data = sym_res.json()
        self.assertEqual(sym_data["file_path"], "README")
        self.assertTrue(len(sym_data["symbols"]) >= 1)

        # Test detective investigate endpoint
        det_res = self.client.post("/api/detective/investigate", json={
            "file_path": "README",
            "start_line": 1,
            "end_line": 1
        })
        self.assertEqual(det_res.status_code, 200)
        det_data = det_res.json()
        self.assertIn("origin", det_data)
        self.assertIn("dna_timeline", det_data)
        self.assertIn("evidence_report", det_data)
        self.assertIn("missing_context", det_data)
        self.assertTrue(len(det_data["dna_timeline"]) >= 1)
        self.assertEqual(det_data["origin"]["short_hash"], "553c207")

if __name__ == "__main__":
    unittest.main()


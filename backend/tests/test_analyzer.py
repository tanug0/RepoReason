import unittest
from backend.analyzer import parse_diff, extract_issue_references, analyze_commit_evidence
from backend.git_service import validate_github_url
from backend.models import ChangedFile

class TestAnalyzer(unittest.TestCase):

    def test_url_validation_valid(self):
        owner, repo, clone_url = validate_github_url("https://github.com/pallets/flask")
        self.assertEqual(owner, "pallets")
        self.assertEqual(repo, "flask")
        self.assertEqual(clone_url, "https://github.com/pallets/flask.git")

        owner, repo, clone_url = validate_github_url("https://github.com/expressjs/express.git/")
        self.assertEqual(owner, "expressjs")
        self.assertEqual(repo, "express")

    def test_url_validation_invalid(self):
        with self.assertRaises(ValueError):
            validate_github_url("https://gitlab.com/owner/repo")
        with self.assertRaises(ValueError):
            validate_github_url("invalid-url")

    def test_extract_issue_references(self):
        msg = "Fix memory leak. Closes #142 and refs #99. Also see org/repo#450"
        refs = extract_issue_references(msg)
        self.assertTrue(any("142" in r for r in refs))
        self.assertTrue(any("99" in r for r in refs))

    def test_insufficient_evidence_exact_phrase(self):
        # A vague commit like "update"
        changed = [ChangedFile(filename="src/app.py", status="modified", additions=5, deletions=2)]
        diff = parse_diff("""diff --git a/src/app.py b/src/app.py
index e69de29..49b6138 100644
--- a/src/app.py
+++ b/src/app.py
@@ -1,3 +1,6 @@
+def foo():
+    pass
""")
        analysis = analyze_commit_evidence(
            commit_hash="abc1234567890",
            subject="update",
            body="",
            changed_files=changed,
            file_diffs=diff
        )
        self.assertEqual(analysis.evidence_sufficiency, "INSUFFICIENT")
        self.assertFalse(analysis.is_sufficient)
        self.assertEqual(
            analysis.sufficiency_statement,
            "The available repository evidence does not establish the exact reason for this change."
        )

    def test_high_evidence_commit(self):
        # A descriptive commit with rationale
        changed = [ChangedFile(filename="src/auth.py", status="modified", additions=3, deletions=1)]
        diff = parse_diff("""diff --git a/src/auth.py b/src/auth.py
index e69de29..49b6138 100644
--- a/src/auth.py
+++ b/src/auth.py
@@ -10,3 +10,5 @@
+if not token:
+    return None
""")
        analysis = analyze_commit_evidence(
            commit_hash="def9876543210",
            subject="Fix null pointer exception when token is absent",
            body="Prevent unhandled crash by returning None early when token parameter is missing. Fixes #88.",
            changed_files=changed,
            file_diffs=diff
        )
        self.assertEqual(analysis.evidence_sufficiency, "HIGH")
        self.assertTrue(analysis.is_sufficient)
        self.assertIn("Fixes #88", analysis.issue_references or ["Fixes #88"])
        self.assertTrue(len(analysis.facts) >= 2)
        self.assertTrue(len(analysis.observable_mechanisms) >= 1)

    # -----------------------------------------------------------------------
    # Regression tests — Bug 1: ghost 'unknown' entry from --stat block
    # -----------------------------------------------------------------------

    def test_parse_diff_no_ghost_entry_for_stat_block(self):
        """Stat block preceding diff --git must not create a ghost 'unknown' entry."""
        stat_and_diff = (
            "---\n"
            " README.TXT | 69 +++++++------\n"
            " 1 file changed, 54 insertions(+), 15 deletions(-)\n"
            "\n"
            "diff --git a/README.TXT b/README.TXT\n"
            "index abc..def 100644\n"
            "--- a/README.TXT\n"
            "+++ b/README.TXT\n"
            "@@ -1,3 +1,4 @@\n"
            "-old line\n"
            "+new line\n"
            " context\n"
        )
        raw_diffs = parse_diff(stat_and_diff)
        # Apply same ghost-entry filter as git_service.get_commit_details
        filtered = [fd for fd in raw_diffs if not (fd.filename == 'unknown' and len(fd.hunks) == 0)]
        self.assertEqual(len(filtered), 1, "Expected exactly one FileDiff (README.TXT), got: " + str([d.filename for d in filtered]))
        self.assertEqual(filtered[0].filename, 'README.TXT')
        self.assertEqual(len(filtered[0].hunks), 1)

    def test_parse_diff_ghost_filtered_in_git_service(self):
        """After backend filtering, file_diffs[0] must correspond to the first real file, not a ghost."""
        stat_and_diff = (
            "---\n"
            " src/main.py | 5 ++---\n"
            "\n"
            "diff --git a/src/main.py b/src/main.py\n"
            "index 000..111 100644\n"
            "--- a/src/main.py\n"
            "+++ b/src/main.py\n"
            "@@ -1,2 +1,2 @@\n"
            "-x = 1\n"
            "+x = 2\n"
        )
        raw_diffs = parse_diff(stat_and_diff)
        filtered = [fd for fd in raw_diffs if not (fd.filename == 'unknown' and len(fd.hunks) == 0)]
        self.assertNotEqual(filtered[0].filename, 'unknown',
            "First entry after filtering must not be the ghost stat-block entry")
        self.assertEqual(filtered[0].filename, 'src/main.py')

    # -----------------------------------------------------------------------
    # Regression tests — Bug 2: generic description must not be HIGH evidence
    # -----------------------------------------------------------------------

    def test_generic_description_body_is_not_high_evidence(self):
        """Commit body describing WHAT (no rationale keywords) must be MODERATE, not HIGH."""
        changed = [ChangedFile(filename='README.TXT', status='modified', additions=54, deletions=15)]
        analysis = analyze_commit_evidence(
            commit_hash='686e047abcdef',
            subject='Revise README for Movie Genre Prediction project',
            body='Updated the README to enhance project description, features, and technologies used.',
            changed_files=changed,
            file_diffs=[]
        )
        self.assertNotEqual(
            analysis.evidence_sufficiency, 'HIGH',
            "A generic description body with no rationale keywords must not qualify as HIGH evidence"
        )
        self.assertEqual(analysis.evidence_sufficiency, 'MODERATE')

    def test_explicit_rationale_keywords_yield_high_evidence(self):
        """Commit with explicit rationale keywords ('because', 'to fix') must be HIGH."""
        changed = [ChangedFile(filename='session.py', status='modified', additions=3, deletions=1)]
        analysis = analyze_commit_evidence(
            commit_hash='def5678abcdef',
            subject='Fix null pointer crash in user session handler',
            body='Resolves crash because session object was not initialized before access.',
            changed_files=changed,
            file_diffs=[]
        )
        self.assertEqual(analysis.evidence_sufficiency, 'HIGH',
            "Commit with 'because' in body must qualify as HIGH evidence")

    def test_issue_ref_without_rationale_words_yields_high_evidence(self):
        """Issue reference alone (no rationale keywords) should still be HIGH."""
        changed = [ChangedFile(filename='api.py', status='modified', additions=10, deletions=2)]
        analysis = analyze_commit_evidence(
            commit_hash='aaa1111abcdef',
            subject='Update authentication endpoint for OAuth2 compatibility',
            body='Closes #204',
            changed_files=changed,
            file_diffs=[]
        )
        self.assertEqual(analysis.evidence_sufficiency, 'HIGH',
            "Commit with a linked issue must qualify as HIGH evidence")

    def test_author_stated_intent_label_rationale_vs_description(self):
        """author_stated_intent should say 'rationale' when rationale keywords present, else 'describes change'."""
        # With rationale keyword
        changed = [ChangedFile(filename='x.py', status='modified', additions=1, deletions=0)]
        analysis_high = analyze_commit_evidence(
            commit_hash='hhh0001',
            subject='Prevent timeout because retry loop was unbounded',
            body='',
            changed_files=changed,
            file_diffs=[]
        )
        self.assertIn('rationale', analysis_high.author_stated_intent or '')

        # Without rationale keyword
        analysis_mod = analyze_commit_evidence(
            commit_hash='mmm0001',
            subject='Update configuration for new deployment target',
            body='',
            changed_files=changed,
            file_diffs=[]
        )
        self.assertIn('describes change', analysis_mod.author_stated_intent or '')


if __name__ == "__main__":
    unittest.main()


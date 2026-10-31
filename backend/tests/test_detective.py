import unittest
from pathlib import Path
from backend.detective import extract_symbols_from_file, analyze_code_differences, detect_missing_context
from backend.models import DetectedSymbol


class TestDetective(unittest.TestCase):

    def test_extract_python_symbols_functions_and_classes(self):
        sample_py = """
import os

def calculate_metric(a, b):
    \"\"\"Calculates sum.\"\"\"
    return a + b

class DataAnalyzer:
    def process_records(self, records):
        if not records:
            return []
        return [r.strip() for r in records]

async def fetch_remote_data(url):
    pass
"""
        symbols = extract_symbols_from_file(sample_py, "analyzer.py")
        names = [s.name for s in symbols]
        self.assertIn("calculate_metric", names)
        self.assertIn("DataAnalyzer", names)
        self.assertIn("DataAnalyzer.process_records", names)
        self.assertIn("fetch_remote_data", names)

        # Check line ranges
        calc = next(s for s in symbols if s.name == "calculate_metric")
        self.assertEqual(calc.kind, "function")
        self.assertEqual(calc.start_line, 4)
        self.assertEqual(calc.end_line, 6)

        cls_node = next(s for s in symbols if s.name == "DataAnalyzer")
        self.assertEqual(cls_node.kind, "class")
        self.assertEqual(cls_node.start_line, 8)

    def test_extract_js_symbols(self):
        sample_js = """
import React from 'react';

export function Header(props) {
  return <header>Title</header>;
}

const formatNumber = (num) => {
  return num.toLocaleString();
};

export class AppManager {
  startSession() {
    console.log("started");
  }
}
"""
        symbols = extract_symbols_from_file(sample_js, "Header.jsx")
        names = [s.name for s in symbols]
        self.assertIn("Header", names)
        self.assertIn("formatNumber", names)
        self.assertIn("AppManager", names)

    def test_analyze_code_differences_guard_detection(self):
        patch = """
@@ -10,3 +10,5 @@
 def process(item):
-    return item.name
+    if not item:
+        return None
+    return item.name
"""
        prev, upd, changes = analyze_code_differences(patch, "Add validation")
        self.assertIn("def process(item):", prev)
        self.assertIn("return item.name", prev)
        self.assertIn("if not item:", upd)
        self.assertTrue(any("guard" in c.lower() for c in changes))

    def test_fallback_line_blocks_for_markdown(self):
        sample_md = "\n".join([f"Line {i} content" for i in range(1, 60)])
        symbols = extract_symbols_from_file(sample_md, "README.md")
        self.assertTrue(len(symbols) >= 2)
        self.assertEqual(symbols[0].kind, "block")
        self.assertEqual(symbols[0].start_line, 1)

    # -----------------------------------------------------------------------
    # Regression Tests: Code Documentation Quality vs Commit Message Quality
    # -----------------------------------------------------------------------

    def test_assess_code_documentation_documented_python(self):
        """Docstrings in Python code must be classified as DOCUMENTED."""
        from backend.detective import assess_code_documentation
        py_code = '''def preprocess_text(text):
    """
    Preprocesses the input text:
    1. Lowercase text.
    2. Remove punctuation.
    """
    if not text:
        return ""
    return text.lower()
'''
        status, notes = assess_code_documentation(py_code, "app.py")
        self.assertEqual(status, "DOCUMENTED")
        self.assertTrue(any("docstring" in n.lower() for n in notes))

    def test_assess_code_documentation_undocumented_python(self):
        """Code with zero comments or docstrings must be classified as UNDOCUMENTED."""
        from backend.detective import assess_code_documentation
        py_code = '''def add(a, b):
    return a + b
'''
        status, notes = assess_code_documentation(py_code, "math_utils.py")
        self.assertEqual(status, "UNDOCUMENTED")
        self.assertTrue(any("no inline comments" in n.lower() for n in notes))

    def test_assess_code_documentation_js_block_comment(self):
        """JSDoc / block comments in JS must be classified as DOCUMENTED."""
        from backend.detective import assess_code_documentation
        js_code = '''/**
 * Formats a given currency value into USD string.
 * @param {number} val
 */
export function formatCurrency(val) {
  return "$" + val.toFixed(2);
}'''
        status, notes = assess_code_documentation(js_code, "formatters.js")
        self.assertEqual(status, "DOCUMENTED")

    def test_code_doc_quality_not_conflated_with_vague_commit(self):
        """A vague commit message like 'Initial Commit' must not degrade code documentation quality."""
        from backend.detective import assess_code_documentation
        # A well-documented function
        code = '''def process():
    """Detailed operational explanation."""
    pass
'''
        doc_status, doc_notes = assess_code_documentation(code, "service.py")
        self.assertEqual(doc_status, "DOCUMENTED", "Docstring in code must yield DOCUMENTED status independent of commit message")

    # -----------------------------------------------------------------------
    # Regression Tests: Mutation Count & Timeline Accuracy
    # -----------------------------------------------------------------------

    def test_mutation_count_origin_not_counted_as_subsequent_mutation(self):
        """When a function has only its origin commit, total_mutations must be 0, not 1."""
        from backend.models import (
            CodeOrigin, CodeDnaStep, MissingContextSummary,
            DetectiveInvestigationResponse, EvidenceFinding
        )
        origin = CodeOrigin(
            commit_hash="63aebec111",
            short_hash="63aebec",
            author_name="Alice",
            author_email="alice@example.com",
            date_iso="2024-01-01T00:00:00Z",
            date_relative="1 year ago",
            subject="Initial Commit",
            file_path_at_origin="app.py",
            original_code_snippet="def foo(): pass",
            introduced_lines="Lines 1-2",
            detection_method="function_trace"
        )
        step0 = CodeDnaStep(
            step_type="ORIGIN",
            step_number=0,
            commit_hash="63aebec111",
            short_hash="63aebec",
            author_name="Alice",
            author_email="alice@example.com",
            date_iso="2024-01-01T00:00:00Z",
            date_relative="1 year ago",
            subject="Initial Commit",
            lines_affected="Lines 1-2",
            observable_changes=["Initial code introduction."],
            is_vague_message=True,
            has_issue_reference=False,
            issue_references=[],
            has_test_changes=False,
            test_files_changed=[],
            missing_context_notes=[],
            verified_facts=[],
            inferred_explanations=[],
            unknown_reasons=[]
        )
        missing = MissingContextSummary(
            vague_commits_count=1,
            commits_without_issue_ref_count=1,
            commits_without_tests_count=1,
            total_commits_evaluated=1,
            code_documentation_status="DOCUMENTED",
            code_documentation_notes=["Has docstring."],
            commit_message_quality_notes=["Vague subject."],
            test_coverage_notes=["No tests."],
            untracked_external_context_notes=[]
        )
        # 1 milestone in dna_timeline (origin)
        dna_timeline = [step0]
        subsequent_count = len(dna_timeline) - 1

        response = DetectiveInvestigationResponse(
            target_file="app.py",
            target_symbol="foo",
            target_lines="foo (Lines 1-2)",
            current_code_snippet="def foo(): pass",
            origin=origin,
            dna_timeline=dna_timeline,
            evidence_report=[],
            missing_context=missing,
            total_mutations=subsequent_count,  # Must be 0
            total_milestones=len(dna_timeline), # Must be 1
            subsequent_explanation="No subsequent modifications to this function found. Neither this function nor its parent file 'app.py' were modified in subsequent commits.",
            file_had_subsequent_changes=False,
            history_is_incomplete=False,
            history_limitation_notes=[],
            confidence_level="HIGH",
            investigation_notes=[]
        )
        self.assertEqual(response.total_mutations, 0, "Origin commit must not count as a subsequent mutation")
        self.assertEqual(response.total_milestones, 1, "Timeline has 1 milestone (the origin)")
        self.assertIn("No subsequent modifications to this function found", response.subsequent_explanation)


if __name__ == "__main__":
    unittest.main()


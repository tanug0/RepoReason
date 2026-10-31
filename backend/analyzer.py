import re
from typing import List, Dict, Any, Optional, Tuple
try:
    from .models import EvidenceAnalysis, EvidenceCitation, ChangedFile, FileDiff, DiffHunk, DiffLine
except (ImportError, ValueError):
    from models import EvidenceAnalysis, EvidenceCitation, ChangedFile, FileDiff, DiffHunk, DiffLine

VAGUE_MESSAGES = {
    "update", "fix", "fixes", "patch", "wip", "work in progress", "changes", "misc",
    "commit", "temp", "test", "testing", "minor", "cleanup", "refactor", "bugfix",
    "modify", "small fix", "updates", "more work", "stuff", "done", "fixed"
}

def parse_diff(raw_diff: str) -> List[FileDiff]:
    """
    Parses a git unified diff output into structured FileDiff, DiffHunk, and DiffLine objects.
    """
    file_diffs: List[FileDiff] = []
    if not raw_diff:
        return file_diffs

    # Split by diff --git
    diff_sections = re.split(r'(?=^diff --git )', raw_diff, flags=re.MULTILINE)

    for section in diff_sections:
        if not section.strip():
            continue

        lines = section.splitlines()
        first_line = lines[0] if lines else ""
        header_match = re.match(r'^diff --git a/(.*?) b/(.*)$', first_line)
        
        filename = "unknown"
        old_path = None
        if header_match:
            old_path = header_match.group(1)
            filename = header_match.group(2)
        
        status = "modified"
        if "new file mode" in section:
            status = "added"
        elif "deleted file mode" in section:
            status = "deleted"
        elif "rename from" in section:
            status = "renamed"

        hunks: List[DiffHunk] = []
        additions = 0
        deletions = 0

        current_hunk_header = ""
        current_old_start = 1
        current_old_count = 0
        current_new_start = 1
        current_new_count = 0
        current_hunk_lines: List[DiffLine] = []

        old_line_ptr = 0
        new_line_ptr = 0

        for line in lines:
            if line.startswith('@@ '):
                # Save previous hunk if exists
                if current_hunk_header:
                    hunks.append(DiffHunk(
                        header=current_hunk_header,
                        old_start=current_old_start,
                        old_count=current_old_count,
                        new_start=current_new_start,
                        new_count=current_new_count,
                        lines=current_hunk_lines
                    ))
                current_hunk_header = line
                current_hunk_lines = []
                
                # Parse @@ -old_start,old_count +new_start,new_count @@
                hunk_match = re.search(r'@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@', line)
                if hunk_match:
                    current_old_start = int(hunk_match.group(1))
                    current_old_count = int(hunk_match.group(2)) if hunk_match.group(2) else 1
                    current_new_start = int(hunk_match.group(3))
                    current_new_count = int(hunk_match.group(4)) if hunk_match.group(4) else 1
                    old_line_ptr = current_old_start
                    new_line_ptr = current_new_start
            elif current_hunk_header:
                if line.startswith('+') and not line.startswith('+++'):
                    additions += 1
                    current_hunk_lines.append(DiffLine(
                        type="add",
                        old_line_number=None,
                        new_line_number=new_line_ptr,
                        content=line[1:]
                    ))
                    new_line_ptr += 1
                elif line.startswith('-') and not line.startswith('---'):
                    deletions += 1
                    current_hunk_lines.append(DiffLine(
                        type="delete",
                        old_line_number=old_line_ptr,
                        new_line_number=None,
                        content=line[1:]
                    ))
                    old_line_ptr += 1
                elif line.startswith(' '):
                    current_hunk_lines.append(DiffLine(
                        type="context",
                        old_line_number=old_line_ptr,
                        new_line_number=new_line_ptr,
                        content=line[1:]
                    ))
                    old_line_ptr += 1
                    new_line_ptr += 1

        # Push last hunk
        if current_hunk_header:
            hunks.append(DiffHunk(
                header=current_hunk_header,
                old_start=current_old_start,
                old_count=current_old_count,
                new_start=current_new_start,
                new_count=current_new_count,
                lines=current_hunk_lines
            ))

        file_diffs.append(FileDiff(
            filename=filename,
            old_path=old_path,
            status=status,
            additions=additions,
            deletions=deletions,
            hunks=hunks,
            raw_patch=section
        ))

    return file_diffs


def extract_issue_references(text: str) -> List[str]:
    """Finds issue and PR references like #123, GH-456, fixes #78."""
    patterns = [
        r'(?:fixes|closes|resolves|refs|see)?\s*#(\d+)',
        r'gh-(\d+)',
        r'([a-zA-Z0-9_\-\.]+/[a-zA-Z0-9_\-\.]+)#(\d+)'
    ]
    refs = set()
    for pat in patterns:
        matches = re.finditer(pat, text, flags=re.IGNORECASE)
        for m in matches:
            refs.add(m.group(0).strip())
    return sorted(list(refs))


def categorize_files(files: List[str]) -> List[str]:
    """Identifies categories of files changed."""
    cats = set()
    for f in files:
        fl = f.lower()
        if any(fl.endswith(ext) for ext in ['.md', '.txt', '.rst', '.adoc']):
            cats.add("Documentation")
        elif any(k in fl for k in ['test', 'spec', '__test__']):
            cats.add("Tests")
        elif any(fl.endswith(ext) for ext in ['.json', '.yaml', '.yml', '.toml', '.env', 'dockerfile', 'makefile', '.xml']):
            cats.add("Configuration & Build")
        elif any(fl.endswith(ext) for ext in ['.css', '.scss', '.sass', '.less', '.html']):
            cats.add("Styles & UI Templates")
        elif any(fl.endswith(ext) for ext in ['.py', '.js', '.jsx', '.ts', '.tsx', '.go', '.rs', '.java', '.c', '.cpp', '.rb', '.php']):
            cats.add("Core Application Logic")
        else:
            cats.add("Assets & Other")
    return sorted(list(cats))


def analyze_commit_evidence(
    commit_hash: str,
    subject: str,
    body: str,
    changed_files: List[ChangedFile],
    file_diffs: List[FileDiff]
) -> EvidenceAnalysis:
    """
    Evidence-based reasoning engine:
    - Never invent developer intent.
    - Strictly separate observable facts from interpretations.
    - If evidence is insufficient, explicitly state:
      'The available repository evidence does not establish the exact reason for this change.'
    - Provide traceable evidence citations.
    """
    full_message = f"{subject}\n\n{body}".strip()
    issue_refs = extract_issue_references(full_message)
    file_names = [f.filename for f in changed_files]
    categories = categorize_files(file_names)

    total_add = sum(f.additions for f in changed_files)
    total_del = sum(f.deletions for f in changed_files)

    # 1. Gather Observable Facts
    facts: List[str] = []
    facts.append(f"Commit {commit_hash[:7]} touched {len(changed_files)} file(s) with {total_add} line insertion(s) and {total_del} line deletion(s).")
    facts.append(f"Author-committed message: \"{subject}\"")
    if body.strip():
        facts.append(f"Extended message body contains {len(body.strip().splitlines())} line(s) of author explanation.")
    else:
        facts.append("No extended commit body was provided by the author.")

    if issue_refs:
        facts.append(f"Direct issue/PR cross-references detected: {', '.join(issue_refs)}.")

    # 2. Inspect Observable Mechanisms in the Diff
    mechanisms: List[str] = []
    evidence_citations: List[EvidenceCitation] = []

    # Check for specific patterns in added / deleted lines
    has_null_check = False
    has_error_handling = False
    has_test_addition = False
    has_config_change = False
    has_dependency_update = False
    has_function_signature_change = False

    for fd in file_diffs:
        filename = fd.filename
        sample_snippets = []

        for hunk in fd.hunks:
            for line in hunk.lines:
                content = line.content.strip()
                if not content:
                    continue

                if line.type == 'add':
                    # Guard / null check
                    if re.search(r'\b(if\s*\(|if\s+not\s+|if\s+.*===\s*null|if\s+.*===\s*undefined|\?\.)', content):
                        has_null_check = True
                        if len(sample_snippets) < 2:
                            sample_snippets.append((line.new_line_number, content, "Added conditional guard or null check"))
                    # Error handling
                    if re.search(r'\b(try\s*\{|except\s+|catch\s*\(|throw\s+new|raise\s+)', content):
                        has_error_handling = True
                        if len(sample_snippets) < 2:
                            sample_snippets.append((line.new_line_number, content, "Added exception or error handling logic"))
                    # Function declaration
                    if re.search(r'\b(def\s+\w+|function\s+\w+|const\s+\w+\s*=\s*(?:async\s*)?\()', content):
                        has_function_signature_change = True
                        if len(sample_snippets) < 2:
                            sample_snippets.append((line.new_line_number, content, "Introduced new function or callable definition"))

                # Dependency updates in manifests
                if any(pkg in filename.lower() for pkg in ['package.json', 'requirements.txt', 'cargo.toml', 'go.mod', 'pom.xml']):
                    has_dependency_update = True

        for line_no, snip, desc in sample_snippets:
            evidence_citations.append(EvidenceCitation(
                commit_hash=commit_hash[:7],
                file=f"{filename} (L{line_no})" if line_no else filename,
                snippet=snip[:120],
                observation=desc
            ))

    if has_null_check:
        mechanisms.append("Added defensive conditional guard or null/undefined verification.")
    if has_error_handling:
        mechanisms.append("Added structured exception/error handling (try/catch or raise/throw).")
    if has_dependency_update:
        mechanisms.append("Modified project package manifest or dependency specifications.")
    if has_function_signature_change:
        mechanisms.append("Introduced or restructured function/method definitions.")
    if "Tests" in categories:
        mechanisms.append("Includes test suite additions or modifications.")
    if "Configuration & Build" in categories and not has_dependency_update:
        mechanisms.append("Altered environment, toolchain, or system configuration.")
    if "Documentation" in categories:
        mechanisms.append("Updated project documentation or documentation comments.")

    if not mechanisms:
        mechanisms.append(f"Direct source modifications across {', '.join(categories[:3]) if categories else 'files'}.")

    # 3. Determine Evidence Sufficiency and Author Stated Intent
    clean_subj = subject.strip().lower()
    # Strip prefix like feat:, fix(scope):
    clean_subj_noprefix = re.sub(r'^[a-z]+(\([a-z0-9_\-\.]+\))?!?:?\s*', '', clean_subj)
    words = clean_subj_noprefix.split()

    is_vague = (
        len(words) <= 2 and (clean_subj_noprefix in VAGUE_MESSAGES or any(w in VAGUE_MESSAGES for w in words))
    ) or clean_subj_noprefix in VAGUE_MESSAGES

    # Compute rationale detection before author_stated_intent so we can label correctly
    has_rationale_words = any(w in full_message.lower() for w in ['because', 'to fix', 'to prevent', 'prevent', 'resolve', 'fix for', 'due to', 'in order to', 'replaces', 'deprecated', 'support for'])

    # Author stated intent — distinguish rationale (WHY) from description (WHAT)
    author_stated_intent: Optional[str] = None
    if not is_vague and len(clean_subj_noprefix) > 5:
        if has_rationale_words:
            author_stated_intent = f"Author states rationale: \"{subject}\""
        else:
            author_stated_intent = f"Author describes change: \"{subject}\""
        if body.strip():
            first_body_para = body.strip().split("\n\n")[0].replace("\n", " ")
            author_stated_intent += f" — Detail: \"{first_body_para[:200]}\""
    else:
        author_stated_intent = None

    # Check sufficiency
    # Evidence is sufficient if author explains the reason/rationale AND observable diff aligns.
    # Evidence is insufficient if message is vague or empty without rationale.
    has_explanatory_message = bool(author_stated_intent) and len(subject) >= 15
    # has_rationale_words already computed above

    interpretations: List[str] = []

    if is_vague or (not has_explanatory_message and not issue_refs):
        evidence_sufficiency = "INSUFFICIENT"
        is_sufficient = False
        sufficiency_statement = "The available repository evidence does not establish the exact reason for this change."
        
        interpretations.append(
            "The commit message does not articulate the underlying problem, business requirement, or bug trigger."
        )
        if total_add > total_del:
            interpretations.append(
                f"Observable code addition (+{total_add} lines) introduces new logic, but why it was requested cannot be verified solely from Git history."
            )
        elif total_del > total_add:
            interpretations.append(
                f"Observable code removal (-{total_del} lines) deletes prior logic, but whether it was dead code, deprecated, or refactored is not documented in the commit."
            )
        else:
            interpretations.append(
                "Lines were replaced in-place without explanatory commit notes."
            )

    elif has_explanatory_message and (has_rationale_words or issue_refs):
        evidence_sufficiency = "HIGH"
        is_sufficient = True
        sufficiency_statement = "High evidence: Author explicitly documented the problem or rationale, and the observed diff directly corroborates the explanation."
        
        interpretations.append(
            f"The author's documented intent to '{subject}' aligns with observed changes across {', '.join(categories)}."
        )
        if issue_refs:
            interpretations.append(
                f"Traceable to tracked issue/discussion {', '.join(issue_refs)} in the issue tracker."
            )
        if has_null_check:
            interpretations.append(
                "Added guards serve as evidence of addressing potential edge-case failures or unexpected input types."
            )

    else:
        evidence_sufficiency = "MODERATE"
        is_sufficient = True
        sufficiency_statement = "Moderate evidence: Commit summary describes what changed, but background context (such as an external incident or design meeting) is not recorded."
        
        interpretations.append(
            f"The commit summary indicates work on '{subject}', which correlates with the modified {', '.join(categories)} files."
        )
        if body.strip():
            interpretations.append(
                "The commit body describes what was changed but does not document why (no bug trigger, requirement reference, or rationale keywords detected)."
            )
        else:
            interpretations.append(
                "The diff confirms the physical mechanism, though specific reproduction steps or architectural constraints are not detailed in the commit body."
            )

    # Ensure at least one evidence citation exists
    if not evidence_citations and file_diffs:
        first_fd = file_diffs[0]
        first_hunk = first_fd.hunks[0] if first_fd.hunks else None
        first_line = first_hunk.lines[0] if (first_hunk and first_hunk.lines) else None
        snip = first_line.content if first_line else "File modified"
        evidence_citations.append(EvidenceCitation(
            commit_hash=commit_hash[:7],
            file=first_fd.filename,
            snippet=snip[:120],
            observation=f"File altered with {first_fd.additions} additions, {first_fd.deletions} deletions."
        ))

    return EvidenceAnalysis(
        evidence_sufficiency=evidence_sufficiency,
        is_sufficient=is_sufficient,
        sufficiency_statement=sufficiency_statement,
        facts=facts,
        author_stated_intent=author_stated_intent,
        observable_mechanisms=mechanisms,
        interpretations=interpretations,
        evidence_citations=evidence_citations,
        issue_references=issue_refs,
        categories=categories
    )


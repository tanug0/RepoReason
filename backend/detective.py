import os
import re
import ast
from pathlib import Path
from typing import List, Dict, Any, Optional, Tuple

try:
    from .models import (
        DetectedSymbol, FileSymbolsResponse, CodeOrigin,
        CodeDnaStep, EvidenceFinding, MissingContextSummary,
        DetectiveInvestigationResponse
    )
    from .analyzer import VAGUE_MESSAGES, extract_issue_references
    from .git_service import run_git
except (ImportError, ValueError):
    from models import (
        DetectedSymbol, FileSymbolsResponse, CodeOrigin,
        CodeDnaStep, EvidenceFinding, MissingContextSummary,
        DetectiveInvestigationResponse
    )
    from analyzer import VAGUE_MESSAGES, extract_issue_references
    from git_service import run_git


def extract_symbols_from_file(source_code: str, file_path: str) -> List[DetectedSymbol]:
    """
    Extracts functions, methods, and classes with line ranges from source code.
    Uses AST for Python files and regex for JavaScript, TypeScript, and other languages.
    Never executes repository code.
    """
    symbols: List[DetectedSymbol] = []
    lines = source_code.splitlines()
    total_lines = len(lines)
    if total_lines == 0:
        return symbols

    ext = Path(file_path).suffix.lower()

    # 1. Python AST parsing
    if ext == ".py":
        try:
            tree = ast.parse(source_code)
            for node in tree.body:
                if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
                    symbols.append(DetectedSymbol(
                        name=node.name,
                        kind="async_function" if isinstance(node, ast.AsyncFunctionDef) else "function",
                        start_line=node.lineno,
                        end_line=node.end_lineno or node.lineno,
                        signature=f"def {node.name}(...)"
                    ))
                elif isinstance(node, ast.ClassDef):
                    symbols.append(DetectedSymbol(
                        name=node.name,
                        kind="class",
                        start_line=node.lineno,
                        end_line=node.end_lineno or node.lineno,
                        signature=f"class {node.name}"
                    ))
                    for item in node.body:
                        if isinstance(item, (ast.FunctionDef, ast.AsyncFunctionDef)):
                            symbols.append(DetectedSymbol(
                                name=f"{node.name}.{item.name}",
                                kind="method",
                                start_line=item.lineno,
                                end_line=item.end_lineno or item.lineno,
                                signature=f"def {item.name}(self, ...)"
                            ))
            if symbols:
                return sorted(symbols, key=lambda s: s.start_line)
        except Exception:
            # Fall back to regex if AST fails on non-standard syntax
            pass

    # 2. JavaScript / TypeScript / JSX / TSX
    if ext in [".js", ".jsx", ".ts", ".tsx", ".mjs", ".cjs"]:
        func_patterns = [
            # export async function name(...)
            (r'^\s*(?:export\s+)?(?:default\s+)?(?:async\s+)?function\s+([A-Za-z0-9_$]+)\s*\(', "function"),
            # const name = async (...) => or function(...)
            (r'^\s*(?:export\s+)?(?:const|let|var)\s+([A-Za-z0-9_$]+)\s*=\s*(?:async\s*)?(?:\([^)]*\)|[A-Za-z0-9_$]+)\s*=>', "arrow_function"),
            # class Name
            (r'^\s*(?:export\s+)?class\s+([A-Za-z0-9_$]+)', "class"),
            # Method in class/object: name(...) {
            (r'^\s*(?:async\s+)?([A-Za-z0-9_$]+)\s*\([^)]*\)\s*\{', "method")
        ]

        for idx, line in enumerate(lines):
            line_no = idx + 1
            for pat, kind in func_patterns:
                m = re.search(pat, line)
                if m:
                    name = m.group(1)
                    if name in ["if", "for", "while", "switch", "catch"]:
                        continue
                    # Approximate end line: search for closing brace or next top-level statement
                    end_line = min(total_lines, line_no + 20)
                    brace_count = 0
                    started_brace = False
                    for scan_idx in range(idx, min(total_lines, idx + 250)):
                        brace_count += lines[scan_idx].count('{') - lines[scan_idx].count('}')
                        if '{' in lines[scan_idx]:
                            started_brace = True
                        if started_brace and brace_count <= 0:
                            end_line = scan_idx + 1
                            break

                    symbols.append(DetectedSymbol(
                        name=name,
                        kind=kind,
                        start_line=line_no,
                        end_line=max(line_no, end_line),
                        signature=line.strip()[:80]
                    ))
                    break

        if symbols:
            return sorted(symbols, key=lambda s: s.start_line)

    # 3. Generic fallback for Go, Rust, Java, C/C++, Ruby, PHP
    generic_patterns = [
        # Go: func (r *Repo) FunctionName(...)
        r'^\s*func\s+(?:\([^)]+\)\s+)?([A-Za-z0-9_]+)\s*\(',
        # Rust: pub fn function_name(...)
        r'^\s*(?:pub\s+)?fn\s+([A-Za-z0-9_]+)\s*\(',
        # Java / C++: public void functionName(...)
        r'^\s*(?:public|private|protected|static|final|\s)+\s+[A-Za-z0-9_<>,\[\]]+\s+([A-Za-z0-9_]+)\s*\(',
        # Ruby: def function_name
        r'^\s*def\s+([A-Za-z0-9_]+)',
        # PHP: function function_name(...)
        r'^\s*(?:public|private|protected)?\s*function\s+([A-Za-z0-9_]+)\s*\('
    ]

    for idx, line in enumerate(lines):
        line_no = idx + 1
        for pat in generic_patterns:
            m = re.search(pat, line)
            if m:
                name = m.group(1)
                symbols.append(DetectedSymbol(
                    name=name,
                    kind="function",
                    start_line=line_no,
                    end_line=min(total_lines, line_no + 15),
                    signature=line.strip()[:80]
                ))
                break

    # If still no symbols found (e.g. Markdown, plain text, config, or script without functions)
    if not symbols and total_lines > 0:
        step = max(20, total_lines // 5)
        for start in range(1, total_lines + 1, step):
            end = min(total_lines, start + step - 1)
            preview = lines[start - 1].strip() if start - 1 < total_lines else ""
            symbols.append(DetectedSymbol(
                name=f"Section L{start}-L{end}",
                kind="block",
                start_line=start,
                end_line=end,
                signature=preview[:60] if preview else f"Lines {start} to {end}"
            ))

    return symbols


def assess_code_documentation(source_code: str, file_path: str) -> Tuple[str, List[str]]:
    """
    Evaluates source code documentation quality directly from code syntax (docstrings, comments).
    Does NOT conflate code comments with commit messages.
    Returns (status, notes) where status is 'DOCUMENTED', 'PARTIALLY_DOCUMENTED', or 'UNDOCUMENTED'.
    """
    if not source_code or not source_code.strip():
        return "UNDOCUMENTED", ["Selected code section is empty or contains no statements."]

    ext = Path(file_path).suffix.lower()
    has_docstring = False
    comment_lines = 0
    code_lines = 0

    lines = source_code.splitlines()

    # 1. Python
    if ext == ".py":
        try:
            tree = ast.parse(source_code)
            for node in ast.walk(tree):
                if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef, ast.ClassDef, ast.Module)):
                    doc = ast.get_docstring(node)
                    if doc and doc.strip():
                        has_docstring = True
                        break
        except Exception:
            pass

        if not has_docstring and re.search(r'("""[\s\S]*?"""|\'\'\'[\s\S]*?\'\'\')', source_code):
            has_docstring = True

        for l in lines:
            stripped = l.strip()
            if stripped.startswith('#'):
                comment_lines += 1
            elif stripped:
                code_lines += 1

    # 2. JavaScript / TypeScript
    elif ext in [".js", ".jsx", ".ts", ".tsx", ".mjs", ".cjs"]:
        if re.search(r'/\*\*[\s\S]*?\*/', source_code) or re.search(r'/\*[\s\S]*?\*/', source_code):
            has_docstring = True
        for l in lines:
            stripped = l.strip()
            if stripped.startswith('//'):
                comment_lines += 1
            elif stripped:
                code_lines += 1

    else:
        for l in lines:
            stripped = l.strip()
            if stripped.startswith('//') or stripped.startswith('#') or stripped.startswith('--'):
                comment_lines += 1
            elif stripped:
                code_lines += 1
        if '/*' in source_code and '*/' in source_code:
            has_docstring = True

    notes: List[str] = []
    if has_docstring:
        status = "DOCUMENTED"
        notes.append("Source code contains descriptive documentation (docstring or block comment) explaining function behavior.")
        if comment_lines > 0:
            notes.append(f"Includes {comment_lines} additional inline comment line(s).")
    elif comment_lines >= 2:
        status = "DOCUMENTED"
        notes.append(f"Source code contains inline comments ({comment_lines} lines) clarifying implementation logic.")
    elif comment_lines == 1:
        status = "PARTIALLY_DOCUMENTED"
        notes.append("Source code has minimal inline commenting (1 line) with no docstrings.")
    else:
        status = "UNDOCUMENTED"
        notes.append("Source code contains no inline comments, docstrings, or annotations within this section.")

    return status, notes


def detect_missing_context(
    commit_hash: str,
    subject: str,
    body: str,
    repo_path: Path
) -> Tuple[bool, bool, List[str], bool, List[str], List[str]]:
    """
    Inspects commit message, linked issue/PR references, and changed test files.
    Returns:
    (is_vague, has_issue_ref, issue_refs, has_tests, test_files, missing_notes)
    """
    full_message = f"{subject}\n\n{body}".strip()
    issue_refs = extract_issue_references(full_message)
    has_issue_ref = len(issue_refs) > 0

    clean_subj = subject.strip().lower()
    clean_subj_noprefix = re.sub(r'^[a-z]+(\([a-z0-9_\-\.]+\))?!?:?\s*', '', clean_subj)
    words = clean_subj_noprefix.split()

    is_vague = (
        len(words) <= 2 and (clean_subj_noprefix in VAGUE_MESSAGES or any(w in VAGUE_MESSAGES for w in words))
    ) or clean_subj_noprefix in VAGUE_MESSAGES or len(subject.strip()) < 8

    # Check whether test files were modified in this commit
    code, out, _ = run_git(["diff-tree", "--no-commit-id", "--name-only", "-r", commit_hash], cwd=repo_path)
    test_files: List[str] = []
    if code == 0 and out.strip():
        for f in out.splitlines():
            f_clean = f.strip().lower()
            if any(k in f_clean for k in ['test', 'spec', '__test__']):
                test_files.append(f.strip())

    has_tests = len(test_files) > 0

    missing_notes: List[str] = []
    if is_vague:
        missing_notes.append(f"Vague commit message: \"{subject}\" lacks business requirement or bug trigger context.")
    if not has_issue_ref:
        missing_notes.append("No linked Issue or Pull Request cross-reference (#ID) found in commit metadata.")
    if not has_tests:
        missing_notes.append("No test files were updated or added in this commit to verify behavior.")

    missing_notes.append("Internal discussion (tickets, chat logs, code reviews) is not preserved in repository Git history.")

    return is_vague, has_issue_ref, issue_refs, has_tests, test_files, missing_notes


def analyze_code_differences(
    patch_text: str,
    commit_subject: str
) -> Tuple[str, str, List[str]]:
    """
    Extracts previous code, updated code, and observable change explanations from a patch.
    """
    prev_lines: List[str] = []
    updated_lines: List[str] = []
    observable_changes: List[str] = []

    lines = patch_text.splitlines()
    additions = 0
    deletions = 0
    has_guard = False
    has_error_handling = False
    has_return_change = False
    has_signature_change = False

    for line in lines:
        if line.startswith('@@'):
            continue
        elif line.startswith('-') and not line.startswith('---'):
            deletions += 1
            content = line[1:]
            prev_lines.append(content)
        elif line.startswith('+') and not line.startswith('+++'):
            additions += 1
            content = line[1:]
            updated_lines.append(content)
            # Detect mechanisms
            if re.search(r'\b(if\s*\(|if\s+|not\s+|\?\.|===\s*null|is\s+None)', content):
                has_guard = True
            if re.search(r'\b(try|except|catch|throw|raise|finally)\b', content):
                has_error_handling = True
            if re.search(r'\breturn\b', content):
                has_return_change = True
            if re.search(r'\b(def\s+|function\s+|const\s+\w+\s*=)', content):
                has_signature_change = True
        elif line.startswith(' '):
            content = line[1:]
            prev_lines.append(content)
            updated_lines.append(content)

    observable_changes.append(f"Code diff: +{additions} line(s) added, -{deletions} line(s) removed.")
    if has_guard:
        observable_changes.append("Introduced conditional guard / null verification check.")
    if has_error_handling:
        observable_changes.append("Added structured exception or error-handling logic.")
    if has_signature_change:
        observable_changes.append("Modified function definition or parameter signature.")
    if has_return_change:
        observable_changes.append("Altered return value or termination flow.")

    if not any([has_guard, has_error_handling, has_signature_change, has_return_change]):
        observable_changes.append(f"Direct logic modification aligning with author subject: \"{commit_subject}\".")

    prev_code = "\n".join(prev_lines).strip()
    upd_code = "\n".join(updated_lines).strip()
    return prev_code, upd_code, observable_changes


def investigate_code_dna(
    repo_path: Path,
    file_path: str,
    function_name: Optional[str] = None,
    start_line: Optional[int] = None,
    end_line: Optional[int] = None,
    custom_snippet: Optional[str] = None
) -> DetectiveInvestigationResponse:
    """
    Main Code Mystery Detective engine.
    Traces code origin, chronological mutation timeline, observable diffs,
    evidence classification (VERIFIED, INFERRED, UNKNOWN), and missing context.
    """
    clean_path = file_path.strip().lstrip("/")
    
    # 1. Fetch current file content
    code, current_content, _ = run_git(["show", f"HEAD:{clean_path}"], cwd=repo_path)
    if code != 0 or not current_content:
        raise ValueError(f"File '{clean_path}' could not be read from repository HEAD.")

    content_lines = current_content.splitlines()
    total_lines = len(content_lines)

    # 2. Determine target line range
    target_symbol = function_name
    symbols = extract_symbols_from_file(current_content, clean_path)

    if function_name and (start_line is None or end_line is None):
        # Locate function by name
        matched = next((s for s in symbols if s.name.lower() == function_name.lower()), None)
        if matched:
            start_line = matched.start_line
            end_line = matched.end_line
            target_symbol = matched.name

    if start_line is None:
        start_line = 1
    if end_line is None:
        end_line = min(total_lines, start_line + 25)

    start_line = max(1, min(start_line, total_lines))
    end_line = max(start_line, min(end_line, total_lines))

    # Current snippet
    current_snippet_lines = content_lines[start_line - 1 : end_line]
    current_code_snippet = "\n".join(current_snippet_lines)

    target_lines_desc = f"Lines {start_line}-{end_line}"
    if target_symbol:
        target_lines_desc = f"{target_symbol} ({target_lines_desc})"

    # 3. Perform Git Line Tracking using git log -L
    fmt = "COMMIT_REC%x1f%H%x1f%h%x1f%an%x1f%ae%x1f%aI%x1f%ar%x1f%s%x1fCOMMIT_PATCH"
    code, log_out, log_err = run_git([
        "log",
        f"-L{start_line},{end_line}:{clean_path}",
        f"--format={fmt}",
        "-p"
    ], cwd=repo_path)

    raw_commits: List[Dict[str, Any]] = []
    detection_method = "line_range_blame"

    if code == 0 and "COMMIT_REC\x1f" in log_out:
        detection_method = "function_trace" if function_name else "line_range_tracking"
        records = log_out.split("COMMIT_REC\x1f")
        for rec in records:
            if not rec.strip():
                continue
            parts = rec.split("\x1fCOMMIT_PATCH")
            header_part = parts[0]
            patch = parts[1].strip() if len(parts) > 1 else ""

            fields = header_part.split("\x1f")
            if len(fields) < 7:
                continue

            c_hash = fields[0].strip()
            c_short = fields[1].strip()
            c_author = fields[2].strip()
            c_email = fields[3].strip()
            c_date_iso = fields[4].strip()
            c_date_rel = fields[5].strip()
            subject = fields[6].strip()

            # Check if file was renamed at this commit
            was_renamed = False
            file_at_commit = clean_path
            rename_match = re.search(r'diff --git a/(.*?) b/(.*)', patch)
            if rename_match:
                old_p = rename_match.group(1).strip()
                new_p = rename_match.group(2).strip()
                if old_p != new_p:
                    was_renamed = True
                    file_at_commit = old_p

            raw_commits.append({
                "hash": c_hash,
                "short_hash": c_short,
                "author": c_author,
                "email": c_email,
                "date_iso": c_date_iso,
                "date_rel": c_date_rel,
                "subject": subject,
                "patch": patch,
                "file_path": file_at_commit,
                "was_renamed": was_renamed
            })

    # Fallback to git blame if git log -L did not yield results
    if not raw_commits:
        code_blame, blame_out, _ = run_git([
            "blame",
            f"-L{start_line},{end_line}",
            "--porcelain",
            "-w", "-C", "-C",
            "--",
            clean_path
        ], cwd=repo_path)

        blame_commits: Dict[str, Dict[str, Any]] = {}
        if code_blame == 0 and blame_out:
            cur_hash = None
            cur_author = "Unknown"
            cur_email = ""
            cur_summary = ""
            cur_file = clean_path

            for line in blame_out.splitlines():
                if re.match(r'^[0-9a-f]{40}\s+\d+\s+\d+', line):
                    cur_hash = line.split()[0]
                    if cur_hash not in blame_commits:
                        blame_commits[cur_hash] = {
                            "hash": cur_hash,
                            "short_hash": cur_hash[:7],
                            "author": "Unknown",
                            "email": "",
                            "date_iso": "",
                            "date_rel": "",
                            "subject": "",
                            "patch": "",
                            "file_path": clean_path,
                            "was_renamed": False
                        }
                elif line.startswith("author "):
                    if cur_hash:
                        blame_commits[cur_hash]["author"] = line[7:].strip()
                elif line.startswith("author-mail "):
                    if cur_hash:
                        blame_commits[cur_hash]["email"] = line[12:].strip("<> ")
                elif line.startswith("author-time "):
                    # timestamp
                    pass
                elif line.startswith("summary "):
                    if cur_hash:
                        blame_commits[cur_hash]["subject"] = line[8:].strip()
                elif line.startswith("filename "):
                    if cur_hash:
                        blame_commits[cur_hash]["file_path"] = line[9:].strip()

        # Sort blame commits by git log reverse
        if blame_commits:
            code_order, order_out, _ = run_git([
                "log",
                "--format=%H",
                "--",
                clean_path
            ], cwd=repo_path)
            all_ordered = [h.strip() for h in order_out.splitlines() if h.strip()]
            for h in all_ordered:
                if h in blame_commits:
                    raw_commits.append(blame_commits[h])
            # If any missed, append them
            for h, info in blame_commits.items():
                if not any(c["hash"] == h for c in raw_commits):
                    raw_commits.append(info)

    # If still empty (e.g. newly untracked file or root commit)
    if not raw_commits:
        # Get head commit
        code_head, head_out, _ = run_git(["log", "-n1", f"--format={fmt}"], cwd=repo_path)
        parts = head_out.strip().split("\x1f") if code_head == 0 else []
        c_hash = parts[0] if len(parts) > 0 else "0000000"
        c_short = parts[1] if len(parts) > 1 else "0000000"
        c_author = parts[2] if len(parts) > 2 else "Git Repository"
        c_email = parts[3] if len(parts) > 3 else ""
        c_date_iso = parts[4] if len(parts) > 4 else ""
        c_date_rel = parts[5] if len(parts) > 5 else "initial"
        c_subject = parts[6] if len(parts) > 6 else "Initial code state"

        raw_commits = [{
            "hash": c_hash,
            "short_hash": c_short,
            "author": c_author,
            "email": c_email,
            "date_iso": c_date_iso,
            "date_rel": c_date_rel,
            "subject": c_subject,
            "patch": "",
            "file_path": clean_path,
            "was_renamed": False
        }]

    # Note: git log outputs in reverse chronological order (newest first).
    # For a DNA Timeline, chronological order is:
    # index 0: ORIGIN (oldest)
    # index 1..N: Subsequent MODIFICATIONS in order
    chronological_commits = list(reversed(raw_commits))
    origin_commit = chronological_commits[0]

    # Inspect parent file-level history in Git to distinguish function vs file modifications
    code_flog, flog_out, _ = run_git(["log", "--format=%H%x1f%h%x1f%s", "--", clean_path], cwd=repo_path)
    file_commits: List[Dict[str, str]] = []
    if code_flog == 0 and flog_out.strip():
        for line in flog_out.splitlines():
            if "\x1f" in line:
                f_h, f_sh, f_s = line.split("\x1f", 2)
                file_commits.append({"hash": f_h.strip(), "short_hash": f_sh.strip(), "subject": f_s.strip()})

    raw_commit_hashes = {c["hash"] for c in raw_commits}
    other_file_commits = [fc for fc in file_commits if fc["hash"] not in raw_commit_hashes]

    # Inspect overall repository commit count
    code_rlog, rlog_out, _ = run_git(["log", "-n", "20", "--format=%H%x1f%h%x1f%s"], cwd=repo_path)
    repo_commits_count = len(rlog_out.splitlines()) if code_rlog == 0 else 0

    # Inspect repository completeness / shallow clone
    code_shallow, shallow_out, _ = run_git(["rev-parse", "--is-shallow-repository"], cwd=repo_path)
    is_shallow = (code_shallow == 0 and shallow_out.strip().lower() == "true")

    # Inspect whether origin commit has parent
    code_p, p_out, _ = run_git(["log", "--pretty=%P", "-n", "1", origin_commit["hash"]], cwd=repo_path)
    has_parent = bool(code_p == 0 and p_out.strip())

    history_limitation_notes: List[str] = []
    history_is_incomplete = False
    if is_shallow:
        history_is_incomplete = True
        history_limitation_notes.append("Shallow repository clone detected: Git history depth is limited. Earlier commits or external branches may not be present in local clone.")
    if not has_parent and origin_commit["hash"] != "0000000":
        history_limitation_notes.append(f"Commit {origin_commit['short_hash']} is the root commit of this repository branch (no previous parent history exists).")
    if detection_method == "line_range_blame":
        history_limitation_notes.append("Line history tracked via git blame fallback; intermediate non-affecting changes may be collapsed.")

    # Subsequent explanation distinguishing function vs file changes
    subsequent_count = len(chronological_commits) - 1
    if subsequent_count > 0:
        subsequent_explanation = f"The selected code was modified in {subsequent_count} subsequent commit(s)."
    else:
        if other_file_commits:
            other_shs = ", ".join(fc["short_hash"] for fc in other_file_commits[:3])
            subsequent_explanation = (
                f"No subsequent modifications to this function found. "
                f"Other parts of '{clean_path}' were modified in commit(s) {other_shs}, "
                f"but the selected code remained unchanged."
            )
        else:
            subsequent_explanation = (
                f"No subsequent modifications to this function found. "
                f"Neither this function nor its parent file '{clean_path}' were modified in subsequent commits."
            )
            if repo_commits_count > len(file_commits):
                subsequent_explanation += f" (Subsequent commits in repository history modified other files without affecting '{clean_path}')."

    # Assess source code documentation quality directly from code syntax (docstrings / comments)
    doc_status, doc_notes = assess_code_documentation(current_code_snippet, clean_path)

    # 4. Construct Origin
    # Get original code snippet from origin commit patch or initial file content
    origin_prev_code, origin_upd_code, _ = analyze_code_differences(
        origin_commit.get("patch", ""),
        origin_commit.get("subject", "")
    )
    original_snippet = origin_upd_code or current_code_snippet

    origin = CodeOrigin(
        commit_hash=origin_commit["hash"],
        short_hash=origin_commit["short_hash"],
        author_name=origin_commit["author"],
        author_email=origin_commit.get("email", ""),
        date_iso=origin_commit.get("date_iso", ""),
        date_relative=origin_commit.get("date_rel", ""),
        subject=origin_commit.get("subject", "Introduced code block"),
        body="",
        file_path_at_origin=origin_commit.get("file_path", clean_path),
        was_renamed=origin_commit.get("was_renamed", False),
        original_code_snippet=original_snippet[:1500],
        introduced_lines=f"Lines {start_line}-{end_line}",
        detection_method=detection_method
    )

    # 5. Build Chronological Code DNA Timeline Steps
    dna_steps: List[CodeDnaStep] = []
    vague_count = 0
    missing_issue_count = 0
    missing_tests_count = 0

    for idx, c in enumerate(chronological_commits):
        c_hash = c["hash"]
        c_short = c["short_hash"]
        c_subject = c.get("subject", "")
        c_patch = c.get("patch", "")

        is_origin = (idx == 0)
        step_type = "ORIGIN" if is_origin else "MODIFICATION"

        # Missing context check for commit metadata
        is_vague, has_issue_ref, issue_refs, has_tests, test_files, missing_notes = detect_missing_context(
            commit_hash=c_hash,
            subject=c_subject,
            body="",
            repo_path=repo_path
        )

        if is_vague:
            vague_count += 1
        if not has_issue_ref:
            missing_issue_count += 1
        if not has_tests:
            missing_tests_count += 1

        prev_code, upd_code, observable_changes = analyze_code_differences(c_patch, c_subject)

        # Verified facts for this step
        verified_facts: List[str] = [
            f"Commit {c_short} authored by {c['author']} on {c.get('date_rel', 'record')}.",
            f"Commit message: \"{c_subject}\"."
        ]
        if issue_refs:
            verified_facts.append(f"Linked Issue/PR: {', '.join(issue_refs)}.")
        if test_files:
            verified_facts.append(f"Test suite modified: {', '.join(test_files[:2])}.")

        # Inferred explanations
        inferred: List[str] = []
        if not is_origin:
            if "conditional guard" in " ".join(observable_changes).lower():
                inferred.append("Added defensive validation, plausibly addressing runtime edge cases or falsy inputs.")
            elif "exception" in " ".join(observable_changes).lower():
                inferred.append("Structured error recovery suggests handling expected failure modes gracefully.")
            else:
                inferred.append(f"Modifications correlate with author's task to: \"{c_subject}\".")

        # Unknown reasons
        unknowns: List[str] = []
        if is_vague:
            unknowns.append("Author used a brief/vague message; exact problem triggering this change is not documented.")
        if not has_issue_ref:
            unknowns.append("No bug report, user ticket, or pull request is cross-referenced in repository commits.")
        if not has_tests:
            unknowns.append("No automated test asserts the correctness of this specific modification.")

        dna_steps.append(CodeDnaStep(
            step_type=step_type,
            step_number=idx,
            commit_hash=c_hash,
            short_hash=c_short,
            author_name=c["author"],
            author_email=c.get("email", ""),
            date_iso=c.get("date_iso", ""),
            date_relative=c.get("date_rel", ""),
            subject=c_subject,
            body="",
            previous_code=prev_code[:1200] if prev_code else None,
            updated_code=upd_code[:1200] if upd_code else current_code_snippet[:1200],
            diff_patch=c_patch[:2000] if c_patch else None,
            lines_affected=f"Lines {start_line}-{end_line}",
            observable_changes=observable_changes,
            is_vague_message=is_vague,
            has_issue_reference=has_issue_ref,
            issue_references=issue_refs,
            has_test_changes=has_tests,
            test_files_changed=test_files,
            missing_context_notes=missing_notes,
            code_documentation_status=doc_status,
            code_documentation_notes=doc_notes,
            verified_facts=verified_facts,
            inferred_explanations=inferred,
            unknown_reasons=unknowns
        ))

    # 6. Synthesize Overall Evidence-Based Report Findings
    findings: List[EvidenceFinding] = []

    # Finding 1: Origin (VERIFIED)
    findings.append(EvidenceFinding(
        category="VERIFIED",
        badge="PROVEN ORIGIN",
        title=f"Code Introduced in Commit {origin.short_hash}",
        description=(
            f"The selected code section was introduced by author {origin.author_name} "
            f"on {origin.date_relative} ({origin.date_iso[:10] if origin.date_iso else 'recorded'}) "
            f"with message: \"{origin.subject}\"."
            + (f" Note: File was originally at '{origin.file_path_at_origin}'." if origin.was_renamed else "")
        ),
        citations=[f"{origin.file_path_at_origin}@{origin.short_hash}"]
    ))

    # Finding 2: Subsequent Changes (VERIFIED)
    if subsequent_count > 0:
        mod_hashes = ", ".join(s.short_hash for s in dna_steps[1:])
        findings.append(EvidenceFinding(
            category="VERIFIED",
            badge="EVOLUTION TRAIL",
            title=f"{subsequent_count} Subsequent Modification Commit(s) Recorded",
            description=(
                f"Tracked code was physically revised across {subsequent_count} subsequent commit(s): {mod_hashes}. "
                "Line diffs and file transitions are strictly corroborated by Git revision history."
            ),
            citations=[s.short_hash for s in dna_steps[1:]]
        ))
    else:
        findings.append(EvidenceFinding(
            category="VERIFIED",
            badge="NO SUBSEQUENT CHANGES",
            title="No Subsequent Modifications to Function",
            description=subsequent_explanation,
            citations=[origin.short_hash] + ([fc["short_hash"] for fc in other_file_commits[:2]] if other_file_commits else [])
        ))

    # Finding 3: Inferred Mechanisms (INFERRED)
    all_observable = []
    for s in dna_steps:
        all_observable.extend(s.observable_changes)

    findings.append(EvidenceFinding(
        category="INFERRED",
        badge="OBSERVABLE PATTERN",
        title="Implementation Mechanism Inferences",
        description=(
            "Observable diff inspection reveals physical source modifications: "
            + "; ".join(set(all_observable[:3]))
            + ". While the syntactic changes are verified, developer psychological motives or unstated intentions cannot be assumed."
        ),
        citations=None
    ))

    # Finding 4: Context & Quality Audit (UNKNOWN)
    audit_points = []
    # Commit message quality
    if vague_count > 0:
        audit_points.append(f"Commit message quality: {vague_count} of {len(dna_steps)} commit(s) contain terse or vague messages without explicit rationale.")
    else:
        audit_points.append("Commit message quality: Commit subjects provide descriptive context.")

    # Code documentation quality (SEPARATE from commit message quality)
    audit_points.append(f"Code documentation quality: {doc_status} ({doc_notes[0]}).")

    # Test coverage
    if missing_tests_count == len(dna_steps):
        audit_points.append("Test coverage: No automated test files were modified or added alongside this code.")
    elif missing_tests_count > 0:
        audit_points.append(f"Test coverage: {len(dna_steps) - missing_tests_count} of {len(dna_steps)} commit(s) included test modifications.")
    else:
        audit_points.append("Test coverage: Accompanying test files were detected across all revisions.")

    # External context
    if missing_issue_count == len(dna_steps):
        audit_points.append("External context: Zero commit messages cite issue/PR trackers (#ID).")
    audit_points.append("External discussions, offline planning, and business requirements remain unrecorded in Git.")

    findings.append(EvidenceFinding(
        category="UNKNOWN",
        badge="UNTRACKED CONTEXT",
        title="Context & Quality Audit",
        description=" ".join(audit_points),
        citations=None
    ))

    # 7. Missing Context Summary
    commit_msg_notes = []
    if vague_count > 0:
        commit_msg_notes.append(f"{vague_count} commit(s) contain terse/vague subjects lacking explicit bug trigger or rationale.")
    else:
        commit_msg_notes.append("Commit subjects provide descriptive summaries of work performed.")

    test_notes = []
    if missing_tests_count > 0:
        test_notes.append(f"{missing_tests_count} commit(s) did not update or add automated test files.")
    else:
        test_notes.append("Accompanying test files were detected across all revisions.")

    missing_summary = MissingContextSummary(
        vague_commits_count=vague_count,
        commits_without_issue_ref_count=missing_issue_count,
        commits_without_tests_count=missing_tests_count,
        total_commits_evaluated=len(dna_steps),
        code_documentation_status=doc_status,
        code_documentation_notes=doc_notes,
        commit_message_quality_notes=commit_msg_notes,
        test_coverage_notes=test_notes,
        untracked_external_context_notes=[
            "Pull request discussion threads and code review comments are not stored in Git history.",
            "Issue tracker ticket descriptions, reproduction steps, and screenshots are external.",
            "Developer decision-making meetings, chat messages, or internal emails are unavailable."
        ]
    )

    confidence = "HIGH" if detection_method == "function_trace" or len(dna_steps) > 0 else "MODERATE"

    investigation_notes: List[str] = [
        f"Investigation completed for '{clean_path}' ({target_lines_desc}).",
        f"Tracking mechanism: {detection_method.replace('_', ' ').capitalize()}.",
        f"Identified 1 Origin commit and {subsequent_count} subsequent modification(s) to this function.",
        subsequent_explanation,
        f"Code documentation quality assessed as {doc_status}.",
        "Findings strictly categorized into VERIFIED, INFERRED, and UNKNOWN per evidence standards."
    ]
    if history_limitation_notes:
        investigation_notes.extend([f"History limitation: {note}" for note in history_limitation_notes])

    return DetectiveInvestigationResponse(
        target_file=clean_path,
        target_symbol=target_symbol,
        target_lines=target_lines_desc,
        current_code_snippet=current_code_snippet,
        origin=origin,
        dna_timeline=dna_steps,
        evidence_report=findings,
        missing_context=missing_summary,
        total_mutations=subsequent_count,
        total_milestones=len(dna_steps),
        subsequent_explanation=subsequent_explanation,
        file_had_subsequent_changes=bool(other_file_commits),
        history_is_incomplete=history_is_incomplete,
        history_limitation_notes=history_limitation_notes,
        confidence_level=confidence,
        investigation_notes=investigation_notes
    )

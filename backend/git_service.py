import os
import re
import sys
import shutil
import hashlib
import subprocess
from pathlib import Path
from typing import List, Dict, Any, Optional, Tuple

try:
    from .models import (
        RepoOverview, CommitSummary, ChangedFile, FileTreeNode,
        FileHistoryCommit, FileEvolutionResponse, CommitDetail
    )
    from .analyzer import parse_diff, analyze_commit_evidence
except (ImportError, ValueError):
    from models import (
        RepoOverview, CommitSummary, ChangedFile, FileTreeNode,
        FileHistoryCommit, FileEvolutionResponse, CommitDetail
    )
    from analyzer import parse_diff, analyze_commit_evidence

# Cache directory inside backend/repo_cache
BASE_DIR = Path(__file__).resolve().parent
REPO_CACHE_DIR = BASE_DIR / "repo_cache"
REPO_CACHE_DIR.mkdir(parents=True, exist_ok=True)

# Candidate paths for git binary on Windows
KNOWN_GIT_PATHS = [
    r"C:\Users\dobby\AppData\Local\Microsoft\WinGet\Packages\Git.MinGit_Microsoft.Winget.Source_8wekyb3d8bbwe\cmd\git.exe",
    r"C:\Program Files\Git\cmd\git.exe",
    r"C:\Program Files\Git\bin\git.exe",
    r"C:\Program Files (x86)\Git\cmd\git.exe"
]

def find_git_binary() -> str:
    """Finds the git executable on the current system."""
    # Check standard PATH
    path_git = shutil.which("git")
    if path_git:
        return path_git
    # Check known Windows locations
    for p in KNOWN_GIT_PATHS:
        if os.path.exists(p):
            return p
    # Fallback to "git"
    return "git"

GIT_BIN = find_git_binary()


def run_git(args: List[str], cwd: Optional[Path] = None, timeout: int = 30) -> Tuple[int, str, str]:
    """
    Safely runs git command using subprocess.run with argument list.
    Avoids shell=True to prevent shell injection.
    Disables interactive credential prompts so failed/private repos fail immediately.
    """
    cmd = [GIT_BIN] + args
    git_env = os.environ.copy()
    git_env["GIT_TERMINAL_PROMPT"] = "0"
    git_env["GIT_ASKPASS"] = "echo"
    try:
        proc = subprocess.run(
            cmd,
            cwd=str(cwd) if cwd else None,
            capture_output=True,
            stdin=subprocess.DEVNULL,
            text=True,
            timeout=timeout,
            shell=False,
            encoding='utf-8',
            errors='replace',
            env=git_env
        )
        return proc.returncode, proc.stdout, proc.stderr
    except subprocess.TimeoutExpired:
        return 1, "", f"Git command timed out after {timeout} seconds."
    except Exception as e:
        return 1, "", str(e)


def validate_github_url(url: str) -> Tuple[str, str, str]:
    """
    Validates GitHub URL format and extracts owner, repo, and clean clone URL.
    Accepted formats:
    - https://github.com/owner/repo
    - https://github.com/owner/repo.git
    - http://github.com/owner/repo
    - github.com/owner/repo
    """
    clean = url.strip()
    if not clean.startswith(("http://", "https://")):
        clean = "https://" + clean
    
    pattern = r'^https?://(?:www\.)?github\.com/([A-Za-z0-9_.-]+)/([A-Za-z0-9_.-]+?)(?:\.git)?/?$'
    match = re.match(pattern, clean)
    if not match:
        raise ValueError(
            "Invalid GitHub URL. Please provide a valid public GitHub repository URL (e.g. 'https://github.com/owner/repo')."
        )
    owner = match.group(1)
    repo = match.group(2)
    normalized_url = f"https://github.com/{owner}/{repo}.git"
    return owner, repo, normalized_url


def test_repo_accessible(clone_url: str) -> bool:
    """Checks whether the remote repository exists and is publicly accessible without cloning."""
    code, out, err = run_git(["ls-remote", "--heads", clone_url], timeout=15)
    return code == 0


def get_repo_cache_path(clone_url: str, owner: str, repo: str) -> Path:
    """Generates a safe deterministic cache path for the repository."""
    url_hash = hashlib.sha256(clone_url.encode('utf-8')).hexdigest()[:12]
    safe_name = f"{owner}_{repo}_{url_hash}"
    return REPO_CACHE_DIR / safe_name


def clone_or_update_repo(clone_url: str, owner: str, repo: str) -> Path:
    """
    Clones the repository if not cached, or updates it if present.
    Uses --depth 60 for fast cloning while keeping ample commit history.
    """
    target_dir = get_repo_cache_path(clone_url, owner, repo)

    if target_dir.exists() and (target_dir / ".git").exists():
        # Already cloned, test if healthy
        code, _, _ = run_git(["status"], cwd=target_dir, timeout=10)
        if code == 0:
            return target_dir
        else:
            # Corrupted directory, remove and reclone
            shutil.rmtree(target_dir, ignore_errors=True)

    target_dir.mkdir(parents=True, exist_ok=True)
    # Clone with depth limit
    code, out, err = run_git([
        "clone",
        "--depth", "60",
        "--single-branch",
        clone_url,
        str(target_dir)
    ], timeout=60)

    if code != 0:
        shutil.rmtree(target_dir, ignore_errors=True)
        # Check error details
        if "Authentication failed" in err or "could not read Username" in err or "Repository not found" in err:
            raise RuntimeError(
                f"Repository '{owner}/{repo}' was not found or is private. Only public GitHub repositories are accessible."
            )
        raise RuntimeError(f"Failed to clone repository: {err.strip() or 'Unknown Git error'}")

    return target_dir


def get_default_branch(repo_path: Path) -> str:
    """Returns the default branch name (e.g. main, master)."""
    code, out, _ = run_git(["rev-parse", "--abbrev-ref", "HEAD"], cwd=repo_path)
    if code == 0 and out.strip():
        return out.strip()
    return "main"


def get_head_commit_sha(repo_path: Path) -> str:
    code, out, _ = run_git(["rev-parse", "HEAD"], cwd=repo_path)
    return out.strip() if code == 0 else ""


def get_commits_list(repo_path: Path, limit: int = 50) -> List[CommitSummary]:
    """Retrieves recent commits with message, author, date, hash, and file stats."""
    # Custom delimiter format: HASH%x1fSHORT%x1fNAME%x1fEMAIL%x1fDATE_ISO%x1fDATE_REL%x1fSUBJECT%x1fMESSAGE%x1e
    fmt = "%H%x1f%h%x1f%an%x1f%ae%x1f%aI%x1f%ar%x1f%s%x1f%B%x1e"
    code, out, err = run_git(["log", f"-n{limit}", f"--format={fmt}", "--shortstat"], cwd=repo_path)
    if code != 0:
        return []

    commits: List[CommitSummary] = []
    records = out.split("\x1e")

    for rec in records:
        if not rec.strip():
            continue

        parts = rec.split("\x1f")
        if len(parts) < 8:
            continue

        c_hash = parts[0].strip()
        c_short = parts[1].strip()
        c_author = parts[2].strip()
        c_email = parts[3].strip()
        c_date_iso = parts[4].strip()
        c_date_rel = parts[5].strip()
        c_subject = parts[6].strip()
        # The remainder contains the body and the trailing shortstat
        remainder = parts[7]

        # Parse shortstat from remainder: e.g. " 3 files changed, 12 insertions(+), 4 deletions(-)"
        stat_match = re.search(r'(\d+)\s+file[s]?\s+changed(?:,\s+(\d+)\s+insertion[s]?\(\+\))?(?:,\s+(\d+)\s+deletion[s]?\(-\))?', remainder)
        files_count = int(stat_match.group(1)) if stat_match and stat_match.group(1) else 1
        insertions = int(stat_match.group(2)) if stat_match and stat_match.group(2) else 0
        deletions = int(stat_match.group(3)) if stat_match and stat_match.group(3) else 0

        # Clean message body (strip the shortstat line)
        clean_msg = re.sub(r'\s*\d+\s+file[s]?\s+changed.*$', '', remainder, flags=re.MULTILINE).strip()

        commits.append(CommitSummary(
            hash=c_hash,
            short_hash=c_short,
            author_name=c_author,
            author_email=c_email,
            date_iso=c_date_iso,
            date_relative=c_date_rel,
            subject=c_subject,
            message=clean_msg,
            files_changed_count=files_count,
            insertions=insertions,
            deletions=deletions
        ))

    return commits


def get_contributors_count(repo_path: Path) -> int:
    """Estimates the number of unique contributors in the analyzed history."""
    code, out, _ = run_git(["log", "--format=%aE"], cwd=repo_path)
    if code != 0 or not out:
        return 1
    unique = set(line.strip().lower() for line in out.splitlines() if line.strip())
    return max(len(unique), 1)


def build_file_tree(repo_path: Path, max_files: int = 1000) -> Tuple[List[FileTreeNode], int]:
    """
    Builds a folder and file hierarchy tree from git repository.
    Sensible limits applied to prevent UI freezing on giant repos.
    """
    code, out, _ = run_git(["ls-tree", "-r", "--name-only", "HEAD"], cwd=repo_path)
    if code != 0 or not out:
        return [], 0

    file_paths = [p.strip() for p in out.splitlines() if p.strip() and not p.strip().startswith('.git')]
    total_files = len(file_paths)
    limited_paths = file_paths[:max_files]

    # Build nested tree
    root_dirs: Dict[str, Any] = {}

    def get_or_create_dir(path_parts: List[str], current: Dict[str, Any]) -> Dict[str, Any]:
        if not path_parts:
            return current
        head = path_parts[0]
        if head not in current:
            current[head] = {
                "name": head,
                "type": "dir",
                "children": {}
            }
        return get_or_create_dir(path_parts[1:], current[head]["children"])

    for fp in limited_paths:
        parts = fp.split('/')
        if len(parts) == 1:
            ext = os.path.splitext(parts[0])[1].lower()
            root_dirs[parts[0]] = {
                "name": parts[0],
                "path": parts[0],
                "type": "file",
                "extension": ext
            }
        else:
            dir_node = get_or_create_dir(parts[:-1], root_dirs)
            filename = parts[-1]
            ext = os.path.splitext(filename)[1].lower()
            dir_node[filename] = {
                "name": filename,
                "path": fp,
                "type": "file",
                "extension": ext
            }

    def convert_dict_to_nodes(d: Dict[str, Any], current_path: str = "") -> List[FileTreeNode]:
        nodes: List[FileTreeNode] = []
        # Sort directories first, then files alphabetically
        sorted_keys = sorted(d.keys(), key=lambda k: (0 if d[k].get("type") == "dir" else 1, k.lower()))

        for k in sorted_keys:
            val = d[k]
            path_here = f"{current_path}/{k}".lstrip("/") if current_path else k
            if val.get("type") == "dir":
                children = convert_dict_to_nodes(val["children"], path_here)
                nodes.append(FileTreeNode(
                    name=val["name"],
                    path=path_here,
                    type="dir",
                    children=children
                ))
            else:
                nodes.append(FileTreeNode(
                    name=val["name"],
                    path=val.get("path", path_here),
                    type="file",
                    extension=val.get("extension", "")
                ))
        return nodes

    tree = convert_dict_to_nodes(root_dirs)
    return tree, total_files


def get_commit_details(repo_path: Path, commit_hash: str) -> CommitDetail:
    """
    Retrieves full details of a specific commit: author, date, message,
    changed files with status and line counts, diffs, and evidence analysis.
    """
    fmt = "%H%x1f%h%x1f%an%x1f%ae%x1f%aI%x1f%ar%x1f%s%x1f%b%x1e"
    code, out, err = run_git(["show", f"--format={fmt}", "--stat", "--patch", commit_hash], cwd=repo_path)
    if code != 0:
        raise ValueError(f"Commit '{commit_hash}' not found in repository.")

    parts = out.split("\x1e")
    meta_part = parts[0]
    diff_and_stat_part = parts[1] if len(parts) > 1 else ""

    meta_fields = meta_part.split("\x1f")
    c_hash = meta_fields[0].strip()
    c_short = meta_fields[1].strip()
    c_author = meta_fields[2].strip()
    c_email = meta_fields[3].strip()
    c_date_iso = meta_fields[4].strip()
    c_date_rel = meta_fields[5].strip()
    c_subject = meta_fields[6].strip()
    c_body = meta_fields[7].strip() if len(meta_fields) > 7 else ""
    full_message = f"{c_subject}\n\n{c_body}".strip()

    # Parse changed files with name-status
    code_ns, ns_out, _ = run_git(["diff-tree", "--no-commit-id", "--name-status", "-r", commit_hash], cwd=repo_path)
    # Parse numstat
    code_num, num_out, _ = run_git(["diff-tree", "--no-commit-id", "--numstat", "-r", commit_hash], cwd=repo_path)

    stats_map: Dict[str, Tuple[int, int]] = {}
    if code_num == 0:
        for line in num_out.splitlines():
            line_parts = line.strip().split("\t")
            if len(line_parts) >= 3:
                ins = int(line_parts[0]) if line_parts[0].isdigit() else 0
                dele = int(line_parts[1]) if line_parts[1].isdigit() else 0
                file_name = line_parts[2]
                stats_map[file_name] = (ins, dele)

    changed_files: List[ChangedFile] = []
    if code_ns == 0:
        for line in ns_out.splitlines():
            line_parts = line.strip().split("\t")
            if not line_parts:
                continue
            status_code = line_parts[0]
            fname = line_parts[1] if len(line_parts) > 1 else ""
            status = "modified"
            if status_code.startswith("A"):
                status = "added"
            elif status_code.startswith("D"):
                status = "deleted"
            elif status_code.startswith("R"):
                status = "renamed"
                fname = line_parts[2] if len(line_parts) > 2 else fname

            ins, dele = stats_map.get(fname, (0, 0))
            changed_files.append(ChangedFile(
                filename=fname,
                status=status,
                additions=ins,
                deletions=dele
            ))

    # Parse diff hunks
    file_diffs = parse_diff(diff_and_stat_part)
    # Filter out ghost entries produced by the --stat block appearing before the first
    # 'diff --git' header.  Those entries have filename='unknown' and zero hunks.
    file_diffs = [fd for fd in file_diffs if not (fd.filename == 'unknown' and len(fd.hunks) == 0)]

    # If changed_files was empty from diff-tree (e.g. root commit), populate from parsed diffs
    if not changed_files and file_diffs:
        for fd in file_diffs:
            changed_files.append(ChangedFile(
                filename=fd.filename,
                status=fd.status,
                additions=fd.additions,
                deletions=fd.deletions
            ))

    # Run evidence analysis
    analysis = analyze_commit_evidence(
        commit_hash=c_hash,
        subject=c_subject,
        body=c_body,
        changed_files=changed_files,
        file_diffs=file_diffs
    )

    total_insertions = sum(f.additions for f in changed_files)
    total_deletions = sum(f.deletions for f in changed_files)

    return CommitDetail(
        hash=c_hash,
        short_hash=c_short,
        author_name=c_author,
        author_email=c_email,
        date_iso=c_date_iso,
        date_relative=c_date_rel,
        subject=c_subject,
        body=c_body,
        message=full_message,
        stats={
            "files_changed": len(changed_files),
            "insertions": total_insertions,
            "deletions": total_deletions
        },
        changed_files=changed_files,
        file_diffs=file_diffs,
        analysis=analysis
    )


def get_file_evolution(repo_path: Path, file_path: str, limit: int = 25) -> FileEvolutionResponse:
    """
    Returns the evolution history of a single file across commits:
    - Commits that modified this specific file
    - Diff of each change
    - Explanation of what each commit altered in this file
    - Current content of the file
    """
    clean_path = file_path.strip().lstrip("/")
    
    # 1. Fetch current content
    code, content_out, _ = run_git(["show", f"HEAD:{clean_path}"], cwd=repo_path)
    current_content = content_out if code == 0 else None

    # Limit file size for safety in UI
    if current_content and len(current_content) > 150000:
        current_content = current_content[:150000] + "\n\n/* [Truncated: File exceeds 150KB preview limit] */"

    # 2. Fetch history with git log --follow -p
    fmt = "%H%x1f%h%x1f%an%x1f%aI%x1f%ar%x1f%s%x1e"
    code, log_out, _ = run_git([
        "log",
        f"-n{limit}",
        "--follow",
        f"--format={fmt}",
        "-p",
        "--",
        clean_path
    ], cwd=repo_path)

    if code != 0 or not log_out:
        return FileEvolutionResponse(path=clean_path, total_revisions=0, history=[], current_content=current_content)

    history: List[FileHistoryCommit] = []
    sections = log_out.split("\x1e")

    for sec in sections:
        if not sec.strip():
            continue

        meta_and_patch = sec.split("\x1f")
        if len(meta_and_patch) < 6:
            continue

        c_hash = meta_and_patch[0].strip()
        c_short = meta_and_patch[1].strip()
        c_author = meta_and_patch[2].strip()
        c_date_iso = meta_and_patch[3].strip()
        c_date_rel = meta_and_patch[4].strip()
        # Remainder is subject + patch
        subject_and_patch = meta_and_patch[5]
        
        lines = subject_and_patch.splitlines()
        subject = lines[0].strip() if lines else ""
        patch = "\n".join(lines[1:]).strip() if len(lines) > 1 else ""

        # Count additions / deletions in this patch
        additions = 0
        deletions = 0
        for l in patch.splitlines():
            if l.startswith('+') and not l.startswith('+++'):
                additions += 1
            elif l.startswith('-') and not l.startswith('---'):
                deletions += 1

        status = "modified"
        if "new file mode" in patch:
            status = "created"
        elif "deleted file mode" in patch:
            status = "deleted"

        history.append(FileHistoryCommit(
            hash=c_hash,
            short_hash=c_short,
            author_name=c_author,
            date_iso=c_date_iso,
            date_relative=c_date_rel,
            subject=subject,
            status=status,
            additions=additions,
            deletions=deletions,
            patch=patch,
            explanation=f"{status.capitalize()} with +{additions}/-{deletions} lines."
        ))

    return FileEvolutionResponse(
        path=clean_path,
        total_revisions=len(history),
        history=history,
        current_content=current_content
    )


def get_file_content_at_revision(repo_path: Path, file_path: str, commit_sha: str = "HEAD") -> str:
    """Returns safe content of a file at a specific commit."""
    clean_path = file_path.strip().lstrip("/")
    code, out, err = run_git(["show", f"{commit_sha}:{clean_path}"], cwd=repo_path)
    if code != 0:
        raise ValueError(f"Could not load file '{clean_path}' at {commit_sha}: {err.strip()}")
    if len(out) > 200000:
        return out[:200000] + "\n\n/* [Preview truncated due to file size] */"
    return out


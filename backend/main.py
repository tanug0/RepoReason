import os
import sys
from pathlib import Path
from typing import Optional, List, Dict, Any
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

try:
    from .models import (
        AnalyzeRequest, RepoOverview, CommitSummary, CommitDetail,
        FileTreeNode, FileEvolutionResponse, SampleRepo,
        FileSymbolsResponse, DetectiveInvestigationRequest, DetectiveInvestigationResponse
    )
    from .git_service import (
        validate_github_url, test_repo_accessible, clone_or_update_repo,
        get_default_branch, get_head_commit_sha, get_commits_list,
        get_contributors_count, build_file_tree, get_commit_details,
        get_file_evolution, get_file_content_at_revision, GIT_BIN, run_git
    )
    from .detective import extract_symbols_from_file, investigate_code_dna
except (ImportError, ValueError):
    from models import (
        AnalyzeRequest, RepoOverview, CommitSummary, CommitDetail,
        FileTreeNode, FileEvolutionResponse, SampleRepo,
        FileSymbolsResponse, DetectiveInvestigationRequest, DetectiveInvestigationResponse
    )
    from git_service import (
        validate_github_url, test_repo_accessible, clone_or_update_repo,
        get_default_branch, get_head_commit_sha, get_commits_list,
        get_contributors_count, build_file_tree, get_commit_details,
        get_file_evolution, get_file_content_at_revision, GIT_BIN, run_git
    )
    from detective import extract_symbols_from_file, investigate_code_dna

app = FastAPI(
    title="RepoReason API",
    description="Analyze GitHub repositories and explain code evolution with traceable evidence.",
    version="1.0.0"
)

# Enable CORS for frontend development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Active state tracking
state: Dict[str, Any] = {
    "active_repo_path": None,
    "active_overview": None,
    "active_tree": None,
    "repo_map": {}  # Maps safe_id to repo_path for multi-repo caching
}

SAMPLE_REPOS: List[SampleRepo] = [
    SampleRepo(
        title="Flask",
        description="Lightweight Python WSGI web application framework",
        url="https://github.com/pallets/flask",
        suggested_files=["src/flask/app.py", "src/flask/blueprints.py", "README.md"]
    ),
    SampleRepo(
        title="Express",
        description="Fast, unopinionated, minimalist web framework for Node.js",
        url="https://github.com/expressjs/express",
        suggested_files=["lib/express.js", "lib/application.js", "package.json"]
    ),
    SampleRepo(
        title="Hello World (Octocat)",
        description="Official GitHub starter repo for rapid validation",
        url="https://github.com/octocat/Hello-World",
        suggested_files=["README"]
    ),
    SampleRepo(
        title="Axios",
        description="Promise based HTTP client for the browser and node.js",
        url="https://github.com/axios/axios",
        suggested_files=["lib/axios.js", "lib/core/Axios.js", "package.json"]
    )
]


@app.get("/api/health")
def health_check():
    code, out, _ = run_git(["--version"])
    return {
        "status": "healthy",
        "service": "RepoReason API",
        "python_version": sys.version,
        "git_binary": GIT_BIN,
        "git_version": out.strip() if code == 0 else "Unavailable"
    }


@app.get("/api/samples", response_model=List[SampleRepo])
def get_sample_repositories():
    return SAMPLE_REPOS


@app.post("/api/analyze")
def analyze_repository(req: AnalyzeRequest):
    """
    Validates repository URL, clones or updates local repository cache,
    and returns repository overview and initial commit & file tree data.
    """
    try:
        owner, repo, clone_url = validate_github_url(req.repo_url)
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))

    # Test accessibility
    if not test_repo_accessible(clone_url):
        raise HTTPException(
            status_code=404,
            detail=f"Repository '{owner}/{repo}' is inaccessible or does not exist. Ensure the repository is public and the URL is spelled correctly."
        )

    try:
        repo_path = clone_or_update_repo(clone_url, owner, repo)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    # Extract git overview
    default_branch = get_default_branch(repo_path)
    head_sha = get_head_commit_sha(repo_path)
    commits = get_commits_list(repo_path, limit=50)
    tree, total_files = build_file_tree(repo_path, max_files=1500)
    contributors = get_contributors_count(repo_path)

    overview = RepoOverview(
        repo_url=req.repo_url,
        owner=owner,
        name=repo,
        default_branch=default_branch,
        head_commit=head_sha,
        commit_count=len(commits),
        file_count=total_files,
        contributors_count=contributors,
        recent_commits=commits
    )

    # Cache state
    state["active_repo_path"] = repo_path
    state["active_overview"] = overview
    state["active_tree"] = tree
    repo_key = f"{owner}/{repo}"
    state["repo_map"][repo_key] = repo_path

    return {
        "overview": overview,
        "tree": tree
    }


@app.get("/api/overview")
def get_current_overview():
    if not state.get("active_overview"):
        raise HTTPException(status_code=400, detail="No repository has been analyzed yet.")
    return state["active_overview"]


@app.get("/api/tree")
def get_file_tree():
    if not state.get("active_tree"):
        raise HTTPException(status_code=400, detail="No repository active.")
    return state["active_tree"]


@app.get("/api/commits", response_model=List[CommitSummary])
def get_commits(limit: int = Query(50, ge=1, le=100)):
    repo_path = state.get("active_repo_path")
    if not repo_path or not repo_path.exists():
        raise HTTPException(status_code=400, detail="No repository currently analyzed.")
    return get_commits_list(repo_path, limit=limit)


@app.get("/api/commit/{commit_hash}", response_model=CommitDetail)
def get_commit_detail(commit_hash: str):
    repo_path = state.get("active_repo_path")
    if not repo_path or not repo_path.exists():
        raise HTTPException(status_code=400, detail="No repository currently analyzed.")
    try:
        detail = get_commit_details(repo_path, commit_hash)
        return detail
    except ValueError as ve:
        raise HTTPException(status_code=404, detail=str(ve))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to inspect commit: {str(e)}")


@app.get("/api/file/evolution", response_model=FileEvolutionResponse)
def get_file_evolution_endpoint(path: str = Query(..., description="Relative file path")):
    repo_path = state.get("active_repo_path")
    if not repo_path or not repo_path.exists():
        raise HTTPException(status_code=400, detail="No repository currently analyzed.")
    try:
        return get_file_evolution(repo_path, path)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to analyze file evolution: {str(e)}")


@app.get("/api/file/content")
def get_file_content_endpoint(
    path: str = Query(..., description="File path"),
    commit: Optional[str] = Query("HEAD", description="Commit SHA or branch")
):
    repo_path = state.get("active_repo_path")
    if not repo_path or not repo_path.exists():
        raise HTTPException(status_code=400, detail="No repository currently analyzed.")
    try:
        content = get_file_content_at_revision(repo_path, path, commit_sha=commit or "HEAD")
        return {"path": path, "commit": commit, "content": content}
    except Exception as e:
        raise HTTPException(status_code=404, detail=str(e))


# ==============================================================================
# Code Mystery Detective Endpoints
# ==============================================================================

@app.get("/api/detective/symbols", response_model=FileSymbolsResponse)
def get_file_symbols_endpoint(path: str = Query(..., description="File path in repository")):
    """
    Extracts functions, methods, and classes with line ranges from the active repository file.
    """
    repo_path = state.get("active_repo_path")
    if not repo_path or not repo_path.exists():
        raise HTTPException(status_code=400, detail="No repository currently analyzed.")
    try:
        content = get_file_content_at_revision(repo_path, path, commit_sha="HEAD")
        symbols = extract_symbols_from_file(content, path)
        lines = content.splitlines()
        preview = "\n".join(lines[:40]) if lines else ""
        return FileSymbolsResponse(
            file_path=path,
            symbols=symbols,
            total_lines=len(lines),
            preview_content=preview
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to scan symbols: {str(e)}")


@app.post("/api/detective/investigate", response_model=DetectiveInvestigationResponse)
def investigate_code_endpoint(req: DetectiveInvestigationRequest):
    """
    Code Mystery Detective: traces code origin, chronological mutation timeline,
    observable diff mechanisms, missing context flags, and empirical evidence report.
    """
    repo_path = state.get("active_repo_path")
    if not repo_path or not repo_path.exists():
        raise HTTPException(status_code=400, detail="No repository currently analyzed.")

    try:
        return investigate_code_dna(
            repo_path=repo_path,
            file_path=req.file_path,
            function_name=req.function_name,
            start_line=req.start_line,
            end_line=req.end_line,
            custom_snippet=req.custom_snippet
        )
    except ValueError as ve:
        raise HTTPException(status_code=404, detail=str(ve))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Detective investigation failed: {str(e)}")



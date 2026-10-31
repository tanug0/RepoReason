from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field

class AnalyzeRequest(BaseModel):
    repo_url: str = Field(..., description="Public GitHub repository URL (e.g. https://github.com/owner/repo)")

class CommitSummary(BaseModel):
    hash: str
    short_hash: str
    author_name: str
    author_email: str
    date_iso: str
    date_relative: str
    subject: str
    message: str
    files_changed_count: int
    insertions: int
    deletions: int

class ChangedFile(BaseModel):
    filename: str
    old_path: Optional[str] = None
    new_path: Optional[str] = None
    status: str  # 'added', 'modified', 'deleted', 'renamed'
    additions: int
    deletions: int
    patch: Optional[str] = None

class DiffLine(BaseModel):
    type: str  # 'add', 'delete', 'context', 'header'
    old_line_number: Optional[int] = None
    new_line_number: Optional[int] = None
    content: str

class DiffHunk(BaseModel):
    header: str
    old_start: int
    old_count: int
    new_start: int
    new_count: int
    lines: List[DiffLine]

class FileDiff(BaseModel):
    filename: str
    old_path: Optional[str] = None
    status: str
    additions: int
    deletions: int
    hunks: List[DiffHunk]
    raw_patch: str

class EvidenceCitation(BaseModel):
    commit_hash: str
    file: str
    snippet: str
    observation: str

class EvidenceAnalysis(BaseModel):
    evidence_sufficiency: str  # 'HIGH', 'MODERATE', 'INSUFFICIENT'
    is_sufficient: bool
    sufficiency_statement: str
    facts: List[str]
    author_stated_intent: Optional[str]
    observable_mechanisms: List[str]
    interpretations: List[str]
    evidence_citations: List[EvidenceCitation]
    issue_references: List[str]
    categories: List[str]

class CommitDetail(BaseModel):
    hash: str
    short_hash: str
    author_name: str
    author_email: str
    date_iso: str
    date_relative: str
    subject: str
    body: str
    message: str
    stats: Dict[str, Any]
    changed_files: List[ChangedFile]
    file_diffs: List[FileDiff]
    analysis: EvidenceAnalysis

class FileTreeNode(BaseModel):
    name: str
    path: str
    type: str  # 'file' or 'dir'
    size: Optional[int] = 0
    extension: Optional[str] = ""
    children: Optional[List["FileTreeNode"]] = None

FileTreeNode.model_rebuild()

class RepoOverview(BaseModel):
    repo_url: str
    owner: str
    name: str
    default_branch: str
    head_commit: str
    commit_count: int
    file_count: int
    contributors_count: int
    recent_commits: List[CommitSummary]

class FileHistoryCommit(BaseModel):
    hash: str
    short_hash: str
    author_name: str
    date_iso: str
    date_relative: str
    subject: str
    status: str
    additions: int
    deletions: int
    patch: str
    explanation: Optional[str] = None

class FileEvolutionResponse(BaseModel):
    path: str
    total_revisions: int
    current_content: Optional[str] = None
    history: List[FileHistoryCommit]

class SampleRepo(BaseModel):
    title: str
    description: str
    url: str
    suggested_files: List[str]


# ==============================================================================
# Code Mystery Detective Models
# ==============================================================================

class DetectedSymbol(BaseModel):
    name: str
    kind: str  # 'function', 'async_function', 'class', 'method', 'variable', 'block'
    start_line: int
    end_line: int
    signature: Optional[str] = None

class FileSymbolsResponse(BaseModel):
    file_path: str
    symbols: List[DetectedSymbol]
    total_lines: int
    preview_content: Optional[str] = None

class CodeOrigin(BaseModel):
    commit_hash: str
    short_hash: str
    author_name: str
    author_email: str
    date_iso: str
    date_relative: str
    subject: str
    body: Optional[str] = ""
    file_path_at_origin: str
    was_renamed: bool = False
    original_code_snippet: str
    introduced_lines: str  # e.g. "Lines 27-38"
    detection_method: str  # 'function_trace' or 'line_range_blame'

class CodeDnaStep(BaseModel):
    step_type: str  # 'ORIGIN' | 'MODIFICATION' | 'CURRENT'
    step_number: int  # 0 for origin, 1..N for modifications
    commit_hash: str
    short_hash: str
    author_name: str
    author_email: str
    date_iso: str
    date_relative: str
    subject: str
    body: Optional[str] = ""
    previous_code: Optional[str] = None
    updated_code: Optional[str] = None
    diff_patch: Optional[str] = None
    lines_affected: str
    observable_changes: List[str]
    # Missing Context for this step
    is_vague_message: bool
    has_issue_reference: bool
    issue_references: List[str]
    has_test_changes: bool
    test_files_changed: List[str]
    missing_context_notes: List[str]
    code_documentation_status: Optional[str] = None
    code_documentation_notes: Optional[List[str]] = []
    # Evidence categorization for this step
    verified_facts: List[str]
    inferred_explanations: List[str]
    unknown_reasons: List[str]

class EvidenceFinding(BaseModel):
    category: str  # 'VERIFIED' | 'INFERRED' | 'UNKNOWN'
    badge: str
    title: str
    description: str
    citations: Optional[List[str]] = None

class MissingContextSummary(BaseModel):
    vague_commits_count: int
    commits_without_issue_ref_count: int
    commits_without_tests_count: int
    total_commits_evaluated: int = 1
    code_documentation_status: str = "UNDOCUMENTED"  # 'DOCUMENTED' | 'PARTIALLY_DOCUMENTED' | 'UNDOCUMENTED'
    code_documentation_notes: List[str] = []
    commit_message_quality_notes: List[str] = []
    test_coverage_notes: List[str] = []
    untracked_external_context_notes: List[str]

class DetectiveInvestigationRequest(BaseModel):
    file_path: str
    function_name: Optional[str] = None
    start_line: Optional[int] = None
    end_line: Optional[int] = None
    custom_snippet: Optional[str] = None

class DetectiveInvestigationResponse(BaseModel):
    target_file: str
    target_symbol: Optional[str] = None
    target_lines: str
    current_code_snippet: str
    origin: CodeOrigin
    dna_timeline: List[CodeDnaStep]
    evidence_report: List[EvidenceFinding]
    missing_context: MissingContextSummary
    total_mutations: int  # Subsequent modifications count (0 if unchanged since origin)
    total_milestones: int = 1  # Total milestones in timeline (origin + subsequent modifications)
    subsequent_explanation: Optional[str] = None  # Clear explanation distinguishing function vs file changes
    file_had_subsequent_changes: bool = False
    history_is_incomplete: bool = False
    history_limitation_notes: List[str] = []
    confidence_level: str  # 'HIGH' | 'MODERATE' | 'CAUTION_APPROXIMATE'
    investigation_notes: List[str]



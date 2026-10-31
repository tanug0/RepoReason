# RepoReason
### Understand Why Code Changed — With Git Evidence.

RepoReason is a Git-based code evolution analysis tool that helps developers explore how code has changed over time and investigate the history of specific code sections.

It analyzes available Git history, commit messages, and code diffs to provide a structured view of repository changes. Developers can explore commits, inspect modified files, and investigate selected functions or code ranges where supported.

Rather than guessing developer intentions, RepoReason aims to distinguish between verified facts, reasonable inferences, and information that remains unknown.

---

## Project Preview

### Main Dashboard

<img width="1916" height="906" alt="dashboard png" src="https://github.com/user-attachments/assets/75fca7f6-e007-49f6-bc61-3b5f7da20ee2" />


### Code Mystery Detective

<img width="1917" height="903" alt="code-detective png" src="https://github.com/user-attachments/assets/fa5b8078-57ff-4866-bdd6-e8ca838d4476" />


### Evidence-Based Report

<img width="1917" height="901" alt="evidence-report png" src="https://github.com/user-attachments/assets/b6e3b391-575a-45b4-825d-56669434ec13" />


---

## The Problem

Understanding an unfamiliar codebase is challenging, especially when developers need to investigate:

- Where a particular function originally came from.
- How a piece of code evolved across commits.
- What exactly changed between different versions.
- Which files and functions were affected by a commit.
- Whether the available Git history provides enough context to explain a change.

Developers often have to manually navigate commit histories, inspect diffs, and compare previous versions to understand code evolution.

## Our Solution

RepoReason simplifies code history investigation by analyzing Git repository data and presenting code evolution in a structured interface.

It helps developers trace code origins, inspect historical changes, compare code versions, and understand the evidence available behind those changes.

**Our core principle: Explain what the evidence supports. Never invent what the history does not reveal.**

---

## Key Features

### 1. Repository Analysis

- Analyze public GitHub repositories.
- View repository overview and file structure.
- Explore commit history.
- Identify changed files and commit statistics.

### 2. Commit Diff Viewer

- Inspect additions and deletions in commits.
- Compare previous and current code.
- Examine file-level changes.
- Identify text and binary file differences.

### 3. File Evolution

- Explore the history of individual files.
- Track changes across available commits.
- Inspect historical file versions where supported.
- Understand how files evolved through Git history.

### 4. Code Mystery Detective

Investigate the history of a selected function or custom code range.

- Detect supported functions and code symbols.
- Explore the earliest identifiable occurrence in available Git history.
- Inspect relevant historical modifications.
- Compare previous and current code where supported.
- Review available evidence behind code changes.

Function detection and historical tracking may vary depending on programming language and repository history.

### 5. Evidence-Based Reports

RepoReason uses an evidence classification approach to organize investigation findings:

| Category | Meaning |
|---|---|
| VERIFIED | Directly supported by available Git evidence. |
| INFERRED | A possible interpretation based on observed changes. |
| UNKNOWN | Information that cannot be established from available evidence. |

This approach is designed to prevent unsupported claims about developer intent. Evidence reporting is currently under development.

### 6. Missing Context Detection (Experimental)

RepoReason aims to highlight potential gaps in repository history, such as:

- Vague commit messages.
- Missing issue or pull request references.
- Limited test-related changes.

These indicators require further investigation and do not establish poor code quality.

---

## Code Mystery Detective

Code Mystery Detective is an experimental feature of RepoReason designed to investigate the history of a selected function or custom code range.

Depending on available Git history and language support, the investigation can help developers:

- Explore the earliest identifiable code occurrence.
- Inspect relevant historical commits.
- Compare available code versions.
- Review function-level modification history.
- Examine evidence associated with code changes.

The feature is under development, and results may vary depending on repository history and code extraction support.

---

## Evidence Classification

RepoReason follows an evidence-first approach:

| Evidence Type | Description |
|---|---|
| VERIFIED | Information directly supported by Git history, diffs, or other available evidence. |
| INFERRED | Interpretations derived from observable changes but not explicitly confirmed. |
| UNKNOWN | Information that cannot be reliably determined from the available repository data. |

A commit message may describe what changed, but it does not necessarily explain why the developer made that change.

RepoReason keeps this distinction clear.

---

## How It Works

1. **Enter Repository URL:** Provide the URL of a public GitHub repository.
2. **Analyze Repository:** RepoReason retrieves and analyzes the available Git history.
3. **Explore Commits:** Inspect commit messages, changed files, and code differences.
4. **Select Code:** Choose a function or manually specify a code range.
5. **Investigate Evolution:** Explore the selected code's available origin and historical modifications where supported.
6. **Review Evidence:** Examine available findings classified as verified, inferred, or unknown.

---

## Technology Stack

### Frontend

- React
- Vite
- Tailwind CSS
- JavaScript

### Backend

- Python
- FastAPI
- GitPython
- Git CLI

### Code Analysis

- Python AST
- Regex-based symbol extraction
- Git commit history
- Git diff analysis
- Git blame (where implemented)
- Function-level history analysis (experimental)

---

## System Architecture

```text
                  User
                   |
                   v
          React + Vite Frontend
                   |
                   v
              FastAPI Backend
                   |
                   v
          Git Repository Analysis
                   |
             +-----+------+
             |     |      |
             v     v      v
           Commits Diffs Blame
             |     |      |
             +-----+------+
                   |
                   v
          Code Evolution Analysis
                   |
             +-----+------+
             |            |
             v            v
          Code Origin  Evidence Report
             |            |
             +------+-----+
                    |
                    v
             Frontend Results
```

---

## Project Structure

```text
RepoReason/
│
├── backend/
│   ├── main.py
│   ├── analyzer.py
│   ├── detective.py
│   ├── git_service.py
│   ├── models.py
│   └── requirements.txt
│
├── frontend/
│   ├── public/
│   ├── src/
│   │   ├── components/
│   │   ├── App.jsx
│   │   └── ...
│   └── package.json
│
├── docs/
│   └── screenshots/
│       ├── dashboard.png
│       ├── code-detective.png
│       └── evidence-report.png
│
└── README.md
```

---

## Getting Started

Follow these instructions to run RepoReason locally.

### Prerequisites

Make sure you have the following installed:

- Python 3.12 or later
- Node.js and npm
- Git

### 1. Clone the Repository

```bash
git clone https://github.com/tanug0/RepoReason.git
cd RepoReason
```

### 2. Set Up the Backend

Navigate to the backend directory:

```bash
cd backend
```

Create a virtual environment:

```bash
python -m venv venv
```

Activate the virtual environment.

**Windows PowerShell:**

```powershell
.\venv\Scripts\Activate.ps1
```

Install the required dependencies:

```bash
pip install -r requirements.txt
```

Start the backend server:

```bash
python -m uvicorn main:app --reload
```

Backend URL:

http://127.0.0.1:8000

API documentation:

http://127.0.0.1:8000/docs

### 3. Set Up the Frontend

Open a separate terminal and navigate to the frontend directory:

```bash
cd frontend
```

Install dependencies:

```bash
npm install
```

Start the frontend development server:

```bash
npm run dev
```

Frontend URL:

http://localhost:5173

Keep both backend and frontend servers running while using the application.

---

## Current Limitations

- Repository analysis depends on the Git history available to the application.
- Shallow cloning may prevent identification of the actual earliest origin of older code.
- Developer intention cannot always be established from commit messages or code changes.
- Function detection and history tracking may vary across programming languages.
- Function tracking across extensive refactoring, renaming, or code movement may have limitations.
- The current prototype is designed around public GitHub repositories.
- Some investigation and evidence-reporting capabilities are still experimental and may not work consistently across all repositories.

---

## Future Scope

- Broader programming language support.
- Improved function tracking across renames and refactoring.
- Integration of issue and pull request context.
- Enhanced code relationship and dependency analysis.
- More advanced historical code investigation.
- Improved handling of complex repository histories.

---

## Project Status

RepoReason is an actively developed prototype for HackFront India 2026 under the AI and Developer Tools track. Core repository exploration, commit history, and code diff functionality are implemented. Code Mystery Detective and evidence reporting are under development, with functionality depending on repository history and language-specific code extraction.

---

## Team

**Team DevCrew**

Built as a collaborative project focused on making code history easier to investigate and understand.

---

## Core Philosophy

**Code tells you what changed. Git history provides evidence of how it changed. RepoReason helps connect the two.**

---

const API_BASE = '/api';

export async function checkHealth() {
  const res = await fetch(`${API_BASE}/health`);
  if (!res.ok) throw new Error('Backend health check failed');
  return res.json();
}

export async function getSampleRepos() {
  const res = await fetch(`${API_BASE}/samples`);
  if (!res.ok) throw new Error('Failed to fetch sample repositories');
  return res.json();
}

export async function analyzeRepository(repoUrl) {
  const res = await fetch(`${API_BASE}/analyze`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ repo_url: repoUrl }),
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || `Analysis failed (${res.status})`);
  }
  return res.json();
}

export async function getCommits(limit = 50) {
  const res = await fetch(`${API_BASE}/commits?limit=${limit}`);
  if (!res.ok) throw new Error('Failed to fetch commits');
  return res.json();
}

export async function getCommitDetail(commitHash) {
  const res = await fetch(`${API_BASE}/commit/${commitHash}`);
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || 'Failed to fetch commit detail');
  }
  return res.json();
}

export async function getFileTree() {
  const res = await fetch(`${API_BASE}/tree`);
  if (!res.ok) throw new Error('Failed to fetch file tree');
  return res.json();
}

export async function getFileEvolution(path) {
  const res = await fetch(`${API_BASE}/file/evolution?path=${encodeURIComponent(path)}`);
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || 'Failed to fetch file evolution');
  }
  return res.json();
}

export async function getFileContent(path, commit = 'HEAD') {
  const res = await fetch(
    `${API_BASE}/file/content?path=${encodeURIComponent(path)}&commit=${encodeURIComponent(commit)}`
  );
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || 'Failed to fetch file content');
  }
  return res.json();
}

export async function getFileSymbols(path) {
  const res = await fetch(`${API_BASE}/detective/symbols?path=${encodeURIComponent(path)}`);
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || 'Failed to fetch file symbols');
  }
  return res.json();
}

export async function investigateCode({
  file_path,
  function_name = null,
  start_line = null,
  end_line = null,
  custom_snippet = null
}) {
  const res = await fetch(`${API_BASE}/detective/investigate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      file_path,
      function_name,
      start_line,
      end_line,
      custom_snippet
    })
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || 'Code investigation failed');
  }
  return res.json();
}



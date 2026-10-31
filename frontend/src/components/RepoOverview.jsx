import React, { useState } from 'react';
import {
  GitCommit,
  GitBranch,
  FolderGit2,
  Users,
  Copy,
  Check,
  ExternalLink,
  Code2,
  Clock,
  Sparkles,
  Layers,
  FileSearch
} from 'lucide-react';

export default function RepoOverview({ overview, activeTab, onTabChange }) {
  const [copiedSha, setCopiedSha] = useState(false);

  if (!overview) return null;

  const handleCopySha = () => {
    if (overview.head_commit) {
      navigator.clipboard.writeText(overview.head_commit);
      setCopiedSha(true);
      setTimeout(() => setCopiedSha(false), 2000);
    }
  };

  const githubUrl = overview.repo_url.replace(/\.git$/, '');

  return (
    <div className="bg-slate-900/60 border-b border-slate-800/80 px-4 py-3 sm:px-6">
      <div className="max-w-7xl mx-auto flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        
        {/* Repo title & link */}
        <div className="flex items-center space-x-3">
          <div className="p-2 rounded-lg bg-slate-800/80 border border-slate-700/60">
            <FolderGit2 className="w-5 h-5 text-indigo-400" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h2 className="text-base font-semibold text-white tracking-tight">
                <span className="text-slate-400">{overview.owner} / </span>
                <span className="text-indigo-300 font-bold">{overview.name}</span>
              </h2>
              <a
                href={githubUrl}
                target="_blank"
                rel="noreferrer"
                className="text-slate-500 hover:text-slate-300 transition"
                title="Open on GitHub"
              >
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
            <div className="flex items-center space-x-3 mt-1 text-xs text-slate-400">
              <span className="flex items-center gap-1">
                <GitBranch className="w-3.5 h-3.5 text-cyan-400" />
                <span className="font-mono text-slate-300">{overview.default_branch}</span>
              </span>
              <span className="text-slate-600">•</span>
              <button
                onClick={handleCopySha}
                className="flex items-center gap-1 font-mono text-[11px] text-slate-400 hover:text-slate-200 bg-slate-800/60 px-1.5 py-0.5 rounded border border-slate-700/50 transition"
                title="Copy HEAD SHA"
              >
                {copiedSha ? (
                  <>
                    <Check className="w-3 h-3 text-emerald-400" />
                    <span className="text-emerald-400">Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3 h-3" />
                    <span>{overview.head_commit.slice(0, 7)}</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Studio View Navigation Buttons */}
        <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs font-mono">
          <button
            onClick={() => onTabChange && onTabChange('commit_diff')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition ${
              activeTab === 'commit_diff'
                ? 'bg-indigo-950 text-indigo-200 border border-indigo-700 font-semibold shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <GitCommit className="w-3.5 h-3.5 text-indigo-400" />
            <span>Commit Diffs</span>
          </button>

          <button
            onClick={() => onTabChange && onTabChange('file_evolution')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition ${
              activeTab === 'file_evolution'
                ? 'bg-indigo-950 text-indigo-200 border border-indigo-700 font-semibold shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Layers className="w-3.5 h-3.5 text-cyan-400" />
            <span>File Evolution</span>
          </button>

          <button
            onClick={() => onTabChange && onTabChange('detective')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition ${
              activeTab === 'detective'
                ? 'bg-gradient-to-r from-indigo-950 to-purple-950 text-indigo-200 border border-indigo-500 font-semibold shadow-md shadow-indigo-950/40'
                : 'text-indigo-400 hover:text-indigo-200 hover:bg-slate-900/60'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 text-indigo-400 animate-pulse" />
            <span className="font-semibold">Code Detective</span>
          </button>
        </div>

        {/* Quick metrics cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <div className="bg-slate-950/60 border border-slate-800/90 rounded-lg px-3 py-1.5 flex items-center space-x-2.5">
            <GitCommit className="w-4 h-4 text-indigo-400" />
            <div>
              <div className="text-[10px] uppercase tracking-wider text-slate-400 font-medium">Commits</div>
              <div className="text-sm font-semibold text-slate-200 font-mono">{overview.commit_count}</div>
            </div>
          </div>

          <div className="bg-slate-950/60 border border-slate-800/90 rounded-lg px-3 py-1.5 flex items-center space-x-2.5">
            <Code2 className="w-4 h-4 text-cyan-400" />
            <div>
              <div className="text-[10px] uppercase tracking-wider text-slate-400 font-medium">Files</div>
              <div className="text-sm font-semibold text-slate-200 font-mono">{overview.file_count}</div>
            </div>
          </div>

          <div className="bg-slate-950/60 border border-slate-800/90 rounded-lg px-3 py-1.5 flex items-center space-x-2.5">
            <Users className="w-4 h-4 text-emerald-400" />
            <div>
              <div className="text-[10px] uppercase tracking-wider text-slate-400 font-medium">Authors</div>
              <div className="text-sm font-semibold text-slate-200 font-mono">{overview.contributors_count}</div>
            </div>
          </div>

          <div className="bg-slate-950/60 border border-slate-800/90 rounded-lg px-3 py-1.5 flex items-center space-x-2.5">
            <Clock className="w-4 h-4 text-purple-400" />
            <div>
              <div className="text-[10px] uppercase tracking-wider text-slate-400 font-medium">Depth</div>
              <div className="text-sm font-semibold text-slate-200 font-mono">60 commits</div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}



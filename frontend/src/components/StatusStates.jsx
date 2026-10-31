import React from 'react';
import {
  GitBranch,
  Search,
  Sparkles,
  ShieldCheck,
  AlertCircle,
  FolderGit2,
  Terminal,
  ArrowRight,
  Code2,
  CheckCircle2,
  Loader2
} from 'lucide-react';

export function EmptyState({ samples = [], onSelectSample, isLoading }) {
  return (
    <div className="flex-1 flex items-center justify-center p-6 bg-slate-950">
      <div className="max-w-3xl w-full text-center space-y-8 py-10">
        
        {/* Hero badge & title */}
        <div className="space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-mono font-medium bg-indigo-950/80 border border-indigo-700/60 text-indigo-300">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>Strict Evidence · Zero Fabricated Intent</span>
          </div>

          <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight leading-tight">
            Understand <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 via-purple-300 to-cyan-400">Why The Code Is Like This</span>
          </h1>

          <p className="text-sm sm:text-base text-slate-400 max-w-2xl mx-auto leading-relaxed">
            Developers exploring unfamiliar code struggle to understand why design decisions exist. RepoReason inspects public GitHub repositories to uncover code evolution using actual commits, messages, and diffs.
          </p>
        </div>

        {/* Feature pillars */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-left">
          <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800/80 space-y-2">
            <div className="w-7 h-7 rounded-lg bg-indigo-950 flex items-center justify-center border border-indigo-800/60 text-indigo-400">
              <FolderGit2 className="w-4 h-4" />
            </div>
            <h4 className="text-xs font-semibold text-slate-200">1. Real Git Evidence</h4>
            <p className="text-[11px] text-slate-400 leading-normal">
              Direct analysis of actual commits, authors, dates, and unified diffs. No simulated or fake data.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800/80 space-y-2">
            <div className="w-7 h-7 rounded-lg bg-purple-950 flex items-center justify-center border border-purple-800/60 text-purple-400">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
            </div>
            <h4 className="text-xs font-semibold text-slate-200">2. Facts vs. Interpretations</h4>
            <p className="text-[11px] text-slate-400 leading-normal">
              Observable code changes separated from inferences. If evidence is insufficient, it explicitly warns you.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800/80 space-y-2">
            <div className="w-7 h-7 rounded-lg bg-cyan-950 flex items-center justify-center border border-cyan-800/60 text-cyan-400">
              <Code2 className="w-4 h-4" />
            </div>
            <h4 className="text-xs font-semibold text-slate-200">3. File Evolution Trail</h4>
            <p className="text-[11px] text-slate-400 leading-normal">
              Click any file in the tree to trace how each line evolved across history with previous and current code.
            </p>
          </div>
        </div>

        {/* Quick Launch Demo Cards */}
        <div className="space-y-3 pt-4 border-t border-slate-800/80 text-left">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <Terminal className="w-3.5 h-3.5 text-cyan-400" />
              Try a Popular Public Repository
            </span>
            <span className="text-[11px] text-slate-400">Or paste any public GitHub repo URL above</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {samples.map((s) => (
              <button
                key={s.url}
                onClick={() => onSelectSample(s.url)}
                disabled={isLoading}
                className="p-3.5 rounded-lg bg-slate-900/80 hover:bg-slate-900 border border-slate-800 hover:border-indigo-500/60 text-left transition group shadow-sm flex items-start justify-between gap-3"
              >
                <div className="space-y-1 min-w-0">
                  <div className="flex items-center space-x-2">
                    <span className="text-xs font-semibold text-white group-hover:text-indigo-300 transition">
                      {s.title}
                    </span>
                    <span className="text-[10px] font-mono text-slate-400">
                      {s.url.replace('https://github.com/', '')}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 line-clamp-1">
                    {s.description}
                  </p>
                </div>
                <ArrowRight className="w-4 h-4 text-slate-500 group-hover:text-indigo-400 group-hover:translate-x-0.5 transition flex-shrink-0 mt-1" />
              </button>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}

export function LoadingState({ repoUrl }) {
  return (
    <div className="flex-1 flex items-center justify-center p-8 bg-slate-950">
      <div className="max-w-md w-full text-center space-y-6">
        <div className="relative w-16 h-16 mx-auto">
          <div className="absolute inset-0 rounded-full border-4 border-indigo-500/20 animate-ping" />
          <div className="relative w-16 h-16 rounded-full bg-slate-900 border-2 border-indigo-500 flex items-center justify-center">
            <Loader2 className="w-8 h-8 text-indigo-400 animate-spin" />
          </div>
        </div>

        <div className="space-y-2">
          <h3 className="text-base font-semibold text-white">
            Analyzing Repository Evolution
          </h3>
          <p className="text-xs font-mono text-indigo-300 truncate px-4">
            {repoUrl}
          </p>
        </div>

        {/* Multi-step progress list */}
        <div className="p-4 bg-slate-900/70 border border-slate-800 rounded-lg text-left space-y-2 text-xs font-mono text-slate-400">
          <div className="flex items-center gap-2 text-emerald-400">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Validating repository URL format</span>
          </div>
          <div className="flex items-center gap-2 text-emerald-400">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Checking remote access via Git CLI</span>
          </div>
          <div className="flex items-center gap-2 text-indigo-300 animate-pulse">
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            <span>Shallow cloning commit tree & history...</span>
          </div>
          <div className="flex items-center gap-2 text-slate-500">
            <span className="w-3.5 h-3.5 text-center">•</span>
            <span>Parsing unified diffs & fact matrices</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export function ErrorState({ error, onRetry }) {
  return (
    <div className="flex-1 flex items-center justify-center p-8 bg-slate-950">
      <div className="max-w-md w-full p-6 bg-slate-900/80 border border-rose-800/80 rounded-xl text-center space-y-4 shadow-xl">
        <div className="w-12 h-12 rounded-full bg-rose-950/70 border border-rose-800 text-rose-400 flex items-center justify-center mx-auto">
          <AlertCircle className="w-6 h-6" />
        </div>
        <div className="space-y-1.5">
          <h3 className="text-sm font-semibold text-rose-200">
            Unable to Analyze Repository
          </h3>
          <p className="text-xs text-rose-300/80 leading-relaxed font-mono">
            {error || 'An unexpected error occurred while analyzing the repository.'}
          </p>
        </div>
        <div className="pt-2">
          <button
            onClick={onRetry}
            className="px-4 py-2 text-xs font-medium text-white bg-slate-800 hover:bg-slate-700 rounded-md transition border border-slate-700"
          >
            Try Another Repository
          </button>
        </div>
      </div>
    </div>
  );
}


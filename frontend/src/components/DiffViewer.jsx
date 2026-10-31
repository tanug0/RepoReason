import React, { useState } from 'react';
import {
  FileCode,
  Copy,
  Check,
  FilePlus,
  FileMinus,
  FileEdit,
  ExternalLink,
  Code2,
  FileText,
  ChevronDown
} from 'lucide-react';

function getStatusBadge(status) {
  switch (status) {
    case 'added':
      return (
        <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold bg-emerald-950 text-emerald-400 border border-emerald-800">
          ADDED
        </span>
      );
    case 'deleted':
      return (
        <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold bg-rose-950 text-rose-400 border border-rose-800">
          DELETED
        </span>
      );
    case 'renamed':
      return (
        <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold bg-purple-950 text-purple-400 border border-purple-800">
          RENAMED
        </span>
      );
    default:
      return (
        <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold bg-sky-950 text-sky-400 border border-sky-800">
          MODIFIED
        </span>
      );
  }
}

export default function DiffViewer({ commit, onSelectFileEvolution }) {
  const [selectedFileIdx, setSelectedFileIdx] = useState(0);
  const [viewMode, setViewMode] = useState('unified'); // 'unified' | 'raw'
  const [copiedSha, setCopiedSha] = useState(false);
  const [copiedDiff, setCopiedDiff] = useState(false);

  if (!commit) {
    return (
      <div className="h-full flex items-center justify-center p-8 text-center text-slate-500">
        <div>
          <Code2 className="w-10 h-10 mx-auto mb-3 text-slate-600" />
          <p className="text-sm">Select a commit from the timeline to view its diff.</p>
        </div>
      </div>
    );
  }

  const { changed_files = [], file_diffs = [] } = commit;
  // Match diff by filename so that ghost stat-block entries never shadow real diffs.
  const currentFile = changed_files[selectedFileIdx] || (changed_files.length > 0 ? changed_files[0] : null);
  const currentDiff = currentFile
    ? (file_diffs.find(fd => fd.filename === currentFile.filename) || null)
    : (file_diffs.length > 0 ? file_diffs[0] : null);

  const handleCopySha = () => {
    navigator.clipboard.writeText(commit.hash);
    setCopiedSha(true);
    setTimeout(() => setCopiedSha(false), 2000);
  };

  const handleCopyDiff = () => {
    if (currentDiff && currentDiff.raw_patch) {
      navigator.clipboard.writeText(currentDiff.raw_patch);
      setCopiedDiff(true);
      setTimeout(() => setCopiedDiff(false), 2000);
    }
  };

  return (
    <div className="h-full flex flex-col bg-slate-950">
      
      {/* Commit Info Header */}
      <div className="p-4 border-b border-slate-800/80 bg-slate-900/40">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="space-y-1">
            <h3 className="text-base font-semibold text-white tracking-tight leading-snug">
              {commit.subject}
            </h3>
            <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400">
              <span className="text-slate-300 font-medium">
                {commit.author_name}
              </span>
              <span className="text-slate-600">•</span>
              <span className="font-mono text-slate-400">{commit.date_relative}</span>
              <span className="text-slate-600">•</span>
              <button
                onClick={handleCopySha}
                className="font-mono text-[11px] text-indigo-300 bg-indigo-950/60 hover:bg-indigo-900/60 px-2 py-0.5 rounded border border-indigo-800/60 flex items-center gap-1 transition"
                title="Copy Full SHA"
              >
                {copiedSha ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                <span>{commit.short_hash}</span>
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 text-xs font-mono bg-slate-950 px-2.5 py-1 rounded border border-slate-800">
              <span className="text-emerald-400 font-semibold">+{commit.stats.insertions}</span>
              <span className="text-slate-600">/</span>
              <span className="text-rose-400 font-semibold">-{commit.stats.deletions}</span>
            </div>
          </div>
        </div>

        {/* Extended commit body if author provided one */}
        {commit.body && (
          <div className="mt-3 p-2.5 bg-slate-950/70 border border-slate-800/80 rounded text-xs text-slate-300 font-mono whitespace-pre-wrap leading-relaxed">
            {commit.body}
          </div>
        )}
      </div>

      {/* Changed Files Pill Bar */}
      <div className="px-4 py-2 bg-slate-900/60 border-b border-slate-800/80 flex items-center justify-between gap-2 overflow-x-auto">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="text-[11px] font-semibold uppercase text-slate-400 tracking-wider flex-shrink-0 mr-1">
            Changed Files ({changed_files.length}):
          </span>
          <div className="flex items-center gap-1.5 overflow-x-auto py-0.5">
            {changed_files.map((file, idx) => {
              const isSelected = idx === selectedFileIdx;
              return (
                <button
                  key={file.filename}
                  onClick={() => setSelectedFileIdx(idx)}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-mono transition flex-shrink-0 border ${
                    isSelected
                      ? 'bg-indigo-950 border-indigo-500 text-indigo-200 font-medium shadow-sm'
                      : 'bg-slate-950/80 border-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                  }`}
                >
                  <span className="truncate max-w-[200px]">{file.filename}</span>
                  {file.additions > 0 && <span className="text-emerald-400 text-[10px]">+{file.additions}</span>}
                  {file.deletions > 0 && <span className="text-rose-400 text-[10px]">-{file.deletions}</span>}
                </button>
              );
            })}
          </div>
        </div>

        {/* Diff view switch & copy */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {currentFile && onSelectFileEvolution && (
            <button
              onClick={() => onSelectFileEvolution(currentFile.filename)}
              className="px-2 py-1 text-xs text-indigo-300 hover:text-indigo-100 bg-indigo-950/50 hover:bg-indigo-900/50 border border-indigo-800/50 rounded flex items-center gap-1 transition"
              title="Trace full evolution of this file"
            >
              <span>Trace File History</span>
            </button>
          )}

          <div className="flex items-center bg-slate-950 p-0.5 rounded border border-slate-800 text-[11px]">
            <button
              onClick={() => setViewMode('unified')}
              className={`px-2 py-0.5 rounded font-medium transition ${
                viewMode === 'unified' ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Unified
            </button>
            <button
              onClick={() => setViewMode('raw')}
              className={`px-2 py-0.5 rounded font-medium transition ${
                viewMode === 'raw' ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Raw Patch
            </button>
          </div>

          <button
            onClick={handleCopyDiff}
            className="p-1 text-slate-400 hover:text-slate-200 bg-slate-950 border border-slate-800 rounded transition"
            title="Copy diff to clipboard"
          >
            {copiedDiff ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* Diff content view */}
      <div className="flex-1 overflow-y-auto font-mono text-xs">
        {!currentDiff ? (
          <div className="p-8 text-center text-slate-500">
            No diff available for this file.
          </div>
        ) : viewMode === 'raw' ? (
          <pre className="p-4 text-slate-300 whitespace-pre-wrap leading-relaxed select-text font-mono-code">
            {currentDiff.raw_patch}
          </pre>
        ) : (
          <div className="divide-y divide-slate-900">
            {currentDiff.hunks.length === 0 ? (
              <div className="p-6 text-center text-slate-400">
                {currentDiff.raw_patch && currentDiff.raw_patch.includes('Binary files')
                  ? 'Binary file — diff cannot be rendered as text.'
                  : 'No diff hunks available for this file.'}
              </div>
            ) : (
              currentDiff.hunks.map((hunk, hIdx) => (
                <div key={hIdx} className="border-b border-slate-900 last:border-b-0">
                  {/* Hunk Header */}
                  <div className="bg-indigo-950/30 text-indigo-300 px-4 py-1.5 text-[11px] border-y border-indigo-900/30 font-semibold select-none flex items-center justify-between">
                    <span>{hunk.header}</span>
                    <span className="text-[10px] text-slate-400">Hunk {hIdx + 1}</span>
                  </div>

                  {/* Lines */}
                  <div className="divide-y divide-slate-950/40">
                    {hunk.lines.map((line, lIdx) => {
                      let bgClass = 'bg-transparent';
                      let textClass = 'text-slate-300';
                      let symbol = ' ';
                      let borderClass = 'border-l-2 border-transparent';

                      if (line.type === 'add') {
                        bgClass = 'bg-emerald-950/25 hover:bg-emerald-950/40';
                        textClass = 'text-emerald-300';
                        symbol = '+';
                        borderClass = 'border-l-2 border-emerald-500';
                      } else if (line.type === 'delete') {
                        bgClass = 'bg-rose-950/25 hover:bg-rose-950/40';
                        textClass = 'text-rose-300';
                        symbol = '-';
                        borderClass = 'border-l-2 border-rose-500';
                      } else {
                        bgClass = 'hover:bg-slate-900/50';
                      }

                      return (
                        <div
                          key={lIdx}
                          className={`flex items-start text-xs font-mono-code transition ${bgClass} ${borderClass}`}
                        >
                          {/* Line numbers */}
                          <div className="w-10 py-0.5 px-1 text-right text-slate-600 select-none text-[11px] flex-shrink-0">
                            {line.old_line_number || ''}
                          </div>
                          <div className="w-10 py-0.5 px-1 text-right text-slate-600 select-none text-[11px] flex-shrink-0 border-r border-slate-800/80">
                            {line.new_line_number || ''}
                          </div>

                          {/* Symbol */}
                          <div className="w-5 py-0.5 text-center select-none font-bold text-[11px] flex-shrink-0">
                            <span className={line.type === 'add' ? 'text-emerald-400' : line.type === 'delete' ? 'text-rose-400' : 'text-slate-600'}>
                              {symbol}
                            </span>
                          </div>

                          {/* Line text */}
                          <div className={`flex-1 py-0.5 px-2 overflow-x-auto whitespace-pre ${textClass}`}>
                            {line.content || ' '}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>

    </div>
  );
}


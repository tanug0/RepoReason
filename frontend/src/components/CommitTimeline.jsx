import React, { useState, useMemo } from 'react';
import {
  GitCommit,
  Clock,
  User,
  Search,
  Filter,
  FileCode2,
  CheckCircle2,
  ChevronRight
} from 'lucide-react';

export default function CommitTimeline({
  commits = [],
  selectedCommitHash,
  onSelectCommit,
  isLoadingCommit
}) {
  const [filterQuery, setFilterQuery] = useState('');

  const filteredCommits = useMemo(() => {
    if (!filterQuery.trim()) return commits;
    const q = filterQuery.toLowerCase().trim();
    return commits.filter(
      (c) =>
        c.subject.toLowerCase().includes(q) ||
        c.author_name.toLowerCase().includes(q) ||
        c.short_hash.toLowerCase().includes(q)
    );
  }, [commits, filterQuery]);

  return (
    <div className="h-full flex flex-col bg-slate-950/40 border-r border-slate-800/80">
      
      {/* Header and commit search */}
      <div className="p-3 border-b border-slate-800/80 bg-slate-950/60">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center space-x-1.5">
            <GitCommit className="w-4 h-4 text-indigo-400" />
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-300">
              Commit Timeline
            </span>
          </div>
          <span className="text-[11px] font-mono text-slate-400 bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
            {filteredCommits.length} commits
          </span>
        </div>

        <div className="relative">
          <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-2.5" />
          <input
            type="text"
            value={filterQuery}
            onChange={(e) => setFilterQuery(e.target.value)}
            placeholder="Search commits, authors, hashes..."
            className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-900 border border-slate-800 rounded-md text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500 font-mono transition"
          />
          {filterQuery && (
            <button
              onClick={() => setFilterQuery('')}
              className="absolute right-2.5 top-2 text-xs text-slate-500 hover:text-slate-300"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Commits list */}
      <div className="flex-1 overflow-y-auto divide-y divide-slate-850 p-2 space-y-1.5">
        {filteredCommits.length === 0 ? (
          <div className="p-6 text-center text-xs text-slate-400">
            {filterQuery ? 'No commits match the filter.' : 'No commits found.'}
          </div>
        ) : (
          filteredCommits.map((c) => {
            const isSelected = selectedCommitHash === c.hash;

            return (
              <button
                key={c.hash}
                onClick={() => onSelectCommit(c.hash)}
                className={`w-full text-left p-3 rounded-lg transition border relative group ${
                  isSelected
                    ? 'bg-indigo-950/60 border-indigo-500/70 shadow-md shadow-indigo-950/40 text-slate-100 ring-1 ring-indigo-500/40'
                    : 'bg-slate-900/50 hover:bg-slate-900 border-slate-800/80 text-slate-300 hover:text-slate-100'
                }`}
              >
                {/* Active indicator bar */}
                {isSelected && (
                  <div className="absolute left-0 top-2 bottom-2 w-1 bg-indigo-500 rounded-r" />
                )}

                <div className="flex items-start justify-between gap-2">
                  <span className="font-mono text-[11px] font-semibold px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700/60 text-indigo-300">
                    {c.short_hash}
                  </span>
                  <span className="text-[10px] text-slate-400 font-mono flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {c.date_relative}
                  </span>
                </div>

                {/* Subject */}
                <h4 className="text-xs font-medium text-slate-100 mt-1.5 line-clamp-2 leading-relaxed">
                  {c.subject}
                </h4>

                {/* Footer metadata */}
                <div className="mt-2.5 pt-2 border-t border-slate-800/60 flex items-center justify-between text-[11px] text-slate-400">
                  <span className="flex items-center gap-1 truncate max-w-[130px]" title={c.author_name}>
                    <User className="w-3 h-3 text-slate-400" />
                    <span className="truncate">{c.author_name}</span>
                  </span>

                  <div className="flex items-center space-x-1.5 font-mono text-[10px]">
                    <span className="text-slate-400" title="Files changed">
                      {c.files_changed_count}f
                    </span>
                    {c.insertions > 0 && (
                      <span className="text-emerald-400" title="Additions">
                        +{c.insertions}
                      </span>
                    )}
                    {c.deletions > 0 && (
                      <span className="text-rose-400" title="Deletions">
                        -{c.deletions}
                      </span>
                    )}
                  </div>
                </div>
              </button>
            );
          })
        )}
      </div>

    </div>
  );
}


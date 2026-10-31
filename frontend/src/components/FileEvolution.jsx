import React, { useState } from 'react';
import {
  History,
  Code2,
  FileCode,
  GitCommit,
  User,
  Clock,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  ArrowLeft,
  Copy,
  Check,
  Sparkles
} from 'lucide-react';

export default function FileEvolution({
  evolution,
  filePath,
  isLoading,
  onClose,
  onSelectCommit,
  onInvestigateDetective
}) {
  const [activeTab, setActiveTab] = useState('timeline'); // 'timeline' | 'content'
  const [expandedCommitIdx, setExpandedCommitIdx] = useState(0);
  const [copiedCode, setCopiedCode] = useState(false);

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center p-8 bg-slate-950 text-slate-400">
        <div className="text-center space-y-3">
          <History className="w-8 h-8 animate-spin text-indigo-400 mx-auto" />
          <p className="text-sm">Tracing evolution across commits for {filePath}...</p>
        </div>
      </div>
    );
  }

  if (!evolution) {
    return null;
  }

  const { history = [], current_content, total_revisions } = evolution;

  const handleCopyCode = () => {
    if (current_content) {
      navigator.clipboard.writeText(current_content);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    }
  };

  return (
    <div className="h-full flex flex-col bg-slate-950 overflow-hidden">
      
      {/* Header */}
      <div className="p-3.5 bg-slate-900/70 border-b border-slate-800/80 flex items-center justify-between gap-3">
        <div className="flex items-center space-x-2.5 min-w-0">
          <button
            onClick={onClose}
            className="p-1 rounded text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition"
            title="Back to commit diff view"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div className="min-w-0">
            <div className="flex items-center space-x-2">
              <span className="text-[10px] font-mono uppercase tracking-wider text-indigo-400 font-semibold">
                File Evolution Trail
              </span>
              <span className="text-[11px] font-mono text-slate-400">
                ({total_revisions} revisions recorded)
              </span>
            </div>
            <h3 className="text-xs sm:text-sm font-mono font-semibold text-slate-100 truncate">
              {filePath}
            </h3>
          </div>
        </div>

        {/* View Switcher & Detective Action */}
        <div className="flex items-center space-x-2">
          {onInvestigateDetective && (
            <button
              onClick={() => onInvestigateDetective(filePath)}
              className="px-2.5 py-1 text-xs font-mono rounded-md bg-gradient-to-r from-indigo-950 to-purple-950 hover:from-indigo-900 hover:to-purple-900 text-indigo-200 border border-indigo-700/80 transition flex items-center gap-1.5 shadow-sm"
              title="Launch Code Mystery Detective on this file"
            >
              <Sparkles className="w-3.5 h-3.5 text-indigo-400 animate-pulse" />
              <span>Investigate Code</span>
            </button>
          )}

          <div className="flex items-center bg-slate-950 p-0.5 rounded-md border border-slate-800 text-xs font-mono">
            <button
              onClick={() => setActiveTab('timeline')}
              className={`px-3 py-1 rounded transition flex items-center gap-1.5 ${
                activeTab === 'timeline'
                  ? 'bg-indigo-950 text-indigo-200 border border-indigo-700 font-semibold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <History className="w-3.5 h-3.5" />
              <span>Evolution ({history.length})</span>
            </button>
            <button
              onClick={() => setActiveTab('content')}
              className={`px-3 py-1 rounded transition flex items-center gap-1.5 ${
                activeTab === 'content'
                  ? 'bg-indigo-950 text-indigo-200 border border-indigo-700 font-semibold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Code2 className="w-3.5 h-3.5" />
              <span>Current Code</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto">
        {activeTab === 'timeline' ? (
          <div className="p-4 space-y-3 max-w-5xl mx-auto">
            {history.length === 0 ? (
              <div className="p-8 text-center text-slate-500 text-xs">
                No git history found for this file.
              </div>
            ) : (
              history.map((rev, idx) => {
                const isExpanded = expandedCommitIdx === idx;

                return (
                  <div
                    key={rev.hash}
                    className="border border-slate-800/80 rounded-lg bg-slate-900/40 overflow-hidden"
                  >
                    {/* Commit summary row */}
                    <div
                      onClick={() => setExpandedCommitIdx(isExpanded ? null : idx)}
                      className="p-3 cursor-pointer hover:bg-slate-850/60 transition flex items-center justify-between gap-3 select-none"
                    >
                      <div className="flex items-center space-x-2.5 min-w-0">
                        {isExpanded ? (
                          <ChevronDown className="w-4 h-4 text-indigo-400 flex-shrink-0" />
                        ) : (
                          <ChevronRight className="w-4 h-4 text-slate-500 flex-shrink-0" />
                        )}
                        <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded bg-slate-800 text-indigo-300 border border-slate-700">
                          {rev.short_hash}
                        </span>
                        <span className="text-xs text-slate-200 font-medium truncate">
                          {rev.subject}
                        </span>
                      </div>

                      <div className="flex items-center space-x-3 text-xs flex-shrink-0 font-mono">
                        <span className="text-slate-400 hidden sm:inline">{rev.author_name}</span>
                        <span className="text-slate-400">{rev.date_relative}</span>
                        <div className="flex items-center space-x-1">
                          {rev.additions > 0 && (
                            <span className="text-emerald-400">+{rev.additions}</span>
                          )}
                          {rev.deletions > 0 && (
                            <span className="text-rose-400">-{rev.deletions}</span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Expanded diff patch */}
                    {isExpanded && (
                      <div className="border-t border-slate-800/80 bg-slate-950 p-3 space-y-2">
                        <div className="flex items-center justify-between text-xs text-slate-400">
                          <span className="font-mono text-[11px] text-indigo-300">
                            {rev.explanation}
                          </span>
                          <button
                            onClick={() => onSelectCommit(rev.hash)}
                            className="px-2 py-0.5 bg-indigo-950 hover:bg-indigo-900 text-indigo-300 hover:text-white rounded border border-indigo-800 text-[11px] font-mono flex items-center gap-1 transition"
                          >
                            <span>Inspect Full Commit</span>
                            <ExternalLink className="w-3 h-3" />
                          </button>
                        </div>

                        {rev.patch ? (
                          <pre className="p-3 bg-slate-950 rounded border border-slate-800/90 font-mono-code text-[11px] overflow-x-auto whitespace-pre leading-relaxed text-slate-300">
                            {rev.patch.splitlines().map((line, lIdx) => {
                              let lineClass = 'text-slate-400';
                              if (line.startsWith('+') && !line.startsWith('+++')) {
                                lineClass = 'text-emerald-400 bg-emerald-950/20';
                              } else if (line.startsWith('-') && !line.startsWith('---')) {
                                lineClass = 'text-rose-400 bg-rose-950/20';
                              } else if (line.startsWith('@@')) {
                                lineClass = 'text-indigo-300 bg-indigo-950/30';
                              }
                              return (
                                <div key={lIdx} className={`${lineClass} px-1 rounded`}>
                                  {line}
                                </div>
                              );
                            })}
                          </pre>
                        ) : (
                          <div className="text-xs text-slate-500 italic p-2">
                            Binary file or initial file snapshot without line diff.
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        ) : (
          /* Current Code Content with Line Numbers */
          <div className="h-full flex flex-col p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-mono text-slate-400">
                Viewing current code of <span className="text-slate-200">{filePath}</span> at HEAD
              </span>
              <button
                onClick={handleCopyCode}
                className="px-2.5 py-1 text-xs bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded text-slate-300 flex items-center gap-1 font-mono transition"
              >
                {copiedCode ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedCode ? 'Copied' : 'Copy Content'}</span>
              </button>
            </div>

            <div className="flex-1 bg-slate-950 border border-slate-800/80 rounded-lg overflow-y-auto font-mono text-xs">
              {!current_content ? (
                <div className="p-6 text-slate-500 text-center">
                  File content unavailable or file was deleted.
                </div>
              ) : (
                <table className="w-full border-collapse">
                  <tbody>
                    {current_content.split('\n').map((line, idx) => (
                      <tr key={idx} className="hover:bg-slate-900/50">
                        <td className="w-12 py-0.5 px-2 text-right text-slate-600 select-none text-[11px] border-r border-slate-800/80 font-mono">
                          {idx + 1}
                        </td>
                        <td className="py-0.5 px-3 text-slate-300 whitespace-pre font-mono-code overflow-x-auto text-xs">
                          {line || ' '}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}
      </div>

    </div>
  );
}


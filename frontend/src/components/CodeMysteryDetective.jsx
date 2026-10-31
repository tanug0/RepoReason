import React, { useState, useEffect, useMemo } from 'react';
import {
  Search,
  Sparkles,
  GitCommit,
  User,
  Clock,
  Calendar,
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
  HelpCircle,
  FileCode,
  FileSearch,
  ExternalLink,
  ChevronDown,
  ChevronRight,
  Copy,
  Check,
  ArrowRight,
  Layers,
  ArrowLeft,
  Filter,
  CheckCircle2,
  XCircle,
  Hash,
  Terminal,
  Activity,
  Maximize2
} from 'lucide-react';
import { getFileSymbols, investigateCode } from '../utils/api';

export default function CodeMysteryDetective({
  initialFilePath,
  initialFunction,
  fileTree = [],
  onSelectCommit,
  onClose,
  onViewFileEvolution
}) {
  // Target Selection States
  const [selectedFilePath, setSelectedFilePath] = useState(initialFilePath || '');
  const [symbols, setSymbols] = useState([]);
  const [selectedSymbolName, setSelectedSymbolName] = useState(initialFunction || '');
  const [startLine, setStartLine] = useState(1);
  const [endLine, setEndLine] = useState(30);
  const [useCustomRange, setUseCustomRange] = useState(false);
  const [filePreview, setFilePreview] = useState('');
  const [isLoadingSymbols, setIsLoadingSymbols] = useState(false);

  // Investigation Results State
  const [investigation, setInvestigation] = useState(null);
  const [isInvestigating, setIsInvestigating] = useState(false);
  const [investigationError, setInvestigationError] = useState(null);

  // Active step in DNA Timeline
  const [activeStepIdx, setActiveStepIdx] = useState(0);
  const [expandedDiffStep, setExpandedDiffStep] = useState(null);
  const [copiedHash, setCopiedHash] = useState(null);

  // Flatten file paths from tree for search/select
  const flatFileList = useMemo(() => {
    const list = [];
    function traverse(nodes) {
      if (!nodes) return;
      for (const node of nodes) {
        if (node.type === 'file') {
          list.push(node.path);
        } else if (node.children) {
          traverse(node.children);
        }
      }
    }
    traverse(fileTree);
    return list;
  }, [fileTree]);

  // When initialFilePath changes, update selectedFilePath
  useEffect(() => {
    if (initialFilePath) {
      setSelectedFilePath(initialFilePath);
    }
  }, [initialFilePath]);

  // When selectedFilePath changes, load symbols
  useEffect(() => {
    if (!selectedFilePath) {
      setSymbols([]);
      setFilePreview('');
      return;
    }

    let isMounted = true;
    setIsLoadingSymbols(true);

    getFileSymbols(selectedFilePath)
      .then((data) => {
        if (!isMounted) return;
        setSymbols(data.symbols || []);
        setFilePreview(data.preview_content || '');
        if (data.symbols && data.symbols.length > 0) {
          // If initialFunction was requested and matches, select it
          const matched = initialFunction
            ? data.symbols.find((s) => s.name.toLowerCase() === initialFunction.toLowerCase())
            : data.symbols[0];

          if (matched) {
            setSelectedSymbolName(matched.name);
            setStartLine(matched.start_line);
            setEndLine(matched.end_line);
          } else {
            setSelectedSymbolName(data.symbols[0].name);
            setStartLine(data.symbols[0].start_line);
            setEndLine(data.symbols[0].end_line);
          }
        } else {
          setSelectedSymbolName('');
          setStartLine(1);
          setEndLine(Math.min(data.total_lines || 30, 30));
        }
      })
      .catch((err) => {
        console.warn('Failed to load symbols for file:', err);
      })
      .finally(() => {
        if (isMounted) setIsLoadingSymbols(false);
      });

    return () => {
      isMounted = false;
    };
  }, [selectedFilePath, initialFunction]);

  // Handle symbol change
  const handleSelectSymbol = (symName) => {
    setSelectedSymbolName(symName);
    const sym = symbols.find((s) => s.name === symName);
    if (sym) {
      setStartLine(sym.start_line);
      setEndLine(sym.end_line);
    }
  };

  // Run Investigation
  const handleInvestigate = async () => {
    if (!selectedFilePath) return;

    setIsInvestigating(true);
    setInvestigationError(null);
    setInvestigation(null);

    try {
      const res = await investigateCode({
        file_path: selectedFilePath,
        function_name: useCustomRange ? null : (selectedSymbolName || null),
        start_line: Number(startLine),
        end_line: Number(endLine)
      });
      setInvestigation(res);
      setActiveStepIdx(0);
    } catch (err) {
      setInvestigationError(err.message || 'Investigation failed.');
    } finally {
      setIsInvestigating(false);
    }
  };

  // Trigger auto-investigate on initial mount if file path is provided
  useEffect(() => {
    if (initialFilePath && !investigation && !isInvestigating) {
      handleInvestigate();
    }
  }, [initialFilePath]);

  const handleCopyHash = (hash) => {
    navigator.clipboard.writeText(hash);
    setCopiedHash(hash);
    setTimeout(() => setCopiedHash(null), 2000);
  };

  return (
    <div className="h-full flex flex-col bg-slate-950 overflow-hidden font-sans">
      
      {/* Top Banner / Detective Identity */}
      <div className="p-4 bg-gradient-to-r from-slate-900 via-indigo-950/40 to-slate-900 border-b border-slate-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center space-x-3">
          {onClose && (
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition"
              title="Return to main dashboard"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
          )}

          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-cyan-500 p-[1px] shadow-lg shadow-indigo-500/20 flex-shrink-0">
            <div className="w-full h-full bg-slate-950 rounded-[11px] flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-indigo-400 animate-pulse" />
            </div>
          </div>

          <div>
            <div className="flex items-center space-x-2">
              <h2 className="text-sm sm:text-base font-bold text-white tracking-tight flex items-center gap-1.5">
                <span>Code Mystery Detective</span>
              </h2>
              <span className="text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded-full bg-indigo-950 border border-indigo-700/80 text-indigo-300 font-semibold">
                Trace Origin & Evolution
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Select a file and function to unearth its origin commit, mutation milestones, and verifiable evidence.
            </p>
          </div>
        </div>

        {onViewFileEvolution && selectedFilePath && (
          <button
            onClick={() => onViewFileEvolution(selectedFilePath)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700/80 text-slate-300 transition self-start sm:self-center"
          >
            <Layers className="w-3.5 h-3.5 text-indigo-400" />
            <span>Full File Trail</span>
          </button>
        )}
      </div>

      {/* Target Selection & Input Toolbar */}
      <div className="p-3.5 bg-slate-900/60 border-b border-slate-800/80">
        <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
          
          {/* File Picker */}
          <div className="md:col-span-4">
            <label className="block text-[11px] font-mono uppercase text-slate-400 mb-1 font-medium">
              Target File
            </label>
            <div className="relative">
              <FileCode className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-2.5" />
              <input
                type="text"
                list="repo-files-list"
                value={selectedFilePath}
                onChange={(e) => setSelectedFilePath(e.target.value)}
                placeholder="e.g. app.py, lib/index.js..."
                className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-950 border border-slate-800 rounded-lg text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500 font-mono transition"
              />
              <datalist id="repo-files-list">
                {flatFileList.slice(0, 100).map((fp) => (
                  <option key={fp} value={fp} />
                ))}
              </datalist>
            </div>
          </div>

          {/* Function / Symbol Picker OR Line Range */}
          <div className="md:col-span-5">
            <div className="flex items-center justify-between mb-1">
              <label className="text-[11px] font-mono uppercase text-slate-400 font-medium">
                {useCustomRange ? 'Custom Line Range' : 'Function / Code Section'}
              </label>
              <button
                type="button"
                onClick={() => setUseCustomRange(!useCustomRange)}
                className="text-[10px] text-indigo-400 hover:text-indigo-300 underline font-mono"
              >
                {useCustomRange ? 'Switch to Symbol List' : 'Custom Lines (L-R)'}
              </button>
            </div>

            {useCustomRange ? (
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="number"
                  min="1"
                  value={startLine}
                  onChange={(e) => setStartLine(e.target.value)}
                  placeholder="Start line"
                  className="w-full px-2.5 py-1.5 text-xs bg-slate-950 border border-slate-800 rounded-lg text-slate-200 font-mono focus:outline-none focus:border-indigo-500"
                />
                <input
                  type="number"
                  min="1"
                  value={endLine}
                  onChange={(e) => setEndLine(e.target.value)}
                  placeholder="End line"
                  className="w-full px-2.5 py-1.5 text-xs bg-slate-950 border border-slate-800 rounded-lg text-slate-200 font-mono focus:outline-none focus:border-indigo-500"
                />
              </div>
            ) : (
              <div className="relative">
                <select
                  value={selectedSymbolName}
                  onChange={(e) => handleSelectSymbol(e.target.value)}
                  disabled={isLoadingSymbols || symbols.length === 0}
                  className="w-full px-3 py-1.5 text-xs bg-slate-950 border border-slate-800 rounded-lg text-slate-200 font-mono focus:outline-none focus:border-indigo-500 appearance-none transition disabled:opacity-50"
                >
                  {symbols.length === 0 ? (
                    <option value="">
                      {isLoadingSymbols ? 'Detecting symbols...' : 'No symbols found (use custom lines)'}
                    </option>
                  ) : (
                    symbols.map((sym) => (
                      <option key={`${sym.name}-${sym.start_line}`} value={sym.name}>
                        {sym.name} ({sym.kind}) — L{sym.start_line}-L{sym.end_line}
                      </option>
                    ))
                  )}
                </select>
                <ChevronDown className="w-3.5 h-3.5 text-slate-500 absolute right-2.5 top-2.5 pointer-events-none" />
              </div>
            )}
          </div>

          {/* Action Button: Investigate Code */}
          <div className="md:col-span-3">
            <button
              onClick={handleInvestigate}
              disabled={isInvestigating || !selectedFilePath}
              className="w-full flex items-center justify-center gap-2 py-1.5 px-4 rounded-lg text-xs font-semibold bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white shadow-md shadow-indigo-600/30 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isInvestigating ? (
                <>
                  <Activity className="w-3.5 h-3.5 animate-spin" />
                  <span>Investigating History...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Investigate Code</span>
                </>
              )}
            </button>
          </div>

        </div>

        {/* Selected target indicator */}
        {selectedFilePath && (
          <div className="mt-2 flex items-center space-x-2 text-[11px] font-mono text-slate-400">
            <span className="text-indigo-400 font-semibold">Target:</span>
            <span className="text-slate-200 bg-slate-950 px-1.5 py-0.5 rounded border border-slate-800">
              {selectedFilePath}
            </span>
            <span>•</span>
            <span className="text-slate-300">
              {useCustomRange
                ? `Lines ${startLine}-${endLine}`
                : selectedSymbolName
                ? `${selectedSymbolName} (L${startLine}-L${endLine})`
                : `Lines ${startLine}-${endLine}`}
            </span>
          </div>
        )}
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
        
        {/* Error Notification */}
        {investigationError && (
          <div className="p-4 rounded-xl bg-rose-950/40 border border-rose-800/80 text-rose-200 text-xs flex items-start gap-3">
            <XCircle className="w-4 h-4 text-rose-400 flex-shrink-0 mt-0.5" />
            <div>
              <div className="font-semibold text-rose-300">Investigation Error</div>
              <p className="mt-0.5">{investigationError}</p>
            </div>
          </div>
        )}

        {/* Loading State */}
        {isInvestigating && (
          <div className="p-12 text-center space-y-4">
            <div className="relative w-12 h-12 mx-auto">
              <div className="w-12 h-12 rounded-full border-2 border-indigo-500/20 border-t-indigo-500 animate-spin" />
              <FileSearch className="w-5 h-5 text-indigo-400 absolute inset-0 m-auto" />
            </div>
            <div>
              <h4 className="text-sm font-semibold text-slate-200">Executing Deep Git Investigation</h4>
              <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
                Running line-level blame, tracking historical file renames, analyzing observable diff hunks, and evaluating empirical evidence sufficiency...
              </p>
            </div>
          </div>
        )}

        {/* Completed Investigation Results */}
        {investigation && !isInvestigating && (
          <div className="space-y-6 max-w-7xl mx-auto">
            
            {/* 1. CODE ORIGIN CARD (Birth of Code) */}
            <div className="bg-slate-900/70 border border-emerald-800/60 rounded-xl overflow-hidden shadow-lg shadow-emerald-950/20">
              <div className="px-4 py-3 bg-gradient-to-r from-emerald-950/70 to-slate-900 border-b border-emerald-800/40 flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center space-x-2">
                  <div className="p-1 rounded bg-emerald-900/60 border border-emerald-700/60 text-emerald-400">
                    <CheckCircle2 className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-300">
                      Code Origin Detected
                    </h3>
                    <p className="text-[11px] text-emerald-400/80">
                      First introduced in repository commit {investigation.origin.short_hash}
                    </p>
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-800 uppercase">
                    Method: {investigation.origin.detection_method.replace('_', ' ')}
                  </span>
                  {investigation.origin.was_renamed && (
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-purple-950 text-purple-300 border border-purple-800 uppercase">
                      Renamed File
                    </span>
                  )}
                </div>
              </div>

              <div className="p-4 grid grid-cols-1 lg:grid-cols-12 gap-4">
                {/* Origin Metadata */}
                <div className="lg:col-span-5 space-y-3">
                  <div className="space-y-2 text-xs">
                    <div className="flex items-center justify-between py-1 border-b border-slate-800">
                      <span className="text-slate-400 flex items-center gap-1.5">
                        <GitCommit className="w-3.5 h-3.5 text-indigo-400" />
                        <span>Origin Commit</span>
                      </span>
                      <div className="flex items-center space-x-1.5 font-mono">
                        <button
                          onClick={() => onSelectCommit && onSelectCommit(investigation.origin.commit_hash)}
                          className="text-indigo-300 hover:text-indigo-200 font-semibold underline"
                          title="Open commit in diff viewer"
                        >
                          {investigation.origin.short_hash}
                        </button>
                        <button
                          onClick={() => handleCopyHash(investigation.origin.commit_hash)}
                          className="text-slate-400 hover:text-slate-200"
                          title="Copy SHA"
                        >
                          {copiedHash === investigation.origin.commit_hash ? (
                            <Check className="w-3 h-3 text-emerald-400" />
                          ) : (
                            <Copy className="w-3 h-3" />
                          )}
                        </button>
                      </div>
                    </div>

                    <div className="flex items-center justify-between py-1 border-b border-slate-800">
                      <span className="text-slate-400 flex items-center gap-1.5">
                        <User className="w-3.5 h-3.5 text-cyan-400" />
                        <span>Author</span>
                      </span>
                      <span className="font-semibold text-slate-200 font-mono">
                        {investigation.origin.author_name}
                      </span>
                    </div>

                    <div className="flex items-center justify-between py-1 border-b border-slate-800">
                      <span className="text-slate-400 flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-purple-400" />
                        <span>Date Introduced</span>
                      </span>
                      <span className="text-slate-300 font-mono text-[11px]">
                        {investigation.origin.date_relative} ({investigation.origin.date_iso.slice(0, 10)})
                      </span>
                    </div>

                    <div className="py-1">
                      <span className="text-slate-400 block text-[11px] mb-1">Origin Commit Subject:</span>
                      <p className="font-mono text-slate-200 bg-slate-950 p-2 rounded-lg border border-slate-800 text-[11px] leading-relaxed">
                        "{investigation.origin.subject}"
                      </p>
                    </div>

                    {investigation.origin.was_renamed && (
                      <div className="text-[11px] font-mono text-purple-300 bg-purple-950/40 p-2 rounded-lg border border-purple-800/60">
                        Original location at birth: <code className="text-white">{investigation.origin.file_path_at_origin}</code>
                      </div>
                    )}
                  </div>
                </div>

                {/* Original Code Snapshot */}
                <div className="lg:col-span-7 flex flex-col">
                  <div className="flex items-center justify-between pb-1.5 text-xs text-slate-400">
                    <span className="font-mono text-[11px] text-emerald-400 font-semibold uppercase">
                      Code As Introduced at Birth
                    </span>
                    <span className="text-[11px] font-mono text-slate-500">
                      {investigation.origin.introduced_lines}
                    </span>
                  </div>
                  <pre className="flex-1 bg-slate-950 border border-slate-800/90 rounded-lg p-3 text-[11px] font-mono text-emerald-200 overflow-x-auto leading-relaxed max-h-56">
                    <code>{investigation.origin.original_code_snippet}</code>
                  </pre>
                </div>
              </div>
            </div>

            {/* 2. CODE DNA TIMELINE & CHANGE INVESTIGATION */}
            <div className="space-y-4">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center space-x-2">
                  <Activity className="w-4 h-4 text-indigo-400" />
                  <h3 className="text-xs sm:text-sm font-bold uppercase tracking-wider text-slate-200">
                    Code DNA Timeline ({investigation.dna_timeline.length} Milestone{investigation.dna_timeline.length === 1 ? '' : 's'})
                  </h3>
                </div>
                <span className="text-[11px] font-mono text-slate-400 bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
                  Chronological Order (Origin → Subsequent Modifications)
                </span>
              </div>

              {/* Explicit explanation when function has no subsequent modifications */}
              {investigation.total_mutations === 0 && (
                <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800 text-xs text-slate-300 space-y-1">
                  <div className="font-semibold text-emerald-400 flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>No subsequent modifications to this function found.</span>
                  </div>
                  <p className="text-slate-400 text-[11px] leading-relaxed">
                    {investigation.subsequent_explanation || "The selected code section has not been modified in any subsequent commits."}
                  </p>
                </div>
              )}

              {/* History limitations warning if Git history is incomplete */}
              {investigation.history_is_incomplete && investigation.history_limitation_notes && investigation.history_limitation_notes.length > 0 && (
                <div className="p-3 rounded-xl bg-amber-950/30 border border-amber-800/60 text-xs text-amber-200 space-y-1">
                  <div className="font-semibold text-amber-300 flex items-center gap-1.5">
                    <AlertTriangle className="w-4 h-4" />
                    <span>Git History Limitation</span>
                  </div>
                  {investigation.history_limitation_notes.map((note, i) => (
                    <p key={i} className="text-[11px] text-amber-300/80 leading-relaxed">• {note}</p>
                  ))}
                </div>
              )}

              <div className="space-y-4">
                {investigation.dna_timeline.map((step, idx) => {
                  const isOrigin = step.step_type === 'ORIGIN';
                  const isExpanded = expandedDiffStep === idx;

                  return (
                    <div
                      key={step.commit_hash}
                      className={`rounded-xl border transition ${
                        isOrigin
                          ? 'bg-slate-900/60 border-emerald-800/70'
                          : 'bg-slate-900/40 border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      {/* Step Header */}
                      <div className="p-3 sm:p-4 flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-800/60">
                        <div className="flex items-center space-x-3 min-w-0">
                          {/* Phase Badge */}
                          <div
                            className={`px-2.5 py-1 rounded-md text-[10px] font-mono font-bold uppercase flex-shrink-0 ${
                              isOrigin
                                ? 'bg-emerald-950 text-emerald-300 border border-emerald-700'
                                : 'bg-indigo-950 text-indigo-300 border border-indigo-700'
                            }`}
                          >
                            {isOrigin ? 'ORIGIN' : `MODIFICATION #${step.step_number}`}
                          </div>

                          <div className="min-w-0">
                            <div className="flex items-center space-x-2">
                              <button
                                onClick={() => onSelectCommit && onSelectCommit(step.commit_hash)}
                                className="font-mono text-xs font-bold text-indigo-400 hover:text-indigo-300 underline"
                                title="Open this commit in diff viewer"
                              >
                                {step.short_hash}
                              </button>
                              <span className="text-slate-600">•</span>
                              <span className="text-xs text-slate-300 font-medium truncate">
                                {step.subject}
                              </span>
                            </div>
                            <div className="flex items-center space-x-3 text-[11px] text-slate-400 mt-0.5">
                              <span>by <strong className="text-slate-300">{step.author_name}</strong></span>
                              <span>•</span>
                              <span>{step.date_relative}</span>
                            </div>
                          </div>
                        </div>

                        {/* Missing context warning tags & Toggle Diff */}
                        <div className="flex items-center space-x-2 flex-wrap self-start md:self-center">
                          {step.is_vague_message && (
                            <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-amber-950 text-amber-300 border border-amber-800/80">
                              Vague Msg
                            </span>
                          )}
                          {!step.has_issue_reference && (
                            <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-slate-900 text-slate-400 border border-slate-800">
                              No Issue Link
                            </span>
                          )}
                          {!step.has_test_changes && (
                            <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-slate-900 text-slate-400 border border-slate-800">
                              No Tests
                            </span>
                          )}

                          <button
                            onClick={() => setExpandedDiffStep(isExpanded ? null : idx)}
                            className="px-2.5 py-1 text-xs font-mono rounded bg-slate-800 hover:bg-slate-700 text-slate-200 transition flex items-center gap-1"
                          >
                            <span>{isExpanded ? 'Hide Code' : 'Inspect Code'}</span>
                            <ChevronDown className={`w-3.5 h-3.5 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                          </button>
                        </div>
                      </div>

                      {/* Observable Changes Summary */}
                      <div className="p-3 sm:p-4 space-y-2 bg-slate-950/40">
                        <div className="text-[11px] font-mono text-slate-400 uppercase font-semibold">
                          Observable Changes in this Revision:
                        </div>
                        <ul className="space-y-1">
                          {step.observable_changes.map((obs, i) => (
                            <li key={i} className="text-xs text-slate-200 flex items-start gap-2">
                              <span className="text-indigo-400 mt-0.5 font-bold">•</span>
                              <span>{obs}</span>
                            </li>
                          ))}
                        </ul>

                        {/* Expandable Code Difference: Previous Code vs Updated Code */}
                        {isExpanded && (
                          <div className="mt-4 pt-3 border-t border-slate-800/80 space-y-3">
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                              
                              {/* Previous Code */}
                              <div>
                                <div className="text-[10px] font-mono uppercase text-rose-400 font-semibold mb-1 flex items-center gap-1">
                                  <span>Previous State (Before Commit)</span>
                                </div>
                                <pre className="bg-slate-950 border border-rose-950/80 rounded-lg p-3 text-[11px] font-mono text-rose-200/90 overflow-x-auto max-h-56 leading-relaxed">
                                  <code>{step.previous_code || '/* Initial introduction: no prior state */'}</code>
                                </pre>
                              </div>

                              {/* Updated Code */}
                              <div>
                                <div className="text-[10px] font-mono uppercase text-emerald-400 font-semibold mb-1 flex items-center gap-1">
                                  <span>Updated State (After Commit)</span>
                                </div>
                                <pre className="bg-slate-950 border border-emerald-950/80 rounded-lg p-3 text-[11px] font-mono text-emerald-200/90 overflow-x-auto max-h-56 leading-relaxed">
                                  <code>{step.updated_code || '/* Code removed or shifted */'}</code>
                                </pre>
                              </div>

                            </div>

                            {/* Raw diff patch toggle */}
                            {step.diff_patch && (
                              <details className="mt-2 text-xs">
                                <summary className="cursor-pointer text-slate-400 hover:text-slate-200 font-mono text-[11px]">
                                  View Raw Git Diff Hunk
                                </summary>
                                <pre className="mt-2 bg-slate-950 border border-slate-800 rounded-lg p-3 text-[11px] font-mono text-slate-300 overflow-x-auto max-h-60">
                                  <code>{step.diff_patch}</code>
                                </pre>
                              </details>
                            )}
                          </div>
                        )}
                      </div>

                    </div>
                  );
                })}
              </div>
            </div>

            {/* 3. EVIDENCE-BASED REPORT (VERIFIED, INFERRED, UNKNOWN) */}
            <div className="space-y-3">
              <div className="flex items-center space-x-2">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <h3 className="text-xs sm:text-sm font-bold uppercase tracking-wider text-slate-200">
                  Evidence-Based Report
                </h3>
                <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-slate-400">
                  Strict Proof Standard
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                
                {/* VERIFIED FINDINGS */}
                <div className="bg-slate-900/60 border border-emerald-800/80 rounded-xl p-4 space-y-3">
                  <div className="flex items-center justify-between border-b border-emerald-900/60 pb-2">
                    <span className="text-xs font-bold text-emerald-300 uppercase tracking-wider flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      <span>VERIFIED</span>
                    </span>
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-800">
                      Direct Git Proof
                    </span>
                  </div>

                  <div className="space-y-3 text-xs">
                    {investigation.evidence_report
                      .filter((f) => f.category === 'VERIFIED')
                      .map((finding, idx) => (
                        <div key={idx} className="space-y-1">
                          <h4 className="font-semibold text-slate-100 flex items-center gap-1">
                            <span className="text-emerald-400 font-bold">•</span>
                            <span>{finding.title}</span>
                          </h4>
                          <p className="text-slate-400 text-[11px] leading-relaxed">
                            {finding.description}
                          </p>
                          {finding.citations && finding.citations.length > 0 && (
                            <div className="pt-1 flex flex-wrap gap-1 font-mono text-[10px]">
                              {finding.citations.map((c, ci) => (
                                <span key={ci} className="px-1.5 py-0.5 rounded bg-slate-950 text-indigo-300 border border-slate-800">
                                  {c}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                  </div>
                </div>

                {/* INFERRED FINDINGS */}
                <div className="bg-slate-900/60 border border-amber-800/80 rounded-xl p-4 space-y-3">
                  <div className="flex items-center justify-between border-b border-amber-900/60 pb-2">
                    <span className="text-xs font-bold text-amber-300 uppercase tracking-wider flex items-center gap-1.5">
                      <AlertTriangle className="w-4 h-4 text-amber-400" />
                      <span>INFERRED</span>
                    </span>
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-amber-950 text-amber-400 border border-amber-800">
                      Plausible Pattern
                    </span>
                  </div>

                  <div className="space-y-3 text-xs">
                    {investigation.evidence_report
                      .filter((f) => f.category === 'INFERRED')
                      .map((finding, idx) => (
                        <div key={idx} className="space-y-1">
                          <h4 className="font-semibold text-slate-100 flex items-center gap-1">
                            <span className="text-amber-400 font-bold">•</span>
                            <span>{finding.title}</span>
                          </h4>
                          <p className="text-slate-400 text-[11px] leading-relaxed">
                            {finding.description}
                          </p>
                        </div>
                      ))}
                  </div>
                </div>

                {/* UNKNOWN CONTEXT */}
                <div className="bg-slate-900/60 border border-rose-800/80 rounded-xl p-4 space-y-3">
                  <div className="flex items-center justify-between border-b border-rose-900/60 pb-2">
                    <span className="text-xs font-bold text-rose-300 uppercase tracking-wider flex items-center gap-1.5">
                      <HelpCircle className="w-4 h-4 text-rose-400" />
                      <span>UNKNOWN</span>
                    </span>
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-rose-950 text-rose-400 border border-rose-800">
                      Unrecorded Context
                    </span>
                  </div>

                  <div className="space-y-3 text-xs">
                    {investigation.evidence_report
                      .filter((f) => f.category === 'UNKNOWN')
                      .map((finding, idx) => (
                        <div key={idx} className="space-y-1">
                          <h4 className="font-semibold text-slate-100 flex items-center gap-1">
                            <span className="text-rose-400 font-bold">•</span>
                            <span>{finding.title}</span>
                          </h4>
                          <p className="text-slate-400 text-[11px] leading-relaxed">
                            {finding.description}
                          </p>
                        </div>
                      ))}
                  </div>
                </div>

              </div>
            </div>

            {/* 4. MISSING CONTEXT DETECTOR */}
            <div className="bg-slate-900/40 border border-slate-800 rounded-xl p-4 space-y-4">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center space-x-2">
                  <FileSearch className="w-4 h-4 text-purple-400" />
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200">
                    Missing Context Detector
                  </h3>
                </div>
                <span className="text-[11px] font-mono text-slate-400">
                  Empirical audit of commit metadata completeness
                </span>
              </div>

              {/* Counters */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="p-3 rounded-lg bg-slate-950 border border-slate-800/80">
                  <div className="text-[10px] uppercase font-mono text-slate-400">Vague Commit Messages</div>
                  <div className="text-lg font-bold font-mono text-amber-300 mt-0.5">
                    {investigation.missing_context.vague_commits_count} / {investigation.missing_context.total_commits_evaluated || investigation.dna_timeline.length}
                  </div>
                </div>

                <div className="p-3 rounded-lg bg-slate-950 border border-slate-800/80">
                  <div className="text-[10px] uppercase font-mono text-slate-400">Lacking Issue/PR Link</div>
                  <div className="text-lg font-bold font-mono text-slate-200 mt-0.5">
                    {investigation.missing_context.commits_without_issue_ref_count} / {investigation.missing_context.total_commits_evaluated || investigation.dna_timeline.length}
                  </div>
                </div>

                <div className="p-3 rounded-lg bg-slate-950 border border-slate-800/80">
                  <div className="text-[10px] uppercase font-mono text-slate-400">Without Accompanying Tests</div>
                  <div className="text-lg font-bold font-mono text-slate-200 mt-0.5">
                    {investigation.missing_context.commits_without_tests_count} / {investigation.missing_context.total_commits_evaluated || investigation.dna_timeline.length}
                  </div>
                </div>

                <div className="p-3 rounded-lg bg-slate-950 border border-slate-800/80">
                  <div className="text-[10px] uppercase font-mono text-slate-400">Code Documentation</div>
                  <div className={`text-sm font-bold font-mono mt-1 ${
                    investigation.missing_context.code_documentation_status === 'DOCUMENTED'
                      ? 'text-emerald-400'
                      : investigation.missing_context.code_documentation_status === 'PARTIALLY_DOCUMENTED'
                      ? 'text-amber-400'
                      : 'text-slate-400'
                  }`}>
                    {investigation.missing_context.code_documentation_status || 'NOT AUDITED'}
                  </div>
                </div>
              </div>

              {/* Categorized Context & Quality Notes */}
              <div className="text-xs text-slate-400 space-y-1.5 pt-1">
                {investigation.missing_context.code_documentation_notes && investigation.missing_context.code_documentation_notes.map((note, idx) => (
                  <p key={`doc-${idx}`} className="flex items-center gap-2">
                    <span className="text-indigo-400 font-bold">•</span>
                    <span><strong className="text-slate-300">Code Syntax:</strong> {note}</span>
                  </p>
                ))}
                {investigation.missing_context.commit_message_quality_notes && investigation.missing_context.commit_message_quality_notes.map((note, idx) => (
                  <p key={`msg-${idx}`} className="flex items-center gap-2">
                    <span className="text-amber-400 font-bold">•</span>
                    <span><strong className="text-slate-300">Commit Subject:</strong> {note}</span>
                  </p>
                ))}
                {investigation.missing_context.test_coverage_notes && investigation.missing_context.test_coverage_notes.map((note, idx) => (
                  <p key={`test-${idx}`} className="flex items-center gap-2">
                    <span className="text-cyan-400 font-bold">•</span>
                    <span><strong className="text-slate-300">Test Verification:</strong> {note}</span>
                  </p>
                ))}
                {investigation.missing_context.untracked_external_context_notes && investigation.missing_context.untracked_external_context_notes.map((note, idx) => (
                  <p key={`ext-${idx}`} className="flex items-center gap-2">
                    <span className="text-slate-600">•</span>
                    <span><strong className="text-slate-300">External Context:</strong> {note}</span>
                  </p>
                ))}
              </div>
            </div>

          </div>
        )}

        {/* Empty selection state */}
        {!investigation && !isInvestigating && !investigationError && (
          <div className="p-12 text-center text-slate-500 space-y-3">
            <Sparkles className="w-10 h-10 mx-auto text-slate-600" />
            <div className="text-sm font-medium text-slate-400">Ready to Investigate Code</div>
            <p className="text-xs max-w-sm mx-auto text-slate-500">
              Pick a file and function above, then click <strong>Investigate Code</strong> to trace its origin and evolution.
            </p>
          </div>
        )}

      </div>

    </div>
  );
}


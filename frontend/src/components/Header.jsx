import React, { useState } from 'react';
import { GitBranch, Search, Loader2, Sparkles, AlertCircle, ArrowRight, ShieldCheck, Terminal } from 'lucide-react';

export default function Header({
  onAnalyze,
  isLoading,
  currentRepo,
  samples = [],
  errorMessage,
  onClearError
}) {
  const [inputUrl, setInputUrl] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!inputUrl.trim() || isLoading) return;
    onAnalyze(inputUrl.trim());
  };

  const handleSelectSample = (sampleUrl) => {
    setInputUrl(sampleUrl);
    if (!isLoading) {
      onAnalyze(sampleUrl);
    }
  };

  return (
    <header className="border-b border-slate-800 bg-slate-950/80 backdrop-blur sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 py-3 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          
          {/* Logo & Tagline */}
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 via-purple-600 to-cyan-500 p-[1px] shadow-lg shadow-indigo-500/20 flex-shrink-0">
              <div className="w-full h-full bg-slate-950 rounded-[11px] flex items-center justify-center">
                <GitBranch className="w-5 h-5 text-indigo-400" />
              </div>
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-bold text-lg tracking-tight text-white flex items-center gap-1.5">
                  Repo<span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-cyan-400">Reason</span>
                </span>
                <span className="text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded bg-indigo-950/70 border border-indigo-500/30 text-indigo-300 font-semibold">
                  MVP
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Why the code is like this — Empirical Git evolution without fabricated intent
              </p>
            </div>
          </div>

          {/* URL Input Form */}
          <form onSubmit={handleSubmit} className="flex-1 max-w-2xl">
            <div className="relative flex items-center">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                <Search className="w-4 h-4" />
              </div>
              <input
                type="text"
                value={inputUrl}
                onChange={(e) => {
                  setInputUrl(e.target.value);
                  if (errorMessage) onClearError();
                }}
                placeholder="Enter public GitHub repo URL (e.g. https://github.com/pallets/flask)"
                disabled={isLoading}
                className="w-full pl-10 pr-32 py-2 text-sm bg-slate-900/90 text-slate-100 placeholder-slate-500 rounded-lg border border-slate-700/80 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition disabled:opacity-50"
              />
              <button
                type="submit"
                disabled={isLoading || !inputUrl.trim()}
                className="absolute right-1.5 px-3 py-1.5 text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-500 rounded-md transition disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5 shadow-sm shadow-indigo-950"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Analyzing...</span>
                  </>
                ) : (
                  <>
                    <span>Analyze</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </>
                )}
              </button>
            </div>
          </form>
        </div>

        {/* Quick Sample Repositories */}
        <div className="mt-2.5 pt-2 border-t border-slate-800/60 flex flex-wrap items-center gap-2 text-xs">
          <span className="text-slate-400 font-medium flex items-center gap-1">
            <Terminal className="w-3 h-3 text-cyan-400" />
            Quick Demo Repos:
          </span>
          {samples.map((sample) => (
            <button
              key={sample.url}
              onClick={() => handleSelectSample(sample.url)}
              disabled={isLoading}
              className={`px-2.5 py-1 rounded-md text-[11px] font-mono transition border ${
                currentRepo === sample.url
                  ? 'bg-indigo-950/80 border-indigo-500/50 text-indigo-300 font-semibold'
                  : 'bg-slate-900 hover:bg-slate-800/80 border-slate-800 text-slate-300 hover:text-white'
              }`}
            >
              {sample.title}
            </button>
          ))}
          <span className="ml-auto text-[11px] text-slate-400 flex items-center gap-1">
            <ShieldCheck className="w-3 h-3 text-emerald-400" />
            Zero AI hallucination · Strictly observable Git facts
          </span>
        </div>

        {/* Error notification banner if any */}
        {errorMessage && (
          <div className="mt-3 p-3 bg-rose-950/50 border border-rose-800/70 rounded-lg flex items-start gap-2.5 text-xs text-rose-200">
            <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <span className="font-semibold text-rose-300">Analysis Error: </span>
              {errorMessage}
            </div>
            <button
              onClick={onClearError}
              className="text-rose-400 hover:text-rose-200 font-mono text-[11px] px-1"
            >
              ✕
            </button>
          </div>
        )}
      </div>
    </header>
  );
}


import React from 'react';
import {
  ShieldAlert,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  FileSearch,
  Quote,
  Layers,
  HelpCircle,
  Hash,
  ExternalLink,
  Tag
} from 'lucide-react';

export default function EvidencePanel({ analysis, commitHash }) {
  if (!analysis) {
    return (
      <div className="h-full flex items-center justify-center p-6 text-slate-500 text-center">
        <div>
          <FileSearch className="w-8 h-8 mx-auto mb-2 text-slate-600" />
          <p className="text-xs">Select a commit to view empirical evidence breakdown.</p>
        </div>
      </div>
    );
  }

  const {
    evidence_sufficiency,
    is_sufficient,
    sufficiency_statement,
    facts = [],
    author_stated_intent,
    observable_mechanisms = [],
    interpretations = [],
    evidence_citations = [],
    issue_references = [],
    categories = []
  } = analysis;

  return (
    <div className="h-full flex flex-col bg-slate-950/90 border-l border-slate-800/80 overflow-y-auto">
      
      {/* Header */}
      <div className="p-3.5 border-b border-slate-800/80 bg-slate-900/60 sticky top-0 z-10 backdrop-blur">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Layers className="w-4 h-4 text-indigo-400" />
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-200">
              Why This Code Changed
            </h3>
          </div>

          {/* Sufficiency Badge */}
          {evidence_sufficiency === 'HIGH' && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-emerald-950 text-emerald-300 border border-emerald-800">
              <ShieldCheck className="w-3 h-3 text-emerald-400" />
              HIGH EVIDENCE
            </span>
          )}
          {evidence_sufficiency === 'MODERATE' && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-amber-950 text-amber-300 border border-amber-800">
              <AlertTriangle className="w-3 h-3 text-amber-400" />
              MODERATE EVIDENCE
            </span>
          )}
          {evidence_sufficiency === 'INSUFFICIENT' && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-rose-950 text-rose-300 border border-rose-800">
              <ShieldAlert className="w-3 h-3 text-rose-400" />
              INSUFFICIENT EVIDENCE
            </span>
          )}
        </div>
      </div>

      <div className="p-4 space-y-4">
        
        {/* Core Sufficiency Banner (Crucial Requirement) */}
        {!is_sufficient ? (
          <div className="p-3.5 bg-rose-950/40 border border-rose-800/80 rounded-lg text-rose-200 shadow-sm">
            <div className="flex items-start gap-2.5">
              <ShieldAlert className="w-4 h-4 text-rose-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-semibold text-rose-300 font-mono leading-relaxed">
                  {sufficiency_statement}
                </p>
                <p className="text-[11px] text-rose-400/90 mt-1 leading-normal">
                  The author provided no explanatory rationale in the commit message or issue tracker. Below is strictly observable repository evidence without invented intent.
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className="p-3 bg-emerald-950/30 border border-emerald-800/60 rounded-lg text-emerald-200">
            <div className="flex items-start gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
              <p className="text-xs font-medium text-emerald-300 leading-relaxed">
                {sufficiency_statement}
              </p>
            </div>
          </div>
        )}

        {/* Categories affected */}
        {categories.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] text-slate-400 font-medium">Domain:</span>
            {categories.map((cat) => (
              <span
                key={cat}
                className="px-2 py-0.5 rounded text-[10px] font-mono bg-slate-900 border border-slate-800 text-indigo-300"
              >
                {cat}
              </span>
            ))}
            {issue_references.map((ref) => (
              <span
                key={ref}
                className="px-2 py-0.5 rounded text-[10px] font-mono bg-indigo-950 border border-indigo-800 text-cyan-300 font-semibold"
              >
                {ref}
              </span>
            ))}
          </div>
        )}

        {/* 1. Facts (Directly Observable Evidence) */}
        <div className="space-y-2">
          <div className="flex items-center space-x-1.5 text-xs font-semibold text-slate-300 uppercase tracking-wider">
            <CheckCircle2 className="w-3.5 h-3.5 text-cyan-400" />
            <span>1. Observable Facts (Ground Truth)</span>
          </div>
          <ul className="space-y-1.5 pl-1 text-xs text-slate-300">
            {facts.map((fact, idx) => (
              <li key={idx} className="flex items-start gap-2">
                <span className="text-cyan-500 font-mono text-[11px] mt-0.5">•</span>
                <span className="leading-relaxed">{fact}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* 2. Observable Code Mechanisms */}
        {observable_mechanisms.length > 0 && (
          <div className="space-y-2 pt-2 border-t border-slate-800/60">
            <div className="flex items-center space-x-1.5 text-xs font-semibold text-slate-300 uppercase tracking-wider">
              <Layers className="w-3.5 h-3.5 text-indigo-400" />
              <span>2. Observable Code Mechanisms</span>
            </div>
            <ul className="space-y-1.5 pl-1 text-xs text-slate-300">
              {observable_mechanisms.map((mech, idx) => (
                <li key={idx} className="flex items-start gap-2">
                  <span className="text-indigo-400 font-mono text-[11px] mt-0.5">▸</span>
                  <span className="leading-relaxed">{mech}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* 3. Author Stated Intent vs Inferences */}
        <div className="space-y-2 pt-2 border-t border-slate-800/60">
          <div className="flex items-center space-x-1.5 text-xs font-semibold text-slate-300 uppercase tracking-wider">
            <Quote className="w-3.5 h-3.5 text-purple-400" />
            <span>3. Stated Intent vs. Interpretations</span>
          </div>

          {author_stated_intent ? (
            <div className="p-2.5 bg-slate-900 border border-slate-800 rounded text-xs text-indigo-200 font-mono leading-relaxed">
              <span className="text-slate-400 block text-[10px] uppercase tracking-wider font-sans mb-1 font-semibold">
                Documented Rationale:
              </span>
              {author_stated_intent}
            </div>
          ) : (
            <div className="p-2.5 bg-slate-900/60 border border-slate-800/70 rounded text-xs text-slate-400 italic">
              No rationale was documented by the author in the commit log.
            </div>
          )}

          {interpretations.length > 0 && (
            <div className="space-y-1 mt-2">
              <span className="text-[10px] uppercase font-semibold tracking-wider text-slate-400 block">
                Separated Inferences (Clearly Labeled):
              </span>
              <ul className="space-y-1.5 pl-1 text-xs text-slate-300">
                {interpretations.map((interp, idx) => (
                  <li key={idx} className="flex items-start gap-2">
                    <span className="text-purple-400 font-mono text-[11px] mt-0.5">~</span>
                    <span className="leading-relaxed text-slate-300">{interp}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* 4. Traceable Evidence Citations (Diff Excerpts) */}
        {evidence_citations.length > 0 && (
          <div className="space-y-2 pt-2 border-t border-slate-800/60">
            <div className="flex items-center space-x-1.5 text-xs font-semibold text-slate-300 uppercase tracking-wider">
              <Tag className="w-3.5 h-3.5 text-emerald-400" />
              <span>4. Traceable Diff Evidence</span>
            </div>

            <div className="space-y-2">
              {evidence_citations.map((cite, idx) => (
                <div
                  key={idx}
                  className="p-2.5 bg-slate-900/80 border border-slate-800 rounded-md font-mono text-xs space-y-1.5"
                >
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-indigo-300 font-semibold">{cite.file}</span>
                    <span className="text-slate-500">{cite.commit_hash}</span>
                  </div>
                  <pre className="p-2 bg-slate-950 rounded text-emerald-400/90 text-[11px] overflow-x-auto whitespace-pre font-mono-code border border-slate-800/70">
                    {cite.snippet}
                  </pre>
                  <div className="text-[11px] text-slate-400 font-sans">
                    <span className="text-slate-500 font-mono mr-1">Observed:</span>
                    {cite.observation}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}


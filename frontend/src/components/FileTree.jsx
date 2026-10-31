import React, { useState, useMemo } from 'react';
import {
  Folder,
  FolderOpen,
  FileCode,
  FileText,
  FileJson,
  File,
  ChevronRight,
  ChevronDown,
  Search,
  History
} from 'lucide-react';

function getFileIcon(extension) {
  const ext = (extension || '').toLowerCase();
  if (['.js', '.jsx', '.ts', '.tsx', '.mjs'].includes(ext)) {
    return <FileCode className="w-3.5 h-3.5 text-amber-400" />;
  }
  if (['.py'].includes(ext)) {
    return <FileCode className="w-3.5 h-3.5 text-sky-400" />;
  }
  if (['.json', '.yaml', '.yml', '.toml'].includes(ext)) {
    return <FileJson className="w-3.5 h-3.5 text-emerald-400" />;
  }
  if (['.md', '.txt', '.rst'].includes(ext)) {
    return <FileText className="w-3.5 h-3.5 text-slate-400" />;
  }
  return <File className="w-3.5 h-3.5 text-slate-500" />;
}

function TreeNode({ node, level = 0, selectedPath, onSelectFile, filterQuery }) {
  const [isOpen, setIsOpen] = useState(level < 1 || Boolean(filterQuery));

  if (node.type === 'dir') {
    const isFiltered = filterQuery && node.children && node.children.length > 0;
    const shouldOpen = isFiltered ? true : isOpen;

    return (
      <div>
        <button
          onClick={() => setIsOpen(!isOpen)}
          style={{ paddingLeft: `${Math.max(level * 12 + 6, 6)}px` }}
          className="w-full flex items-center space-x-1.5 py-1 text-xs text-slate-300 hover:text-white hover:bg-slate-800/50 rounded transition text-left group"
        >
          {shouldOpen ? (
            <ChevronDown className="w-3 h-3 text-slate-500 group-hover:text-slate-300 flex-shrink-0" />
          ) : (
            <ChevronRight className="w-3 h-3 text-slate-500 group-hover:text-slate-300 flex-shrink-0" />
          )}
          {shouldOpen ? (
            <FolderOpen className="w-3.5 h-3.5 text-indigo-400/80 flex-shrink-0" />
          ) : (
            <Folder className="w-3.5 h-3.5 text-indigo-400/80 flex-shrink-0" />
          )}
          <span className="truncate font-mono text-[11px]">{node.name}</span>
        </button>

        {shouldOpen && node.children && (
          <div className="flex flex-col">
            {node.children.map((child) => (
              <TreeNode
                key={child.path}
                node={child}
                level={level + 1}
                selectedPath={selectedPath}
                onSelectFile={onSelectFile}
                filterQuery={filterQuery}
              />
            ))}
          </div>
        )}
      </div>
    );
  }

  // File item
  const isSelected = selectedPath === node.path;

  return (
    <button
      onClick={() => onSelectFile(node.path)}
      style={{ paddingLeft: `${Math.max(level * 12 + 18, 18)}px` }}
      className={`w-full flex items-center justify-between py-1 pr-2 text-xs rounded transition text-left group ${
        isSelected
          ? 'bg-indigo-950/90 text-indigo-200 border-l-2 border-indigo-500 font-medium'
          : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
      }`}
    >
      <div className="flex items-center space-x-1.5 min-w-0">
        {getFileIcon(node.extension)}
        <span className="truncate font-mono text-[11px]">{node.name}</span>
      </div>
      <History className="w-3 h-3 text-slate-600 group-hover:text-indigo-400 opacity-0 group-hover:opacity-100 transition flex-shrink-0" title="Trace evolution" />
    </button>
  );
}

export default function FileTree({ tree = [], selectedPath, onSelectFile }) {
  const [filterQuery, setFilterQuery] = useState('');

  // Recursively filter tree nodes based on search
  const filteredTree = useMemo(() => {
    if (!filterQuery.trim()) return tree;
    const q = filterQuery.toLowerCase().trim();

    function filterNodes(nodes) {
      const result = [];
      for (const node of nodes) {
        if (node.type === 'file') {
          if (node.name.toLowerCase().includes(q) || node.path.toLowerCase().includes(q)) {
            result.push(node);
          }
        } else if (node.type === 'dir' && node.children) {
          const matchingChildren = filterNodes(node.children);
          if (matchingChildren.length > 0 || node.name.toLowerCase().includes(q)) {
            result.push({
              ...node,
              children: matchingChildren.length > 0 ? matchingChildren : node.children
            });
          }
        }
      }
      return result;
    }

    return filterNodes(tree);
  }, [tree, filterQuery]);

  return (
    <div className="h-full flex flex-col bg-slate-950/70 border-r border-slate-800/80">
      
      {/* Header and filter input */}
      <div className="p-2.5 border-b border-slate-800/80">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[11px] uppercase tracking-wider font-semibold text-slate-400 flex items-center gap-1.5">
            <Folder className="w-3.5 h-3.5 text-indigo-400" />
            File Explorer
          </span>
          <span className="text-[10px] font-mono text-slate-400">Click to trace evolution</span>
        </div>
        <div className="relative">
          <Search className="w-3 h-3 text-slate-500 absolute left-2.5 top-2.5" />
          <input
            type="text"
            value={filterQuery}
            onChange={(e) => setFilterQuery(e.target.value)}
            placeholder="Filter files..."
            className="w-full pl-7 pr-2 py-1 text-xs bg-slate-900 border border-slate-800 rounded text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500 font-mono"
          />
          {filterQuery && (
            <button
              onClick={() => setFilterQuery('')}
              className="absolute right-2 top-1.5 text-xs text-slate-500 hover:text-slate-300"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Tree list */}
      <div className="flex-1 overflow-y-auto p-1.5 space-y-0.5">
        {filteredTree.length === 0 ? (
          <div className="p-4 text-center text-xs text-slate-400">
            {filterQuery ? 'No matching files found.' : 'No files in repository.'}
          </div>
        ) : (
          filteredTree.map((node) => (
            <TreeNode
              key={node.path}
              node={node}
              level={0}
              selectedPath={selectedPath}
              onSelectFile={onSelectFile}
              filterQuery={filterQuery}
            />
          ))
        )}
      </div>

    </div>
  );
}


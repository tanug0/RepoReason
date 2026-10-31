import React, { useState, useEffect } from 'react';
import Header from './components/Header';
import RepoOverview from './components/RepoOverview';
import FileTree from './components/FileTree';
import CommitTimeline from './components/CommitTimeline';
import DiffViewer from './components/DiffViewer';
import EvidencePanel from './components/EvidencePanel';
import FileEvolution from './components/FileEvolution';
import CodeMysteryDetective from './components/CodeMysteryDetective';
import { EmptyState, LoadingState, ErrorState } from './components/StatusStates';

import {
  analyzeRepository,
  getCommitDetail,
  getFileEvolution,
  getSampleRepos
} from './utils/api';

import { GitCommit, FolderTree, Code2, Layers } from 'lucide-react';

export default function App() {
  const [samples, setSamples] = useState([]);
  const [currentRepoUrl, setCurrentRepoUrl] = useState('');
  const [overview, setOverview] = useState(null);
  const [fileTree, setFileTree] = useState([]);
  const [commits, setCommits] = useState([]);
  
  // Selection states
  const [selectedCommitHash, setSelectedCommitHash] = useState(null);
  const [commitDetail, setCommitDetail] = useState(null);
  const [selectedFilePath, setSelectedFilePath] = useState(null);
  const [fileEvolution, setFileEvolution] = useState(null);

  // UI modes
  const [leftSidebarTab, setLeftSidebarTab] = useState('commits'); // 'commits' | 'files'
  const [mainView, setMainView] = useState('commit_diff'); // 'commit_diff' | 'file_evolution' | 'detective'
  const [detectiveTarget, setDetectiveTarget] = useState({ filePath: '', functionName: '' });

  // Loading & error states
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingCommit, setIsLoadingCommit] = useState(false);
  const [isLoadingFileEvolution, setIsLoadingFileEvolution] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);

  // Load sample repositories on initial render
  useEffect(() => {
    getSampleRepos()
      .then(setSamples)
      .catch((err) => {
        console.warn('Failed to load sample repos:', err);
      });
  }, []);

  // Main Analyze repository action
  const handleAnalyze = async (repoUrl) => {
    setIsLoading(true);
    setErrorMessage(null);
    setSelectedFilePath(null);
    setFileEvolution(null);
    setMainView('commit_diff');

    try {
      const data = await analyzeRepository(repoUrl);
      setCurrentRepoUrl(repoUrl);
      setOverview(data.overview);
      setFileTree(data.tree);
      const recentCommits = data.overview.recent_commits || [];
      setCommits(recentCommits);

      // Automatically select the most recent commit
      if (recentCommits.length > 0) {
        handleSelectCommit(recentCommits[0].hash);
      }
    } catch (err) {
      setErrorMessage(err.message || 'Failed to analyze repository.');
    } finally {
      setIsLoading(false);
    }
  };

  // Select commit and fetch its full diff and evidence analysis
  const handleSelectCommit = async (commitHash) => {
    if (!commitHash) return;
    setSelectedCommitHash(commitHash);
    setIsLoadingCommit(true);
    setMainView('commit_diff');

    try {
      const detail = await getCommitDetail(commitHash);
      setCommitDetail(detail);
    } catch (err) {
      console.error('Failed to load commit detail:', err);
    } finally {
      setIsLoadingCommit(false);
    }
  };

  // Select a file from the explorer tree or diff view to inspect its evolution
  const handleSelectFile = async (path) => {
    if (!path) return;
    setSelectedFilePath(path);

    if (mainView === 'detective') {
      setDetectiveTarget({ filePath: path, functionName: '' });
      return;
    }

    setIsLoadingFileEvolution(true);
    setMainView('file_evolution');

    try {
      const evo = await getFileEvolution(path);
      setFileEvolution(evo);
    } catch (err) {
      console.error('Failed to load file evolution:', err);
    } finally {
      setIsLoadingFileEvolution(false);
    }
  };

  const handleOpenDetective = (path = null, funcName = null) => {
    const targetPath = path || selectedFilePath || '';
    setDetectiveTarget({ filePath: targetPath, functionName: funcName || '' });
    setMainView('detective');
  };

  const handleCloseFileEvolution = () => {
    setMainView('commit_diff');
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-950 text-slate-100 font-sans selection:bg-indigo-500/30 selection:text-indigo-200">
      
      {/* Top Application Header */}
      <Header
        onAnalyze={handleAnalyze}
        isLoading={isLoading}
        currentRepo={currentRepoUrl}
        samples={samples}
        errorMessage={errorMessage}
        onClearError={() => setErrorMessage(null)}
      />

      {/* Main Body */}
      {isLoading ? (
        <LoadingState repoUrl={currentRepoUrl} />
      ) : !overview ? (
        <EmptyState
          samples={samples}
          onSelectSample={handleAnalyze}
          isLoading={isLoading}
        />
      ) : (
        <div className="flex-1 flex flex-col min-h-0">
          
          {/* Repository Metrics Overview Bar */}
          <RepoOverview
            overview={overview}
            activeTab={mainView}
            onTabChange={setMainView}
          />

          {/* 3-Column Studio Dashboard */}
          <div className="flex-1 grid grid-cols-12 min-h-0 border-t border-slate-800/80">
            
            {/* Left Column: Explorer (File Tree & Commit Timeline Tabs) */}
            <div className="col-span-12 md:col-span-4 lg:col-span-3 flex flex-col border-r border-slate-800/80 bg-slate-950/60 min-h-[400px] md:min-h-0">
              
              {/* Sidebar Tabs */}
              <div className="flex items-center border-b border-slate-800/80 bg-slate-900/80 px-2 py-1.5 gap-1.5">
                <button
                  onClick={() => setLeftSidebarTab('commits')}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-md text-xs font-medium transition ${
                    leftSidebarTab === 'commits'
                      ? 'bg-indigo-950/90 text-indigo-200 border border-indigo-700/80 shadow-sm'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
                  }`}
                >
                  <GitCommit className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Commits ({commits.length})</span>
                </button>

                <button
                  onClick={() => setLeftSidebarTab('files')}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-md text-xs font-medium transition ${
                    leftSidebarTab === 'files'
                      ? 'bg-indigo-950/90 text-indigo-200 border border-indigo-700/80 shadow-sm'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
                  }`}
                >
                  <FolderTree className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Files ({overview.file_count})</span>
                </button>
              </div>

              {/* Sidebar Tab Content */}
              <div className="flex-1 overflow-hidden">
                {leftSidebarTab === 'commits' ? (
                  <CommitTimeline
                    commits={commits}
                    selectedCommitHash={selectedCommitHash}
                    onSelectCommit={handleSelectCommit}
                    isLoadingCommit={isLoadingCommit}
                  />
                ) : (
                  <FileTree
                    tree={fileTree}
                    selectedPath={selectedFilePath}
                    onSelectFile={handleSelectFile}
                  />
                )}
              </div>
            </div>

            {/* Center & Right Columns */}
            {mainView === 'detective' ? (
              /* Code Mystery Detective Mode */
              <div className="col-span-12 md:col-span-8 lg:col-span-9 flex flex-col min-h-[500px]">
                <CodeMysteryDetective
                  initialFilePath={detectiveTarget.filePath || selectedFilePath}
                  initialFunction={detectiveTarget.functionName}
                  fileTree={fileTree}
                  onSelectCommit={handleSelectCommit}
                  onClose={() => setMainView('commit_diff')}
                  onViewFileEvolution={(path) => {
                    setMainView('file_evolution');
                    handleSelectFile(path);
                  }}
                />
              </div>
            ) : mainView === 'file_evolution' ? (
              /* File Evolution Mode: Takes remaining space */
              <div className="col-span-12 md:col-span-8 lg:col-span-9 flex flex-col min-h-[500px]">
                <FileEvolution
                  evolution={fileEvolution}
                  filePath={selectedFilePath}
                  isLoading={isLoadingFileEvolution}
                  onClose={handleCloseFileEvolution}
                  onSelectCommit={handleSelectCommit}
                  onInvestigateDetective={handleOpenDetective}
                />
              </div>
            ) : (
              /* Commit Diff & Evidence Mode */
              <>
                {/* Center Column: Diff Viewer */}
                <div className="col-span-12 md:col-span-8 lg:col-span-5 flex flex-col min-h-[500px] border-r border-slate-800/80">
                  <DiffViewer
                    commit={commitDetail}
                    onSelectFileEvolution={handleSelectFile}
                  />
                </div>

                {/* Right Column: Evidence Panel ("Why The Code Is Like This") */}
                <div className="col-span-12 lg:col-span-4 flex flex-col min-h-[400px]">
                  <EvidencePanel
                    analysis={commitDetail?.analysis}
                    commitHash={selectedCommitHash}
                  />
                </div>
              </>
            )}

          </div>

        </div>
      )}

    </div>
  );
}

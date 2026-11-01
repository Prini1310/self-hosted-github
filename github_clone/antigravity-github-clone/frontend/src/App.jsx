import React, { useState, useEffect, useRef } from 'react';
import { listRepos, initRepo, addFile, commitFiles, getLog, getStatus, logout } from './api/client';
import BranchPage from './pages/BranchPage';
import BuildPage from './pages/BuildPage';
import CheckoutPage from './pages/CheckoutPage';
import LoginPage from './pages/LoginPage';
import PushPullPage from './pages/PushPullPage';
import PullRequestsPage from './pages/PullRequestsPage';
import EnvironmentsPage from './pages/EnvironmentsPage';
import FileBrowserPage from './pages/FileBrowserPage';

export default function App() {
  // Auth State
  const [authenticated, setAuthenticated] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);

  // Navigation / View State
  const [activeRepo, setActiveRepo] = useState('');
  const [activeView, setActiveView] = useState('welcome'); // 'welcome' | 'init' | 'dashboard'
  const [activeTab, setActiveTab] = useState('code'); // 'code' | 'commits' | 'status' | 'branches' | 'builds' | 'locks'
  const [repoList, setRepoList] = useState([]);

  // Load Repositories once on mount (without using useEffect)
  const [hasLoadedRepos, setHasLoadedRepos] = useState(false);
  if (!hasLoadedRepos) {
    setHasLoadedRepos(true);
    listRepos()
      .then((res) => {
        setRepoList(res.repos || []);
      })
      .catch((err) => {
        console.error('Failed to load repositories on mount:', err);
      });
  }

  // Refresh Repos Helper
  const refreshRepoList = async () => {
    try {
      const res = await listRepos();
      setRepoList(res.repos || []);
    } catch (err) {
      console.error('Failed to refresh repository list:', err);
    }
  };

  // Search / Jump to State
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [selectedSearchIndex, setSelectedSearchIndex] = useState(-1);

  // Section 2: Init Repo Form State
  const [initRepoName, setInitRepoName] = useState('');
  const [initLoading, setInitLoading] = useState(false);
  const [initError, setInitError] = useState('');

  // Section 3: Add File State
  const [filepath, setFilepath] = useState('');
  const [fileContent, setFileContent] = useState('');
  const [addLoading, setAddLoading] = useState(false);
  const [addSuccess, setAddSuccess] = useState('');
  const [addError, setAddError] = useState('');

  // Section 4: Commit State
  const [commitMessage, setCommitMessage] = useState('');
  const [author, setAuthor] = useState('');
  const [commitLoading, setCommitLoading] = useState(false);
  const [commitSuccess, setCommitSuccess] = useState('');
  const [commitError, setCommitError] = useState('');

  // Section 5: Status & Log State
  const [statusData, setStatusData] = useState(null);
  const [statusLoading, setStatusLoading] = useState(false);
  const [statusError, setStatusError] = useState('');

  const [logData, setLogData] = useState([]);
  const [logLoading, setLogLoading] = useState(false);
  const [logError, setLogError] = useState('');

  // ─── Actions ───────────────────────────────────────────────────────────────

  const handleInitRepo = async (e) => {
    e.preventDefault();
    if (!initRepoName.trim()) {
      setInitError('Repository name is required');
      return;
    }
    setInitLoading(true);
    setInitError('');
    try {
      const repoName = initRepoName.trim();
      await initRepo(repoName);
      setInitRepoName('');
      await refreshRepoList();
      setActiveRepo(repoName);
      setActiveView('dashboard');
      setActiveTab('code');
      // Reset dashboard states
      resetDashboardFormStates();
    } catch (err) {
      setInitError(err.response?.data?.error || err.message || 'Failed to initialise repository');
    } finally {
      setInitLoading(false);
    }
  };

  const handleAddFile = async (e) => {
    e.preventDefault();
    if (!filepath.trim()) {
      setAddError('File path is required');
      return;
    }
    setAddLoading(true);
    setAddSuccess('');
    setAddError('');
    try {
      const pathValue = filepath.trim();
      const res = await addFile(activeRepo, pathValue, fileContent);
      setAddSuccess(`✅ Staged ${pathValue} (hash: ${res.blobHash.slice(0, 7)})`);
      setFilepath('');
      setFileContent('');
    } catch (err) {
      setAddError(err.response?.data?.error || err.message || 'Failed to stage file');
    } finally {
      setAddLoading(false);
    }
  };

  const handleCommitChanges = async (e) => {
    e.preventDefault();
    if (!commitMessage.trim()) {
      setCommitError('Commit message is required');
      return;
    }
    setCommitLoading(true);
    setCommitSuccess('');
    setCommitError('');
    try {
      const authorVal = author.trim() || 'dev';
      const msgVal = commitMessage.trim();
      const res = await commitFiles(activeRepo, authorVal, msgVal);
      setCommitSuccess(`✅ Committed — ${res.commitHash.slice(0, 7)}`);
      setCommitMessage('');
      setAuthor('');
    } catch (err) {
      setCommitError(err.response?.data?.error || err.message || 'Failed to commit');
    } finally {
      setCommitLoading(false);
    }
  };

  const loadStatus = async () => {
    setStatusLoading(true);
    setStatusError('');
    try {
      const res = await getStatus(activeRepo);
      setStatusData(res);
    } catch (err) {
      setStatusError(err.response?.data?.error || err.message || 'Failed to load status');
    } finally {
      setStatusLoading(false);
    }
  };

  const loadCommits = async () => {
    setLogLoading(true);
    setLogError('');
    try {
      const res = await getLog(activeRepo);
      setLogData(res.log || []);
    } catch (err) {
      setLogError(err.response?.data?.error || err.message || 'Failed to load commits');
    } finally {
      setLogLoading(false);
    }
  };

  const selectRepo = (repoName) => {
    setActiveRepo(repoName);
    setActiveView('dashboard');
    setActiveTab('code');
    resetDashboardFormStates();
  };

  const handleNewRepoClick = () => {
    setActiveView('init');
    setInitRepoName('');
    setInitError('');
  };

  const selectTab = (tabName) => {
    setActiveTab(tabName);
    if (tabName === 'status') {
      loadStatus();
    } else if (tabName === 'commits') {
      loadCommits();
    }
  };

  const resetDashboardFormStates = () => {
    setFilepath('');
    setFileContent('');
    setAddSuccess('');
    setAddError('');
    setCommitMessage('');
    setAuthor('');
    setCommitSuccess('');
    setCommitError('');
    setStatusData(null);
    setStatusError('');
    setLogData([]);
    setLogError('');
  };

  // Filtered repositories based on search query
  const filteredRepos = repoList.filter((name) =>
    name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Total dropdown items = matched repos + "Create new repository" option
  const totalDropdownItems = filteredRepos.length + 1;

  // Handle hotkey '/' to focus search bar
  useEffect(() => {
    const handleGlobalKeyDown = (e) => {
      if (
        e.key === '/' &&
        document.activeElement?.id !== 'search-bar-input' &&
        document.activeElement?.tagName !== 'INPUT' &&
        document.activeElement?.tagName !== 'TEXTAREA'
      ) {
        e.preventDefault();
        const searchInput = document.getElementById('search-bar-input');
        if (searchInput) {
          searchInput.focus();
          searchInput.select();
        }
      }
    };
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, []);

  // Listen to 'auth:expired' to force logout and redirect
  useEffect(() => {
    const handleAuthExpired = () => {
      logout();
      setAuthenticated(false);
      setCurrentUser(null);
    };
    window.addEventListener('auth:expired', handleAuthExpired);
    return () => window.removeEventListener('auth:expired', handleAuthExpired);
  }, []);

  const handleSearchKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedSearchIndex((prev) => (prev + 1) % totalDropdownItems);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedSearchIndex((prev) => (prev <= 0 ? totalDropdownItems - 1 : prev - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (selectedSearchIndex >= 0 && selectedSearchIndex < filteredRepos.length) {
        selectRepo(filteredRepos[selectedSearchIndex]);
      } else if (selectedSearchIndex === filteredRepos.length) {
        handleNewRepoClick();
      } else if (selectedSearchIndex === -1 && filteredRepos.length > 0) {
        selectRepo(filteredRepos[0]);
      }
      setIsSearchFocused(false);
      setSearchQuery('');
      document.getElementById('search-bar-input')?.blur();
    } else if (e.key === 'Escape') {
      setIsSearchFocused(false);
      document.getElementById('search-bar-input')?.blur();
    }
  };

  const handleDropdownItemClick = (index) => {
    if (index < filteredRepos.length) {
      selectRepo(filteredRepos[index]);
    } else {
      handleNewRepoClick();
    }
    setSearchQuery('');
    setIsSearchFocused(false);
  };

  if (!authenticated) {
    return (
      <LoginPage
        onLogin={(user) => {
          setAuthenticated(true);
          setCurrentUser(user);
          refreshRepoList();
        }}
      />
    );
  }

  return (
    <div className="app-wrapper">
      <style>{`
        :root {
          --bg-canvas: #0d1117;
          --bg-default: #161b22;
          --bg-subtle: #21262d;
          --border: #30363d;
          --border-muted: #21262d;
          --text-primary: #e6edf3;
          --text-secondary: #8b949e;
          --text-link: #58a6ff;
          --accent-green: #238636;
          --accent-green-hover: #2ea043;
          --accent-red: #f85149;
          --accent-blue: #1f6feb;
          --tag-bg: #21262d;
          --input-bg: #0d1117;
          --success: #3fb950;
        }

        * {
          box-sizing: border-box;
        }

        body {
          margin: 0;
          padding: 0;
          background-color: var(--bg-canvas);
          color: var(--text-primary);
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif;
        }

        .app-wrapper {
          background-color: var(--bg-canvas);
          color: var(--text-primary);
          min-height: 100vh;
          display: flex;
          flex-direction: column;
        }

        /* Navbar */
        .navbar {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          height: 56px;
          background-color: var(--bg-default);
          border-bottom: 1px solid var(--border);
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0 24px;
          z-index: 100;
        }
        .navbar-left {
          display: flex;
          align-items: center;
          gap: 10px;
          cursor: pointer;
        }
        .logo-svg {
          fill: var(--text-primary);
        }
        .brand-name {
          font-weight: 700;
          font-size: 16px;
          color: var(--text-primary);
        }
        .navbar-center {
          flex-grow: 1;
          max-width: 320px;
          position: relative;
        }
        .search-bar-container {
          position: relative;
          width: 100%;
          display: flex;
          align-items: center;
        }
        .search-bar {
          width: 100%;
          background-color: var(--input-bg);
          border: 1px solid var(--border);
          border-radius: 6px;
          padding: 6px 36px 6px 12px;
          font-size: 13px;
          color: var(--text-primary);
          font-family: inherit;
          transition: border-color 0.2s, box-shadow 0.2s;
        }
        .search-bar:focus {
          outline: none;
          border-color: var(--text-link);
          box-shadow: 0 0 0 3px rgba(88, 166, 255, 0.15);
        }
        .search-bar::placeholder {
          color: var(--text-secondary);
        }
        .search-hotkey-badge {
          position: absolute;
          right: 8px;
          background-color: var(--bg-subtle);
          border: 1px solid var(--border);
          border-radius: 3px;
          color: var(--text-secondary);
          font-size: 11px;
          padding: 2px 5px;
          pointer-events: none;
          font-family: monospace;
          line-height: 1;
        }
        .search-results-dropdown {
          position: absolute;
          top: 100%;
          left: 0;
          right: 0;
          background-color: var(--bg-default);
          border: 1px solid var(--border);
          border-radius: 6px;
          margin-top: 4px;
          max-height: 280px;
          overflow-y: auto;
          box-shadow: 0 8px 24px rgba(0,0,0,0.5);
          z-index: 1000;
          display: flex;
          flex-direction: column;
          padding: 8px 0;
        }
        .search-result-item {
          padding: 8px 16px;
          font-size: 13px;
          color: var(--text-primary);
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 8px;
          transition: background-color 0.2s;
          text-decoration: none;
        }
        .search-result-item:hover, .search-result-item.active {
          background-color: var(--bg-subtle);
        }
        .search-result-item-icon {
          color: var(--text-secondary);
          flex-shrink: 0;
        }
        .search-result-item-name {
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .search-result-item-action {
          margin-left: auto;
          font-size: 11px;
          color: var(--text-secondary);
          background-color: var(--tag-bg);
          padding: 2px 6px;
          border-radius: 3px;
          border: 1px solid var(--border);
        }
        .search-divider {
          height: 1px;
          background-color: var(--border);
          margin: 6px 0;
        }
        .navbar-right {
          display: flex;
          align-items: center;
        }
        .dashboard-link {
          color: var(--text-secondary);
          text-decoration: none;
          font-size: 14px;
          cursor: pointer;
          font-weight: 500;
        }
        .dashboard-link:hover {
          color: var(--text-primary);
        }

        /* Layout */
        .main-layout {
          display: flex;
          margin-top: 56px;
          flex-grow: 1;
          height: calc(100vh - 56px);
        }

        /* Sidebar */
        .sidebar {
          width: 260px;
          background-color: var(--bg-canvas);
          border-right: 1px solid var(--border);
          padding: 24px 16px;
          display: flex;
          flex-direction: column;
          gap: 16px;
          overflow-y: auto;
        }
        .sidebar-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        .sidebar-title {
          font-weight: 600;
          color: var(--text-primary);
          font-size: 14px;
          display: flex;
          align-items: center;
          gap: 6px;
        }
        .btn-new {
          background-color: var(--accent-green);
          color: white;
          border: none;
          border-radius: 6px;
          padding: 4px 10px;
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
          transition: background-color 0.2s;
        }
        .btn-new:hover {
          background-color: var(--accent-green-hover);
        }
        .repo-list {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }
        .repo-item {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 8px 12px;
          border-radius: 6px;
          cursor: pointer;
          font-size: 14px;
          color: var(--text-primary);
          border-left: 2px solid transparent;
          transition: background-color 0.2s;
          user-select: none;
        }
        .repo-item:hover {
          background-color: var(--bg-default);
        }
        .repo-item.active {
          background-color: var(--bg-subtle);
          border-left: 2px solid var(--text-link);
          font-weight: 500;
        }
        .repo-icon {
          color: var(--text-secondary);
        }
        .empty-sidebar {
          color: var(--text-secondary);
          font-size: 13px;
          font-style: italic;
          padding: 8px 12px;
        }

        /* Content Area */
        .content-area {
          flex-grow: 1;
          padding: 24px 32px;
          overflow-y: auto;
          background-color: var(--bg-canvas);
        }

        /* Welcome view */
        .welcome-card {
          text-align: center;
          max-width: 520px;
          margin: 80px auto 0 auto;
          background-color: var(--bg-default);
          border: 1px solid var(--border);
          border-radius: 6px;
          padding: 40px 32px;
        }
        .welcome-icon-container {
          display: flex;
          justify-content: center;
          margin-bottom: 20px;
        }
        .welcome-title {
          font-size: 22px;
          font-weight: 600;
          margin-bottom: 12px;
          color: var(--text-primary);
        }
        .welcome-subtext {
          color: var(--text-secondary);
          font-size: 14px;
          line-height: 1.5;
          margin-bottom: 24px;
        }

        /* Card panels */
        .github-card {
          background-color: var(--bg-default);
          border: 1px solid var(--border);
          border-radius: 6px;
          padding: 24px;
          max-width: 800px;
          margin: 0 auto;
        }
        .card-title {
          font-size: 18px;
          font-weight: 600;
          margin-top: 0;
          margin-bottom: 16px;
        }
        .form-group {
          margin-bottom: 16px;
        }
        .form-label {
          display: block;
          font-weight: 600;
          font-size: 14px;
          margin-bottom: 8px;
        }
        .form-helper {
          color: var(--text-secondary);
          font-size: 12px;
          margin-top: 6px;
        }
        .hr-muted {
          border: 0;
          border-top: 1px solid var(--border);
          margin: 20px 0;
        }
        .input-text, .textarea-text {
          width: 100%;
          background-color: var(--input-bg);
          border: 1px solid var(--border);
          border-radius: 6px;
          padding: 8px 12px;
          font-size: 14px;
          color: var(--text-primary);
          font-family: inherit;
        }
        .input-text:focus, .textarea-text:focus {
          outline: none;
          border-color: var(--text-link);
          box-shadow: 0 0 0 3px rgba(88, 166, 255, 0.15);
        }
        .textarea-text {
          height: 160px;
          resize: vertical;
          font-family: monospace;
        }

        /* Buttons */
        .btn-green {
          background-color: var(--accent-green);
          color: white;
          border: none;
          border-radius: 6px;
          padding: 8px 16px;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          transition: background-color 0.2s;
          font-family: inherit;
        }
        .btn-green:hover:not(:disabled) {
          background-color: var(--accent-green-hover);
        }
        .btn-green:disabled {
          background-color: #216e39;
          color: var(--text-secondary);
          cursor: not-allowed;
        }
        .btn-outline {
          background-color: transparent;
          color: var(--text-secondary);
          border: 1px solid var(--border);
          border-radius: 6px;
          padding: 6px 12px;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          transition: border-color 0.2s, color 0.2s;
          font-family: inherit;
        }
        .btn-outline:hover:not(:disabled) {
          color: var(--text-primary);
          border-color: var(--text-primary);
        }

        /* Repo Dashboard View */
        .repo-title-row {
          font-size: 20px;
          font-weight: 400;
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 20px;
          color: var(--text-primary);
        }
        .repo-title-bold {
          font-weight: 600;
        }
        .tabs-row {
          display: flex;
          border-bottom: 1px solid var(--border);
          margin-bottom: 24px;
        }
        .tab-btn {
          background: none;
          border: none;
          color: var(--text-secondary);
          padding: 10px 16px;
          font-size: 14px;
          cursor: pointer;
          border-bottom: 2px solid transparent;
          display: flex;
          align-items: center;
          gap: 8px;
          transition: color 0.2s;
          font-family: inherit;
        }
        .tab-btn:hover {
          color: var(--text-primary);
        }
        .tab-btn.active {
          color: var(--text-primary);
          border-bottom: 2px solid #f78166;
          font-weight: 600;
        }

        /* Banner alerts */
        .banner {
          padding: 12px 16px;
          border-radius: 6px;
          font-size: 14px;
          margin-bottom: 16px;
          font-weight: 500;
        }
        .banner-success {
          background-color: rgba(56, 139, 253, 0.1);
          border: 1px solid rgba(56, 139, 253, 0.4);
          color: var(--text-primary);
        }
        .banner-error {
          background-color: rgba(248, 81, 73, 0.1);
          border: 1px solid rgba(248, 81, 73, 0.4);
          color: var(--accent-red);
        }

        /* Code Tab Details */
        .code-tab-layout {
          display: flex;
          flex-direction: column;
          gap: 20px;
          max-width: 800px;
          margin: 0 auto;
        }
        .stage-panel {
          background-color: var(--bg-default);
          border: 1px solid var(--border);
          border-radius: 6px;
          padding: 20px;
        }
        .stage-subheading {
          color: var(--text-secondary);
          font-size: 12px;
          font-weight: 600;
          text-transform: uppercase;
          margin-bottom: 12px;
          display: block;
        }
        .stage-inputs-row {
          display: flex;
          gap: 12px;
          margin-bottom: 12px;
        }
        .stage-inputs-row .input-text {
          flex: 1;
          margin-bottom: 0;
        }
        .commit-panel {
          background-color: var(--bg-default);
          border: 1px solid var(--border);
          border-radius: 6px;
          padding: 20px;
        }

        /* Commits Tab Details */
        .commits-container {
          max-width: 800px;
          margin: 0 auto;
        }
        .commits-header {
          display: flex;
          align-items: center;
          gap: 10px;
          margin-bottom: 16px;
          border-bottom: 1px solid var(--border);
          padding-bottom: 12px;
        }
        .commits-title {
          font-size: 16px;
          font-weight: 600;
          margin: 0;
        }
        .branch-badge {
          background-color: var(--tag-bg);
          border: 1px solid var(--border);
          border-radius: 2em;
          padding: 2px 10px;
          font-size: 12px;
          font-weight: 600;
          color: var(--text-secondary);
          display: flex;
          align-items: center;
          gap: 4px;
        }
        .commit-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 12px 16px;
          border-bottom: 1px solid var(--border);
          background-color: var(--bg-default);
        }
        .commit-row:first-of-type {
          border-top-left-radius: 6px;
          border-top-right-radius: 6px;
          border-top: 1px solid var(--border);
        }
        .commit-row:last-of-type {
          border-bottom-left-radius: 6px;
          border-bottom-right-radius: 6px;
          border-bottom: 1px solid var(--border);
        }
        .commit-info-left {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }
        .commit-message-title {
          font-weight: 600;
          font-size: 14px;
          color: var(--text-primary);
        }
        .commit-meta {
          font-size: 12px;
          color: var(--text-secondary);
        }
        .commit-info-right {
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .hash-pill {
          font-family: monospace;
          background-color: var(--bg-canvas);
          border: 1px solid var(--border);
          border-radius: 6px;
          padding: 4px 8px;
          font-size: 12px;
          color: var(--text-link);
          font-weight: 600;
        }
        .clipboard-btn {
          background: none;
          border: none;
          color: var(--text-secondary);
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 4px;
          border-radius: 6px;
        }
        .clipboard-btn:hover {
          color: var(--text-primary);
          background-color: var(--bg-subtle);
        }
        .empty-commits-card {
          background-color: var(--bg-default);
          border: 1px solid var(--border);
          border-radius: 6px;
          padding: 40px;
          text-align: center;
        }
        .empty-commits-text {
          color: var(--text-secondary);
          font-size: 14px;
          margin-top: 8px;
        }

        /* Status Tab Details */
        .status-container {
          max-width: 800px;
          margin: 0 auto;
          display: flex;
          flex-direction: column;
          gap: 20px;
        }
        .status-grid {
          display: flex;
          gap: 20px;
        }
        .status-card {
          flex: 1;
          background-color: var(--bg-default);
          border: 1px solid var(--border);
          border-radius: 6px;
          padding: 20px;
          display: flex;
          flex-direction: column;
        }
        .status-card-header {
          display: flex;
          align-items: center;
          gap: 8px;
          font-weight: 600;
          font-size: 14px;
          color: var(--text-primary);
          margin-bottom: 16px;
          border-bottom: 1px solid var(--border);
          padding-bottom: 12px;
        }
        .status-icon {
          color: var(--text-secondary);
        }
        .status-card-value {
          font-family: monospace;
          color: var(--text-link);
          font-size: 14px;
          font-weight: 600;
          margin-bottom: 8px;
          word-break: break-all;
        }
        .status-card-label {
          color: var(--text-secondary);
          font-size: 13px;
        }
        .staged-files-list {
          list-style: none;
          padding: 0;
          margin: 0;
          display: flex;
          flex-direction: column;
          gap: 8px;
          max-height: 240px;
          overflow-y: auto;
        }
        .staged-file-item {
          display: flex;
          align-items: center;
          font-size: 13px;
          font-family: monospace;
        }
        .green-dot {
          width: 8px;
          height: 8px;
          background-color: var(--success);
          border-radius: 50%;
          margin-right: 8px;
          display: inline-block;
          flex-shrink: 0;
        }
        .staged-file-path {
          color: var(--text-primary);
        }
        .clean-tree-text {
          color: var(--text-secondary);
          font-size: 13px;
          font-style: italic;
        }
        .refresh-status-row {
          display: flex;
          justify-content: flex-end;
          margin-top: 12px;
        }
      `}</style>

      {/* NAVBAR */}
      <nav className="navbar">
        <div className="navbar-left" onClick={() => setActiveView('welcome')}>
          <svg className="logo-svg" height="32" viewBox="0 0 16 16" width="32">
            <path d="M8 0c4.42 0 8 3.58 8 8a8.013 8.013 0 0 1-5.45 7.59c-.4.08-.55-.17-.55-.38 0-.27.01-1.13.01-2.2 0-.75-.25-1.23-.54-1.48 1.78-.2 3.65-.88 3.65-3.95 0-.88-.31-1.59-.82-2.15.08-.2.36-1.02-.08-2.12 0 0-.67-.22-2.2.82-.64-.18-1.32-.27-2-.27-.68 0-1.36.09-2 .27-1.53-1.03-2.2-.82-2.2-.82-.44 1.1-.16 1.92-.08 2.12-.51.56-.82 1.28-.82 2.15 0 3.06 1.86 3.75 3.64 3.95-.23.2-.44.55-.51 1.07-.46.21-1.61.55-2.33-.66-.15-.24-.6-.83-1.23-.82-.67.01-.27.38.01.53.34.19.73.9.82 1.13.16.45.68 1.35 3.12.88.01.64.01 1.24.01 1.53 0 .21-.15.47-.56.38A8.006 8.006 0 0 1 0 8c0-4.42 3.58-8 8-8z" />
          </svg>
          <span className="brand-name">⚡ VRel</span>
        </div>
        <div className="navbar-center">
          <div className="search-bar-container">
            <input
              id="search-bar-input"
              type="text"
              className="search-bar"
              placeholder="Search or jump to..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setSelectedSearchIndex(-1);
              }}
              onFocus={() => setIsSearchFocused(true)}
              onBlur={() => {
                // Small timeout to allow click/mousedown handlers on dropdown items to trigger
                setTimeout(() => setIsSearchFocused(false), 200);
              }}
              onKeyDown={handleSearchKeyDown}
            />
            {!isSearchFocused && !searchQuery && <span className="search-hotkey-badge">/</span>}
          </div>

          {isSearchFocused && (
            <div className="search-results-dropdown">
              {filteredRepos.length > 0 ? (
                filteredRepos.map((name, index) => (
                  <div
                    key={name}
                    className={`search-result-item ${selectedSearchIndex === index ? 'active' : ''}`}
                    onMouseDown={() => handleDropdownItemClick(index)}
                    onMouseEnter={() => setSelectedSearchIndex(index)}
                  >
                    <span className="search-result-item-icon">📁</span>
                    <span className="search-result-item-name">{name}</span>
                    <span className="search-result-item-action">Jump to repo</span>
                  </div>
                ))
              ) : (
                <div className="search-result-item" style={{ color: 'var(--text-secondary)', cursor: 'default' }}>
                  No matching repositories
                </div>
              )}
              <div className="search-divider" />
              <div
                className={`search-result-item ${selectedSearchIndex === filteredRepos.length ? 'active' : ''}`}
                onMouseDown={() => handleDropdownItemClick(filteredRepos.length)}
                onMouseEnter={() => setSelectedSearchIndex(filteredRepos.length)}
              >
                <span className="search-result-item-icon">➕</span>
                <span className="search-result-item-name">Create new repository...</span>
              </div>
            </div>
          )}
        </div>
        <div className="navbar-right" style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <span className="dashboard-link" onClick={() => setActiveView('welcome')} style={{ marginRight: '8px' }}>
            Dashboard
          </span>
          {currentUser && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px' }}>
              <span style={{ color: 'var(--text-primary)', fontWeight: '600' }}>👤 {currentUser}</span>
              <button
                className="btn-outline"
                style={{ padding: '3px 8px', fontSize: '12px' }}
                onClick={() => {
                  logout();
                  setAuthenticated(false);
                  setCurrentUser(null);
                }}
              >
                Sign out
              </button>
            </div>
          )}
        </div>
      </nav>

      {/* TWO-COLUMN LAYOUT */}
      <div className="main-layout">
        {/* SIDEBAR */}
        <aside className="sidebar">
          <div className="sidebar-header">
            <span className="sidebar-title">
              <svg height="16" viewBox="0 0 16 16" width="16" fill="currentColor">
                <path d="M2 2.5A2.5 2.5 0 0 1 4.5 0h8.75a.75.75 0 0 1 .75.75v12.5a.75.75 0 0 1-.75.75h-2.5a.75.75 0 1 1 0-1.5h1.75v-2h-8a1 1 0 0 0-.714 1.7.75.75 0 0 1-1.072 1.05A2.495 2.495 0 0 1 2 11.5Zm10.5-1V9h-8c-.356 0-.694.074-1 .208V2.5a1 1 0 0 1 1-1h8Z" />
              </svg>
              Repositories
            </span>
            <button className="btn-new" onClick={handleNewRepoClick}>
              New
            </button>
          </div>
          <div className="repo-list">
            {repoList.length > 0 ? (
              repoList.map((name) => (
                <div
                  key={name}
                  className={`repo-item ${activeRepo === name && activeView === 'dashboard' ? 'active' : ''}`}
                  onClick={() => selectRepo(name)}
                >
                  <span className="repo-icon">📁</span>
                  <span>{name}</span>
                </div>
              ))
            ) : (
              <span className="empty-sidebar">No repositories yet</span>
            )}
          </div>
        </aside>

        {/* MAIN CONTENT AREA */}
        <main className="content-area">
          {/* VIEW 1: Welcome */}
          {activeView === 'welcome' && (
            <div className="welcome-card">
              <div className="welcome-icon-container">
                <svg height="64" viewBox="0 0 16 16" width="64" fill="#8b949e">
                  <path d="M8 0c4.42 0 8 3.58 8 8a8.013 8.013 0 0 1-5.45 7.59c-.4.08-.55-.17-.55-.38 0-.27.01-1.13.01-2.2 0-.75-.25-1.23-.54-1.48 1.78-.2 3.65-.88 3.65-3.95 0-.88-.31-1.59-.82-2.15.08-.2.36-1.02-.08-2.12 0 0-.67-.22-2.2.82-.64-.18-1.32-.27-2-.27-.68 0-1.36.09-2 .27-1.53-1.03-2.2-.82-2.2-.82-.44 1.1-.16 1.92-.08 2.12-.51.56-.82 1.28-.82 2.15 0 3.06 1.86 3.75 3.64 3.95-.23.2-.44.55-.51 1.07-.46.21-1.61.55-2.33-.66-.15-.24-.6-.83-1.23-.82-.67.01-.27.38.01.53.34.19.73.9.82 1.13.16.45.68 1.35 3.12.88.01.64.01 1.24.01 1.53 0 .21-.15.47-.56.38A8.006 8.006 0 0 1 0 8c0-4.42 3.58-8 8-8z" />
                </svg>
              </div>
              <h1 className="welcome-title">Welcome to VRel</h1>
              <p className="welcome-subtext">
                Create a new repository or select one from the sidebar to get started with content-addressed storage version control.
              </p>
              <button className="btn-green" onClick={handleNewRepoClick}>
                Create New Repository
              </button>
            </div>
          )}

          {/* VIEW 2: Init Repo Form */}
          {activeView === 'init' && (
            <div className="github-card">
              <h1 className="card-title" style={{ fontSize: '20px', marginBottom: '8px' }}>
                Create a new repository
              </h1>
              <p style={{ color: 'var(--text-secondary)', fontSize: '14px', margin: '0 0 16px 0' }}>
                A repository contains all your commit histories, files, and staged index.
              </p>
              <hr className="hr-muted" />
              <form onSubmit={handleInitRepo}>
                <div className="form-group">
                  <label className="form-label" htmlFor="repo-name-input">
                    Repository name *
                  </label>
                  <input
                    type="text"
                    id="repo-name-input"
                    className="input-text"
                    placeholder="my-project"
                    value={initRepoName}
                    onChange={(e) => setInitRepoName(e.target.value)}
                    disabled={initLoading}
                  />
                  <div className="form-helper">
                    Great repository names are short and memorable.
                  </div>
                </div>
                <hr className="hr-muted" />
                <button type="submit" className="btn-green" disabled={initLoading}>
                  {initLoading ? '...' : 'Create repository'}
                </button>
                {initError && (
                  <div className="message-error" style={{ marginTop: '12px' }}>
                    ❌ {initError}
                  </div>
                )}
              </form>
            </div>
          )}

          {/* VIEW 3: Repo Dashboard */}
          {activeView === 'dashboard' && activeRepo && (
            <div>
              {/* TOP BAR / BREADCRUMB */}
              <div className="repo-title-row">
                <span>📁</span>
                <span className="repo-title-bold">{activeRepo}</span>
              </div>

              {/* TABS ROW */}
              <div className="tabs-row">
                <button
                  type="button"
                  className={`tab-btn ${activeTab === 'code' ? 'active' : ''}`}
                  onClick={() => selectTab('code')}
                >
                  <span>📁</span> Code
                </button>
                <button
                  type="button"
                  className={`tab-btn ${activeTab === 'stage' ? 'active' : ''}`}
                  onClick={() => selectTab('stage')}
                >
                  <span>📝</span> Stage
                </button>
                <button
                  type="button"
                  className={`tab-btn ${activeTab === 'commits' ? 'active' : ''}`}
                  onClick={() => selectTab('commits')}
                >
                  <span>🕒</span> Commits
                </button>
                <button
                  type="button"
                  className={`tab-btn ${activeTab === 'status' ? 'active' : ''}`}
                  onClick={() => selectTab('status')}
                >
                  <span>📊</span> Status
                </button>
                <button
                  type="button"
                  className={`tab-btn ${activeTab === 'branches' ? 'active' : ''}`}
                  onClick={() => selectTab('branches')}
                >
                  <span>🌿</span> Branches
                </button>
                <button
                  type="button"
                  className={`tab-btn ${activeTab === 'builds' ? 'active' : ''}`}
                  onClick={() => selectTab('builds')}
                >
                  <span>⚙️</span> Builds
                </button>
                <button
                  type="button"
                  className={`tab-btn ${activeTab === 'locks' ? 'active' : ''}`}
                  onClick={() => selectTab('locks')}
                >
                  <span>🔒</span> Locks
                </button>
                <button
                  type="button"
                  className={`tab-btn ${activeTab === 'pushpull' ? 'active' : ''}`}
                  onClick={() => selectTab('pushpull')}
                >
                  <span>⇅</span> Push/Pull
                </button>
                <button
                  type="button"
                  className={`tab-btn ${activeTab === 'pulls' ? 'active' : ''}`}
                  onClick={() => selectTab('pulls')}
                >
                  <span>🔀</span> Pull Requests
                </button>
                <button
                  type="button"
                  className={`tab-btn ${activeTab === 'environments' ? 'active' : ''}`}
                  onClick={() => selectTab('environments')}
                >
                  <span>🌐</span> Environments
                </button>
              </div>

              {/* ACTIVE TAB MAIN CONTENT */}

              {/* TAB: CODE – File Browser */}
              {activeTab === 'code' && (
                <FileBrowserPage repoName={activeRepo} />
              )}

              {/* TAB: STAGE – Stage + Commit forms */}
              {activeTab === 'stage' && (
                <div className="code-tab-layout">
                  {/* Staging panel */}
                  <div className="stage-panel">
                    <span className="stage-subheading">Stage a file</span>
                    <form onSubmit={handleAddFile}>
                      <div className="stage-inputs-row">
                        <input
                          type="text"
                          className="input-text"
                          placeholder="filepath e.g. src/index.js"
                          value={filepath}
                          onChange={(e) => setFilepath(e.target.value)}
                          disabled={addLoading}
                        />
                        <button type="submit" className="btn-green" disabled={addLoading}>
                          {addLoading ? '...' : 'Add File'}
                        </button>
                      </div>
                      <textarea
                        className="textarea-text"
                        placeholder="Paste file content here..."
                        value={fileContent}
                        onChange={(e) => setFileContent(e.target.value)}
                        disabled={addLoading}
                      />
                    </form>
                    {addSuccess && <div className="banner banner-success">{addSuccess}</div>}
                    {addError && <div className="banner banner-error">❌ {addError}</div>}
                  </div>

                  {/* Commit panel */}
                  <div className="commit-panel">
                    <span className="stage-subheading">Commit Changes</span>
                    <form onSubmit={handleCommitChanges}>
                      <div className="form-group">
                        <input
                          type="text"
                          className="input-text"
                          placeholder="Commit message"
                          value={commitMessage}
                          onChange={(e) => setCommitMessage(e.target.value)}
                          disabled={commitLoading}
                        />
                      </div>
                      <div className="form-group">
                        <input
                          type="text"
                          className="input-text"
                          placeholder="Author (optional — defaults to 'dev')"
                          value={author}
                          onChange={(e) => setAuthor(e.target.value)}
                          disabled={commitLoading}
                        />
                      </div>
                      <button type="submit" className="btn-green" disabled={commitLoading}>
                        {commitLoading ? '...' : 'Commit changes'}
                      </button>
                    </form>
                    {commitSuccess && <div className="banner banner-success">{commitSuccess}</div>}
                    {commitError && <div className="banner banner-error">❌ {commitError}</div>}
                  </div>
                </div>
              )}

              {/* TAB: COMMITS */}
              {activeTab === 'commits' && (
                <div className="commits-container">
                  <div className="commits-header">
                    <h3 className="commits-title">Commits</h3>
                    <div className="branch-badge">
                      <svg height="12" viewBox="0 0 16 16" width="12" fill="currentColor">
                        <path d="M11.5 2.75a2.25 2.25 0 0 0-4 1.48v5.54a2.25 2.25 0 0 0 0 4.46v.52a.75.75 0 0 1-1.5 0v-.52a2.25 2.25 0 0 0 0-4.46V4.23a2.25 2.25 0 1 0-1.5 0v3.42a2.235 2.235 0 0 0-.5 1.1v.52a2.25 2.25 0 0 0 0 4.46v.52a.75.75 0 0 1-1.5 0v-.52a2.25 2.25 0 0 0 0-4.46v-.52c0-.526.182-1.01.485-1.39l.015-.018V5.77A2.25 2.25 0 1 0 11.5 2.75Zm-7.5.75a.75.75 0 1 1 1.5 0 .75.75 0 0 1-1.5 0Zm6 0a.75.75 0 1 1 1.5 0 .75.75 0 0 1-1.5 0ZM4.75 12a.75.75 0 1 1 1.5 0 .75.75 0 0 1-1.5 0Z" />
                      </svg>
                      main
                    </div>
                    <button
                      type="button"
                      className="btn-outline"
                      style={{ marginLeft: 'auto', fontSize: '12px', padding: '3px 10px' }}
                      onClick={loadCommits}
                      disabled={logLoading}
                    >
                      {logLoading ? '...' : '↻ Refresh'}
                    </button>
                  </div>

                  {logError && <div className="banner banner-error">❌ {logError}</div>}

                  {logData.length > 0 ? (
                    logData.map((commit) => (
                      <div key={commit.hash} className="commit-row">
                        <div className="commit-info-left">
                          <span className="commit-message-title">{commit.message}</span>
                          <span className="commit-meta">
                            {commit.author} committed on {new Date(commit.timestamp).toLocaleString()}
                          </span>
                        </div>
                        <div className="commit-info-right">
                          <span className="hash-pill">
                            {commit.hash.slice(0, 7)}
                          </span>
                          <button
                            type="button"
                            className="clipboard-btn"
                            title="Copy full SHA"
                            onClick={() => {
                              navigator.clipboard.writeText(commit.hash);
                            }}
                          >
                            <svg height="16" viewBox="0 0 16 16" width="16" fill="currentColor">
                              <path d="M0 6.75C0 5.784.784 5 1.75 5h1.5a.75.75 0 0 1 0 1.5h-1.5a.25.25 0 0 0-.25.25v7.5c0 .138.112.25.25.25h7.5a.25.25 0 0 0 .25-.25v-1.5a.75.75 0 0 1 1.5 0v1.5A1.75 1.75 0 0 1 9.25 16h-7.5A1.75 1.75 0 0 1 0 14.25Z" />
                              <path d="M5 1.75C5 .784 5.784 0 6.75 0h7.5C15.216 0 16 .784 16 1.75v7.5A1.75 1.75 0 0 1 14.25 11h-7.5A1.75 1.75 0 0 1 5 9.25Zm1.75-.25a.25.25 0 0 0-.25.25v7.5c0 .138.112.25.25.25h7.5a.25.25 0 0 0 .25-.25v-7.5a.25.25 0 0 0-.25-.25Z" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    ))
                  ) : (
                    !logLoading && (
                      <div className="empty-commits-card">
                        <svg height="32" viewBox="0 0 16 16" width="32" fill="var(--text-secondary)">
                          <path d="M10.5 2.75a2.25 2.25 0 0 0-4 1.48v5.54a2.25 2.25 0 0 0 0 4.46v.52a.75.75 0 0 1-1.5 0v-.52a2.25 2.25 0 0 0 0-4.46V4.23a2.25 2.25 0 1 0-1.5 0v3.42a2.235 2.235 0 0 0-.5 1.1v.52a2.25 2.25 0 0 0 0 4.46v.52a.75.75 0 0 1-1.5 0v-.52a2.25 2.25 0 0 0 0-4.46v-.52c0-.526.182-1.01.485-1.39l.015-.018V5.77A2.25 2.25 0 1 0 11.5 2.75Zm-7.5.75a.75.75 0 1 1 1.5 0 .75.75 0 0 1-1.5 0Zm6 0a.75.75 0 1 1 1.5 0 .75.75 0 0 1-1.5 0ZM4.75 12a.75.75 0 1 1 1.5 0 .75.75 0 0 1-1.5 0Z" />
                        </svg>
                        <div className="empty-commits-text">No commits yet.</div>
                      </div>
                    )
                  )}
                  {logLoading && <div style={{ textAlign: 'center', padding: '20px', color: 'var(--text-secondary)' }}>Loading...</div>}
                </div>
              )}

              {/* TAB: STATUS */}
              {activeTab === 'status' && (
                <div className="status-container">
                  {statusError && <div className="banner banner-error">❌ {statusError}</div>}

                  <div className="status-grid">
                    {/* Card 1: HEAD */}
                    <div className="status-card">
                      <div className="status-card-header">
                        <span className="status-icon">🔖</span>
                        HEAD Commit
                      </div>
                      <div className="status-card-value">
                        {statusData && statusData.head && statusData.head !== 'none'
                          ? statusData.head.slice(0, 7)
                          : 'No commits'}
                      </div>
                      <div className="status-card-label">Current branch: main</div>
                    </div>

                    {/* Card 2: Staged files */}
                    <div className="status-card">
                      <div className="status-card-header">
                        <span className="status-icon">📋</span>
                        Staged files
                      </div>
                      {statusData && statusData.staged && Object.keys(statusData.staged).length > 0 ? (
                        <ul className="staged-files-list">
                          {Object.entries(statusData.staged).map(([path, hash]) => (
                            <li key={path} className="staged-file-item">
                              <span className="green-dot"></span>
                              <span className="staged-file-path" title={path}>
                                {path}
                              </span>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <span className="clean-tree-text">Working tree clean</span>
                      )}
                    </div>
                  </div>

                  <div className="refresh-status-row">
                    <button
                      type="button"
                      className="btn-outline"
                      onClick={loadStatus}
                      disabled={statusLoading}
                    >
                      {statusLoading ? '...' : '↻ Refresh Status'}
                    </button>
                  </div>
                </div>
              )}

              {/* TAB: BRANCHES */}
              {activeTab === 'branches' && (
                <BranchPage repoName={activeRepo} />
              )}

              {/* TAB: BUILDS */}
              {activeTab === 'builds' && (
                <BuildPage repoName={activeRepo} />
              )}

              {/* TAB: LOCKS */}
              {activeTab === 'locks' && (
                <CheckoutPage repoName={activeRepo} />
              )}

              {/* TAB: PUSH/PULL */}
              {activeTab === 'pushpull' && (
                <PushPullPage repoName={activeRepo} />
              )}

              {/* TAB: PULL REQUESTS */}
              {activeTab === 'pulls' && (
                <PullRequestsPage repoName={activeRepo} currentUser={currentUser} />
              )}

              {/* TAB: ENVIRONMENTS */}
              {activeTab === 'environments' && (
                <EnvironmentsPage repoName={activeRepo} />
              )}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

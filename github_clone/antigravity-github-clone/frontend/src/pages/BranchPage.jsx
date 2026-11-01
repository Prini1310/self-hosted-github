import React, { useEffect, useState } from 'react';
import { listBranches, createBranch, switchBranch, mergeBranch, deleteBranch, getMergeStatus } from '../api/client';

export default function BranchPage({ repoName }) {
  const [branches, setBranches] = useState({});
  const [currentBranch, setCurrentBranch] = useState('');
  const [newBranchName, setNewBranchName] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [createError, setCreateError] = useState('');
  const [mergeResult, setMergeResult] = useState(null); // { type, commitHash, conflicts }
  const [deleteBranchName, setDeleteBranchName] = useState('');
  const [deleteMsg, setDeleteMsg] = useState('');

  const [mergeTargetBranch, setMergeTargetBranch] = useState(null);
  const [mergeStatusCheck, setMergeStatusCheck] = useState(null);
  const [statusLoading, setStatusLoading] = useState(false);

  const fetchBranches = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await listBranches(repoName);
      setBranches(data.branchesMap || {});
      setCurrentBranch(data.current || '');
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Failed to load branches');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (repoName) {
      fetchBranches();
      setMergeResult(null);
    }
  }, [repoName]);

  const handleCreateBranch = async (e) => {
    e.preventDefault();
    if (!newBranchName.trim()) return;
    setCreateError('');
    try {
      await createBranch(repoName, newBranchName.trim());
      setNewBranchName('');
      await fetchBranches();
    } catch (err) {
      setCreateError(err.response?.data?.error || err.message || 'Failed to create branch');
    }
  };

  const handleSwitchBranch = async (branchName) => {
    setError('');
    setMergeResult(null);
    try {
      await switchBranch(repoName, branchName);
      await fetchBranches();
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Failed to switch branch');
    }
  };

  const handlePrepareMerge = async (sourceBranchName) => {
    setMergeTargetBranch(sourceBranchName);
    setStatusLoading(true);
    setError('');
    setMergeResult(null);
    setMergeStatusCheck(null);
    try {
      const status = await getMergeStatus(repoName, sourceBranchName, currentBranch);
      setMergeStatusCheck(status);
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Failed to fetch merge status');
    } finally {
      setStatusLoading(false);
    }
  };

  const handleMergeBranch = async (sourceBranch, strategy) => {
    setError('');
    setMergeResult(null);
    try {
      const res = await mergeBranch(repoName, sourceBranch, strategy);
      setMergeResult(res);
      await fetchBranches();
      // Refresh merge status after successful merge
      try {
        const status = await getMergeStatus(repoName, sourceBranch, currentBranch);
        setMergeStatusCheck(status);
      } catch (e) {
        // Safe to ignore if branches are fully merged and return some trivial error
      }
    } catch (err) {
      const responseData = err.response?.data;
      if (err.response?.status === 409 && responseData?.type === 'conflict') {
        setMergeResult(responseData);
      } else {
        setError(responseData?.error || err.message || 'Failed to merge branch');
      }
    }
  };

  const handleDeleteBranch = async () => {
    setDeleteMsg('');
    try {
      await deleteBranch(repoName, deleteBranchName.trim());
      setDeleteMsg(`✅ Branch '${deleteBranchName}' deleted`);
      setDeleteBranchName('');
      await fetchBranches(); // refresh branch list
    } catch (err) {
      setDeleteMsg(`❌ ${err.response?.data?.error || 'Delete failed'}`);
    }
  };

  return (
    <div className="branch-page">
      <style>{`
        .branch-page {
          max-width: 800px;
          margin: 0 auto;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif;
          color: var(--text-primary);
        }

        .header-row {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 24px;
        }

        .page-title {
          font-size: 20px;
          font-weight: 600;
          margin: 0;
        }

        .current-badge {
          background-color: var(--accent-blue, #1f6feb);
          color: #ffffff;
          font-size: 12px;
          font-weight: 600;
          padding: 3px 8px;
          border-radius: 2em;
        }

        .section-title {
          font-size: 16px;
          font-weight: 600;
          margin-top: 0;
          margin-bottom: 12px;
          border-bottom: 1px solid var(--border);
          padding-bottom: 8px;
        }

        .branch-list {
          background-color: var(--bg-default);
          border: 1px solid var(--border);
          border-radius: 6px;
          margin-bottom: 24px;
          overflow: hidden;
        }

        .branch-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 12px 16px;
          border-bottom: 1px solid var(--border);
        }

        .branch-row:last-child {
          border-bottom: none;
        }

        .branch-info {
          display: flex;
          align-items: center;
          gap: 8px;
          flex-wrap: wrap;
        }

        .branch-name-text {
          font-weight: 600;
          font-size: 14px;
        }

        .badge-current {
          background-color: rgba(56, 139, 253, 0.1);
          border: 1px solid rgba(56, 139, 253, 0.4);
          color: var(--text-link);
          font-size: 11px;
          padding: 1px 5px;
          border-radius: 3px;
        }

        .tip-hash {
          font-family: monospace;
          color: var(--text-secondary);
          font-size: 12px;
        }

        .actions-cell {
          display: flex;
          gap: 8px;
        }

        .btn-outline-blue {
          background: transparent;
          color: var(--text-link);
          border: 1px solid var(--border);
          border-radius: 6px;
          padding: 4px 10px;
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
          transition: background-color 0.2s;
        }

        .btn-outline-blue:hover {
          background-color: var(--bg-subtle);
          border-color: var(--text-link);
        }

        .btn-outline-green {
          background: transparent;
          color: var(--success, #3fb950);
          border: 1px solid var(--border);
          border-radius: 6px;
          padding: 4px 10px;
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
          transition: background-color 0.2s;
        }

        .btn-outline-green:hover {
          background-color: var(--bg-subtle);
          border-color: var(--success, #3fb950);
        }

        .card-panel {
          background-color: var(--bg-default);
          border: 1px solid var(--border);
          border-radius: 6px;
          padding: 16px;
          margin-bottom: 24px;
        }

        .form-row {
          display: flex;
          gap: 12px;
          margin-bottom: 8px;
        }

        .input-field {
          flex: 1;
          background-color: var(--bg-canvas);
          border: 1px solid var(--border);
          border-radius: 6px;
          padding: 6px 12px;
          font-size: 14px;
          color: var(--text-primary);
        }

        .input-field:focus {
          outline: none;
          border-color: var(--text-link);
        }

        .btn-solid-green {
          background-color: var(--accent-green);
          color: #ffffff;
          border: none;
          border-radius: 6px;
          padding: 6px 16px;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
        }

        .btn-solid-green:hover {
          background-color: var(--accent-green-hover, #2ea043);
        }

        .btn-solid-red {
          background-color: #f85149;
          color: #ffffff;
          border: none;
          border-radius: 6px;
          padding: 6px 16px;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
        }

        .btn-solid-red:hover {
          background-color: #da3633;
        }

        .helper-text {
          font-size: 12px;
          color: var(--text-secondary);
          margin: 0;
        }

        .banner {
          padding: 12px 16px;
          border-radius: 6px;
          margin-bottom: 24px;
          font-size: 14px;
          font-weight: 500;
        }

        .banner-success {
          background-color: rgba(63, 185, 80, 0.1);
          border: 1px solid rgba(63, 185, 80, 0.4);
          color: var(--success, #3fb950);
        }

        .banner-info {
          background-color: rgba(56, 139, 253, 0.15);
          border: 1px solid rgba(56, 139, 253, 0.45);
          color: #58a6ff;
        }

        .banner-error {
          background-color: rgba(248, 81, 73, 0.1);
          border: 1px solid rgba(248, 81, 73, 0.4);
          color: var(--accent-red);
        }

        .merge-panel {
          background-color: var(--bg-default);
          border: 1px solid var(--border);
          border-radius: 6px;
          padding: 20px;
          margin-bottom: 24px;
        }

        .merge-status-container {
          display: flex;
          align-items: center;
          gap: 10px;
          margin-bottom: 15px;
        }

        .status-indicator {
          font-weight: 600;
          padding: 4px 8px;
          border-radius: 4px;
          font-size: 13px;
        }

        .status-clean {
          background-color: rgba(63, 185, 80, 0.15);
          color: var(--success, #2ea043);
          border: 1px solid rgba(63, 185, 80, 0.3);
        }

        .status-conflicts {
          background-color: rgba(248, 81, 73, 0.15);
          color: var(--accent-red, #f85149);
          border: 1px solid rgba(248, 81, 73, 0.3);
        }

        .merge-actions-row {
          display: flex;
          gap: 10px;
          margin-top: 15px;
          flex-wrap: wrap;
        }

        .btn-merge-commit {
          background-color: #2c974b;
          color: #fff;
          border: 1px solid rgba(27, 31, 35, 0.15);
          border-radius: 6px;
          padding: 8px 16px;
          font-weight: 600;
          cursor: pointer;
        }

        .btn-merge-commit:hover:not(:disabled) {
          background-color: #2ea043;
        }

        .btn-merge-squash {
          background-color: #0366d6;
          color: #fff;
          border: 1px solid rgba(27, 31, 35, 0.15);
          border-radius: 6px;
          padding: 8px 16px;
          font-weight: 600;
          cursor: pointer;
        }

        .btn-merge-squash:hover:not(:disabled) {
          background-color: #0056b3;
        }

        .btn-merge-rebase {
          background-color: #6f42c1;
          color: #fff;
          border: 1px solid rgba(27, 31, 35, 0.15);
          border-radius: 6px;
          padding: 8px 16px;
          font-weight: 600;
          cursor: pointer;
        }

        .btn-merge-rebase:hover:not(:disabled) {
          background-color: #5a30a3;
        }

        .btn-merge-commit:disabled,
        .btn-merge-squash:disabled,
        .btn-merge-rebase:disabled {
          background-color: var(--bg-subtle, #f6f8fa);
          color: var(--text-secondary, #959da5);
          border-color: var(--border, #e1e4e6);
          cursor: not-allowed;
        }

        .btn-close-panel {
          background-color: transparent;
          color: var(--text-secondary);
          border: 1px solid var(--border);
          border-radius: 6px;
          padding: 8px 16px;
          cursor: pointer;
        }
        .btn-close-panel:hover {
          background-color: var(--bg-subtle);
        }
      `}</style>

      {/* Header Row */}
      <div className="header-row">
        <h2 className="page-title">🌿 Branches</h2>
        <span className="current-badge">{currentBranch}</span>
      </div>

      {/* Global Error Banner */}
      {error && <div className="banner banner-error">❌ {error}</div>}

      {/* Merge Result Panel */}
      {mergeResult && (
        <div className="merge-result-panel">
          {mergeResult.type === 'fast-forward' && (
            <div className="banner banner-success">✅ Fast-forward merge complete</div>
          )}
          {(mergeResult.type === 'already-merged' || mergeResult.type === 'already-up-to-date') && (
            <div className="banner banner-info">ℹ️ {mergeResult.message || 'Already up to date'}</div>
          )}
          {mergeResult.type === 'merged' && (
            <div className="banner banner-success">
              ✅ Merged {mergeResult.strategy ? `via ${mergeResult.strategy} (${mergeResult.commitsMerged} commit(s))` : ''} — commit {mergeResult.commitHash ? mergeResult.commitHash.slice(0, 7) : ''}
            </div>
          )}
          {mergeResult.type === 'conflict' && (
            <div className="banner banner-error">
              ⚠️ Merge conflict in: {mergeResult.conflicts ? mergeResult.conflicts.join(', ') : ''} — resolve manually
            </div>
          )}
        </div>
      )}
      {/* Merge Preparation and Strategy Panel */}
      {mergeTargetBranch && (
        <div className="merge-panel card-panel">
          <h3 className="section-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>🔀 Merge branch <strong>{mergeTargetBranch}</strong> into <strong>{currentBranch}</strong></span>
            <button 
              type="button" 
              className="btn-close-panel" 
              onClick={() => {
                setMergeTargetBranch(null);
                setMergeStatusCheck(null);
              }}
              style={{ padding: '2px 8px', fontSize: '12px' }}
            >
              Cancel
            </button>
          </h3>

          {statusLoading ? (
            <p style={{ color: 'var(--text-secondary)' }}>🔄 Checking merge status...</p>
          ) : mergeStatusCheck ? (
            <div>
              <div className="merge-status-container" style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '15px' }}>
                <span className={`status-indicator ${mergeStatusCheck.ableToMerge ? 'status-clean' : 'status-conflicts'}`}>
                  {mergeStatusCheck.ableToMerge ? 'able to merge cleanly' : 'has conflicts'}
                </span>
                <span style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>
                  {mergeStatusCheck.commitsAhead} commit(s) ahead. 
                  {mergeStatusCheck.ableToMerge && (
                    <span> Recommended strategy: <strong>{mergeStatusCheck.recommendedStrategy}</strong></span>
                  )}
                </span>
              </div>

              {!mergeStatusCheck.ableToMerge && mergeStatusCheck.conflicts.length > 0 && (
                <div style={{ color: 'var(--accent-red)', backgroundColor: 'rgba(248, 81, 73, 0.05)', border: '1px solid rgba(248, 81, 73, 0.15)', padding: '10px 15px', borderRadius: '6px', marginBottom: '15px' }}>
                  <h5 style={{ margin: '0 0 8px 0', fontSize: '14px' }}>Conflicting Files:</h5>
                  <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '13px' }}>
                    {mergeStatusCheck.conflicts.map(file => (
                      <li key={file} style={{ listStyleType: 'square' }}>{file}</li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="merge-actions-row">
                <button
                  type="button"
                  className="btn-merge-commit"
                  disabled={!mergeStatusCheck.ableToMerge}
                  onClick={() => handleMergeBranch(mergeTargetBranch, 'merge')}
                >
                  Merge Commit
                </button>
                <button
                  type="button"
                  className="btn-merge-squash"
                  disabled={!mergeStatusCheck.ableToMerge}
                  onClick={() => handleMergeBranch(mergeTargetBranch, 'squash')}
                >
                  Squash and Merge
                </button>
                <button
                  type="button"
                  className="btn-merge-rebase"
                  disabled={!mergeStatusCheck.ableToMerge}
                  onClick={() => handleMergeBranch(mergeTargetBranch, 'rebase')}
                >
                  Rebase and Merge
                </button>
              </div>
            </div>
          ) : null}
        </div>
      )}

      {/* Branch List Section */}
      <div className="branch-list-section">
        <h3 className="section-title">All Branches</h3>
        {loading ? (
          <p style={{ color: 'var(--text-secondary)' }}>Loading branches...</p>
        ) : (
          <div className="branch-list">
            {Object.keys(branches).length > 0 ? (
              Object.entries(branches).map(([name, hash]) => (
                <div key={name} className="branch-row">
                  <div className="branch-info">
                    <span className="branch-name-text">🌿 {name}</span>
                    {name === currentBranch && (
                      <span className="badge-current">(current)</span>
                    )}
                    <span className="tip-hash">
                      ({hash === 'none' ? 'no commits' : hash.slice(0, 7)})
                    </span>
                  </div>
                  <div className="actions-cell">
                    {name !== currentBranch && (
                      <>
                        <button
                          type="button"
                          className="btn-outline-blue"
                          onClick={() => handleSwitchBranch(name)}
                        >
                          Switch
                        </button>
                        {hash !== 'none' && (
                          <button
                            type="button"
                            className="btn-outline-green"
                            onClick={() => handlePrepareMerge(name)}
                          >
                            Merge into current
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <p style={{ padding: '16px', margin: 0, color: 'var(--text-secondary)' }}>
                No branches found.
              </p>
            )}
          </div>
        )}
      </div>

      {/* Create Branch Section */}
      <div className="card-panel">
        <h3 className="section-title" style={{ border: 'none', padding: 0, marginBottom: '16px' }}>
          Create new branch
        </h3>
        <form onSubmit={handleCreateBranch}>
          <div className="form-row">
            <input
              type="text"
              className="input-field"
              placeholder="feature/my-branch"
              value={newBranchName}
              onChange={(e) => setNewBranchName(e.target.value)}
            />
            <button type="submit" className="btn-solid-green">
              Create Branch
            </button>
          </div>
          <p className="helper-text">Branch will be created from current HEAD</p>
        </form>
        {createError && (
          <div className="banner banner-error" style={{ marginTop: '12px', marginBottom: 0 }}>
            ❌ {createError}
          </div>
        )}
      </div>

      {/* Delete Branch Section */}
      <div className="card-panel">
        <h3 className="section-title" style={{ border: 'none', padding: 0, marginBottom: '16px' }}>
          🗑️ Delete Branch
        </h3>
        <div className="form-row">
          <input
            type="text"
            className="input-field"
            placeholder="branch-to-delete"
            value={deleteBranchName}
            onChange={(e) => setDeleteBranchName(e.target.value)}
          />
          <button
            type="button"
            className="btn-solid-red"
            onClick={handleDeleteBranch}
            disabled={!deleteBranchName || !repoName}
          >
            Delete Branch
          </button>
        </div>
        {deleteMsg && (
          <p style={{
            color: deleteMsg.startsWith("✅") ? "#3fb950" : "#f85149",
            fontSize: '13px',
            marginTop: '8px',
            marginBottom: 0
          }}>
            {deleteMsg}
          </p>
        )}
      </div>
    </div>
  );
}

import React, { useEffect, useState } from 'react';
import { listBranches, listPullRequests, createPullRequest, updatePullRequestStatus, mergePullRequest } from '../api/client';

export default function PullRequestsPage({ repoName, currentUser }) {
  const [pulls, setPulls] = useState([]);
  const [branches, setBranches] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Active PR View Modal/Detail state
  const [activePR, setActivePR] = useState(null);
  const [mergeLoading, setMergeLoading] = useState(false);
  const [mergeError, setMergeError] = useState('');
  const [mergeConflicts, setMergeConflicts] = useState([]);

  // Create PR form state
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [fromBranch, setFromBranch] = useState('');
  const [toBranch, setToBranch] = useState('');
  const [prAuthor, setPrAuthor] = useState(currentUser || '');
  const [createLoading, setCreateLoading] = useState(false);
  const [createError, setCreateError] = useState('');

  const fetchData = async () => {
    setLoading(true);
    setError('');
    try {
      const prs = await listPullRequests(repoName);
      setPulls(prs.pulls || []);

      const branchData = await listBranches(repoName);
      const bMap = branchData.branchesMap || {};
      setBranches(bMap);

      const branchKeys = Object.keys(bMap);
      if (branchKeys.length > 0) {
        // Default select first two branches for creation form
        setFromBranch(branchKeys.find(b => b !== 'main') || branchKeys[0]);
        setToBranch(branchKeys.includes('main') ? 'main' : branchKeys[0]);
      }
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Failed to load pull requests');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (repoName) {
      fetchData();
      setActivePR(null);
      setShowCreateForm(false);
      setMergeConflicts([]);
      setMergeError('');
    }
  }, [repoName]);

  const handleCreatePR = async (e) => {
    e.preventDefault();
    if (!title.trim() || !fromBranch || !toBranch) {
      setCreateError('Title, from branch, and to branch are required');
      return;
    }
    if (fromBranch === toBranch) {
      setCreateError('Cannot create a pull request with identical source and target branches');
      return;
    }

    setCreateLoading(true);
    setCreateError('');
    try {
      const res = await createPullRequest(
        repoName,
        title.trim(),
        description.trim(),
        fromBranch,
        toBranch,
        prAuthor.trim() || currentUser
      );
      
      // Reset form
      setTitle('');
      setDescription('');
      setShowCreateForm(false);
      
      // Refresh list
      await fetchData();
      if (res.pr) {
        setActivePR(res.pr);
      }
    } catch (err) {
      setCreateError(err.response?.data?.error || err.message || 'Failed to create PR');
    } finally {
      setCreateLoading(false);
    }
  };

  const handleMergePR = async (prId) => {
    setMergeLoading(true);
    setMergeError('');
    setMergeConflicts([]);
    try {
      const res = await mergePullRequest(repoName, prId);
      if (res.success) {
        // Refresh pulls
        await fetchData();
        // Update active PR modal details
        setActivePR(res.pr);
      }
    } catch (err) {
      const responseData = err.response?.data;
      if (err.response?.status === 409 && responseData?.conflicts) {
        setMergeError(responseData.error || 'Merge conflicts detected.');
        setMergeConflicts(responseData.conflicts);
      } else {
        setMergeError(responseData?.error || err.message || 'Failed to merge pull request');
      }
    } finally {
      setMergeLoading(false);
    }
  };

  const handleUpdateStatus = async (prId, newStatus) => {
    setError('');
    setMergeError('');
    try {
      const res = await updatePullRequestStatus(repoName, prId, newStatus);
      if (res.success) {
        await fetchData();
        setActivePR(res.pr);
      }
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Failed to update PR status');
    }
  };

  const branchKeys = Object.keys(branches);

  if (loading && pulls.length === 0) {
    return <div style={{ color: 'var(--text-secondary)', padding: '20px' }}>Loading Pull Requests...</div>;
  }

  return (
    <div className="pr-page">
      <style>{`
        .pr-page {
          max-width: 900px;
          margin: 0 auto;
          color: var(--text-primary);
        }
        .header-section {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 24px;
        }
        .title {
          font-size: 20px;
          font-weight: 600;
          margin: 0;
        }
        .btn {
          border: none;
          border-radius: 6px;
          padding: 6px 12px;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          transition: background-color 0.2s;
        }
        .btn-primary {
          background-color: var(--accent-green);
          color: white;
        }
        .btn-primary:hover {
          background-color: var(--accent-green-hover);
        }
        .btn-secondary {
          background-color: var(--bg-subtle);
          color: var(--text-primary);
          border: 1px solid var(--border);
        }
        .btn-secondary:hover {
          background-color: #30363d;
        }
        .btn-merge {
          background-color: #8250df; /* Purple color matching GitHub merge */
          color: white;
        }
        .btn-merge:hover:not(:disabled) {
          background-color: #a371f7;
        }
        .btn-danger {
          background-color: var(--accent-red);
          color: white;
        }
        .btn-danger:hover {
          background-color: #da3633;
        }
        .list-container {
          background-color: var(--bg-default);
          border: 1px solid var(--border);
          border-radius: 6px;
          overflow: hidden;
        }
        .pr-item {
          display: flex;
          align-items: flex-start;
          padding: 16px;
          border-bottom: 1px solid var(--border);
          cursor: pointer;
          transition: background-color 0.2s;
        }
        .pr-item:last-child {
          border-bottom: none;
        }
        .pr-item:hover {
          background-color: var(--bg-subtle);
        }
        .pr-icon {
          font-size: 18px;
          margin-right: 12px;
          color: #3fb950; /* Green for open */
        }
        .pr-icon.merged {
          color: #8250df; /* Purple for merged */
        }
        .pr-icon.closed {
          color: var(--accent-red); /* Red for closed */
        }
        .pr-content {
          flex-grow: 1;
        }
        .pr-title-text {
          font-size: 15px;
          font-weight: 600;
          margin: 0 0 4px 0;
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .pr-meta {
          font-size: 12px;
          color: var(--text-secondary);
        }
        .badge {
          display: inline-block;
          padding: 3px 8px;
          border-radius: 2em;
          font-size: 11px;
          font-weight: 600;
          text-transform: capitalize;
        }
        .badge-open {
          background-color: rgba(63, 185, 80, 0.15);
          color: var(--success);
          border: 1px solid rgba(63, 185, 80, 0.3);
        }
        .badge-merged {
          background-color: rgba(130, 80, 223, 0.15);
          color: #a371f7;
          border: 1px solid rgba(130, 80, 223, 0.3);
        }
        .badge-closed {
          background-color: rgba(248, 81, 73, 0.15);
          color: var(--accent-red);
          border: 1px solid rgba(248, 81, 73, 0.3);
        }
        .form-card {
          background-color: var(--bg-default);
          border: 1px solid var(--border);
          border-radius: 6px;
          padding: 20px;
          margin-bottom: 24px;
        }
        .form-title {
          font-size: 16px;
          font-weight: 600;
          margin: 0 0 16px 0;
        }
        .form-group {
          margin-bottom: 16px;
        }
        .form-label {
          display: block;
          font-size: 13px;
          font-weight: 500;
          margin-bottom: 6px;
          color: var(--text-secondary);
        }
        .input-text, .select-input, .textarea-input {
          width: 100%;
          background-color: var(--input-bg);
          border: 1px solid var(--border);
          border-radius: 6px;
          padding: 8px 12px;
          color: var(--text-primary);
          font-size: 13px;
        }
        .input-text:focus, .select-input:focus, .textarea-input:focus {
          outline: none;
          border-color: var(--text-link);
        }
        .branches-select-row {
          display: grid;
          grid-template-columns: 1fr auto 1fr;
          align-items: center;
          gap: 12px;
        }
        .arrow {
          font-size: 16px;
          color: var(--text-secondary);
          align-self: flex-end;
          padding-bottom: 10px;
        }
        .message-error {
          background-color: rgba(248, 81, 73, 0.15);
          border: 1px solid rgba(248, 81, 73, 0.4);
          color: var(--accent-red);
          padding: 10px;
          border-radius: 6px;
          font-size: 13px;
          margin-top: 12px;
        }
        .detail-card {
          background-color: var(--bg-default);
          border: 1px solid var(--border);
          border-radius: 6px;
          padding: 24px;
          margin-bottom: 24px;
        }
        .detail-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          border-bottom: 1px solid var(--border);
          padding-bottom: 16px;
          margin-bottom: 16px;
        }
        .detail-title {
          font-size: 18px;
          font-weight: 600;
          margin: 0 0 8px 0;
        }
        .detail-desc {
          font-size: 14px;
          line-height: 1.6;
          color: var(--text-primary);
          background-color: var(--input-bg);
          padding: 16px;
          border-radius: 6px;
          border: 1px solid var(--border);
          margin-bottom: 20px;
        }
        .merge-action-bar {
          background-color: var(--bg-canvas);
          border: 1px solid var(--border);
          border-radius: 6px;
          padding: 16px;
          display: flex;
          align-items: center;
          justify-content: space-between;
        }
        .conflict-list {
          margin-top: 8px;
          font-family: monospace;
          background-color: rgba(248, 81, 73, 0.1);
          border: 1px dashed var(--accent-red);
          padding: 8px 12px;
          border-radius: 4px;
          font-size: 12px;
        }
      `}</style>

      {error && <div className="message-error" style={{ marginBottom: '20px' }}>❌ {error}</div>}

      <div className="header-section">
        <h2 className="title">🔀 Pull Requests</h2>
        {!showCreateForm && !activePR && (
          <button className="btn btn-primary" onClick={() => setShowCreateForm(true)}>
            New Pull Request
          </button>
        )}
        {(showCreateForm || activePR) && (
          <button className="btn btn-secondary" onClick={() => { setShowCreateForm(false); setActivePR(null); }}>
            Back to List
          </button>
        )}
      </div>

      {/* CREATE PR FORM */}
      {showCreateForm && (
        <div className="form-card">
          <h3 className="form-title">Create a new Pull Request</h3>
          <form onSubmit={handleCreatePR}>
            <div className="form-group">
              <label className="form-label">PR Title *</label>
              <input
                type="text"
                className="input-text"
                placeholder="e.g. Add validation middleware"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label">Description</label>
              <textarea
                rows="3"
                className="textarea-input"
                placeholder="Describe your changes..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>
            
            <div className="form-group branches-select-row">
              <div>
                <label className="form-label">Compare branch (from) *</label>
                <select 
                  className="select-input"
                  value={fromBranch}
                  onChange={(e) => setFromBranch(e.target.value)}
                >
                  {branchKeys.map(b => (
                    <option key={b} value={b}>{b}</option>
                  ))}
                </select>
              </div>
              <div className="arrow">➔</div>
              <div>
                <label className="form-label">Base branch (to) *</label>
                <select 
                  className="select-input"
                  value={toBranch}
                  onChange={(e) => setToBranch(e.target.value)}
                >
                  {branchKeys.map(b => (
                    <option key={b} value={b}>{b}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Author</label>
              <input
                type="text"
                className="input-text"
                value={prAuthor}
                onChange={(e) => setPrAuthor(e.target.value)}
              />
            </div>

            <button type="submit" className="btn btn-primary" disabled={createLoading || branchKeys.length < 2}>
              {createLoading ? 'Creating PR...' : 'Create Pull Request'}
            </button>
            {createError && <div className="message-error">❌ {createError}</div>}
          </form>
        </div>
      )}

      {/* VIEW SINGLE PR */}
      {activePR && (
        <div className="detail-card">
          <div className="detail-header">
            <div>
              <h3 className="detail-title">
                {activePR.title} <span style={{ color: 'var(--text-secondary)', fontWeight: '400' }}>#{activePR.prId}</span>
              </h3>
              <div className="pr-meta">
                <span className={`badge badge-${activePR.status}`} style={{ marginRight: '8px' }}>{activePR.status}</span>
                <span>
                  <strong>{activePR.author}</strong> wants to merge commits from 
                  <span className="hash-code" style={{ color: 'var(--text-link)', margin: '0 4px' }}>🌿 {activePR.fromBranch}</span> 
                  into 
                  <span className="hash-code" style={{ color: 'var(--text-link)', margin: '0 4px' }}>🌿 {activePR.toBranch}</span>
                </span>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              {activePR.status === 'open' && (
                <button className="btn btn-secondary" onClick={() => handleUpdateStatus(activePR.prId, 'closed')}>
                  Close PR
                </button>
              )}
              {activePR.status === 'closed' && (
                <button className="btn btn-primary" onClick={() => handleUpdateStatus(activePR.prId, 'open')}>
                  Reopen PR
                </button>
              )}
            </div>
          </div>

          <div className="detail-desc">
            {activePR.description || <em style={{ color: 'var(--text-secondary)' }}>No description provided.</em>}
          </div>

          {/* MERGE BOX */}
          {activePR.status === 'open' && (
            <div className="merge-action-bar">
              <div>
                <div style={{ fontWeight: '600', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span>🔀</span> Merge Pull Request
                </div>
                <div style={{ color: 'var(--text-secondary)', fontSize: '12px', marginTop: '4px' }}>
                  This will perform a fast-forward or three-way merge into branch '{activePR.toBranch}'.
                </div>
              </div>
              <button 
                className="btn btn-merge" 
                onClick={() => handleMergePR(activePR.prId)}
                disabled={mergeLoading}
              >
                {mergeLoading ? 'Merging...' : 'Merge Pull Request'}
              </button>
            </div>
          )}

          {activePR.status === 'merged' && (
            <div className="merge-action-bar" style={{ borderColor: '#8250df', backgroundColor: 'rgba(130, 80, 223, 0.05)' }}>
              <div>
                <div style={{ color: '#a371f7', fontWeight: '600', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span>💜</span> Pull Request Merged
                </div>
                <div style={{ color: 'var(--text-secondary)', fontSize: '12px', marginTop: '4px' }}>
                  Merged by system at {new Date(activePR.mergedAt).toLocaleString()}
                </div>
              </div>
            </div>
          )}

          {activePR.status === 'closed' && (
            <div className="merge-action-bar" style={{ borderColor: 'var(--accent-red)', backgroundColor: 'rgba(248, 81, 73, 0.05)' }}>
              <div>
                <div style={{ color: 'var(--accent-red)', fontWeight: '600', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span>🚫</span> Pull Request Closed
                </div>
                <div style={{ color: 'var(--text-secondary)', fontSize: '12px', marginTop: '4px' }}>
                  Closed without merging at {new Date(activePR.closedAt).toLocaleString()}
                </div>
              </div>
            </div>
          )}

          {mergeError && (
            <div className="message-error" style={{ marginTop: '16px' }}>
              <strong>Merge Error:</strong> {mergeError}
              {mergeConflicts.length > 0 && (
                <div className="conflict-list">
                  <div>Conflicting files:</div>
                  {mergeConflicts.map(file => <div key={file}>⚠️ {file}</div>)}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* PR LIST */}
      {!showCreateForm && !activePR && (
        <div>
          {pulls.length === 0 ? (
            <div className="list-container" style={{ padding: '24px', textAlign: 'center', color: 'var(--text-secondary)' }}>
              <div style={{ fontSize: '24px', marginBottom: '8px' }}>🔀</div>
              <div style={{ fontSize: '14px', fontWeight: '500' }}>No pull requests here yet</div>
              <div style={{ fontSize: '12px', marginTop: '4px' }}>Open a pull request to compare changes between branches.</div>
            </div>
          ) : (
            <div className="list-container">
              {pulls.map((pr) => (
                <div key={pr.prId} className="pr-item" onClick={() => setActivePR(pr)}>
                  <div className={`pr-icon ${pr.status}`}>
                    {pr.status === 'open' && '⭕'}
                    {pr.status === 'merged' && '💜'}
                    {pr.status === 'closed' && '🚫'}
                  </div>
                  <div className="pr-content">
                    <h4 className="pr-title-text">
                      {pr.title}
                      <span className={`badge badge-${pr.status}`}>{pr.status}</span>
                    </h4>
                    <div className="pr-meta">
                      <span>#{pr.prId} opened {new Date(pr.createdAt).toLocaleDateString()} by <strong>{pr.author}</strong></span>
                      <span style={{ marginLeft: '12px' }}>
                        🌿 {pr.fromBranch} ➔ 🌿 {pr.toBranch}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

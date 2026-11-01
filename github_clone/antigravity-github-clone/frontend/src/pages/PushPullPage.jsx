import React, { useEffect, useState } from 'react';
import { listBranches, pushBranch, pullBranch, getActivityLog } from '../api/client';

export default function PushPullPage({ repoName }) {
  const [branches, setBranches] = useState({});
  const [activity, setActivity] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Push Form State
  const [pushBranchName, setPushBranchName] = useState('');
  const [pushCommit, setPushCommit] = useState('');
  const [pushLoading, setPushLoading] = useState(false);
  const [pushSuccess, setPushSuccess] = useState('');
  const [pushError, setPushError] = useState('');

  // Pull Form State
  const [pullBranchName, setPullBranchName] = useState('');
  const [pullTargetBranch, setPullTargetBranch] = useState('');
  const [pullLoading, setPullLoading] = useState(false);
  const [pullSuccess, setPullSuccess] = useState('');
  const [pullError, setPullError] = useState('');

  const fetchData = async () => {
    setLoading(true);
    setError('');
    try {
      const branchData = await listBranches(repoName);
      setBranches(branchData.branchesMap || {});
      
      const active = branchData.current || '';
      setPushBranchName(active);
      setPullBranchName(active);

      // Pre-fill push commit with active branch tip if available
      if (active && branchData.branchesMap && branchData.branchesMap[active]) {
        setPushCommit(branchData.branchesMap[active]);
      }

      // Pre-fill pull target branch with another branch if available
      const otherBranches = Object.keys(branchData.branchesMap || {}).filter(b => b !== active);
      if (otherBranches.length > 0) {
        setPullTargetBranch(otherBranches[0]);
      } else {
        setPullTargetBranch('');
      }

      const activityData = await getActivityLog(repoName);
      setActivity(activityData.activity || []);
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Failed to load page data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (repoName) {
      fetchData();
      // Clear forms
      setPushSuccess('');
      setPushError('');
      setPullSuccess('');
      setPullError('');
    }
  }, [repoName]);

  const handlePushSubmit = async (e) => {
    e.preventDefault();
    if (!pushBranchName || !pushCommit.trim()) {
      setPushError('Branch and commit hash are required');
      return;
    }
    setPushLoading(true);
    setPushError('');
    setPushSuccess('');
    try {
      const res = await pushBranch(repoName, pushBranchName, pushCommit.trim());
      setPushSuccess(res.message || 'Successfully pushed!');
      // Refresh activity log and branch list
      const activityData = await getActivityLog(repoName);
      setActivity(activityData.activity || []);
      const branchData = await listBranches(repoName);
      setBranches(branchData.branchesMap || {});
    } catch (err) {
      setPushError(err.response?.data?.error || err.message || 'Failed to push');
    } finally {
      setPushLoading(false);
    }
  };

  const handlePullSubmit = async (e) => {
    e.preventDefault();
    if (!pullBranchName || !pullTargetBranch) {
      setPullError('Local branch and target branch are required');
      return;
    }
    setPullLoading(true);
    setPullError('');
    setPullSuccess('');
    try {
      const res = await pullBranch(repoName, pullBranchName, pullTargetBranch);
      setPullSuccess(res.message || 'Successfully pulled!');
      // Refresh activity log and branch list
      const activityData = await getActivityLog(repoName);
      setActivity(activityData.activity || []);
      const branchData = await listBranches(repoName);
      setBranches(branchData.branchesMap || {});
      // Update push commit field to match new tip
      if (branches && branches[pullBranchName]) {
        setPushCommit(branches[pullBranchName]);
      }
    } catch (err) {
      setPullError(err.response?.data?.error || err.message || 'Failed to pull');
    } finally {
      setPullLoading(false);
    }
  };

  const branchKeys = Object.keys(branches);

  if (loading && activity.length === 0) {
    return <div style={{ color: 'var(--text-secondary)', padding: '20px' }}>Loading push/pull history...</div>;
  }

  return (
    <div className="push-pull-page">
      <style>{`
        .push-pull-page {
          max-width: 900px;
          margin: 0 auto;
          color: var(--text-primary);
        }
        .operations-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 24px;
          margin-bottom: 32px;
        }
        .op-card {
          background-color: var(--bg-default);
          border: 1px solid var(--border);
          border-radius: 6px;
          padding: 20px;
        }
        .op-title {
          font-size: 16px;
          font-weight: 600;
          margin: 0 0 16px 0;
          display: flex;
          align-items: center;
          gap: 8px;
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
        .select-input, .text-input {
          width: 100%;
          background-color: var(--input-bg);
          border: 1px solid var(--border);
          border-radius: 6px;
          padding: 8px 12px;
          color: var(--text-primary);
          font-size: 13px;
        }
        .select-input:focus, .text-input:focus {
          outline: none;
          border-color: var(--text-link);
        }
        .btn-submit {
          width: 100%;
          border: none;
          border-radius: 6px;
          padding: 8px 16px;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          color: white;
          transition: background-color 0.2s;
        }
        .btn-push {
          background-color: var(--accent-blue);
        }
        .btn-push:hover:not(:disabled) {
          background-color: #388bfd;
        }
        .btn-pull {
          background-color: var(--accent-green);
        }
        .btn-pull:hover:not(:disabled) {
          background-color: var(--accent-green-hover);
        }
        .message-success {
          background-color: rgba(63, 185, 80, 0.15);
          border: 1px solid rgba(63, 185, 80, 0.4);
          color: #58a6ff;
          color: var(--success);
          padding: 10px;
          border-radius: 6px;
          font-size: 13px;
          margin-top: 12px;
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
        .activity-section {
          background-color: var(--bg-default);
          border: 1px solid var(--border);
          border-radius: 6px;
          padding: 20px;
        }
        .activity-title {
          font-size: 16px;
          font-weight: 600;
          margin: 0 0 16px 0;
        }
        .activity-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 13px;
        }
        .activity-table th {
          text-align: left;
          padding: 10px;
          background-color: var(--bg-subtle);
          border-bottom: 1px solid var(--border);
          color: var(--text-secondary);
          font-weight: 600;
        }
        .activity-table td {
          padding: 10px;
          border-bottom: 1px solid var(--border);
        }
        .badge {
          display: inline-block;
          padding: 2px 6px;
          border-radius: 2em;
          font-size: 11px;
          font-weight: 600;
        }
        .badge-push {
          background-color: rgba(31, 111, 235, 0.15);
          color: var(--text-link);
          border: 1px solid rgba(31, 111, 235, 0.3);
        }
        .badge-pull {
          background-color: rgba(63, 185, 80, 0.15);
          color: var(--success);
          border: 1px solid rgba(63, 185, 80, 0.3);
        }
        .badge-build {
          background-color: rgba(187, 128, 255, 0.15);
          color: #bc8cff;
          border: 1px solid rgba(187, 128, 255, 0.3);
        }
        .badge-env-small {
          font-size: 10px;
          font-weight: 600;
          padding: 1px 4px;
          border-radius: 3px;
          text-transform: uppercase;
          margin-left: 6px;
          display: inline-block;
        }
        .badge-env-dev {
          background-color: rgba(56, 139, 253, 0.15);
          color: #58a6ff;
          border: 1px solid rgba(56, 139, 253, 0.3);
        }
        .badge-env-qa {
          background-color: rgba(219, 109, 40, 0.15);
          color: #f0883e;
          border: 1px solid rgba(219, 109, 40, 0.3);
        }
        .badge-env-staging {
          background-color: rgba(187, 128, 255, 0.15);
          color: #bc8cff;
          border: 1px solid rgba(187, 128, 255, 0.3);
        }
        .badge-env-prod {
          background-color: rgba(248, 81, 73, 0.15);
          color: #f85149;
          border: 1px solid rgba(248, 81, 73, 0.3);
        }
        .hash-code {
          font-family: monospace;
          background-color: var(--bg-subtle);
          padding: 2px 4px;
          border-radius: 3px;
        }
      `}</style>

      {error && <div className="message-error" style={{ marginBottom: '20px' }}>❌ {error}</div>}

      <div className="operations-grid">
        {/* PUSH CARD */}
        <div className="op-card">
          <h2 className="op-title">⬆️ Push Branch</h2>
          <form onSubmit={handlePushSubmit}>
            <div className="form-group">
              <label className="form-label">Local Branch</label>
              <select 
                className="select-input" 
                value={pushBranchName}
                onChange={(e) => {
                  setPushBranchName(e.target.value);
                  if (branches[e.target.value]) {
                    setPushCommit(branches[e.target.value]);
                  }
                }}
              >
                {branchKeys.map(b => (
                  <option key={b} value={b}>{b}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Commit Hash (Target Tip)</label>
              <input 
                type="text" 
                className="text-input"
                placeholder="Enter commit SHA-1"
                value={pushCommit}
                onChange={(e) => setPushCommit(e.target.value)}
              />
            </div>
            <button 
              type="submit" 
              className="btn-submit btn-push"
              disabled={pushLoading || branchKeys.length === 0}
            >
              {pushLoading ? 'Pushing...' : 'Push Commits'}
            </button>
            {pushSuccess && <div className="message-success">✅ {pushSuccess}</div>}
            {pushError && <div className="message-error">❌ {pushError}</div>}
          </form>
        </div>

        {/* PULL CARD */}
        <div className="op-card">
          <h2 className="op-title">⬇️ Pull Changes</h2>
          <form onSubmit={handlePullSubmit}>
            <div className="form-group">
              <label className="form-label">Local Branch to Sync</label>
              <select 
                className="select-input"
                value={pullBranchName}
                onChange={(e) => setPullBranchName(e.target.value)}
              >
                {branchKeys.map(b => (
                  <option key={b} value={b}>{b}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Target Branch (Remote tip)</label>
              <select 
                className="select-input"
                value={pullTargetBranch}
                onChange={(e) => setPullTargetBranch(e.target.value)}
              >
                <option value="">-- select target branch --</option>
                {branchKeys.map(b => (
                  <option key={b} value={b}>{b}</option>
                ))}
              </select>
            </div>
            <button 
              type="submit" 
              className="btn-submit btn-pull"
              disabled={pullLoading || branchKeys.length === 0 || !pullTargetBranch}
            >
              {pullLoading ? 'Pulling...' : 'Pull Changes'}
            </button>
            {pullSuccess && <div className="message-success">✅ {pullSuccess}</div>}
            {pullError && <div className="message-error">❌ {pullError}</div>}
          </form>
        </div>
      </div>

      {/* ACTIVITY LOG */}
      <div className="activity-section">
        <h2 className="activity-title">🕒 Activity Log</h2>
        {activity.length === 0 ? (
          <div style={{ color: 'var(--text-secondary)', fontStyle: 'italic', fontSize: '13px' }}>
            No push/pull activities recorded for this repository yet.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="activity-table">
              <thead>
                <tr>
                  <th>User</th>
                  <th>Action</th>
                  <th>Branch</th>
                  <th>Details</th>
                  <th>Commit</th>
                  <th>Time</th>
                </tr>
              </thead>
              <tbody>
                {activity.map((act, index) => {
                  let badgeClass = 'badge-push';
                  let actionText = act.action;
                  if (act.action === 'pull') badgeClass = 'badge-pull';
                  if (act.action === 'build') badgeClass = 'badge-build';

                  let details = '';
                  if (act.action === 'pull') {
                    details = act.targetBranch ? `Synced with 🌿 ${act.targetBranch}` : 'Pulled changes';
                  } else if (act.action === 'push') {
                    details = 'Pushed changes';
                  } else if (act.action === 'build') {
                    details = 'Triggered pipeline build';
                  }

                  let envBadge = null;
                  if (act.environment && act.environment !== 'none') {
                    const e = act.environment;
                    const c = e === 'production' ? 'badge-env-prod' : e === 'staging' ? 'badge-env-staging' : e === 'QA' ? 'badge-env-qa' : 'badge-env-dev';
                    envBadge = <span className={`badge-env-small ${c}`}>{e}</span>;
                  }

                  return (
                    <tr key={index}>
                      <td style={{ fontWeight: '500' }}>👤 {act.username}</td>
                      <td>
                        <span className={`badge ${badgeClass}`}>
                          {actionText}
                        </span>
                        {envBadge}
                      </td>
                      <td>🌿 {act.branch}</td>
                      <td>{details}</td>
                      <td>
                        <span className="hash-code">{act.commit?.substring(0, 7)}</span>
                      </td>
                      <td style={{ color: 'var(--text-secondary)' }}>
                        {new Date(act.timestamp).toLocaleString()}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

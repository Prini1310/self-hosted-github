import React, { useEffect, useState } from 'react';
import {
  listEnvironments,
  createEnvironment,
  updateEnvironment,
  deleteEnvironment
} from '../api/client';

export default function EnvironmentsPage({ repoName }) {
  const [environments, setEnvironments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Form State
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [formName, setFormName] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formNodeEnv, setFormNodeEnv] = useState('development');
  const [formBuildCommandOverride, setFormBuildCommandOverride] = useState('');
  const [formEnvVars, setFormEnvVars] = useState([]); // [{ key: '', value: '' }]
  const [formError, setFormError] = useState('');

  const fetchEnvironments = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await listEnvironments(repoName);
      // Sort so production is last, development first
      const order = { development: 1, QA: 2, staging: 3, production: 4 };
      const sorted = [...data].sort((a, b) => {
        const oa = order[a.name] || 99;
        const ob = order[b.name] || 99;
        return oa - ob || a.name.localeCompare(b.name);
      });
      setEnvironments(sorted);
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Failed to load environments');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (repoName) {
      fetchEnvironments();
      closeForm();
    }
  }, [repoName]);

  const closeForm = () => {
    setIsFormOpen(false);
    setIsEditing(false);
    setFormName('');
    setFormDescription('');
    setFormNodeEnv('development');
    setFormBuildCommandOverride('');
    setFormEnvVars([]);
    setFormError('');
  };

  const openCreateForm = () => {
    closeForm();
    setIsFormOpen(true);
    setIsEditing(false);
  };

  const openEditForm = (env) => {
    closeForm();
    setIsFormOpen(true);
    setIsEditing(true);
    setFormName(env.name);
    setFormDescription(env.description || '');
    setFormNodeEnv(env.nodeEnv || 'development');
    setFormBuildCommandOverride(env.buildCommandOverride || '');
    
    // Map object to array of {key, value}
    const vars = [];
    if (env.envVars) {
      for (const [key, value] of Object.entries(env.envVars)) {
        vars.push({ key, value });
      }
    }
    setFormEnvVars(vars);
  };

  const handleAddEnvVarRow = () => {
    setFormEnvVars([...formEnvVars, { key: '', value: '' }]);
  };

  const handleRemoveEnvVarRow = (index) => {
    const next = [...formEnvVars];
    next.splice(index, 1);
    setFormEnvVars(next);
  };

  const handleEnvVarChange = (index, field, val) => {
    const next = [...formEnvVars];
    next[index][field] = val;
    setFormEnvVars(next);
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    setFormError('');
    setSuccess('');

    const name = formName.trim();
    if (!name) {
      setFormError('Environment name is required');
      return;
    }

    // Convert variables list back to key-value object
    const envVarsObj = {};
    for (const item of formEnvVars) {
      const k = item.key.trim();
      const v = item.value; // keep value as is
      if (k) {
        envVarsObj[k] = v;
      }
    }

    const payload = {
      name,
      description: formDescription.trim(),
      nodeEnv: formNodeEnv.trim(),
      buildCommandOverride: formBuildCommandOverride.trim(),
      envVars: envVarsObj
    };

    try {
      if (isEditing) {
        await updateEnvironment(repoName, name, payload);
        setSuccess(`✅ Environment '${name}' updated successfully`);
      } else {
        await createEnvironment(repoName, payload);
        setSuccess(`✅ Environment '${name}' created successfully`);
      }
      closeForm();
      await fetchEnvironments();
    } catch (err) {
      setFormError(err.response?.data?.error || err.message || 'Failed to save environment config');
    }
  };

  const handleDelete = async (envName) => {
    if (!window.confirm(`Are you sure you want to delete environment '${envName}'?`)) {
      return;
    }
    setError('');
    setSuccess('');
    try {
      await deleteEnvironment(repoName, envName);
      setSuccess(`✅ Environment '${envName}' deleted successfully`);
      await fetchEnvironments();
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Failed to delete environment');
    }
  };

  return (
    <div className="environments-page">
      <style>{`
        .environments-page {
          max-width: 900px;
          margin: 0 auto;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif;
          color: var(--text-primary);
        }

        .header-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 24px;
        }

        .page-title {
          font-size: 20px;
          font-weight: 600;
          margin: 0;
        }

        .btn-new-env {
          background-color: var(--success, #2ea44f);
          color: #ffffff;
          border: 1px solid rgba(27, 31, 35, 0.15);
          border-radius: 6px;
          padding: 5px 16px;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .btn-new-env:hover {
          background-color: #2c974b;
        }

        .alert-success {
          background-color: rgba(56, 139, 253, 0.1);
          border: 1px solid rgba(56, 139, 253, 0.4);
          color: var(--text-link);
          padding: 12px;
          border-radius: 6px;
          margin-bottom: 16px;
          font-size: 14px;
        }

        .alert-error {
          background-color: rgba(248, 81, 73, 0.1);
          border: 1px solid rgba(248, 81, 73, 0.4);
          color: #f85149;
          padding: 12px;
          border-radius: 6px;
          margin-bottom: 16px;
          font-size: 14px;
        }

        .env-grid {
          display: grid;
          grid-template-columns: 1fr;
          gap: 16px;
        }

        .env-card {
          background-color: var(--bg-default, #0d1117);
          border: 1px solid var(--border, #30363d);
          border-radius: 6px;
          padding: 16px;
          display: flex;
          flex-direction: column;
          gap: 12px;
          position: relative;
        }

        .env-card.production-env {
          border-color: rgba(248, 81, 73, 0.4);
          box-shadow: 0 0 10px rgba(248, 81, 73, 0.05);
        }

        .env-card-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          flex-wrap: wrap;
          gap: 8px;
        }

        .env-name-container {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .env-name {
          font-size: 16px;
          font-weight: 600;
          color: var(--text-primary);
        }

        .badge {
          font-size: 11px;
          font-weight: 600;
          padding: 2px 6px;
          border-radius: 2em;
          text-transform: uppercase;
        }

        .badge-dev {
          background-color: rgba(56, 139, 253, 0.15);
          color: #58a6ff;
          border: 1px solid rgba(56, 139, 253, 0.3);
        }

        .badge-qa {
          background-color: rgba(219, 109, 40, 0.15);
          color: #f0883e;
          border: 1px solid rgba(219, 109, 40, 0.3);
        }

        .badge-staging {
          background-color: rgba(187, 128, 255, 0.15);
          color: #bc8cff;
          border: 1px solid rgba(187, 128, 255, 0.3);
        }

        .badge-prod {
          background-color: rgba(248, 81, 73, 0.15);
          color: #f85149;
          border: 1px solid rgba(248, 81, 73, 0.3);
        }

        .env-desc {
          font-size: 13px;
          color: var(--text-secondary, #8b949e);
          line-height: 1.4;
        }

        .env-details {
          background-color: var(--bg-subtle, #161b22);
          border-radius: 6px;
          padding: 10px 12px;
          font-size: 13px;
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .detail-row {
          display: flex;
          justify-content: space-between;
          border-bottom: 1px solid rgba(48, 54, 61, 0.5);
          padding-bottom: 6px;
        }

        .detail-row:last-child {
          border-bottom: none;
          padding-bottom: 0;
        }

        .detail-label {
          color: var(--text-secondary, #8b949e);
        }

        .detail-value {
          font-family: ui-monospace, SFMono-Regular, SF Mono, Menlo, Consolas, Liberation Mono, monospace;
          color: var(--text-primary);
        }

        .detail-value.override-cmd {
          color: #ff7b72;
          font-style: italic;
        }

        .env-vars-section {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .env-vars-title {
          font-size: 12px;
          font-weight: 600;
          color: var(--text-secondary, #8b949e);
        }

        .env-vars-list {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
        }

        .env-var-pill {
          background-color: rgba(110, 118, 129, 0.1);
          border: 1px solid rgba(240, 246, 252, 0.1);
          border-radius: 4px;
          padding: 2px 6px;
          font-size: 11px;
          font-family: monospace;
          display: inline-flex;
          align-items: center;
          gap: 4px;
        }

        .env-var-key {
          color: #ff7b72;
          font-weight: 600;
        }

        .env-var-val {
          color: #a5d6ff;
        }

        .card-actions {
          display: flex;
          justify-content: flex-end;
          gap: 8px;
          margin-top: 4px;
          border-top: 1px solid var(--border, #30363d);
          padding-top: 12px;
        }

        .env-meta {
          font-size: 11px;
          color: var(--text-secondary, #8b949e);
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .form-card {
          background-color: var(--bg-default, #0d1117);
          border: 1px solid var(--border, #30363d);
          border-radius: 6px;
          padding: 20px;
          margin-bottom: 24px;
        }

        .form-title {
          font-size: 18px;
          font-weight: 600;
          margin-top: 0;
          margin-bottom: 16px;
          color: var(--text-primary);
        }

        .form-group {
          margin-bottom: 16px;
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .form-label {
          font-size: 14px;
          font-weight: 600;
          color: var(--text-primary);
        }

        .input-text, .select-input, .textarea-text {
          background-color: #0d1117;
          border: 1px solid var(--border, #30363d);
          border-radius: 6px;
          color: #c9d1d9;
          padding: 6px 12px;
          font-size: 14px;
          width: 100%;
          outline: none;
        }

        .input-text:focus, .select-input:focus, .textarea-text:focus {
          border-color: #58a6ff;
          box-shadow: 0 0 0 3px rgba(56, 139, 253, 0.3);
        }

        .input-text:disabled {
          background-color: #161b22;
          color: #8b949e;
          cursor: not-allowed;
        }

        .textarea-text {
          resize: vertical;
          min-height: 60px;
        }

        .variables-manager {
          margin-bottom: 16px;
          border: 1px solid var(--border, #30363d);
          border-radius: 6px;
          padding: 12px;
          background-color: #161b22;
        }

        .variables-manager-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 12px;
        }

        .var-row {
          display: grid;
          grid-template-columns: 1fr 1fr auto;
          gap: 8px;
          margin-bottom: 8px;
          align-items: center;
        }

        .btn-delete-row {
          background: transparent;
          border: none;
          color: #f85149;
          cursor: pointer;
          padding: 6px;
          font-size: 16px;
        }

        .form-actions {
          display: flex;
          gap: 12px;
          margin-top: 20px;
        }

        .btn-primary {
          background-color: var(--success, #2ea44f);
          color: #ffffff;
          border: 1px solid rgba(27, 31, 35, 0.15);
          border-radius: 6px;
          padding: 6px 16px;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
        }

        .btn-primary:hover {
          background-color: #2c974b;
        }

        .btn-secondary {
          background-color: transparent;
          color: var(--text-primary);
          border: 1px solid var(--border, #30363d);
          border-radius: 6px;
          padding: 6px 16px;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
        }

        .btn-secondary:hover {
          background-color: var(--bg-subtle, #161b22);
          border-color: #8b949e;
        }

        .btn-danger {
          background-color: transparent;
          color: #f85149;
          border: 1px solid rgba(248, 81, 73, 0.4);
          border-radius: 6px;
          padding: 4px 10px;
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
        }

        .btn-danger:hover {
          background-color: rgba(248, 81, 73, 0.15);
          border-color: #f85149;
        }

        .btn-edit {
          background-color: transparent;
          color: var(--text-link, #58a6ff);
          border: 1px solid var(--border, #30363d);
          border-radius: 6px;
          padding: 4px 10px;
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
        }

        .btn-edit:hover {
          background-color: var(--bg-subtle, #161b22);
          border-color: var(--text-link, #58a6ff);
        }

        .empty-state {
          text-align: center;
          padding: 40px;
          border: 1px dashed var(--border, #30363d);
          border-radius: 6px;
          color: var(--text-secondary, #8b949e);
        }
      `}</style>

      <div className="header-row">
        <h2 className="page-title">Environments</h2>
        {!isFormOpen && (
          <button className="btn-new-env" onClick={openCreateForm}>
            ➕ New Environment
          </button>
        )}
      </div>

      {success && <div className="alert-success">{success}</div>}
      {error && <div className="alert-error">{error}</div>}

      {/* FORM SECTION */}
      {isFormOpen && (
        <div className="form-card">
          <h3 className="form-title">
            {isEditing ? `Edit Environment: ${formName}` : 'Create New Environment'}
          </h3>

          <form onSubmit={handleFormSubmit}>
            {formError && <div className="alert-error" style={{ padding: '8px', marginBottom: '12px' }}>{formError}</div>}

            <div className="form-group">
              <label className="form-label" htmlFor="env-name-input">
                Environment Name *
              </label>
              <input
                type="text"
                id="env-name-input"
                className="input-text"
                placeholder="e.g. development, production, staging-2"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                disabled={isEditing}
                required
              />
              {!isEditing && (
                <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                  Alphanumeric characters, underscores, and dashes only. Name is immutable after creation.
                </div>
              )}
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="env-desc-input">
                Description
              </label>
              <textarea
                id="env-desc-input"
                className="textarea-text"
                placeholder="Describe what this environment is used for..."
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="env-nodeenv-input">
                NODE_ENV
              </label>
              <select
                id="env-nodeenv-input"
                className="select-input"
                value={formNodeEnv}
                onChange={(e) => setFormNodeEnv(e.target.value)}
              >
                <option value="development">development</option>
                <option value="staging">staging</option>
                <option value="testing">testing</option>
                <option value="production">production</option>
              </select>
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="env-override-input">
                Build Command Override (optional)
              </label>
              <input
                type="text"
                id="env-override-input"
                className="input-text"
                placeholder="e.g. npm run build:prod (runs directly in shell, bypassing default script parsing)"
                value={formBuildCommandOverride}
                onChange={(e) => setFormBuildCommandOverride(e.target.value)}
              />
            </div>

            {/* Environment Variables Manager */}
            <div className="variables-manager">
              <div className="variables-manager-header">
                <span className="form-label" style={{ fontSize: '13px' }}>Environment Variables</span>
                <button
                  type="button"
                  className="btn-secondary"
                  style={{ padding: '3px 8px', fontSize: '12px' }}
                  onClick={handleAddEnvVarRow}
                >
                  ➕ Add Variable
                </button>
              </div>

              {formEnvVars.length === 0 ? (
                <div style={{ fontSize: '12px', color: 'var(--text-secondary)', textAlign: 'center', padding: '10px 0' }}>
                  No environment variables added.
                </div>
              ) : (
                formEnvVars.map((item, index) => (
                  <div className="var-row" key={index}>
                    <input
                      type="text"
                      className="input-text"
                      style={{ fontSize: '12px', padding: '4px 8px' }}
                      placeholder="KEY (e.g. API_URL)"
                      value={item.key}
                      onChange={(e) => handleEnvVarChange(index, 'key', e.target.value)}
                    />
                    <input
                      type="text"
                      className="input-text"
                      style={{ fontSize: '12px', padding: '4px 8px' }}
                      placeholder="VALUE"
                      value={item.value}
                      onChange={(e) => handleEnvVarChange(index, 'value', e.target.value)}
                    />
                    <button
                      type="button"
                      className="btn-delete-row"
                      title="Remove variable"
                      onClick={() => handleRemoveEnvVarRow(index)}
                    >
                      🗑️
                    </button>
                  </div>
                ))
              )}
            </div>

            <div className="form-actions">
              <button type="submit" className="btn-primary">
                {isEditing ? 'Save Changes' : 'Create Environment'}
              </button>
              <button type="button" className="btn-secondary" onClick={closeForm}>
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ENVIRONMENTS LIST */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-secondary)' }}>
          Loading environments...
        </div>
      ) : environments.length === 0 ? (
        <div className="empty-state">
          No environments found for this repository.
        </div>
      ) : (
        <div className="env-grid">
          {environments.map((env) => {
            const isProd = env.name === 'production' || env.nodeEnv === 'production';
            const badgeClass =
              env.name === 'production' ? 'badge-prod' :
              env.name === 'staging' ? 'badge-staging' :
              env.name === 'QA' ? 'badge-qa' : 'badge-dev';

            return (
              <div key={env.name} className={`env-card ${isProd ? 'production-env' : ''}`}>
                <div className="env-card-header">
                  <div className="env-name-container">
                    <span className="env-name">{env.name}</span>
                    <span className={`badge ${badgeClass}`}>
                      {env.name === 'production' ? '⚠️ production' : env.name}
                    </span>
                  </div>
                  <div className="env-meta">
                    <span>Created by: <strong>{env.createdBy}</strong></span>
                    <span>•</span>
                    <span>Modified: {new Date(env.lastModified).toLocaleDateString()}</span>
                  </div>
                </div>

                {env.description ? (
                  <p className="env-desc">{env.description}</p>
                ) : (
                  <p className="env-desc" style={{ fontStyle: 'italic', opacity: 0.6 }}>No description provided.</p>
                )}

                <div className="env-details">
                  <div className="detail-row">
                    <span className="detail-label">NODE_ENV:</span>
                    <span className="detail-value">{env.nodeEnv}</span>
                  </div>
                  <div className="detail-row">
                    <span className="detail-label">Build Override:</span>
                    {env.buildCommandOverride ? (
                      <span className="detail-value override-cmd">{env.buildCommandOverride}</span>
                    ) : (
                      <span className="detail-value" style={{ opacity: 0.5 }}>(None - defaults to build script detection)</span>
                    )}
                  </div>
                </div>

                <div className="env-vars-section">
                  <span className="env-vars-title">Environment Variables:</span>
                  {env.envVars && Object.keys(env.envVars).length > 0 ? (
                    <div className="env-vars-list">
                      {Object.entries(env.envVars).map(([k, v]) => (
                        <div className="env-var-pill" key={k}>
                          <span className="env-var-key">{k}</span>
                          <span>=</span>
                          <span className="env-var-val">"{v}"</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <span style={{ fontSize: '12px', color: 'var(--text-secondary)', fontStyle: 'italic' }}>None configured</span>
                  )}
                </div>

                <div className="card-actions">
                  <button className="btn-edit" onClick={() => openEditForm(env)}>
                    Edit
                  </button>
                  <button className="btn-danger" onClick={() => handleDelete(env.name)}>
                    Delete
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

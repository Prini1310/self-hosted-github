import React, { useEffect, useState, useRef } from 'react';
import { listBuilds, seedWorkspace, seedPythonWorkspace, getStatus, getToken, listEnvironments } from '../api/client';

const ENV_COLORS = {
  production: { bg: 'rgba(248,81,73,0.15)', color: '#f85149', border: 'rgba(248,81,73,0.4)', label: '⚠️ production' },
  staging:    { bg: 'rgba(187,128,255,0.15)', color: '#bc8cff', border: 'rgba(187,128,255,0.4)', label: '🔵 staging' },
  QA:         { bg: 'rgba(240,136,62,0.15)', color: '#f0883e', border: 'rgba(240,136,62,0.4)', label: '🟠 QA' },
  development:{ bg: 'rgba(56,139,253,0.15)', color: '#58a6ff', border: 'rgba(56,139,253,0.4)', label: '🟢 development' },
};

function getEnvStyle(envName) {
  return ENV_COLORS[envName] || { bg: 'rgba(110,118,129,0.15)', color: '#8b949e', border: 'rgba(110,118,129,0.4)', label: `⚪ ${envName}` };
}

export default function BuildPage({ repoName }) {
  const [currentBranch, setCurrentBranch] = useState('main');
  const [selectedLang, setSelectedLang] = useState('java');
  const [builds, setBuilds] = useState([]);
  const [logs, setLogs] = useState([]);
  const [buildStatus, setBuildStatus] = useState('idle'); // idle | running | success | failed
  const [buildTool, setBuildTool] = useState('');
  const [selectedBuild, setSelectedBuild] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [infoMessage, setInfoMessage] = useState('');

  // Environment state
  const [envs, setEnvs] = useState([]);
  const [selectedEnv, setSelectedEnv] = useState('development');
  const [confirmProd, setConfirmProd] = useState(false);
  const [envsLoading, setEnvsLoading] = useState(true);

  const eventSourceRef = useRef(null);
  const logsEndRef = useRef(null);

  /* ── data fetching ─────────────────────────────────── */
  const fetchStatus = async () => {
    try {
      const data = await getStatus(repoName);
      if (data?.branch) setCurrentBranch(data.branch);
    } catch (e) { /* silent */ }
  };

  const fetchHistory = async () => {
    try {
      const data = await listBuilds(repoName);
      if (data?.builds) setBuilds(data.builds);
    } catch (e) { /* silent */ }
  };

  const fetchEnvironments = async () => {
    setEnvsLoading(true);
    try {
      const result = await listEnvironments(repoName);
      // API returns { success, environments: [...] }
      const list = Array.isArray(result) ? result : (result?.environments || []);
      setEnvs(list);
      if (list.length > 0) {
        const hasDev = list.some(e => e.name === 'development');
        setSelectedEnv(hasDev ? 'development' : list[0].name);
      }
    } catch (e) {
      console.error('BuildPage: failed to load environments', e);
    } finally {
      setEnvsLoading(false);
    }
  };

  useEffect(() => {
    if (!repoName) return;
    fetchStatus();
    fetchHistory();
    fetchEnvironments();
    setLogs([]);
    setBuildStatus('idle');
    setSelectedBuild(null);
    setError('');
    setInfoMessage('');
    setConfirmProd(false);

    return () => {
      eventSourceRef.current?.close();
    };
  }, [repoName]);

  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  /* ── actions ───────────────────────────────────────── */
  const handleSeedWorkspace = async () => {
    setError(''); setInfoMessage(''); setLoading(true);
    try {
      if (selectedLang === 'python') {
        await seedPythonWorkspace(repoName);
        setInfoMessage('✅ Python pytest workspace seeded successfully!');
      } else {
        await seedWorkspace(repoName);
        setInfoMessage('✅ Maven workspace seeded successfully!');
      }
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Failed to seed workspace');
    } finally { setLoading(false); }
  };

  const handleTriggerBuild = () => {
    setError(''); setInfoMessage('');
    setLogs([]); setBuildStatus('running');
    setBuildTool(''); setSelectedBuild(null);
    eventSourceRef.current?.close();

    const token = getToken();
    const qs = new URLSearchParams({ branch: currentBranch, lang: selectedLang });
    if (token) qs.set('token', token);
    if (selectedEnv) qs.set('environment', selectedEnv);
    if (confirmProd) qs.set('confirmProduction', 'true');

    const es = new EventSource(`http://localhost:3000/api/repos/${repoName}/builds/trigger?${qs}`);
    eventSourceRef.current = es;

    es.addEventListener('start', e => {
      try {
        const d = JSON.parse(e.data);
        setBuildTool(d.tool);
        setLogs([`▶ Build started — tool: ${d.tool} | env: ${selectedEnv}`]);
      } catch { setLogs(['▶ Build started']); }
    });

    es.addEventListener('log', e => {
      try {
        const d = JSON.parse(e.data);
        setLogs(prev => [...prev, d.line]);
      } catch { setLogs(prev => [...prev, e.data]); }
    });

    es.addEventListener('done', e => {
      try {
        const d = JSON.parse(e.data);
        setLogs(prev => [...prev, d.status === 'success' ? '✅ Build succeeded (exit 0)' : `❌ Build failed (exit ${d.exitCode ?? 1})`]);
        setBuildStatus(d.status);
      } catch { setBuildStatus('success'); }
      es.close(); eventSourceRef.current = null;
      fetchHistory();
    });

    es.onerror = () => {
      setLogs(prev => [...prev, '❌ Build connection error.']);
      setBuildStatus('failed');
      es.close(); eventSourceRef.current = null;
      fetchHistory();
    };
  };

  const handleSelectBuild = (build) => {
    if (buildStatus === 'running') {
      if (!window.confirm('A build is running. View past build anyway?')) return;
      eventSourceRef.current?.close();
      eventSourceRef.current = null;
      setBuildStatus('idle');
    }
    setSelectedBuild(build);
    setBuildTool(build.tool);
    const startMsg = `▶ Build started — tool: ${build.tool}${build.environment ? ` | env: ${build.environment}` : ''}`;
    const endMsg = build.status === 'success'
      ? '✅ Build succeeded (exit 0)'
      : `❌ Build failed (exit ${build.exitCode ?? 1})`;
    setLogs([startMsg, ...(build.logs || []), endMsg]);
  };

  /* ── helpers ───────────────────────────────────────── */
  const formatTs = (iso) => {
    if (!iso) return '';
    try {
      return new Date(iso).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false }).replace(',', '');
    } catch { return iso; }
  };

  const envStyle = getEnvStyle(selectedEnv);
  const isProduction = selectedEnv === 'production';
  const canTrigger = buildStatus !== 'running' && !(isProduction && !confirmProd);

  /* ── render ────────────────────────────────────────── */
  return (
    <div style={styles.page}>

      {/* ── Header ─────────────────────────────────── */}
      <div style={styles.headerRow}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <h2 style={styles.pageTitle}>⚙️ Build Pipeline</h2>
          <span style={styles.branchBadge}>🌿 {currentBranch}</span>
        </div>
        {/* Active environment indicator */}
        <div style={{ ...styles.activeEnvPill, background: envStyle.bg, color: envStyle.color, borderColor: envStyle.border }}>
          {envStyle.label}
        </div>
      </div>

      {/* ── Banners ────────────────────────────────── */}
      {error      && <div style={styles.bannerError}>❌ {error}</div>}
      {infoMessage && <div style={styles.bannerSuccess}>{infoMessage}</div>}

      {/* ── Config Row: Language + Environment ─────── */}
      <div style={styles.configCard}>
        <div style={styles.configRow}>
          {/* Language toggle */}
          <div style={styles.configGroup}>
            <span style={styles.configLabel}>Pipeline Language</span>
            <div style={{ display: 'flex', gap: 6 }}>
              {['java', 'python'].map(lang => (
                <button
                  key={lang}
                  style={{ ...styles.pill, ...(selectedLang === lang ? styles.pillActive : {}) }}
                  onClick={() => setSelectedLang(lang)}
                  disabled={buildStatus === 'running'}
                >
                  {lang === 'java' ? '☕ Java' : '🐍 Python'}
                </button>
              ))}
            </div>
          </div>

          {/* Environment selector */}
          <div style={styles.configGroup}>
            <span style={styles.configLabel}>Target Environment</span>
            {envsLoading ? (
              <span style={{ color: '#8b949e', fontSize: 13 }}>Loading environments…</span>
            ) : (
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                {envs.length === 0
                  ? <span style={{ color: '#8b949e', fontSize: 13 }}>No environments configured</span>
                  : envs.map(env => {
                    const s = getEnvStyle(env.name);
                    const isSelected = selectedEnv === env.name;
                    return (
                      <button
                        key={env.name}
                        onClick={() => { setSelectedEnv(env.name); setConfirmProd(false); }}
                        disabled={buildStatus === 'running'}
                        title={env.description || env.name}
                        style={{
                          background: isSelected ? s.bg : 'transparent',
                          color: isSelected ? s.color : '#8b949e',
                          border: `1px solid ${isSelected ? s.border : '#30363d'}`,
                          borderRadius: 20,
                          padding: '4px 14px',
                          fontSize: 12,
                          fontWeight: 600,
                          cursor: 'pointer',
                          transition: 'all 0.15s',
                          textTransform: 'uppercase',
                          letterSpacing: '0.4px',
                        }}
                      >
                        {env.name}
                      </button>
                    );
                  })}
              </div>
            )}
          </div>
        </div>

        {/* Production confirmation */}
        {isProduction && (
          <div style={styles.prodWarning}>
            <input
              type="checkbox"
              id="confirm-prod"
              checked={confirmProd}
              onChange={e => setConfirmProd(e.target.checked)}
              disabled={buildStatus === 'running'}
              style={{ cursor: 'pointer', width: 14, height: 14 }}
            />
            <label htmlFor="confirm-prod" style={{ color: '#f85149', fontSize: 13, fontWeight: 600, cursor: 'pointer', margin: 0 }}>
              ⚠️ I confirm this is a <strong>production</strong> build — this will affect live systems
            </label>
          </div>
        )}
      </div>

      {/* ── Actions ────────────────────────────────── */}
      <div style={styles.actionBar}>
        <button
          style={styles.btnMuted}
          onClick={handleSeedWorkspace}
          disabled={loading || buildStatus === 'running'}
        >
          {selectedLang === 'python' ? '🌱 Seed Python Workspace' : '🌱 Seed Maven Workspace'}
        </button>

        <button
          style={{ ...styles.btnTrigger, background: isProduction ? '#b91c1c' : '#238636', opacity: canTrigger ? 1 : 0.5, cursor: canTrigger ? 'pointer' : 'not-allowed' }}
          onClick={handleTriggerBuild}
          disabled={!canTrigger}
        >
          {buildStatus === 'running'
            ? '⏳ Building…'
            : `▶ Trigger Build${selectedEnv ? ` on ${selectedEnv}` : ''}`}
        </button>
      </div>

      {/* ── Live terminal ───────────────────────────── */}
      {(logs.length > 0 || buildStatus === 'running') && (
        <div style={styles.terminal}>
          <div style={styles.terminalHeader}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ color: buildStatus === 'running' ? '#3fb950' : '#8b949e' }}>
                {buildStatus === 'running' ? '● RUNNING' : '◎ FINISHED'}
              </span>
              <span style={{ color: '#8b949e' }}>
                {selectedBuild
                  ? `Build ${selectedBuild.buildId.slice(0, 8)} · ${selectedBuild.tool}`
                  : `Live stream · ${buildTool || '…'}`}
              </span>
            </div>
            {/* Environment pill in terminal header */}
            {(selectedBuild?.environment || selectedEnv) && (() => {
              const eN = selectedBuild?.environment || selectedEnv;
              const eS = getEnvStyle(eN);
              return (
                <span style={{ background: eS.bg, color: eS.color, border: `1px solid ${eS.border}`, borderRadius: 4, padding: '1px 8px', fontSize: 11, fontWeight: 700, textTransform: 'uppercase' }}>
                  {eN}
                </span>
              );
            })()}
          </div>
          <div style={styles.terminalBody}>
            {logs.map((line, i) => {
              let color = '#c9d1d9';
              if (line.startsWith('✅')) color = '#3fb950';
              else if (line.startsWith('❌') || line.startsWith('ERROR') || line.startsWith('SPAWN ERROR')) color = '#f85149';
              else if (line.startsWith('▶')) color = '#58a6ff';
              return (
                <div key={i} style={{ color, padding: '1px 0', fontFamily: 'monospace', fontSize: 13, lineHeight: 1.5 }}>
                  {line}
                </div>
              );
            })}
            <div ref={logsEndRef} />
          </div>
        </div>
      )}

      {/* ── Build History ───────────────────────────── */}
      <div>
        <h3 style={styles.sectionTitle}>Recent Builds</h3>
        <div style={styles.historyList}>
          {builds.length === 0 ? (
            <p style={{ padding: '16px', margin: 0, color: '#8b949e', fontSize: 13 }}>No past builds found.</p>
          ) : (
            builds.map(build => {
              const isActive = selectedBuild?.buildId === build.buildId;
              const eStyle = build.environment ? getEnvStyle(build.environment) : null;
              const statusIcon = build.status === 'success' ? '✅' : build.status === 'failed' ? '❌' : '🔄';
              const exitBg = build.exitCode === 0 ? 'rgba(56,139,253,0.12)' : 'rgba(248,81,73,0.12)';
              const exitColor = build.exitCode === 0 ? '#58a6ff' : '#f85149';

              return (
                <div
                  key={build.buildId}
                  onClick={() => handleSelectBuild(build)}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '12px 16px',
                    borderBottom: '1px solid #21262d',
                    cursor: 'pointer',
                    background: isActive ? 'rgba(56,139,253,0.07)' : 'transparent',
                    borderLeft: isActive ? '3px solid #1f6feb' : '3px solid transparent',
                    transition: 'background 0.15s',
                  }}
                  onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = '#161b22'; }}
                  onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'transparent'; }}
                >
                  {/* Left */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                    <span title={build.status}>{statusIcon}</span>
                    <span style={{ fontFamily: 'monospace', color: '#8b949e', fontSize: 13 }}>{build.buildId.slice(0, 8)}</span>
                    <span style={{ background: '#161b22', border: '1px solid #30363d', color: '#c9d1d9', fontSize: 11, padding: '2px 6px', borderRadius: 3 }}>
                      🌿 {build.branch || 'main'}
                    </span>
                    {eStyle && (
                      <span style={{ background: eStyle.bg, color: eStyle.color, border: `1px solid ${eStyle.border}`, fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 3, textTransform: 'uppercase' }}>
                        {build.environment}
                      </span>
                    )}
                  </div>

                  {/* Right */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    {/* Tool badge */}
                    {build.tool && (
                      <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 12, background: build.tool.includes('python') ? 'rgba(53,114,165,0.12)' : 'rgba(242,100,25,0.12)', color: build.tool.includes('python') ? '#3572a5' : '#f26419' }}>
                        {build.tool.includes('python') ? `🐍 ${build.tool.split('-')[1] || build.tool}` : `☕ ${build.tool}`}
                      </span>
                    )}
                    <span style={{ fontSize: 12, color: '#8b949e' }}>{formatTs(build.startedAt)}</span>
                    {build.exitCode !== null && (
                      <span style={{ background: exitBg, color: exitColor, fontSize: 11, padding: '2px 6px', borderRadius: 3, fontFamily: 'monospace' }}>
                        exit {build.exitCode}
                      </span>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Inline style constants ─────────────────────────── */
const styles = {
  page: {
    maxWidth: 920,
    margin: '0 auto',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif',
    color: '#c9d1d9',
  },
  headerRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
    flexWrap: 'wrap',
    gap: 12,
  },
  pageTitle: {
    fontSize: 20,
    fontWeight: 700,
    margin: 0,
    color: '#e6edf3',
  },
  branchBadge: {
    background: '#1f6feb22',
    border: '1px solid #1f6feb55',
    color: '#58a6ff',
    fontSize: 12,
    fontWeight: 600,
    padding: '3px 10px',
    borderRadius: 20,
  },
  activeEnvPill: {
    fontSize: 12,
    fontWeight: 700,
    padding: '5px 14px',
    borderRadius: 20,
    border: '1px solid',
    letterSpacing: '0.3px',
    textTransform: 'uppercase',
  },
  bannerError: {
    background: 'rgba(248,81,73,0.1)',
    border: '1px solid rgba(248,81,73,0.4)',
    color: '#f85149',
    padding: '10px 14px',
    borderRadius: 6,
    fontSize: 14,
    marginBottom: 16,
  },
  bannerSuccess: {
    background: 'rgba(56,139,253,0.1)',
    border: '1px solid rgba(56,139,253,0.4)',
    color: '#c9d1d9',
    padding: '10px 14px',
    borderRadius: 6,
    fontSize: 14,
    marginBottom: 16,
  },
  configCard: {
    background: '#161b22',
    border: '1px solid #30363d',
    borderRadius: 8,
    padding: '18px 20px',
    marginBottom: 20,
    display: 'flex',
    flexDirection: 'column',
    gap: 18,
  },
  configRow: {
    display: 'flex',
    gap: 40,
    flexWrap: 'wrap',
  },
  configGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
    minWidth: 200,
  },
  configLabel: {
    fontSize: 11,
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.8px',
    color: '#8b949e',
  },
  pill: {
    background: 'transparent',
    color: '#8b949e',
    border: '1px solid #30363d',
    borderRadius: 20,
    padding: '5px 16px',
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'all 0.15s',
  },
  pillActive: {
    background: '#238636',
    color: '#ffffff',
    borderColor: '#238636',
  },
  prodWarning: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    background: 'rgba(248,81,73,0.08)',
    border: '1px solid rgba(248,81,73,0.3)',
    borderRadius: 6,
    padding: '10px 14px',
  },
  actionBar: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
    gap: 12,
  },
  btnMuted: {
    background: 'transparent',
    color: '#8b949e',
    border: '1px solid #30363d',
    borderRadius: 6,
    padding: '7px 16px',
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
  },
  btnTrigger: {
    color: '#fff',
    border: 'none',
    borderRadius: 6,
    padding: '8px 20px',
    fontSize: 14,
    fontWeight: 700,
    transition: 'background 0.15s',
    letterSpacing: '0.2px',
  },
  terminal: {
    background: '#010409',
    border: '1px solid #30363d',
    borderRadius: 8,
    marginBottom: 32,
    overflow: 'hidden',
  },
  terminalHeader: {
    background: '#161b22',
    borderBottom: '1px solid #30363d',
    padding: '8px 16px',
    fontFamily: 'monospace',
    fontSize: 12,
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  terminalBody: {
    padding: 16,
    height: 340,
    overflowY: 'auto',
    whiteSpace: 'pre-wrap',
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: 700,
    margin: '0 0 12px 0',
    color: '#e6edf3',
    paddingBottom: 8,
    borderBottom: '1px solid #21262d',
  },
  historyList: {
    background: '#0d1117',
    border: '1px solid #21262d',
    borderRadius: 8,
    overflow: 'hidden',
  },
};

import React, { useEffect, useState, useCallback } from 'react';
import { getRepoTree, getTreePath, getBlobContent, listBranches } from '../api/client';

/* ── Language map for syntax highlighting (CSS class → extension groups) ─── */
const EXT_LANG = {
  js: 'lang-js', jsx: 'lang-js', ts: 'lang-js', tsx: 'lang-js',
  py: 'lang-python', rb: 'lang-ruby', go: 'lang-go',
  java: 'lang-java', kt: 'lang-java', scala: 'lang-java',
  rs: 'lang-rust', cpp: 'lang-cpp', c: 'lang-cpp', h: 'lang-cpp',
  json: 'lang-json', yaml: 'lang-yaml', yml: 'lang-yaml',
  toml: 'lang-toml', xml: 'lang-xml', html: 'lang-html',
  css: 'lang-css', scss: 'lang-css', sass: 'lang-css',
  sh: 'lang-sh', bash: 'lang-sh', zsh: 'lang-sh',
  md: 'lang-md', markdown: 'lang-md', txt: 'lang-txt',
  sql: 'lang-sql', dockerfile: 'lang-sh', makefile: 'lang-sh',
};

const FILE_ICONS = {
  js: '📜', jsx: '⚛️', ts: '📘', tsx: '⚛️',
  py: '🐍', rb: '💎', go: '🐹',
  java: '☕', kt: '🟣', rs: '🦀',
  json: '🔧', yaml: '🔧', yml: '🔧', toml: '🔧',
  md: '📄', txt: '📄', html: '🌐', css: '🎨', scss: '🎨',
  sh: '⚡', sql: '🗄️', dockerfile: '🐳', makefile: '🔨',
  xml: '📋', png: '🖼️', jpg: '🖼️', jpeg: '🖼️', gif: '🖼️', svg: '🖼️',
};

function getExtension(name = '') {
  const parts = name.toLowerCase().split('.');
  return parts.length > 1 ? parts[parts.length - 1] : '';
}
function getFileIcon(name = '') {
  const ext = getExtension(name);
  return FILE_ICONS[ext] || '📄';
}
function getLangClass(name = '') {
  const ext = getExtension(name);
  return EXT_LANG[ext] || 'lang-txt';
}

function timeAgo(iso) {
  if (!iso) return '';
  const diff = Date.now() - new Date(iso).getTime();
  const secs = Math.floor(diff / 1000);
  if (secs < 60) return `${secs}s ago`;
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins} minute${mins !== 1 ? 's' : ''} ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} hour${hours !== 1 ? 's' : ''} ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} day${days !== 1 ? 's' : ''} ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months} month${months !== 1 ? 's' : ''} ago`;
  return `${Math.floor(months / 12)} year${Math.floor(months / 12) !== 1 ? 's' : ''} ago`;
}

/* ── Simple markdown renderer (headings, bold, code, links) ─────────────── */
function renderMarkdown(text = '') {
  const lines = text.split('\n');
  const result = [];
  let inCode = false;
  let codeLines = [];
  let codeLang = '';

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (line.startsWith('```')) {
      if (!inCode) {
        inCode = true;
        codeLang = line.slice(3).trim();
        codeLines = [];
      } else {
        result.push(
          <pre key={i} style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 6, padding: '12px 16px', overflowX: 'auto', fontSize: 13, fontFamily: 'monospace', color: '#e6edf3', margin: '12px 0' }}>
            <code>{codeLines.join('\n')}</code>
          </pre>
        );
        inCode = false;
        codeLines = [];
      }
      continue;
    }
    if (inCode) { codeLines.push(line); continue; }

    if (line.startsWith('# ')) {
      result.push(<h1 key={i} style={{ fontSize: 26, fontWeight: 700, color: '#e6edf3', margin: '16px 0 8px', borderBottom: '1px solid #30363d', paddingBottom: 8 }}>{line.slice(2)}</h1>);
    } else if (line.startsWith('## ')) {
      result.push(<h2 key={i} style={{ fontSize: 20, fontWeight: 600, color: '#e6edf3', margin: '16px 0 8px' }}>{line.slice(3)}</h2>);
    } else if (line.startsWith('### ')) {
      result.push(<h3 key={i} style={{ fontSize: 16, fontWeight: 600, color: '#c9d1d9', margin: '12px 0 6px' }}>{line.slice(4)}</h3>);
    } else if (line.startsWith('- ') || line.startsWith('* ')) {
      result.push(<li key={i} style={{ color: '#c9d1d9', fontSize: 14, lineHeight: 1.7, listStyle: 'disc', marginLeft: 20 }}>{inlineMarkdown(line.slice(2))}</li>);
    } else if (line.trim() === '') {
      result.push(<div key={i} style={{ height: 8 }} />);
    } else {
      result.push(<p key={i} style={{ color: '#c9d1d9', fontSize: 14, lineHeight: 1.7, margin: '6px 0' }}>{inlineMarkdown(line)}</p>);
    }
  }
  return result;
}

function inlineMarkdown(text) {
  // Bold **text** and inline `code`
  const parts = text.split(/(`[^`]+`|\*\*[^*]+\*\*)/g);
  return parts.map((p, i) => {
    if (p.startsWith('`') && p.endsWith('`')) {
      return <code key={i} style={{ background: '#21262d', borderRadius: 3, padding: '1px 5px', fontFamily: 'monospace', fontSize: '0.9em', color: '#e6edf3' }}>{p.slice(1, -1)}</code>;
    }
    if (p.startsWith('**') && p.endsWith('**')) {
      return <strong key={i} style={{ fontWeight: 700 }}>{p.slice(2, -2)}</strong>;
    }
    return p;
  });
}

/* ── Main component ─────────────────────────────────────────────────────── */
export default function FileBrowserPage({ repoName }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Tree state
  const [rootData, setRootData] = useState(null);    // result from getRepoTree
  const [currentPath, setCurrentPath] = useState(''); // '' = root, 'src' = inside src
  const [currentEntries, setCurrentEntries] = useState([]);

  // File viewer state
  const [viewingFile, setViewingFile] = useState(null); // { name, path, content, ... }

  // Branch state
  const [branches, setBranches] = useState([]);
  const [selectedBranch, setSelectedBranch] = useState('');
  const [branchDropOpen, setBranchDropOpen] = useState(false);

  // README state
  const [readme, setReadme] = useState(null);
  const [readmeLoading, setReadmeLoading] = useState(false);

  /* ── Fetchers ─────────────────────────────────────────────────────────── */
  const fetchBranches = useCallback(async () => {
    try {
      const data = await listBranches(repoName);
      setBranches(data.branches || []);
    } catch (e) { /* silent */ }
  }, [repoName]);

  const fetchRoot = useCallback(async (branch = '') => {
    setLoading(true);
    setError('');
    setViewingFile(null);
    setCurrentPath('');
    setReadme(null);
    try {
      const data = await getRepoTree(repoName, branch);
      setRootData(data);
      setCurrentEntries(data.entries || []);
      setSelectedBranch(data.branch || branch);
      // Look for README at root
      loadReadme('', data.entries || [], branch);
    } catch (e) {
      setError(e.response?.data?.error || e.message || 'Failed to load repository tree');
    } finally {
      setLoading(false);
    }
  }, [repoName]);

  const navigateTo = async (path, branch = '') => {
    if (!path) {
      // Go back to root
      setCurrentPath('');
      setCurrentEntries(rootData?.entries || []);
      setViewingFile(null);
      loadReadme('', rootData?.entries || [], branch || selectedBranch);
      return;
    }
    setLoading(true);
    setError('');
    setViewingFile(null);
    try {
      const data = await getTreePath(repoName, path, branch || selectedBranch);
      if (data.type === 'file') {
        setViewingFile(data);
      } else {
        setCurrentPath(path);
        setCurrentEntries(data.entries || []);
        loadReadme(path, data.entries || [], branch || selectedBranch);
      }
    } catch (e) {
      setError(e.response?.data?.error || e.message || `Path not found: ${path}`);
    } finally {
      setLoading(false);
    }
  };

  const loadReadme = async (path, entries, branch = '') => {
    const hasReadme = entries.some(e => e.type === 'file' && e.name.toLowerCase() === 'readme.md');
    if (!hasReadme) { setReadme(null); return; }
    setReadmeLoading(true);
    try {
      const readmePath = path ? `${path}/README.md` : 'README.md';
      const data = await getBlobContent(repoName, readmePath, branch || selectedBranch);
      setReadme(data);
    } catch (e) {
      setReadme(null);
    } finally {
      setReadmeLoading(false);
    }
  };

  useEffect(() => {
    if (!repoName) return;
    setCurrentPath('');
    setViewingFile(null);
    setReadme(null);
    fetchBranches();
    fetchRoot();
  }, [repoName]);

  /* ── Branch switch ───────────────────────────────────────────────────── */
  const handleBranchSwitch = (b) => {
    setBranchDropOpen(false);
    setSelectedBranch(b);
    setCurrentPath('');
    setViewingFile(null);
    setReadme(null);
    fetchRoot(b);
  };

  /* ── Breadcrumb parts ────────────────────────────────────────────────── */
  const breadcrumbParts = currentPath ? currentPath.split('/') : [];

  /* ── Render ──────────────────────────────────────────────────────────── */
  return (
    <div style={S.page}>

      {/* Header: repo name + branch dropdown + commit count */}
      <div style={S.header}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          {/* Branch selector */}
          <div style={{ position: 'relative' }}>
            <button
              style={S.branchBtn}
              onClick={() => setBranchDropOpen(o => !o)}
            >
              <span>🌿</span>
              <span style={{ maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {selectedBranch || 'main'}
              </span>
              <span style={{ fontSize: 10 }}>▼</span>
            </button>
            {branchDropOpen && (
              <div style={S.branchDropdown}>
                <div style={{ padding: '8px 12px', fontSize: 11, color: '#8b949e', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.6px' }}>
                  Switch branches
                </div>
                {branches.map(b => (
                  <button
                    key={b}
                    style={{ ...S.branchItem, fontWeight: b === selectedBranch ? 700 : 400, color: b === selectedBranch ? '#58a6ff' : '#c9d1d9' }}
                    onClick={() => handleBranchSwitch(b)}
                  >
                    {b === selectedBranch && '✓ '}
                    {b}
                  </button>
                ))}
                {branches.length === 0 && (
                  <div style={{ padding: '8px 12px', color: '#8b949e', fontSize: 13 }}>No branches</div>
                )}
              </div>
            )}
          </div>

          {/* Breadcrumb */}
          <div style={S.breadcrumb}>
            <button style={S.breadcrumbLink} onClick={() => navigateTo('')}>
              📁 {repoName}
            </button>
            {breadcrumbParts.map((part, i) => {
              const segPath = breadcrumbParts.slice(0, i + 1).join('/');
              const isLast = i === breadcrumbParts.length - 1;
              return (
                <React.Fragment key={segPath}>
                  <span style={{ color: '#8b949e', fontSize: 16 }}>/</span>
                  {isLast
                    ? <span style={{ color: '#e6edf3', fontWeight: 600, fontSize: 14 }}>{part}</span>
                    : <button style={S.breadcrumbLink} onClick={() => navigateTo(segPath)}>{part}</button>}
                </React.Fragment>
              );
            })}
            {viewingFile && (
              <>
                <span style={{ color: '#8b949e', fontSize: 16 }}>/</span>
                <span style={{ color: '#e6edf3', fontWeight: 600, fontSize: 14 }}>{viewingFile.name}</span>
              </>
            )}
          </div>
        </div>

        {rootData && rootData.commitCount > 0 && (
          <div style={S.commitCount}>
            🕒 {rootData.commitCount} commit{rootData.commitCount !== 1 ? 's' : ''}
          </div>
        )}
      </div>

      {/* Error */}
      {error && <div style={S.bannerError}>❌ {error}</div>}

      {/* Loading */}
      {loading && (
        <div style={{ padding: '40px', textAlign: 'center', color: '#8b949e' }}>
          <div style={{ fontSize: 24, marginBottom: 8 }}>⏳</div>
          Loading…
        </div>
      )}

      {/* Empty state – no commits */}
      {!loading && !error && rootData && rootData.commitCount === 0 && (
        <div style={S.emptyState}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>📭</div>
          <h2 style={{ margin: '0 0 8px', color: '#e6edf3', fontSize: 20 }}>This repository is empty</h2>
          <p style={{ color: '#8b949e', fontSize: 14, margin: '0 0 20px' }}>
            Get started by staging and committing files using the Stage tab.
          </p>
          <div style={S.codeBlock}>
            <div style={{ color: '#8b949e', fontSize: 11, marginBottom: 6 }}>Quick start</div>
            <code style={{ color: '#3fb950', fontSize: 12, fontFamily: 'monospace' }}>
              {`POST /api/repos/${repoName}/add   { filepath, content }\nPOST /api/repos/${repoName}/commit { author, message }`}
            </code>
          </div>
        </div>
      )}

      {/* File viewer */}
      {!loading && viewingFile && (
        <div>
          {/* File header */}
          <div style={S.fileHeader}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <button style={S.backBtn} onClick={() => navigateTo(currentPath)}>
                ← Back
              </button>
              <span style={{ color: '#8b949e', fontSize: 13 }}>
                {getFileIcon(viewingFile.name)} {viewingFile.name}
              </span>
              {viewingFile.lastCommitMessage && (
                <span style={{ color: '#8b949e', fontSize: 12, fontStyle: 'italic' }}>
                  · {viewingFile.lastCommitMessage.slice(0, 60)}
                </span>
              )}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ color: '#8b949e', fontSize: 12 }}>
                {timeAgo(viewingFile.lastCommitTimestamp)}
              </span>
              {viewingFile.size !== undefined && (
                <span style={{ color: '#8b949e', fontSize: 12 }}>{viewingFile.size} B</span>
              )}
            </div>
          </div>

          {/* Code block */}
          <div style={S.codeContainer}>
            <div style={S.lineNumbers}>
              {(viewingFile.content || '').split('\n').map((_, i) => (
                <span key={i} style={{ display: 'block', color: '#495162', userSelect: 'none', fontSize: 12, lineHeight: '1.6' }}>
                  {i + 1}
                </span>
              ))}
            </div>
            <pre style={S.codeContent}>
              <code className={getLangClass(viewingFile.name)}>
                {viewingFile.content || ''}
              </code>
            </pre>
          </div>
        </div>
      )}

      {/* File/folder table */}
      {!loading && !viewingFile && rootData && rootData.commitCount > 0 && (
        <>
          {/* Latest commit bar */}
          {rootData.commitMessage && (
            <div style={S.latestCommitBar}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 }}>
                <span style={{ color: '#58a6ff', fontSize: 13, fontWeight: 600 }}>
                  👤 {rootData.commitAuthor || 'unknown'}
                </span>
                <span style={{ color: '#c9d1d9', fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {rootData.commitMessage}
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
                <span style={S.hashBadge}>{(rootData.commitHash || '').slice(0, 7)}</span>
                <span style={{ color: '#8b949e', fontSize: 12 }}>{timeAgo(rootData.commitTimestamp)}</span>
              </div>
            </div>
          )}

          {/* Table */}
          <div style={S.table}>
            {currentEntries.length === 0 ? (
              <div style={{ padding: '20px 16px', color: '#8b949e', fontSize: 13 }}>
                Empty directory
              </div>
            ) : (
              currentEntries.map(entry => (
                <div
                  key={entry.path + entry.name}
                  style={S.tableRow}
                  onClick={() => navigateTo(entry.path)}
                  onMouseEnter={e => { e.currentTarget.style.background = '#161b22'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
                >
                  {/* Icon + Name */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: '0 0 240px', minWidth: 0, paddingRight: 12 }}>
                    <span style={{ flexShrink: 0, fontSize: 14 }}>
                      {entry.type === 'dir' ? '📁' : getFileIcon(entry.name)}
                    </span>
                    <span style={{
                      color: entry.type === 'dir' ? '#58a6ff' : '#e6edf3',
                      fontSize: 14,
                      fontWeight: entry.type === 'dir' ? 500 : 400,
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      cursor: 'pointer',
                    }}>
                      {entry.name}
                      {entry.type === 'dir' ? '/' : ''}
                    </span>
                  </div>

                  {/* Last commit message */}
                  <div style={{ flex: 1, minWidth: 0, paddingRight: 16 }}>
                    <span style={{ color: '#8b949e', fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }}>
                      {entry.lastCommitMessage || '—'}
                    </span>
                  </div>

                  {/* Time ago */}
                  <div style={{ flexShrink: 0, color: '#8b949e', fontSize: 12, textAlign: 'right', minWidth: 90 }}>
                    {timeAgo(entry.lastCommitTimestamp)}
                  </div>
                </div>
              ))
            )}
          </div>
        </>
      )}

      {/* README renderer */}
      {!loading && !viewingFile && readme && (
        <div style={S.readmeCard}>
          <div style={S.readmeHeader}>
            <span>📄 README.md</span>
          </div>
          <div style={S.readmeBody}>
            {renderMarkdown(readme.content || '')}
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Styles ───────────────────────────────────────────────────────────────── */
const S = {
  page: {
    maxWidth: 960,
    margin: '0 auto',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif',
    color: '#c9d1d9',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    gap: 12,
    flexWrap: 'wrap',
  },
  branchBtn: {
    display: 'flex', alignItems: 'center', gap: 6,
    background: '#161b22', border: '1px solid #30363d', borderRadius: 6,
    color: '#c9d1d9', padding: '5px 12px', fontSize: 13, fontWeight: 600,
    cursor: 'pointer', transition: 'border-color 0.15s',
  },
  branchDropdown: {
    position: 'absolute', top: '100%', left: 0, zIndex: 200,
    background: '#161b22', border: '1px solid #30363d', borderRadius: 8,
    boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
    minWidth: 220, marginTop: 4,
    display: 'flex', flexDirection: 'column',
  },
  branchItem: {
    background: 'transparent', border: 'none', padding: '7px 16px',
    textAlign: 'left', fontSize: 13, cursor: 'pointer', color: '#c9d1d9',
    transition: 'background 0.1s',
  },
  breadcrumb: {
    display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap',
  },
  breadcrumbLink: {
    background: 'transparent', border: 'none', color: '#58a6ff',
    fontSize: 14, fontWeight: 600, cursor: 'pointer', padding: '0 2px',
    textDecoration: 'none',
  },
  commitCount: {
    background: '#161b22', border: '1px solid #30363d', borderRadius: 6,
    padding: '4px 10px', fontSize: 12, color: '#8b949e', fontWeight: 500,
  },
  bannerError: {
    background: 'rgba(248,81,73,0.1)', border: '1px solid rgba(248,81,73,0.4)',
    color: '#f85149', padding: '10px 14px', borderRadius: 6, fontSize: 14, marginBottom: 16,
  },
  emptyState: {
    background: '#161b22', border: '1px solid #30363d', borderRadius: 8,
    padding: '48px 32px', textAlign: 'center',
  },
  codeBlock: {
    background: '#0d1117', border: '1px solid #30363d', borderRadius: 6,
    padding: '12px 16px', textAlign: 'left', display: 'inline-block',
    maxWidth: 480, width: '100%',
  },
  latestCommitBar: {
    background: '#161b22', border: '1px solid #30363d',
    borderTopLeftRadius: 8, borderTopRightRadius: 8,
    padding: '10px 16px', display: 'flex', alignItems: 'center',
    justifyContent: 'space-between', gap: 12,
  },
  hashBadge: {
    fontFamily: 'monospace', background: '#21262d', border: '1px solid #30363d',
    borderRadius: 6, padding: '2px 7px', fontSize: 12, color: '#58a6ff',
  },
  table: {
    border: '1px solid #30363d', borderTop: 'none',
    borderBottomLeftRadius: 8, borderBottomRightRadius: 8,
    overflow: 'hidden', background: '#0d1117',
  },
  tableRow: {
    display: 'flex', alignItems: 'center', padding: '9px 16px',
    borderBottom: '1px solid #21262d', cursor: 'pointer',
    transition: 'background 0.1s',
  },
  fileHeader: {
    background: '#161b22', border: '1px solid #30363d',
    borderTopLeftRadius: 8, borderTopRightRadius: 8,
    padding: '10px 16px', display: 'flex', alignItems: 'center',
    justifyContent: 'space-between', gap: 12, flexWrap: 'wrap',
    marginBottom: 0,
  },
  backBtn: {
    background: 'transparent', border: '1px solid #30363d', borderRadius: 6,
    color: '#8b949e', padding: '4px 12px', fontSize: 13, cursor: 'pointer',
    fontWeight: 600,
  },
  codeContainer: {
    display: 'flex', background: '#0d1117',
    border: '1px solid #30363d', borderTop: 'none',
    borderBottomLeftRadius: 8, borderBottomRightRadius: 8,
    overflow: 'auto', maxHeight: 600,
    marginBottom: 24,
  },
  lineNumbers: {
    padding: '16px 12px', background: '#010409', userSelect: 'none',
    borderRight: '1px solid #21262d', textAlign: 'right', minWidth: 48,
    flexShrink: 0,
  },
  codeContent: {
    flex: 1, padding: 16, margin: 0, overflowX: 'auto',
    whiteSpace: 'pre', fontFamily: '"SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace',
    fontSize: 13, lineHeight: 1.6, color: '#e6edf3', background: 'transparent',
  },
  readmeCard: {
    border: '1px solid #30363d', borderRadius: 8, overflow: 'hidden',
    marginTop: 24,
  },
  readmeHeader: {
    background: '#161b22', borderBottom: '1px solid #30363d',
    padding: '10px 16px', fontSize: 13, fontWeight: 600, color: '#e6edf3',
  },
  readmeBody: {
    background: '#0d1117', padding: '24px 32px',
  },
};

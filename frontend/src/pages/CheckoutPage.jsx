import React, { useEffect, useState } from 'react';
import {
  checkoutFile,
  releaseFile,
  listLocks,
  checkFileLock,
  forceReleaseLock
} from '../api/client';

export default function CheckoutPage({ repoName }) {
  // Section 1: Checkout Form State
  const [filePath, setFilePath] = useState('');
  const [username, setUsername] = useState('');
  const [duration, setDuration] = useState('30');
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [checkoutMsg, setCheckoutMsg] = useState(null); // { type, lockId, filepath, expiresAt, lock, message }

  // Section 2: Release Form State
  const [releasePath, setReleasePath] = useState('');
  const [releaseLockId, setReleaseLockId] = useState('');
  const [releaseUser, setReleaseUser] = useState('');
  const [releaseSuccess, setReleaseSuccess] = useState('');
  const [releaseError, setReleaseError] = useState('');

  // Section 3: Active Locks State
  const [locks, setLocks] = useState([]);
  const [tick, setTick] = useState(0); // Used to trigger rerender for countdowns

  // Section 4: Check Status State
  const [checkPath, setCheckPath] = useState('');
  const [checkResult, setCheckResult] = useState(null); // { checked: true, lock: lockRecord | null }
  const [checkError, setCheckError] = useState('');

  // Expiry Countdown Helper
  function formatExpiry(expiresAt) {
    const ms = new Date(expiresAt) - new Date();
    if (ms <= 0) return { text: "EXPIRED", color: "#f85149" };
    const mins = Math.floor(ms / 60000);
    const hours = Math.floor(mins / 60);
    const remainMins = mins % 60;
    if (mins < 5) return { text: "Expires in " + mins + "m", color: "#d29922" };
    if (hours === 0) return { text: "Expires in " + mins + "m", color: "#8b949e" };
    return {
      text: "Expires in " + hours + "h " + remainMins + "m",
      color: "#8b949e"
    };
  }

  // Load active locks on mount and on repo change
  const loadLocks = async () => {
    console.log('loadLocks called with repoName:', repoName);
    try {
      const data = await listLocks(repoName);
      setLocks(data.locks || []);
    } catch (err) {
      console.error('Failed to load locks:', err);
      setLocks([]);
    }
  };

  useEffect(() => {
    console.log('useEffect trigger for repoName:', repoName);
    if (repoName) {
      loadLocks();
    }
    const interval = setInterval(() => {
      setTick(t => t + 1);
    }, 15000); // refresh countdown calculations every 15s
    return () => clearInterval(interval);
  }, [repoName]);

  // Handle Checkout File
  const handleCheckout = async (e) => {
    e.preventDefault();
    if (!filePath.trim() || !username.trim()) {
      setCheckoutMsg({ type: 'error', message: 'Filepath and username are required' });
      return;
    }
    setCheckoutLoading(true);
    setCheckoutMsg(null);
    try {
      const data = await checkoutFile(repoName, filePath.trim(), username.trim(), Number(duration));
      setCheckoutMsg({
        type: 'success',
        lockId: data.lockId,
        filepath: data.filepath,
        expiresAt: data.expiresAt
      });
      setFilePath('');
      loadLocks(); // refresh active locks list
    } catch (err) {
      const errData = err.response?.data;
      if (err.response?.status === 409) {
        setCheckoutMsg({
          type: 'conflict',
          lock: errData.lock
        });
      } else {
        setCheckoutMsg({ type: 'error', message: errData?.error || err.message });
      }
    } finally {
      setCheckoutLoading(false);
    }
  };

  // Handle Release File
  const handleRelease = async (e) => {
    e.preventDefault();
    setReleaseSuccess('');
    setReleaseError('');
    if (!releasePath.trim() || !releaseLockId.trim() || !releaseUser.trim()) {
      setReleaseError('All release fields are required');
      return;
    }
    try {
      await releaseFile(repoName, releasePath.trim(), releaseLockId.trim(), releaseUser.trim());
      setReleaseSuccess(`✅ Lock released for ${releasePath.trim()}`);
      setReleasePath('');
      setReleaseLockId('');
      loadLocks();
    } catch (err) {
      setReleaseError(err.response?.data?.error || err.message || 'Failed to release lock');
    }
  };

  // Handle Force Release
  const handleForceRelease = async (filepath) => {
    if (!window.confirm(`Are you sure you want to force release the lock on "${filepath}"?`)) {
      return;
    }
    try {
      await forceReleaseLock(repoName, filepath);
      loadLocks();
    } catch (err) {
      alert(err.response?.data?.error || err.message || 'Failed to force release lock');
    }
  };

  // Handle Check File Status
  const handleCheckStatus = async (e) => {
    e.preventDefault();
    setCheckResult(null);
    setCheckError('');
    if (!checkPath.trim()) {
      setCheckError('Filepath is required');
      return;
    }
    try {
      const data = await checkFileLock(repoName, checkPath.trim());
      setCheckResult({ checked: true, lock: data.lock });
    } catch (err) {
      setCheckError(err.response?.data?.error || err.message || 'Failed to check status');
    }
  };

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '24px' }}>

      {/* HEADER */}
      <div style={{ borderBottom: '1px solid #30363d', paddingBottom: '12px' }}>
        <h2 style={{ margin: '0', fontSize: '20px', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '8px' }}>
          🔒 Exclusive Checkout
        </h2>
        <p style={{ margin: '4px 0 0 0', color: '#8b949e', fontSize: '14px' }}>
          Lock files for exclusive editing
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>

        {/* SECTION 1: CHECKOUT A FILE */}
        <div style={{
          backgroundColor: '#161b22',
          border: '1px solid #30363d',
          borderRadius: '6px',
          padding: '20px',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px'
        }}>
          <h3 style={{ margin: '0 0 4px 0', fontSize: '16px', fontWeight: '600' }}>Lock a File</h3>
          <form onSubmit={handleCheckout} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <input
              type="text"
              placeholder="filepath e.g. src/main/App.java"
              value={filePath}
              onChange={(e) => setFilePath(e.target.value)}
              style={{
                backgroundColor: '#0d1117',
                border: '1px solid #30363d',
                borderRadius: '6px',
                padding: '8px 12px',
                fontSize: '14px',
                color: '#e6edf3',
              }}
            />
            <input
              type="text"
              placeholder="Your username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              style={{
                backgroundColor: '#0d1117',
                border: '1px solid #30363d',
                borderRadius: '6px',
                padding: '8px 12px',
                fontSize: '14px',
                color: '#e6edf3',
              }}
            />
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px' }}>
              <span style={{ color: '#8b949e' }}>Lock duration:</span>
              <select
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
                style={{
                  backgroundColor: '#0d1117',
                  border: '1px solid #30363d',
                  borderRadius: '6px',
                  padding: '6px 10px',
                  fontSize: '14px',
                  color: '#e6edf3',
                  cursor: 'pointer'
                }}
              >
                <option value="15">15 min</option>
                <option value="30">30 min</option>
                <option value="60">1 hour</option>
                <option value="120">2 hours</option>
                <option value="480">8 hours</option>
              </select>
            </div>
            <button
              type="submit"
              disabled={checkoutLoading}
              style={{
                backgroundColor: '#238636',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                padding: '8px 16px',
                fontSize: '14px',
                fontWeight: '600',
                cursor: 'pointer',
                transition: 'background-color 0.2s',
              }}
              onMouseOver={(e) => e.target.style.backgroundColor = '#2ea043'}
              onMouseOut={(e) => e.target.style.backgroundColor = '#238636'}
            >
              {checkoutLoading ? 'Locking...' : '🔒 Checkout File'}
            </button>
          </form>

          {checkoutMsg?.type === 'success' && (
            <div style={{ background: '#0d2b1a', border: '1px solid #238636',
              borderRadius: '6px', padding: '12px', marginTop: '8px' }}>
              <div style={{ color: '#3fb950', fontWeight: 'bold', marginBottom: '6px' }}>
                ✅ Lock acquired for {checkoutMsg.filepath}
              </div>
              <div style={{ color: '#e6edf3', fontFamily: 'monospace',
                background: '#161b22', padding: '8px', borderRadius: '4px',
                marginBottom: '6px', wordBreak: 'break-all' }}>
                <span style={{ color: '#8b949e' }}>Lock ID: </span>
                <span
                  onClick={() => navigator.clipboard.writeText(checkoutMsg.lockId)}
                  style={{ color: '#58a6ff', cursor: 'pointer' }}
                  title="Click to copy"
                >
                  {checkoutMsg.lockId}
                </span>
                <span style={{ color: '#8b949e', fontSize: '12px' }}> (click to copy)</span>
              </div>
              <div style={{ color: '#8b949e', fontSize: '13px' }}>
                Expires: {new Date(checkoutMsg.expiresAt).toLocaleString()}
              </div>
            </div>
          )}

          {checkoutMsg?.type === 'conflict' && (
            <div style={{
              backgroundColor: 'rgba(248, 81, 73, 0.1)',
              border: '1px solid rgba(248, 81, 73, 0.4)',
              borderRadius: '6px',
              padding: '12px',
              fontSize: '13px',
              color: '#f85149',
              lineHeight: '1.6',
              textAlign: 'left'
            }}>
              <div>⚠️ File is locked by <strong>{checkoutMsg.lock.lockedBy}</strong></div>
              <div style={{ color: '#8b949e', marginTop: '4px' }}>Locked at: {new Date(checkoutMsg.lock.lockedAt).toLocaleString()}</div>
              <div style={{ color: '#8b949e' }}>Expires: {new Date(checkoutMsg.lock.expiresAt).toLocaleString()}</div>
            </div>
          )}

          {checkoutMsg?.type === 'error' && (
            <div style={{
              backgroundColor: 'rgba(248, 81, 73, 0.1)',
              border: '1px solid rgba(248, 81, 73, 0.4)',
              borderRadius: '6px',
              padding: '12px',
              fontSize: '13px',
              color: '#f85149',
              lineHeight: '1.6',
              textAlign: 'left'
            }}>
              <div>❌ {checkoutMsg.message}</div>
            </div>
          )}
        </div>

        {/* SECTION 2: RELEASE A LOCK */}
        <div style={{
          backgroundColor: '#161b22',
          border: '1px solid #30363d',
          borderRadius: '6px',
          padding: '20px',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px'
        }}>
          <h3 style={{ margin: '0 0 4px 0', fontSize: '16px', fontWeight: '600' }}>Release Lock</h3>
          <form onSubmit={handleRelease} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <input
              type="text"
              placeholder="filepath"
              value={releasePath}
              onChange={(e) => setReleasePath(e.target.value)}
              style={{
                backgroundColor: '#0d1117',
                border: '1px solid #30363d',
                borderRadius: '6px',
                padding: '8px 12px',
                fontSize: '14px',
                color: '#e6edf3',
              }}
            />
            <input
              type="text"
              placeholder="Lock ID (from checkout)"
              value={releaseLockId}
              onChange={(e) => setReleaseLockId(e.target.value)}
              style={{
                backgroundColor: '#0d1117',
                border: '1px solid #30363d',
                borderRadius: '6px',
                padding: '8px 12px',
                fontSize: '14px',
                color: '#e6edf3',
              }}
            />
            <input
              type="text"
              placeholder="Your username"
              value={releaseUser}
              onChange={(e) => setReleaseUser(e.target.value)}
              style={{
                backgroundColor: '#0d1117',
                border: '1px solid #30363d',
                borderRadius: '6px',
                padding: '8px 12px',
                fontSize: '14px',
                color: '#e6edf3',
              }}
            />
            <button
              type="submit"
              style={{
                backgroundColor: 'transparent',
                color: '#f85149',
                border: '1px solid #f85149',
                borderRadius: '6px',
                padding: '8px 16px',
                fontSize: '14px',
                fontWeight: '600',
                cursor: 'pointer',
                transition: 'background-color 0.2s, color 0.2s',
              }}
              onMouseOver={(e) => {
                e.target.style.backgroundColor = '#f85149';
                e.target.style.color = 'white';
              }}
              onMouseOut={(e) => {
                e.target.style.backgroundColor = 'transparent';
                e.target.style.color = '#f85149';
              }}
            >
              🔓 Release Lock
            </button>
          </form>

          {releaseSuccess && (
            <div style={{
              backgroundColor: 'rgba(56, 139, 253, 0.1)',
              border: '1px solid rgba(56, 139, 253, 0.4)',
              borderRadius: '6px',
              padding: '10px 12px',
              fontSize: '13px',
              color: '#e6edf3',
            }}>
              {releaseSuccess}
            </div>
          )}

          {releaseError && (
            <div style={{
              backgroundColor: 'rgba(248, 81, 73, 0.1)',
              border: '1px solid rgba(248, 81, 73, 0.4)',
              borderRadius: '6px',
              padding: '10px 12px',
              fontSize: '13px',
              color: '#f85149',
            }}>
              ❌ {releaseError}
            </div>
          )}
        </div>
      </div>

      {/* SECTION 3: ACTIVE LOCKS */}
      <div style={{
        backgroundColor: '#161b22',
        border: '1px solid #30363d',
        borderRadius: '6px',
        padding: '20px',
        position: 'relative'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h3 style={{ margin: '0', fontSize: '16px', fontWeight: '600' }}>Active Locks</h3>
          <button
            onClick={loadLocks}
            style={{
              backgroundColor: 'transparent',
              border: '1px solid #30363d',
              color: '#8b949e',
              padding: '4px 10px',
              fontSize: '12px',
              borderRadius: '6px',
              cursor: 'pointer'
            }}
          >
            ↻ Refresh
          </button>
        </div>

        {locks.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {locks.map((lock) => {
              const countdown = formatExpiry(lock.expiresAt);
              return (
                <div
                  key={lock.filepath}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '12px 0',
                    borderBottom: '1px solid #30363d',
                  }}
                >
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', textAlign: 'left' }}>
                    <span style={{ fontWeight: '600', color: '#e6edf3', fontSize: '14px' }}>🔒 {lock.filepath}</span>
                    <span style={{ color: '#8b949e', fontSize: '12px' }}>Locked by: {lock.lockedBy}</span>
                    <span style={{ color: '#8b949e', fontSize: '12px' }}>Locked at: {new Date(lock.lockedAt).toLocaleString()}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <span style={{ fontSize: '13px', fontWeight: '500', color: countdown.color }}>
                      {countdown.text}
                    </span>
                    <button
                      onClick={() => navigator.clipboard.writeText(lock.lockId)}
                      style={{
                        background: 'transparent',
                        border: '1px solid #30363d',
                        color: '#8b949e',
                        padding: '4px 10px',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        fontSize: '12px',
                        marginRight: '8px'
                      }}
                    >
                      📋 Copy Lock ID
                    </button>
                    <button
                      onClick={() => handleForceRelease(lock.filepath)}
                      style={{
                        backgroundColor: 'transparent',
                        color: '#f85149',
                        border: '1px solid rgba(248, 81, 73, 0.4)',
                        borderRadius: '6px',
                        padding: '4px 8px',
                        fontSize: '12px',
                        cursor: 'pointer',
                        transition: 'background-color 0.2s, color 0.2s',
                      }}
                      onMouseOver={(e) => {
                        e.target.style.backgroundColor = '#f85149';
                        e.target.style.color = 'white';
                      }}
                      onMouseOut={(e) => {
                        e.target.style.backgroundColor = 'transparent';
                        e.target.style.color = '#f85149';
                      }}
                    >
                      Force Release
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div style={{ color: '#8b949e', fontSize: '14px', textAlign: 'center', padding: '24px 0' }}>
            No files currently locked
          </div>
        )}
      </div>

      {/* SECTION 4: CHECK FILE STATUS */}
      <div style={{
        backgroundColor: '#161b22',
        border: '1px solid #30363d',
        borderRadius: '6px',
        padding: '20px',
        display: 'flex',
        flexDirection: 'column',
        gap: '16px'
      }}>
        <h3 style={{ margin: '0 0 4px 0', fontSize: '16px', fontWeight: '600' }}>Check File</h3>
        <form onSubmit={handleCheckStatus} style={{ display: 'flex', gap: '12px' }}>
          <input
            type="text"
            placeholder="filepath to check"
            value={checkPath}
            onChange={(e) => setCheckPath(e.target.value)}
            style={{
              flex: '1',
              backgroundColor: '#0d1117',
              border: '1px solid #30363d',
              borderRadius: '6px',
              padding: '8px 12px',
              fontSize: '14px',
              color: '#e6edf3',
            }}
          />
          <button
            type="submit"
            style={{
              backgroundColor: 'transparent',
              color: '#8b949e',
              border: '1px solid #30363d',
              borderRadius: '6px',
              padding: '8px 16px',
              fontSize: '14px',
              fontWeight: '600',
              cursor: 'pointer',
            }}
          >
            Check Status
          </button>
        </form>

        {checkError && <div style={{ color: '#f85149', fontSize: '13px' }}>❌ {checkError}</div>}

        {checkResult && (
          <div style={{ marginTop: '8px', textAlign: 'left' }}>
            {checkResult.lock ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <div>
                  <span style={{
                    backgroundColor: 'rgba(248, 81, 73, 0.15)',
                    border: '1px solid rgba(248, 81, 73, 0.4)',
                    color: '#f85149',
                    borderRadius: '2em',
                    padding: '3px 12px',
                    fontSize: '12px',
                    fontWeight: '600',
                    display: 'inline-block'
                  }}>
                    🔒 LOCKED
                  </span>
                </div>
                <div style={{ fontSize: '13px', color: '#8b949e', lineHeight: '1.5' }}>
                  <div>Locked by: <strong>{checkResult.lock.lockedBy}</strong></div>
                  <div>Locked at: {new Date(checkResult.lock.lockedAt).toLocaleString()}</div>
                  <div>Expires: {new Date(checkResult.lock.expiresAt).toLocaleString()}</div>
                </div>
              </div>
            ) : (
              <div>
                <span style={{
                  backgroundColor: 'rgba(56, 139, 253, 0.15)',
                  border: '1px solid rgba(56, 139, 253, 0.4)',
                  color: '#58a6ff',
                  borderRadius: '2em',
                  padding: '3px 12px',
                  fontSize: '12px',
                  fontWeight: '600',
                  display: 'inline-block'
                }}>
                  ✅ AVAILABLE
                </span>
              </div>
            )}
          </div>
        )}
      </div>

    </div>
  );
}

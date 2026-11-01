/**
 * FileLockBadge.jsx
 * Displays a visual badge indicating a file is locked and by whom.
 *
 * Props:
 *   filePath  {string} - relative path of the locked file
 *   owner     {string} - user who holds the lock
 *   expiresAt {string} [optional] - ISO timestamp of lock expiry
 */

import React from 'react';

export default function FileLockBadge({ filePath, owner, expiresAt }) {
  const expired = expiresAt && new Date(expiresAt) < new Date();

  return (
    <span
      role="status"
      title={`Locked by ${owner}${expiresAt ? ` until ${new Date(expiresAt).toLocaleString()}` : ''}`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '0.25rem',
        padding: '0.15rem 0.5rem',
        borderRadius: '9999px',
        fontSize: '0.75rem',
        background: expired ? '#6b7280' : '#f59e0b',
        color: '#fff',
        fontWeight: 600,
      }}
    >
      🔒 {filePath} — {owner}
      {expired && ' (expired)'}
    </span>
  );
}

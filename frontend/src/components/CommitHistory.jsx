/**
 * CommitHistory.jsx
 * Renders a scrollable list of commits for a given repo / branch.
 *
 * Props:
 *   repoId   {string}  - repository identifier
 *   branch   {string}  - branch name to inspect (default: 'main')
 */

import React, { useEffect, useState } from 'react';
import { apiClient } from '../api/client';

export default function CommitHistory({ repoId, branch = 'main' }) {
  const [commits, setCommits] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // TODO: GET /api/repos/:repoId/branches/:branch/commits
    setLoading(false);
  }, [repoId, branch]);

  if (loading) return <p>Loading commits…</p>;

  return (
    <section aria-label="Commit history">
      <h2>Commit History — {branch}</h2>
      {commits.length === 0 ? (
        <p>No commits yet.</p>
      ) : (
        <ol>
          {commits.map((c) => (
            <li key={c.sha}>
              <code>{c.sha.slice(0, 7)}</code>
              {' '}
              <span>{c.message}</span>
              {' '}
              <small>{c.author} · {new Date(c.timestamp).toLocaleString()}</small>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

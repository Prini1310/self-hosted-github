/**
 * BuildLog.jsx
 * Connects to the SSE endpoint and streams build log lines in real time.
 *
 * Props:
 *   repoId   {string} - repository identifier
 *   buildId  {string} - build job identifier
 */

import React, { useEffect, useRef, useState } from 'react';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001';

export default function BuildLog({ repoId, buildId }) {
  const [lines, setLines]   = useState([]);
  const [done, setDone]     = useState(false);
  const bottomRef           = useRef(null);

  useEffect(() => {
    if (!repoId || !buildId) return;

    // TODO: retrieve JWT from auth context / localStorage
    const token = localStorage.getItem('jwt') || '';
    const url = `${API_BASE}/api/repos/${repoId}/builds/${buildId}/log`;

    const evtSource = new EventSource(`${url}?token=${token}`);

    evtSource.addEventListener('log', (e) => {
      const { message } = JSON.parse(e.data);
      setLines((prev) => [...prev, message]);
    });

    evtSource.addEventListener('done', () => {
      setDone(true);
      evtSource.close();
    });

    evtSource.onerror = () => {
      evtSource.close();
    };

    return () => evtSource.close();
  }, [repoId, buildId]);

  // Auto-scroll to bottom when new lines arrive
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [lines]);

  return (
    <section aria-label="Build log" style={{ fontFamily: 'monospace', background: '#111', color: '#d4d4d4', padding: '1rem', overflowY: 'auto', maxHeight: '400px' }}>
      <h2>Build Log — {buildId}</h2>
      {lines.map((line, i) => (
        <div key={i}>{line}</div>
      ))}
      {done && <div style={{ color: '#4ec9b0' }}>✓ Build complete</div>}
      <div ref={bottomRef} />
    </section>
  );
}

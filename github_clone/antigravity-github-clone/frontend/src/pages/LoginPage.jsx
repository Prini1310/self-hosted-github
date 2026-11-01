import React, { useState } from 'react';
import { login } from '../api/client';

export default function LoginPage({ onLogin }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) {
      setError('Username and password are required');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const data = await login(username.trim(), password.trim());
      onLogin(data.username);
    } catch (err) {
      setError(err.response?.data?.error || 'Invalid username or password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      backgroundColor: '#0d1117',
      color: '#e6edf3',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif',
      padding: '20px'
    }}>
      <div style={{ textAlign: 'center', marginBottom: '24px' }}>
        <svg height="48" viewBox="0 0 16 16" width="48" fill="#e6edf3" style={{ marginBottom: '12px' }}>
          <path d="M8 0c4.42 0 8 3.58 8 8a8.013 8.013 0 0 1-5.45 7.59c-.4.08-.55-.17-.55-.38 0-.27.01-1.13.01-2.2 0-.75-.25-1.23-.54-1.48 1.78-.2 3.65-.88 3.65-3.95 0-.88-.31-1.59-.82-2.15.08-.2.36-1.02-.08-2.12 0 0-.67-.22-2.2.82-.64-.18-1.32-.27-2-.27-.68 0-1.36.09-2 .27-1.53-1.03-2.2-.82-2.2-.82-.44 1.1-.16 1.92-.08 2.12-.51.56-.82 1.28-.82 2.15 0 3.06 1.86 3.75 3.64 3.95-.23.2-.44.55-.51 1.07-.46.21-1.61.55-2.33-.66-.15-.24-.6-.83-1.23-.82-.67.01-.27.38.01.53.34.19.73.9.82 1.13.16.45.68 1.35 3.12.88.01.64.01 1.24.01 1.53 0 .21-.15.47-.56.38A8.006 8.006 0 0 1 0 8c0-4.42 3.58-8 8-8z" />
        </svg>
        <h1 style={{ fontSize: '24px', fontWeight: '600', margin: '0' }}>⚡ VRel</h1>
        <p style={{ color: '#8b949e', fontSize: '14px', marginTop: '6px' }}>Sign in to your internal repository</p>
      </div>

      <div style={{
        backgroundColor: '#161b22',
        border: '1px solid #30363d',
        borderRadius: '6px',
        padding: '32px',
        width: '340px',
        boxSizing: 'border-box'
      }}>
        <h2 style={{ fontSize: '20px', fontWeight: '600', margin: '0 0 20px 0', textAlign: 'left' }}>Sign in</h2>

        {error && (
          <div style={{
            backgroundColor: 'rgba(248, 81, 73, 0.15)',
            border: '1px solid rgba(248, 81, 73, 0.4)',
            color: '#f85149',
            padding: '10px 12px',
            borderRadius: '6px',
            fontSize: '13px',
            marginBottom: '16px',
            fontWeight: '500',
            textAlign: 'left'
          }}>
            ❌ {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '16px', textAlign: 'left' }}>
            <label style={{ display: 'block', fontWeight: '500', fontSize: '14px', marginBottom: '6px' }}>
              Username
            </label>
            <input
              type="text"
              placeholder="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              disabled={loading}
              style={{
                width: '100%',
                backgroundColor: '#0d1117',
                border: '1px solid #30363d',
                borderRadius: '6px',
                padding: '8px 12px',
                fontSize: '14px',
                color: '#e6edf3',
                boxSizing: 'border-box'
              }}
              required
            />
          </div>

          <div style={{ marginBottom: '24px', textAlign: 'left' }}>
            <label style={{ display: 'block', fontWeight: '500', fontSize: '14px', marginBottom: '6px' }}>
              Password
            </label>
            <input
              type="password"
              placeholder="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={loading}
              style={{
                width: '100%',
                backgroundColor: '#0d1117',
                border: '1px solid #30363d',
                borderRadius: '6px',
                padding: '8px 12px',
                fontSize: '14px',
                color: '#e6edf3',
                boxSizing: 'border-box'
              }}
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%',
              backgroundColor: '#238636',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              padding: '10px 16px',
              fontSize: '14px',
              fontWeight: '600',
              cursor: 'pointer',
              transition: 'background-color 0.2s',
            }}
            onMouseOver={(e) => e.target.style.backgroundColor = '#2ea043'}
            onMouseOut={(e) => e.target.style.backgroundColor = '#238636'}
          >
            {loading ? 'Signing in...' : 'Sign in'}
          </button>
        </form>
      </div>

      <div style={{
        marginTop: '24px',
        color: '#8b949e',
        fontSize: '12px',
        textAlign: 'center',
        lineHeight: '1.6',
        maxWidth: '340px'
      }}>
        <div style={{ fontWeight: '500', marginBottom: '4px' }}>Available users:</div>
        <div>prabhaharan / friend / admin</div>
        <div style={{ marginTop: '8px', fontWeight: '500', marginBottom: '4px' }}>Passwords:</div>
        <div>admin123 / dev123 / admin123</div>
      </div>
    </div>
  );
}

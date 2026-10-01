// pages/expert.jsx - Expert interface with full customization
'use client';

import { useState, useEffect, useRef } from 'react';

const ExpertUI = () => {
  const [activeTab, setActiveTab] = useState('accounts');
  const [accounts, setAccounts] = useState([]);
  const [sessions, setSessions] = useState([]);
  
  // Account form
  const [formData, setFormData] = useState({ email: '', password: '', token: '' });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  
  // Boost controls
  const [boostCount, setBoostCount] = useState(2);
  const [serverLink, setServerLink] = useState('');
  const [currentSession, setCurrentSession] = useState(null);

  // Config panel
  const [config, setConfig] = useState({
    maxConcurrent: 5,
    retryAttempts: 3,
    healthCheckInterval: 300000,
    autoLockThreshold: 40,
    adaptiveDelay: true,
    requestTimeout: 15000
  });

  const [showConfig, setShowConfig] = useState(false);
  const refreshIntervalRef = useRef(null);

  const API_URL = '/api/v1';

  // Fetch accounts
  const fetchAccounts = async () => {
    try {
      const res = await fetch(`${API_URL}/accounts/status`);
      const data = await res.json();
      if (data.accounts) {
        setAccounts(data.accounts);
      }
    } catch (err) {
      console.error('Fetch error:', err);
    }
  };

  useEffect(() => {
    fetchAccounts();
    refreshIntervalRef.current = setInterval(fetchAccounts, 3000);
    return () => clearInterval(refreshIntervalRef.current);
  }, []);

  // Poll session status
  useEffect(() => {
    if (!currentSession) return;

    const checkStatus = async () => {
      try {
        const res = await fetch(`${API_URL}/boost/status?id=${currentSession}`);
        const data = await res.json();
        
        const existing = sessions.find(s => s.sessionId === currentSession);
        if (existing) {
          setSessions(sessions.map(s => s.sessionId === currentSession ? { ...s, ...data } : s));
        }

        if (data.status === 'completed' || data.status === 'failed') {
          setCurrentSession(null);
        }
      } catch (err) {
        console.error('Status check error:', err);
      }
    };

    const statusInterval = setInterval(checkStatus, 500);
    return () => clearInterval(statusInterval);
  }, [currentSession]);

  // Add account
  const handleAddAccount = async (e) => {
    e.preventDefault();
    if (!formData.email || !formData.password || !formData.token) {
      setMessage('❌ All fields required');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/accounts/add`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      const data = await res.json();
      if (res.ok) {
        setMessage(`✓ Account added: ${data.account_id}`);
        setFormData({ email: '', password: '', token: '' });
        await fetchAccounts();
      } else {
        setMessage(`❌ ${data.error}`);
      }
    } catch (err) {
      setMessage(`❌ ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Execute boost
  const handleBoost = async (e) => {
    e.preventDefault();
    if (!serverLink || boostCount < 1) {
      setMessage('❌ Invalid input');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/boost/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ boost_count: boostCount, server_link: serverLink })
      });

      const data = await res.json();
      if (res.ok) {
        setCurrentSession(data.sessionId);
        setSessions([...sessions, data.session]);
        setMessage(`✓ Boost queued: ${data.sessionId}`);
        setServerLink('');
      } else {
        setMessage(`❌ ${data.error}`);
      }
    } catch (err) {
      setMessage(`❌ ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Config panel
  const handleConfigChange = (key, value) => {
    setConfig({ ...config, [key]: value });
  };

  const getHealthColor = (score) => {
    if (score >= 80) return '#10b981'; // green
    if (score >= 60) return '#f59e0b'; // amber
    if (score >= 40) return '#f97316'; // orange
    return '#ef4444'; // red
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'completed': return '#4ade80';
      case 'running': return '#facc15';
      case 'failed': return '#ef4444';
      default: return '#64748b';
    }
  };

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#0f172a', color: '#e2e8f0', fontFamily: 'monospace', fontSize: '13px' }}>
      {/* Header */}
      <div style={{ borderBottom: '2px solid #334155', padding: '15px', backgroundColor: '#1e293b', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ margin: '0', fontSize: '18px', color: '#60a5fa' }}>🔥 Expert Discord Booster</h1>
          <p style={{ margin: '4px 0 0', fontSize: '11px', color: '#94a3b8' }}>Enterprise-Grade | Rate-Limited | Token Protected</p>
        </div>
        <button
          onClick={() => setShowConfig(!showConfig)}
          style={{
            padding: '8px 16px',
            backgroundColor: showConfig ? '#3b82f6' : '#475569',
            color: '#fff',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '12px',
            fontWeight: 'bold'
          }}
        >
          ⚙️ Config
        </button>
      </div>

      {/* Config Panel */}
      {showConfig && (
        <div style={{
          backgroundColor: '#1e293b',
          borderBottom: '1px solid #334155',
          padding: '15px',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
          gap: '12px'
        }}>
          <div>
            <label style={{ display: 'block', fontSize: '11px', color: '#cbd5e1', marginBottom: '4px' }}>Max Concurrent</label>
            <input
              type="number"
              value={config.maxConcurrent}
              onChange={(e) => handleConfigChange('maxConcurrent', parseInt(e.target.value))}
              style={{
                width: '100%',
                padding: '6px',
                backgroundColor: '#0f172a',
                border: '1px solid #334155',
                color: '#e2e8f0',
                borderRadius: '3px'
              }}
            />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '11px', color: '#cbd5e1', marginBottom: '4px' }}>Retry Attempts</label>
            <input
              type="number"
              value={config.retryAttempts}
              onChange={(e) => handleConfigChange('retryAttempts', parseInt(e.target.value))}
              style={{
                width: '100%',
                padding: '6px',
                backgroundColor: '#0f172a',
                border: '1px solid #334155',
                color: '#e2e8f0',
                borderRadius: '3px'
              }}
            />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '11px', color: '#cbd5e1', marginBottom: '4px' }}>Health Threshold</label>
            <input
              type="number"
              value={config.autoLockThreshold}
              onChange={(e) => handleConfigChange('autoLockThreshold', parseInt(e.target.value))}
              min="0"
              max="100"
              style={{
                width: '100%',
                padding: '6px',
                backgroundColor: '#0f172a',
                border: '1px solid #334155',
                color: '#e2e8f0',
                borderRadius: '3px'
              }}
            />
          </div>
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <label style={{ fontSize: '11px', color: '#cbd5e1', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <input
                type="checkbox"
                checked={config.adaptiveDelay}
                onChange={(e) => handleConfigChange('adaptiveDelay', e.target.checked)}
              />
              Adaptive Delays
            </label>
          </div>
        </div>
      )}

      {/* Message Display */}
      {message && (
        <div style={{
          padding: '10px 15px',
          backgroundColor: '#1e293b',
          borderLeft: `3px solid ${message.includes('✓') ? '#4ade80' : '#ef4444'}`,
          color: '#cbd5e1',
          fontSize: '12px',
          marginBottom: '1px'
        }}>
          {message}
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '0', borderBottom: '1px solid #334155', backgroundColor: '#1e293b' }}>
        {['accounts', 'boost', 'sessions', 'analytics'].map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              padding: '12px 20px',
              backgroundColor: activeTab === tab ? '#3b82f6' : 'transparent',
              color: '#e2e8f0',
              border: 'none',
              cursor: 'pointer',
              fontSize: '12px',
              fontWeight: 'bold',
              borderBottom: activeTab === tab ? '3px solid #3b82f6' : 'none',
              textTransform: 'uppercase'
            }}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Main Content */}
      <div style={{ padding: '20px', maxWidth: '1400px', margin: '0 auto' }}>
        
        {/* Accounts Tab */}
        {activeTab === 'accounts' && (
          <div>
            {/* Add Account Form */}
            <div style={{
              backgroundColor: '#1e293b',
              border: '1px solid #334155',
              borderRadius: '6px',
              padding: '15px',
              marginBottom: '20px'
            }}>
              <h2 style={{ margin: '0 0 12px', fontSize: '14px' }}>Add Account</h2>
              <form onSubmit={handleAddAccount}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px', marginBottom: '10px' }}>
                  <input
                    type="email"
                    placeholder="Email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    style={{
                      padding: '8px',
                      backgroundColor: '#0f172a',
                      border: '1px solid #334155',
                      color: '#e2e8f0',
                      borderRadius: '3px'
                    }}
                  />
                  <input
                    type="password"
                    placeholder="Password"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    style={{
                      padding: '8px',
                      backgroundColor: '#0f172a',
                      border: '1px solid #334155',
                      color: '#e2e8f0',
                      borderRadius: '3px'
                    }}
                  />
                  <textarea
                    placeholder="Discord Token"
                    value={formData.token}
                    onChange={(e) => setFormData({ ...formData, token: e.target.value })}
                    style={{
                      padding: '8px',
                      backgroundColor: '#0f172a',
                      border: '1px solid #334155',
                      color: '#e2e8f0',
                      borderRadius: '3px',
                      fontFamily: 'monospace',
                      fontSize: '11px',
                      resize: 'none',
                      height: '40px'
                    }}
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  style={{
                    width: '100%',
                    padding: '8px',
                    backgroundColor: loading ? '#475569' : '#3b82f6',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '3px',
                    cursor: loading ? 'not-allowed' : 'pointer',
                    fontSize: '12px',
                    fontWeight: 'bold'
                  }}
                >
                  {loading ? 'Verifying...' : 'Add & Verify Account'}
                </button>
              </form>
            </div>

            {/* Accounts Grid */}
            <div style={{
              backgroundColor: '#1e293b',
              border: '1px solid #334155',
              borderRadius: '6px',
              padding: '15px'
            }}>
              <h2 style={{ margin: '0 0 12px', fontSize: '14px' }}>
                Accounts ({accounts.length})
              </h2>
              {accounts.length === 0 ? (
                <p style={{ color: '#94a3b8', margin: '0' }}>No accounts added</p>
              ) : (
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
                  gap: '10px'
                }}>
                  {accounts.map(acc => (
                    <div
                      key={acc.id}
                      style={{
                        backgroundColor: '#0f172a',
                        border: `1px solid ${getHealthColor(acc.health_score)}`,
                        borderRadius: '4px',
                        padding: '10px',
                        fontSize: '11px'
                      }}
                    >
                      <div style={{ marginBottom: '6px', fontWeight: 'bold', color: '#60a5fa' }}>
                        {acc.username || 'Unknown'} <span style={{ color: '#94a3b8' }}>({acc.id})</span>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', marginBottom: '6px' }}>
                        <div>Nitro: <span style={{ color: acc.has_nitro ? '#4ade80' : '#ef4444' }}>
                          {acc.has_nitro ? '✓' : '✗'}
                        </span></div>
                        <div>Verified: <span style={{ color: acc.verified ? '#4ade80' : '#ef4444' }}>
                          {acc.verified ? '✓' : '✗'}
                        </span></div>
                        <div>Health: <span style={{ color: getHealthColor(acc.health_score) }}>
                          {acc.health_score}%
                        </span></div>
                        <div>Boosts: <span style={{ color: '#60a5fa' }}>
                          {acc.boosts_remaining}/2
                        </span></div>
                      </div>
                      <div style={{ color: '#94a3b8', fontSize: '10px' }}>
                        Last: {acc.last_activity ? new Date(acc.last_activity).toLocaleString() : 'Never'}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Boost Tab */}
        {activeTab === 'boost' && (
          <div style={{
            backgroundColor: '#1e293b',
            border: '1px solid #334155',
            borderRadius: '6px',
            padding: '15px'
          }}>
            <h2 style={{ margin: '0 0 12px', fontSize: '14px' }}>Execute Boost</h2>
            <form onSubmit={handleBoost}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '10px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '11px', color: '#cbd5e1', marginBottom: '4px' }}>Boost Count</label>
                  <input
                    type="number"
                    min="1"
                    max="100"
                    value={boostCount}
                    onChange={(e) => setBoostCount(parseInt(e.target.value))}
                    style={{
                      width: '100%',
                      padding: '8px',
                      backgroundColor: '#0f172a',
                      border: '1px solid #334155',
                      color: '#e2e8f0',
                      borderRadius: '3px'
                    }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '11px', color: '#cbd5e1', marginBottom: '4px' }}>Available Boosts</label>
                  <div style={{
                    padding: '8px',
                    backgroundColor: '#0f172a',
                    border: '1px solid #334155',
                    borderRadius: '3px',
                    color: '#60a5fa',
                    fontWeight: 'bold'
                  }}>
                    {accounts.reduce((sum, acc) => sum + acc.boosts_remaining, 0)} / {accounts.length * 2}
                  </div>
                </div>
              </div>
              <input
                type="text"
                placeholder="discord.gg/xxxxx or discord.com/invite/xxxxx"
                value={serverLink}
                onChange={(e) => setServerLink(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px',
                  backgroundColor: '#0f172a',
                  border: '1px solid #334155',
                  color: '#e2e8f0',
                  borderRadius: '3px',
                  marginBottom: '10px'
                }}
              />
              <button
                type="submit"
                disabled={loading || accounts.length === 0}
                style={{
                  width: '100%',
                  padding: '10px',
                  backgroundColor: loading || accounts.length === 0 ? '#475569' : '#10b981',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '3px',
                  cursor: loading || accounts.length === 0 ? 'not-allowed' : 'pointer',
                  fontSize: '13px',
                  fontWeight: 'bold'
                }}
              >
                {loading ? 'Executing...' : `Execute ${boostCount} Boost${boostCount !== 1 ? 's' : ''}`}
              </button>
            </form>
          </div>
        )}

        {/* Sessions Tab */}
        {activeTab === 'sessions' && (
          <div>
            {sessions.length === 0 ? (
              <p style={{ color: '#94a3b8' }}>No boost sessions yet</p>
            ) : (
              <div style={{ display: 'grid', gap: '10px' }}>
                {sessions.map(session => (
                  <div
                    key={session.sessionId}
                    style={{
                      backgroundColor: '#1e293b',
                      border: `1px solid ${getStatusColor(session.status)}`,
                      borderRadius: '6px',
                      padding: '12px'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                      <span style={{ color: '#60a5fa', fontWeight: 'bold' }}>{session.sessionId}</span>
                      <span style={{ color: getStatusColor(session.status), fontWeight: 'bold' }}>
                        {session.status?.toUpperCase()}
                      </span>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px', fontSize: '11px' }}>
                      <div>✓ Success: <span style={{ color: '#4ade80', fontWeight: 'bold' }}>{session.successful || 0}</span></div>
                      <div>✗ Failed: <span style={{ color: '#ef4444', fontWeight: 'bold' }}>{session.failed || 0}</span></div>
                      <div>⏳ Pending: <span style={{ color: '#facc15', fontWeight: 'bold' }}>{session.pending || 0}</span></div>
                      <div>Progress: <span style={{ color: '#60a5fa', fontWeight: 'bold' }}>
                        {session.percentage || 0}%
                      </span></div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Analytics Tab */}
        {activeTab === 'analytics' && (
          <div style={{
            backgroundColor: '#1e293b',
            border: '1px solid #334155',
            borderRadius: '6px',
            padding: '15px'
          }}>
            <h2 style={{ margin: '0 0 12px', fontSize: '14px' }}>Analytics & Metrics</h2>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: '10px'
            }}>
              <div style={{ backgroundColor: '#0f172a', padding: '10px', borderRadius: '4px', borderLeft: '3px solid #60a5fa' }}>
                <div style={{ fontSize: '11px', color: '#94a3b8' }}>Total Accounts</div>
                <div style={{ fontSize: '16px', fontWeight: 'bold', color: '#60a5fa' }}>{accounts.length}</div>
              </div>
              <div style={{ backgroundColor: '#0f172a', padding: '10px', borderRadius: '4px', borderLeft: '3px solid #4ade80' }}>
                <div style={{ fontSize: '11px', color: '#94a3b8' }}>Healthy</div>
                <div style={{ fontSize: '16px', fontWeight: 'bold', color: '#4ade80' }}>
                  {accounts.filter(a => a.health_score >= 60).length}
                </div>
              </div>
              <div style={{ backgroundColor: '#0f172a', padding: '10px', borderRadius: '4px', borderLeft: '3px solid #3b82f6' }}>
                <div style={{ fontSize: '11px', color: '#94a3b8' }}>Total Boosts</div>
                <div style={{ fontSize: '16px', fontWeight: 'bold', color: '#3b82f6' }}>
                  {accounts.reduce((sum, acc) => sum + acc.boosts_remaining, 0)}
                </div>
              </div>
              <div style={{ backgroundColor: '#0f172a', padding: '10px', borderRadius: '4px', borderLeft: '3px solid #f59e0b' }}>
                <div style={{ fontSize: '11px', color: '#94a3b8' }}>Avg Health</div>
                <div style={{ fontSize: '16px', fontWeight: 'bold', color: '#f59e0b' }}>
                  {accounts.length > 0
                    ? Math.round(accounts.reduce((sum, acc) => sum + acc.health_score, 0) / accounts.length)
                    : '0'
                  }%
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ExpertUI;

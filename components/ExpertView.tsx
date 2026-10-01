// @ts-nocheck
// pages/expert.jsx - Expert interface with full customization
'use client';

import { useState, useEffect, useRef } from 'react';
import { ArrowLeft } from 'lucide-react';

const ExpertUI = ({ onBack }) => {
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
    <div className="max-w-5xl mx-auto p-6 md:p-12 font-sans">
      <button onClick={onBack} className="flex items-center gap-2 text-slate-400 hover:text-white mb-8 transition font-medium text-sm bg-[#151924] px-4 py-2 rounded-full border border-slate-800 hover:bg-slate-800 w-fit">
        <ArrowLeft className="w-4 h-4" /> Back to Dashboard
      </button>

      {/* Header */}
      <div className="flex items-center gap-5 mb-10">
        <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center shadow-[0_0_15px_rgba(16,185,129,0.3)]">
          <span className="text-2xl">🚀</span>
        </div>
        <div>
          <h1 className="text-2xl font-bold text-white mb-1">Expert Discord Booster</h1>
          <p className="text-slate-400 text-sm">Enterprise-Grade | Rate-Limited | Token Protected</p>
        </div>
        <button
          onClick={() => setShowConfig(!showConfig)}
          className={`ml-auto px-4 py-2 rounded-lg text-white font-medium text-sm transition ${
            showConfig ? 'bg-blue-600 hover:bg-blue-500' : 'bg-slate-700 hover:bg-slate-600'
          }`}
        >
          {showConfig ? 'Hide Config' : '⚙️ Config'}
        </button>
      </div>

      <div className="bg-[#151924] border border-slate-800 rounded-3xl overflow-hidden shadow-xl mb-12">

      {/* Config Panel */}
      {showConfig && (
        <div className="bg-[#1a1f2e] border-b border-slate-800 p-6 grid grid-cols-1 md:grid-cols-4 gap-6">
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-2">Max Concurrent</label>
            <input
              type="number"
              value={config.maxConcurrent}
              onChange={(e) => handleConfigChange('maxConcurrent', parseInt(e.target.value))}
              className="w-full bg-[#0b0e14] border border-slate-800 rounded-lg p-2.5 text-sm text-slate-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-2">Retry Attempts</label>
            <input
              type="number"
              value={config.retryAttempts}
              onChange={(e) => handleConfigChange('retryAttempts', parseInt(e.target.value))}
              className="w-full bg-[#0b0e14] border border-slate-800 rounded-lg p-2.5 text-sm text-slate-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-2">Health Threshold</label>
            <input
              type="number"
              value={config.autoLockThreshold}
              onChange={(e) => handleConfigChange('autoLockThreshold', parseInt(e.target.value))}
              min="0"
              max="100"
              className="w-full bg-[#0b0e14] border border-slate-800 rounded-lg p-2.5 text-sm text-slate-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition"
            />
          </div>
          <div className="flex items-center pt-6">
            <label className="flex items-center gap-3 text-sm font-medium text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                checked={config.adaptiveDelay}
                onChange={(e) => handleConfigChange('adaptiveDelay', e.target.checked)}
                className="w-4 h-4 rounded bg-[#0b0e14] border-slate-800 text-indigo-500 focus:ring-indigo-500 focus:ring-offset-slate-900"
              />
              Adaptive Delays
            </label>
          </div>
        </div>
      )}

      {/* Message Display */}
      {message && (
        <div className={`p-4 border-l-4 text-sm font-medium ${message.includes('✓') ? 'bg-emerald-500/10 border-emerald-500 text-emerald-400' : 'bg-rose-500/10 border-rose-500 text-rose-400'}`}>
          {message}
        </div>
      )}

      {/* Tabs */}
      <div className="flex bg-[#1a1f2e] border-b border-slate-800 px-6 pt-4 gap-2">
        {['accounts', 'boost', 'sessions', 'analytics'].map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-6 py-3 text-sm font-bold uppercase transition-all rounded-t-xl ${
              activeTab === tab 
                ? 'bg-[#151924] text-indigo-400 border-t border-l border-r border-slate-800' 
                : 'text-slate-500 hover:text-slate-300 hover:bg-[#151924]/50 border-t border-l border-r border-transparent'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Main Content */}
      <div className="p-6 md:p-8">
        
        {/* Accounts Tab */}
        {activeTab === 'accounts' && (
          <div className="space-y-6">
            {/* Add Account Form */}
            <div className="bg-[#1a1f2e] border border-slate-800 rounded-2xl p-6">
              <h2 className="text-white font-bold text-lg mb-4">Add Account</h2>
              <form onSubmit={handleAddAccount}>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                  <input
                    type="email"
                    placeholder="Email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full bg-[#0b0e14] border border-slate-800 rounded-lg p-3 text-sm text-slate-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition"
                  />
                  <input
                    type="password"
                    placeholder="Password"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    className="w-full bg-[#0b0e14] border border-slate-800 rounded-lg p-3 text-sm text-slate-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition"
                  />
                  <textarea
                    placeholder="Discord Token"
                    value={formData.token}
                    onChange={(e) => setFormData({ ...formData, token: e.target.value })}
                    className="w-full bg-[#0b0e14] border border-slate-800 rounded-lg p-3 text-sm text-slate-200 font-mono resize-none h-[46px] focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition"
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className={`w-full py-3 rounded-lg text-white font-medium text-sm transition ${
                    loading ? 'bg-indigo-600/50 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-500 shadow-lg shadow-indigo-500/20'
                  }`}
                >
                  {loading ? 'Verifying...' : 'Add & Verify Account'}
                </button>
              </form>
            </div>

            {/* Accounts Grid */}
            <div className="bg-[#1a1f2e] border border-slate-800 rounded-2xl p-6">
              <h2 className="text-white font-bold text-lg mb-4">
                Accounts ({accounts.length})
              </h2>
              {accounts.length === 0 ? (
                <p className="text-slate-400 text-sm">No accounts added</p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {accounts.map(acc => (
                    <div
                      key={acc.id}
                      className="bg-[#0b0e14] border border-slate-800 rounded-xl p-4 text-xs transition hover:border-slate-700"
                    >
                      <div className="flex items-center justify-between mb-3">
                        <span className="font-bold text-indigo-400">{acc.username || 'Unknown'}</span>
                        <span className="text-slate-500 text-[10px]">({acc.id})</span>
                      </div>
                      <div className="grid grid-cols-2 gap-2 mb-3">
                        <div className="text-slate-400">Nitro: <span className={acc.has_nitro ? 'text-emerald-400' : 'text-rose-400 font-medium'}>
                          {acc.has_nitro ? '✓' : '✗'}
                        </span></div>
                        <div className="text-slate-400">Verified: <span className={acc.verified ? 'text-emerald-400' : 'text-rose-400 font-medium'}>
                          {acc.verified ? '✓' : '✗'}
                        </span></div>
                        <div className="text-slate-400">Health: <span style={{ color: getHealthColor(acc.health_score) }} className="font-medium">
                          {acc.health_score}%
                        </span></div>
                        <div className="text-slate-400">Boosts: <span className="text-indigo-400 font-medium">
                          {acc.boosts_remaining}/2
                        </span></div>
                      </div>
                      <div className="text-slate-500 text-[10px] pt-2 border-t border-slate-800/50">
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
          <div className="bg-[#1a1f2e] border border-slate-800 rounded-2xl p-6">
            <h2 className="text-white font-bold text-lg mb-4">Execute Boost</h2>
            <form onSubmit={handleBoost}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-2">Boost Count</label>
                  <input
                    type="number"
                    min="1"
                    max="100"
                    value={boostCount}
                    onChange={(e) => setBoostCount(parseInt(e.target.value))}
                    className="w-full bg-[#0b0e14] border border-slate-800 rounded-lg p-3 text-sm text-slate-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-2">Available Boosts</label>
                  <div className="w-full bg-[#0b0e14] border border-slate-800 rounded-lg p-3 text-sm text-indigo-400 font-bold">
                    {accounts.reduce((sum, acc) => sum + acc.boosts_remaining, 0)} / {accounts.length * 2}
                  </div>
                </div>
              </div>
              <input
                type="text"
                placeholder="discord.gg/xxxxx or discord.com/invite/xxxxx"
                value={serverLink}
                onChange={(e) => setServerLink(e.target.value)}
                className="w-full bg-[#0b0e14] border border-slate-800 rounded-lg p-3 text-sm text-slate-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition mb-4"
              />
              <button
                type="submit"
                disabled={loading || accounts.length === 0}
                className={`w-full py-3 rounded-lg text-white font-medium text-sm transition ${
                  loading || accounts.length === 0 ? 'bg-emerald-600/50 cursor-not-allowed' : 'bg-emerald-600 hover:bg-emerald-500 shadow-lg shadow-emerald-500/20'
                }`}
              >
                {loading ? 'Executing...' : `Execute ${boostCount} Boost${boostCount !== 1 ? 's' : ''}`}
              </button>
            </form>
          </div>
        )}

        {/* Sessions Tab */}
        {activeTab === 'sessions' && (
          <div className="bg-[#1a1f2e] border border-slate-800 rounded-2xl p-6">
            <h2 className="text-white font-bold text-lg mb-4">Boost Sessions</h2>
            {sessions.length === 0 ? (
              <p className="text-slate-400 text-sm">No boost sessions yet</p>
            ) : (
              <div className="grid grid-cols-1 gap-4">
                {sessions.map(session => (
                  <div
                    key={session.sessionId}
                    className="bg-[#0b0e14] border border-slate-800 rounded-xl p-4 transition hover:border-slate-700"
                  >
                    <div className="flex justify-between items-center mb-3">
                      <span className="text-indigo-400 font-bold">{session.sessionId}</span>
                      <span className={`font-bold text-xs px-2 py-1 rounded-md border ${
                        session.status === 'completed' ? 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20' :
                        session.status === 'failed' ? 'text-rose-400 bg-rose-400/10 border-rose-400/20' :
                        'text-amber-400 bg-amber-400/10 border-amber-400/20 animate-pulse'
                      }`}>
                        {session.status?.toUpperCase()}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
                      <div className="text-slate-400">✓ Success: <span className="text-emerald-400 font-bold">{session.successful || 0}</span></div>
                      <div className="text-slate-400">✗ Failed: <span className="text-rose-400 font-bold">{session.failed || 0}</span></div>
                      <div className="text-slate-400">⏳ Pending: <span className="text-amber-400 font-bold">{session.pending || 0}</span></div>
                      <div className="text-slate-400">Progress: <span className="text-indigo-400 font-bold">
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
          <div className="bg-[#1a1f2e] border border-slate-800 rounded-2xl p-6">
            <h2 className="text-white font-bold text-lg mb-4">Analytics & Metrics</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-[#0b0e14] p-4 rounded-xl border-l-4 border-indigo-500">
                <div className="text-xs text-slate-400 mb-1">Total Accounts</div>
                <div className="text-2xl font-bold text-indigo-400">{accounts.length}</div>
              </div>
              <div className="bg-[#0b0e14] p-4 rounded-xl border-l-4 border-emerald-500">
                <div className="text-xs text-slate-400 mb-1">Healthy</div>
                <div className="text-2xl font-bold text-emerald-400">
                  {accounts.filter(a => a.health_score >= 60).length}
                </div>
              </div>
              <div className="bg-[#0b0e14] p-4 rounded-xl border-l-4 border-blue-500">
                <div className="text-xs text-slate-400 mb-1">Total Boosts</div>
                <div className="text-2xl font-bold text-blue-500">
                  {accounts.reduce((sum, acc) => sum + acc.boosts_remaining, 0)}
                </div>
              </div>
              <div className="bg-[#0b0e14] p-4 rounded-xl border-l-4 border-amber-500">
                <div className="text-xs text-slate-400 mb-1">Avg Health</div>
                <div className="text-2xl font-bold text-amber-500">
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
    </div>
  );
};

export default ExpertUI;

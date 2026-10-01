// @ts-nocheck
'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { ArrowLeft, Settings, Users, Rocket, Activity, BarChart3, Plus, Zap, Server, Shield, Heart, ChevronDown, Loader2, CheckCircle2, XCircle, AlertTriangle, RefreshCw, Sparkles, ShieldCheck, ShieldX, Crown, GitBranch } from 'lucide-react';

// ─── Reusable Sub-Components ───────────────────────────────────────────────────

const GlassCard = ({ children, className = '', glow = false, ...props }) => (
  <div
    className={`bg-[#1a1f2e]/80 backdrop-blur-sm border border-slate-800/60 rounded-2xl ${glow ? 'shadow-[0_0_20px_rgba(99,102,241,0.08)]' : ''} ${className}`}
    {...props}
  >
    {children}
  </div>
);

const StyledInput = ({ label, icon: Icon, className = '', ...props }) => (
  <div className="space-y-1.5">
    {label && <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider">{label}</label>}
    <div className="relative">
      {Icon && <Icon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />}
      <input
        className={`w-full bg-[#0b0e14] border border-slate-800/80 rounded-xl ${Icon ? 'pl-10' : 'pl-4'} pr-4 py-3 text-sm text-slate-200 placeholder-slate-600 focus:border-indigo-500/50 focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all duration-300 ${className}`}
        {...props}
      />
    </div>
  </div>
);

const AnimatedButton = ({ children, loading = false, variant = 'primary', className = '', disabled = false, ...props }) => {
  const variants = {
    primary: 'bg-indigo-600 hover:bg-indigo-500 shadow-lg shadow-indigo-500/20 hover:shadow-indigo-500/30',
    success: 'bg-emerald-600 hover:bg-emerald-500 shadow-lg shadow-emerald-500/20 hover:shadow-emerald-500/30',
    ghost: 'bg-slate-800/50 hover:bg-slate-700/50 border border-slate-700/50',
  };

  return (
    <button
      disabled={disabled || loading}
      className={`relative flex items-center justify-center gap-2 px-6 py-3 rounded-xl text-white font-semibold text-sm transition-all duration-300 active:scale-[0.97] ${disabled || loading ? 'opacity-50 cursor-not-allowed' : variants[variant]} ${className}`}
      {...props}
    >
      {loading && <Loader2 className="w-4 h-4 animate-spin" />}
      {children}
    </button>
  );
};

const Badge = ({ children, color = 'slate' }) => {
  const colors = {
    emerald: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20',
    rose: 'text-rose-400 bg-rose-400/10 border-rose-400/20',
    amber: 'text-amber-400 bg-amber-400/10 border-amber-400/20',
    indigo: 'text-indigo-400 bg-indigo-400/10 border-indigo-400/20',
    slate: 'text-slate-400 bg-slate-400/10 border-slate-400/20',
  };
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider border ${colors[color]}`}>
      {children}
    </span>
  );
};

const HealthRing = ({ score, size = 36 }) => {
  const radius = (size - 6) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;
  const color = score >= 80 ? '#10b981' : score >= 60 ? '#f59e0b' : score >= 40 ? '#f97316' : '#ef4444';

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#1e293b" strokeWidth="3" />
        <circle
          cx={size / 2} cy={size / 2} r={radius} fill="none"
          stroke={color} strokeWidth="3" strokeLinecap="round"
          strokeDasharray={circumference} strokeDashoffset={offset}
          className="transition-all duration-700 ease-out"
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-[9px] font-bold text-slate-300">
        {score}
      </span>
    </div>
  );
};

const MetricCard = ({ icon: Icon, label, value, color = 'indigo', borderColor }) => {
  const iconColors = {
    indigo: 'text-indigo-400 bg-indigo-400/10',
    emerald: 'text-emerald-400 bg-emerald-400/10',
    blue: 'text-blue-400 bg-blue-400/10',
    amber: 'text-amber-400 bg-amber-400/10',
    rose: 'text-rose-400 bg-rose-400/10',
  };
  return (
    <GlassCard className={`p-5 border-l-4 ${borderColor} hover:scale-[1.02] transition-transform duration-300`}>
      <div className="flex items-center gap-3 mb-3">
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${iconColors[color]}`}>
          <Icon className="w-4 h-4" />
        </div>
        <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">{label}</span>
      </div>
      <div className="text-3xl font-black text-white tracking-tight">{value}</div>
    </GlassCard>
  );
};

const Toast = ({ message, type = 'success', onDismiss }) => {
  useEffect(() => {
    const timer = setTimeout(onDismiss, 4000);
    return () => clearTimeout(timer);
  }, [onDismiss]);

  return (
    <div className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 px-5 py-3.5 rounded-xl border shadow-2xl animate-[slideUp_0.4s_ease-out] backdrop-blur-md ${
      type === 'success' ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400' : 'bg-rose-500/15 border-rose-500/30 text-rose-400'
    }`}>
      {type === 'success' ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <XCircle className="w-4 h-4 shrink-0" />}
      <span className="text-sm font-medium">{message}</span>
    </div>
  );
};

// ─── Account Card Component ────────────────────────────────────────────────────

const AccountCard = ({ account }) => (
  <GlassCard className="p-4 hover:border-slate-700/80 hover:shadow-lg hover:shadow-indigo-500/5 transition-all duration-300 group">
    <div className="flex items-start justify-between mb-3">
      <div className="flex items-center gap-2.5">
        <HealthRing score={account.health_score} />
        <div>
          <div className="font-bold text-sm text-white group-hover:text-indigo-300 transition-colors">{account.username || 'Unknown'}</div>
          <div className="text-[10px] text-slate-500 font-mono">{account.id}</div>
        </div>
      </div>
    </div>
    <div className="flex flex-wrap gap-1.5 mb-3">
      <Badge color={account.has_nitro ? 'indigo' : 'slate'}><Crown className="w-3 h-3" /> {account.has_nitro ? 'Nitro' : 'No Nitro'}</Badge>
      <Badge color={account.verified ? 'emerald' : 'rose'}>{account.verified ? <ShieldCheck className="w-3 h-3" /> : <ShieldX className="w-3 h-3" />} {account.verified ? 'Verified' : 'Unverified'}</Badge>
      <Badge color={account.boosts_remaining > 0 ? 'amber' : 'slate'}><Rocket className="w-3 h-3" /> {account.boosts_remaining}/2</Badge>
    </div>
    <div className="text-[10px] text-slate-500 pt-2 border-t border-slate-800/40">
      Last: {account.last_activity ? new Date(account.last_activity).toLocaleString() : 'Never'}
    </div>
  </GlassCard>
);

// ─── Session Card Component ────────────────────────────────────────────────────

const SessionCard = ({ session }) => {
  const total = (session.successful || 0) + (session.failed || 0) + (session.pending || 0);
  const pct = total > 0 ? Math.round(((session.successful || 0) + (session.failed || 0)) / total * 100) : 0;

  return (
    <GlassCard className="p-5 hover:border-slate-700/60 transition-all duration-300">
      <div className="flex justify-between items-center mb-4">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-indigo-400" />
          <span className="text-sm font-bold text-white font-mono">{session.sessionId}</span>
        </div>
        <Badge color={session.status === 'completed' ? 'emerald' : session.status === 'failed' ? 'rose' : 'amber'}>
          {session.status === 'running' && <Loader2 className="w-3 h-3 animate-spin" />}
          {session.status?.toUpperCase()}
        </Badge>
      </div>
      {/* Progress Bar */}
      <div className="mb-4">
        <div className="flex justify-between text-[10px] text-slate-500 mb-1.5">
          <span>Progress</span>
          <span className="font-bold text-slate-300">{pct}%</span>
        </div>
        <div className="w-full h-1.5 bg-slate-800/80 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-700 ease-out ${session.status === 'completed' ? 'bg-emerald-500' : session.status === 'failed' ? 'bg-rose-500' : 'bg-indigo-500 animate-pulse'}`}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
      <div className="grid grid-cols-3 gap-3 text-xs">
        <div className="text-center p-2 rounded-lg bg-emerald-500/5 border border-emerald-500/10">
          <div className="text-emerald-400 font-black text-lg">{session.successful || 0}</div>
          <div className="text-emerald-400/60 text-[10px] font-medium">Success</div>
        </div>
        <div className="text-center p-2 rounded-lg bg-rose-500/5 border border-rose-500/10">
          <div className="text-rose-400 font-black text-lg">{session.failed || 0}</div>
          <div className="text-rose-400/60 text-[10px] font-medium">Failed</div>
        </div>
        <div className="text-center p-2 rounded-lg bg-amber-500/5 border border-amber-500/10">
          <div className="text-amber-400 font-black text-lg">{session.pending || 0}</div>
          <div className="text-amber-400/60 text-[10px] font-medium">Pending</div>
        </div>
      </div>
    </GlassCard>
  );
};

// ─── Main Expert UI Component ──────────────────────────────────────────────────

const TABS = [
  { id: 'accounts', label: 'Accounts', icon: Users },
  { id: 'boost', label: 'Boost', icon: Rocket },
  { id: 'sessions', label: 'Sessions', icon: Activity },
  { id: 'analytics', label: 'Analytics', icon: BarChart3 },
];

const ExpertUI = ({ onBack }) => {
  // ─── State ───────────────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState('accounts');
  const [accounts, setAccounts] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState(null);
  const [showConfig, setShowConfig] = useState(false);

  // Account form
  const [comboInput, setComboInput] = useState(''); // email:password:token format

  // Boost form
  const [boostMode, setBoostMode] = useState('2x');         // '2x' | '1x-split'
  const [primaryServer, setPrimaryServer] = useState('');
  const [secondaryServer, setSecondaryServer] = useState('');
  const [currentSession, setCurrentSession] = useState(null);

  // Config
  const [config, setConfig] = useState({
    maxConcurrent: 5,
    retryAttempts: 3,
    autoLockThreshold: 40,
    adaptiveDelay: true,
  });

  const refreshRef = useRef(null);
  const sessionPollRef = useRef(null);
  const abortRef = useRef(null);

  const API_URL = '/api/v1';

  // ─── Toast Helper ────────────────────────────────────────────────────────────
  const showToast = useCallback((message, type = 'success') => {
    setToast({ message, type });
  }, []);

  // ─── Fetch Accounts (with abort controller) ──────────────────────────────────
  const fetchAccounts = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/accounts/status`);
      if (!res.ok) return;
      const data = await res.json();
      if (data.accounts) setAccounts(data.accounts);
    } catch { /* silently ignore on unmount */ }
  }, []);

  // ─── Account Polling ─────────────────────────────────────────────────────────
  useEffect(() => {
    fetchAccounts();
    refreshRef.current = setInterval(fetchAccounts, 8000); // 8s, not 3s
    return () => clearInterval(refreshRef.current);
  }, [fetchAccounts]);

  // ─── Session Polling (with functional updater to avoid stale closures) ───────
  useEffect(() => {
    if (!currentSession) return;

    const poll = async () => {
      try {
        const res = await fetch(`${API_URL}/boost/status?id=${currentSession}`);
        if (!res.ok) return;
        const data = await res.json();

        setSessions(prev => prev.map(s => s.sessionId === currentSession ? { ...s, ...data } : s));

        if (data.status === 'completed' || data.status === 'failed') {
          setCurrentSession(null);
          showToast(data.status === 'completed' ? 'Boost session completed!' : 'Boost session failed', data.status === 'completed' ? 'success' : 'error');
        }
      } catch { /* ignore */ }
    };

    sessionPollRef.current = setInterval(poll, 3000); // 3s, not 500ms
    return () => clearInterval(sessionPollRef.current);
  }, [currentSession, showToast]);

  // ─── Add Account ─────────────────────────────────────────────────────────────
  const handleAddAccount = async (e) => {
    e.preventDefault();
    const trimmed = comboInput.trim();
    if (!trimmed) {
      showToast('Paste at least one email:password:token combo', 'error');
      return;
    }

    // Parse combos (supports multi-line bulk paste)
    const lines = trimmed.split('\n').map(l => l.trim()).filter(Boolean);
    const combos = [];
    for (const line of lines) {
      const parts = line.split(':');
      if (parts.length < 3) {
        showToast(`Invalid format: "${line.slice(0, 30)}..." — use email:password:token`, 'error');
        return;
      }
      const email = parts[0];
      const password = parts[1];
      const token = parts.slice(2).join(':'); // token may contain colons
      combos.push({ email, password, token });
    }

    setLoading(true);
    let added = 0;
    try {
      for (const combo of combos) {
        const res = await fetch(`${API_URL}/accounts/add`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(combo),
        });
        const data = await res.json();
        if (res.ok) {
          added++;
        } else {
          showToast(`${combo.email}: ${data.error || 'Failed'}`, 'error');
        }
      }
      if (added > 0) {
        showToast(`${added} account${added > 1 ? 's' : ''} added & verified`);
        setComboInput('');
        await fetchAccounts();
      }
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  // ─── Execute Boost ───────────────────────────────────────────────────────────
  const handleBoost = async (e) => {
    e.preventDefault();
    if (!primaryServer) {
      showToast('Server link is required', 'error');
      return;
    }
    if (boostMode === '1x-split' && !secondaryServer) {
      showToast('Second server link is required for split mode', 'error');
      return;
    }

    setLoading(true);
    try {
      const targets = boostMode === '2x'
        ? [{ server_link: primaryServer, boosts_per_account: 2 }]
        : [
            { server_link: primaryServer, boosts_per_account: 1 },
            { server_link: secondaryServer, boosts_per_account: 1 },
          ];

      const res = await fetch(`${API_URL}/boost/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ boost_mode: boostMode, targets }),
      });

      const data = await res.json();
      if (res.ok) {
        setCurrentSession(data.sessionId);
        setSessions(prev => [...prev, data.session]);
        showToast(`Boost queued: ${data.sessionId}`);
        setPrimaryServer('');
        setSecondaryServer('');
      } else {
        showToast(data.error || 'Boost execution failed', 'error');
      }
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  // ─── Derived Metrics ─────────────────────────────────────────────────────────
  const totalBoosts = accounts.reduce((sum, a) => sum + (a.boosts_remaining || 0), 0);
  const healthyCount = accounts.filter(a => (a.health_score || 0) >= 60).length;
  const avgHealth = accounts.length > 0 ? Math.round(accounts.reduce((s, a) => s + (a.health_score || 0), 0) / accounts.length) : 0;

  // ─── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="max-w-6xl mx-auto px-6 py-10 md:px-12 md:py-14 font-sans animate-[fadeIn_0.5s_ease-out]">

      {/* Toast */}
      {toast && <Toast message={toast.message} type={toast.type} onDismiss={() => setToast(null)} />}

      {/* Back Button */}
      <button onClick={onBack} className="group flex items-center gap-2 text-slate-400 hover:text-white mb-8 transition-all duration-300 text-sm bg-[#151924] px-4 py-2.5 rounded-full border border-slate-800/60 hover:border-slate-700 hover:shadow-lg hover:shadow-indigo-500/5 w-fit">
        <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform duration-300" /> Back to Dashboard
      </button>

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center gap-5 mb-10">
        <div className="flex items-center gap-4 flex-1">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-500/20 to-emerald-500/10 text-indigo-400 flex items-center justify-center shadow-[0_0_25px_rgba(99,102,241,0.15)] border border-indigo-500/20">
            <Rocket className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-white tracking-tight">Expert Boost Engine</h1>
            <p className="text-slate-500 text-sm font-medium">Enterprise-Grade · Rate-Limited · Token Protected</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="hidden md:flex items-center gap-2 px-4 py-2 rounded-xl bg-[#0b0e14] border border-slate-800/60 text-xs text-slate-400">
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="font-bold text-emerald-400">{accounts.length}</span> accounts · <span className="font-bold text-indigo-400">{totalBoosts}</span> boosts
          </div>
          <button
            onClick={() => setShowConfig(!showConfig)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all duration-300 border ${
              showConfig ? 'bg-indigo-600/20 border-indigo-500/30 text-indigo-400' : 'bg-[#151924] border-slate-800/60 text-slate-400 hover:text-white hover:border-slate-700'
            }`}
          >
            <Settings className={`w-4 h-4 transition-transform duration-500 ${showConfig ? 'rotate-180' : ''}`} />
            Config
          </button>
        </div>
      </div>

      {/* Main Container */}
      <div className="bg-[#151924] border border-slate-800/60 rounded-3xl overflow-hidden shadow-2xl shadow-black/20">

        {/* Config Panel (Collapsible) */}
        <div className={`grid transition-all duration-500 ease-in-out ${showConfig ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}>
          <div className="overflow-hidden">
            <div className="bg-[#1a1f2e]/50 border-b border-slate-800/40 p-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
              <StyledInput label="Max Concurrent" type="number" value={config.maxConcurrent} onChange={(e) => setConfig(c => ({ ...c, maxConcurrent: parseInt(e.target.value) || 1 }))} />
              <StyledInput label="Retry Attempts" type="number" value={config.retryAttempts} onChange={(e) => setConfig(c => ({ ...c, retryAttempts: parseInt(e.target.value) || 1 }))} />
              <StyledInput label="Health Threshold" type="number" min="0" max="100" value={config.autoLockThreshold} onChange={(e) => setConfig(c => ({ ...c, autoLockThreshold: parseInt(e.target.value) || 0 }))} />
              <div className="flex items-end pb-1">
                <label className="flex items-center gap-3 cursor-pointer select-none group">
                  <div className={`relative w-11 h-6 rounded-full transition-colors duration-300 ${config.adaptiveDelay ? 'bg-indigo-600' : 'bg-slate-700'}`}>
                    <div className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow-md transition-transform duration-300 ${config.adaptiveDelay ? 'translate-x-5' : ''}`} />
                  </div>
                  <span className="text-sm font-medium text-slate-300 group-hover:text-white transition-colors">Adaptive Delays</span>
                </label>
              </div>
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex bg-[#0b0e14]/50 border-b border-slate-800/40 px-4 md:px-6 pt-3 gap-1">
          {TABS.map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-5 py-3 text-sm font-bold uppercase tracking-wide transition-all duration-300 rounded-t-xl border-x border-t ${
                  isActive
                    ? 'bg-[#151924] text-indigo-400 border-slate-800/60 shadow-[0_-2px_10px_rgba(99,102,241,0.1)]'
                    : 'text-slate-500 hover:text-slate-300 border-transparent hover:bg-[#151924]/30'
                }`}
              >
                <Icon className={`w-4 h-4 transition-colors ${isActive ? 'text-indigo-400' : ''}`} />
                <span className="hidden sm:inline">{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Tab Content */}
        <div className="p-6 md:p-8 animate-[fadeIn_0.3s_ease-out]">

          {/* ═══ ACCOUNTS TAB ═══ */}
          {activeTab === 'accounts' && (
            <div className="space-y-8">
              {/* Add Account Form */}
              <GlassCard className="p-6" glow>
                <div className="flex items-center gap-3 mb-5">
                  <div className="w-8 h-8 rounded-lg bg-indigo-500/10 flex items-center justify-center">
                    <Plus className="w-4 h-4 text-indigo-400" />
                  </div>
                  <h2 className="text-lg font-bold text-white">Add Account</h2>
                </div>
                <form onSubmit={handleAddAccount}>
                  <div className="mb-4">
                    <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Account Combos</label>
                    <textarea
                      placeholder={"email:password:token\nemail2:password2:token2\n(one combo per line for bulk import)"}
                      value={comboInput}
                      onChange={(e) => setComboInput(e.target.value)}
                      rows={3}
                      className="w-full bg-[#0b0e14] border border-slate-800/80 rounded-xl px-4 py-3 text-sm text-slate-200 placeholder-slate-600 font-mono focus:border-indigo-500/50 focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all duration-300 resize-none"
                    />
                    <p className="text-[10px] text-slate-600 mt-1.5 ml-1">Format: <span className="text-slate-400 font-mono">email:password:token</span> — paste multiple lines for bulk import</p>
                  </div>
                  <AnimatedButton type="submit" loading={loading} className="w-full">
                    <Shield className="w-4 h-4" /> Add & Verify {comboInput.trim().split('\n').filter(Boolean).length > 1 ? `${comboInput.trim().split('\n').filter(Boolean).length} Accounts` : 'Account'}
                  </AnimatedButton>
                </form>
              </GlassCard>

              {/* Account Grid */}
              <div>
                <div className="flex items-center justify-between mb-5">
                  <h2 className="text-lg font-bold text-white">Accounts <span className="text-slate-500 font-normal text-sm">({accounts.length})</span></h2>
                  <button onClick={fetchAccounts} className="text-slate-500 hover:text-indigo-400 transition-colors" title="Refresh">
                    <RefreshCw className="w-4 h-4" />
                  </button>
                </div>
                {accounts.length === 0 ? (
                  <GlassCard className="p-10 text-center">
                    <Users className="w-8 h-8 text-slate-600 mx-auto mb-3" />
                    <p className="text-slate-400 text-sm">No accounts added yet</p>
                    <p className="text-slate-600 text-xs mt-1">Add a Nitro account above to get started</p>
                  </GlassCard>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {accounts.map(acc => <AccountCard key={acc.id} account={acc} />)}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ═══ BOOST TAB ═══ */}
          {activeTab === 'boost' && (
            <div className="space-y-8">
              {/* Boost Mode Selector */}
              <GlassCard className="p-6" glow>
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                    <Zap className="w-4 h-4 text-emerald-400" />
                  </div>
                  <h2 className="text-lg font-bold text-white">Boost Mode</h2>
                </div>

                {/* Mode Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                  <button
                    onClick={() => setBoostMode('2x')}
                    className={`relative text-left p-5 rounded-xl border-2 transition-all duration-300 ${
                      boostMode === '2x'
                        ? 'border-indigo-500/50 bg-indigo-500/5 shadow-[0_0_20px_rgba(99,102,241,0.1)]'
                        : 'border-slate-800/60 bg-[#0b0e14] hover:border-slate-700'
                    }`}
                  >
                    {boostMode === '2x' && <div className="absolute top-3 right-3 w-5 h-5 rounded-full bg-indigo-500 flex items-center justify-center"><CheckCircle2 className="w-3.5 h-3.5 text-white" /></div>}
                    <div className="flex gap-1 mb-3">
                      <div className="w-8 h-8 rounded-lg bg-indigo-500/15 flex items-center justify-center"><Zap className="w-4 h-4 text-indigo-400" /></div>
                      <div className="w-8 h-8 rounded-lg bg-indigo-500/15 flex items-center justify-center"><Zap className="w-4 h-4 text-indigo-400" /></div>
                    </div>
                    <div className="font-bold text-white text-sm mb-1">2x Same Server</div>
                    <div className="text-xs text-slate-500">Both boosts go to a single server. Maximum impact.</div>
                  </button>
                  <button
                    onClick={() => setBoostMode('1x-split')}
                    className={`relative text-left p-5 rounded-xl border-2 transition-all duration-300 ${
                      boostMode === '1x-split'
                        ? 'border-emerald-500/50 bg-emerald-500/5 shadow-[0_0_20px_rgba(16,185,129,0.1)]'
                        : 'border-slate-800/60 bg-[#0b0e14] hover:border-slate-700'
                    }`}
                  >
                    {boostMode === '1x-split' && <div className="absolute top-3 right-3 w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center"><CheckCircle2 className="w-3.5 h-3.5 text-white" /></div>}
                    <div className="flex items-center gap-1 mb-3">
                      <div className="w-8 h-8 rounded-lg bg-emerald-500/15 flex items-center justify-center"><Zap className="w-4 h-4 text-emerald-400" /></div>
                      <GitBranch className="w-4 h-4 text-slate-600" />
                      <div className="w-8 h-8 rounded-lg bg-emerald-500/15 flex items-center justify-center"><Zap className="w-4 h-4 text-emerald-400" /></div>
                    </div>
                    <div className="font-bold text-white text-sm mb-1">1x Split (Two Servers)</div>
                    <div className="text-xs text-slate-500">1 boost each to two different servers. Max coverage.</div>
                  </button>
                </div>

                {/* Server Link Inputs */}
                <form onSubmit={handleBoost} className="space-y-4">
                  <StyledInput
                    icon={Server}
                    label={boostMode === '1x-split' ? 'Server 1 Invite' : 'Server Invite Link'}
                    placeholder="discord.gg/xxxxx"
                    value={primaryServer}
                    onChange={(e) => setPrimaryServer(e.target.value)}
                  />

                  {/* Animated Second Input */}
                  <div className={`grid transition-all duration-500 ease-in-out ${boostMode === '1x-split' ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}>
                    <div className="overflow-hidden">
                      <StyledInput
                        icon={Server}
                        label="Server 2 Invite"
                        placeholder="discord.gg/yyyyy"
                        value={secondaryServer}
                        onChange={(e) => setSecondaryServer(e.target.value)}
                      />
                    </div>
                  </div>

                  {/* Boost Summary */}
                  <GlassCard className="p-4 flex items-center justify-between">
                    <div className="text-xs text-slate-400">
                      <span className="text-white font-bold">{totalBoosts}</span> boosts available across <span className="text-white font-bold">{accounts.length}</span> accounts
                    </div>
                    <div className="text-xs font-bold text-indigo-400">
                      Mode: {boostMode === '2x' ? '2x per account → 1 server' : '1x per account → 2 servers'}
                    </div>
                  </GlassCard>

                  <AnimatedButton type="submit" variant="success" loading={loading} disabled={accounts.length === 0} className="w-full">
                    <Rocket className="w-4 h-4" />
                    {loading ? 'Executing...' : `Execute ${boostMode === '2x' ? '2x' : '1x Split'} Boost`}
                  </AnimatedButton>
                </form>
              </GlassCard>
            </div>
          )}

          {/* ═══ SESSIONS TAB ═══ */}
          {activeTab === 'sessions' && (
            <div>
              <div className="flex items-center gap-3 mb-6">
                <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center">
                  <Activity className="w-4 h-4 text-amber-400" />
                </div>
                <h2 className="text-lg font-bold text-white">Boost Sessions</h2>
              </div>
              {sessions.length === 0 ? (
                <GlassCard className="p-10 text-center">
                  <Activity className="w-8 h-8 text-slate-600 mx-auto mb-3" />
                  <p className="text-slate-400 text-sm">No boost sessions yet</p>
                  <p className="text-slate-600 text-xs mt-1">Execute a boost to see live progress here</p>
                </GlassCard>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {sessions.map(s => <SessionCard key={s.sessionId} session={s} />)}
                </div>
              )}
            </div>
          )}

          {/* ═══ ANALYTICS TAB ═══ */}
          {activeTab === 'analytics' && (
            <div>
              <div className="flex items-center gap-3 mb-6">
                <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center">
                  <BarChart3 className="w-4 h-4 text-blue-400" />
                </div>
                <h2 className="text-lg font-bold text-white">Analytics & Metrics</h2>
              </div>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <MetricCard icon={Users} label="Accounts" value={accounts.length} color="indigo" borderColor="border-indigo-500" />
                <MetricCard icon={Heart} label="Healthy" value={healthyCount} color="emerald" borderColor="border-emerald-500" />
                <MetricCard icon={Rocket} label="Boosts" value={totalBoosts} color="blue" borderColor="border-blue-500" />
                <MetricCard icon={Shield} label="Avg Health" value={`${avgHealth}%`} color="amber" borderColor="border-amber-500" />
              </div>

              {/* Extra Analytics Row */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
                <GlassCard className="p-5">
                  <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
                    <BarChart3 className="w-4 h-4 text-indigo-400" /> Account Health Distribution
                  </h3>
                  <div className="space-y-2.5">
                    {[
                      { label: 'Excellent (80+)', count: accounts.filter(a => a.health_score >= 80).length, color: 'bg-emerald-500', total: accounts.length },
                      { label: 'Good (60-79)', count: accounts.filter(a => a.health_score >= 60 && a.health_score < 80).length, color: 'bg-amber-500', total: accounts.length },
                      { label: 'Poor (<60)', count: accounts.filter(a => a.health_score < 60).length, color: 'bg-rose-500', total: accounts.length },
                    ].map(tier => (
                      <div key={tier.label}>
                        <div className="flex justify-between text-xs text-slate-400 mb-1">
                          <span>{tier.label}</span>
                          <span className="font-bold text-slate-300">{tier.count}</span>
                        </div>
                        <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                          <div
                            className={`h-full ${tier.color} rounded-full transition-all duration-700`}
                            style={{ width: `${tier.total > 0 ? (tier.count / tier.total) * 100 : 0}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </GlassCard>

                <GlassCard className="p-5">
                  <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
                    <Activity className="w-4 h-4 text-emerald-400" /> Session Summary
                  </h3>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="text-center p-3 rounded-xl bg-[#0b0e14] border border-slate-800/40">
                      <div className="text-2xl font-black text-white">{sessions.length}</div>
                      <div className="text-[10px] text-slate-500 font-medium uppercase tracking-wider mt-1">Total Sessions</div>
                    </div>
                    <div className="text-center p-3 rounded-xl bg-[#0b0e14] border border-slate-800/40">
                      <div className="text-2xl font-black text-emerald-400">{sessions.filter(s => s.status === 'completed').length}</div>
                      <div className="text-[10px] text-slate-500 font-medium uppercase tracking-wider mt-1">Completed</div>
                    </div>
                    <div className="text-center p-3 rounded-xl bg-[#0b0e14] border border-slate-800/40">
                      <div className="text-2xl font-black text-rose-400">{sessions.filter(s => s.status === 'failed').length}</div>
                      <div className="text-[10px] text-slate-500 font-medium uppercase tracking-wider mt-1">Failed</div>
                    </div>
                    <div className="text-center p-3 rounded-xl bg-[#0b0e14] border border-slate-800/40">
                      <div className="text-2xl font-black text-amber-400">{sessions.filter(s => s.status === 'running').length}</div>
                      <div className="text-[10px] text-slate-500 font-medium uppercase tracking-wider mt-1">Running</div>
                    </div>
                  </div>
                </GlassCard>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* CSS Keyframes */}
      <style jsx global>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(16px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
};

export default ExpertUI;

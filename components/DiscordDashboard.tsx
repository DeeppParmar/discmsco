"use client";

import React, { useState, useCallback, useMemo } from "react";
import { OperationType, AccountCheckResult, JobStatus, JobResult, ApiResponse } from "@/types";
import { CheckCircle2, XCircle, Clock, AlertCircle, ShieldCheck, Gift, Zap, Target, ChevronRight, Loader2, Trash2, ArrowLeft, Search, UserPlus, Fingerprint, Lock, ShieldAlert, KeyRound, RotateCcw } from "lucide-react";

interface TokenResult {
  hash: string;
  email: string;
  originalLine: string;
  jobId: string;
  status: "pending" | "validating" | "ready" | "error";
  checkResult?: AccountCheckResult;
  error?: string;
}

export default function DiscordDashboard() {
  const [activeView, setActiveView] = useState<string | null>(null);

  return (
    <div className="min-h-screen bg-[#0b0e14] text-slate-300 font-sans selection:bg-indigo-500/30">
      {!activeView ? (
        <HomeView onSelect={setActiveView} />
      ) : activeView === "checker" ? (
        <TokenCheckerView onBack={() => setActiveView(null)} />
      ) : activeView === "quests" ? (
        <QuestView onBack={() => setActiveView(null)} />
      ) : (
        <div className="p-12 text-center">
          <h2 className="text-2xl text-white mb-4">Tool in development</h2>
          <button onClick={() => setActiveView(null)} className="px-4 py-2 bg-indigo-600 rounded-lg text-white font-medium hover:bg-indigo-500 transition">Go Back</button>
        </div>
      )}
    </div>
  );
}

function HomeView({ onSelect }: { onSelect: (v: string) => void }) {
  const tools = [
    { id: "checker", name: "Token Checker", desc: "Check up to 1,000 tokens — sorted into valid, locked & invalid with full details.", icon: Search, color: "text-blue-400", bg: "bg-blue-500/10", shadow: "shadow-[0_0_15px_rgba(59,130,246,0.5)]" },
    { id: "quests", name: "Quest Tools", desc: "Enroll and complete quests automatically for your valid tokens to claim rewards.", icon: Target, color: "text-purple-400", bg: "bg-purple-500/10", shadow: "shadow-[0_0_15px_rgba(168,85,247,0.5)]" }
  ];

  return (
    <div className="max-w-7xl mx-auto p-6 md:p-12">

      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-5">
        {tools.map(tool => (
          <div key={tool.id} className="bg-[#151924] border border-slate-800/80 rounded-2xl p-6 flex flex-col items-center text-center hover:border-slate-700 hover:bg-[#1a1f2e] transition-all group">
            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-5 transition-all duration-300 ${tool.bg} ${tool.color} ${tool.shadow}`}>
              <tool.icon className="w-7 h-7" />
            </div>
            <h3 className="text-white font-bold text-sm mb-3">{tool.name}</h3>
            <p className="text-slate-400 text-[11px] leading-relaxed mb-6 flex-1">{tool.desc}</p>
            <button onClick={() => onSelect(tool.id)} className="w-full py-2 rounded-full border border-slate-700/50 bg-[#0b0e14]/50 text-xs font-medium text-slate-300 hover:bg-slate-800 hover:text-white transition-all">
              Open
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

function TokenCheckerView({ onBack }: { onBack: () => void }) {
  const [tokenInput, setTokenInput] = useState("");
  const [tokens, setTokens] = useState<TokenResult[]>([]);
  const [loading, setLoading] = useState(false);

  // Filters
  const [filterStatus, setFilterStatus] = useState<string>("All");
  const [filterNitro, setFilterNitro] = useState(false);
  const [filterAvatar, setFilterAvatar] = useState(false);
  const [filterPhone, setFilterPhone] = useState(false);
  const [filterEmail, setFilterEmail] = useState(false);

  const [filterNitroDays, setFilterNitroDays] = useState<number>(0);
  const [filterAgeDays, setFilterAgeDays] = useState<number>(0);

  const validateToken = useCallback(async (tokenStr: string) => {
    try {
      const response = await fetch("/api/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: tokenStr }),
      });
      const data = (await response.json()) as ApiResponse<any>;
      if (!data.success) return { error: data.error };
      
      // Since it's synchronous now on the backend, data.data.result already has the result!
      return { 
        jobId: data.data.jobId, 
        hash: data.data.tokenHash, 
        status: data.data.status, // "ready" or "error"
        error: data.data.error,
        result: data.data.result 
      };
    } catch (error) {
      return { error: error instanceof Error ? error.message : "Unknown error" };
    }
  }, []);

  const handlePaste = async () => {
    if (!tokenInput.trim()) return;
    setLoading(true);
    const lines = tokenInput.split("\n").map((l) => l.trim()).filter((l) => l);
    if (lines.length === 0) {
      alert("No valid token format found.");
      setLoading(false);
      return;
    }

    // Set initial pending state
    const initialTokens: TokenResult[] = lines.map((line, idx) => {
      const parts = line.split(":");
      let email = "Unknown";
      if (parts.length >= 3) {
        email = parts[0];
      } else if (parts.length === 1 && line.length > 30) {
        email = "Token";
      }
      return {
        hash: "",
        email,
        originalLine: line,
        jobId: `temp-${idx}`,
        status: "pending"
      };
    });

    setTokens(initialTokens);

    // Run all checks concurrently for maximum speed
    await Promise.all(
      initialTokens.map(async (tokenObj, idx) => {
        const result = await validateToken(tokenObj.originalLine);
        setTokens((prev) => {
          const newTokens = [...prev];
          newTokens[idx] = {
            ...newTokens[idx],
            hash: result.hash || "",
            jobId: result.jobId || tokenObj.jobId,
            status: result.error || result.status === "error" ? "error" : "ready",
            error: result.error || (result.status === "error" ? "Check failed" : undefined),
            checkResult: result.result
          };
          return newTokens;
        });
      })
    );

    setLoading(false);
  };

  const filteredTokens = useMemo(() => {
    return tokens.filter(t => {
      if (filterStatus !== "All") {
        if (filterStatus === "Valid" && t.status !== "ready") return false;
        if (filterStatus === "Locked" && t.error !== "Account locked or suspended") return false;
        if (filterStatus === "Invalid" && t.error !== "Invalid token") return false;
        if (filterStatus === "Error" && (t.status === "ready" || t.error === "Account locked or suspended" || t.error === "Invalid token")) return false; 
      }
      if (filterNitro && !t.checkResult?.hasNitro) return false;
      if (filterAvatar && !t.checkResult?.hasAvatar) return false;
      if (filterPhone && !t.checkResult?.phoneVerified) return false;
      if (filterEmail && !t.checkResult?.emailVerified) return false;
      
      if (filterNitroDays > 0) {
        if (!t.checkResult?.nitroExpiry) return false;
        const expiry = new Date(t.checkResult.nitroExpiry).getTime();
        const days = (expiry - Date.now()) / (1000 * 60 * 60 * 24);
        if (days < filterNitroDays) return false;
      }
      if (filterAgeDays > 0) {
        if (!t.checkResult?.accountAge) return false;
        let ageDays = 0;
        const yearsMatch = t.checkResult.accountAge.match(/(\d+)\s*year/);
        const daysMatch = t.checkResult.accountAge.match(/(\d+)\s*day/);
        if (yearsMatch) {
          ageDays = parseInt(yearsMatch[1]) * 365;
        } else if (daysMatch) {
          ageDays = parseInt(daysMatch[1]);
        }
        if (ageDays < filterAgeDays) return false;
      }

      return true;
    });
  }, [tokens, filterStatus, filterNitro, filterAvatar, filterPhone, filterEmail, filterNitroDays, filterAgeDays]);

  const handleDownload = () => {
    if (filteredTokens.length === 0) return;
    const textContent = filteredTokens.map(t => t.originalLine).join("\n");
    const blob = new Blob([textContent], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `tokens_${filterStatus.toLowerCase()}_${Date.now()}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="max-w-5xl mx-auto p-6 md:p-12">
      <button onClick={onBack} className="flex items-center gap-2 text-slate-400 hover:text-white mb-8 transition font-medium text-sm bg-[#151924] px-4 py-2 rounded-full border border-slate-800 hover:bg-slate-800 w-fit">
        <ArrowLeft className="w-4 h-4" /> Back to Dashboard
      </button>

      <div className="flex items-center gap-5 mb-10">
        <div className="w-14 h-14 rounded-2xl bg-blue-500/10 text-blue-400 flex items-center justify-center shadow-[0_0_15px_rgba(59,130,246,0.3)]">
          <Search className="w-7 h-7" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-white mb-1">Token Checker</h1>
          <p className="text-slate-400 text-sm">Validate and inspect Discord tokens.</p>
        </div>
      </div>

      <div className="bg-[#151924] border border-slate-800 rounded-3xl p-8 mb-8 shadow-xl">
        <textarea
          value={tokenInput}
          onChange={(e) => setTokenInput(e.target.value)}
          placeholder="email:password:token"
          className="w-full h-40 bg-[#0b0e14] border border-slate-800 rounded-2xl px-5 py-4 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-blue-500/50 transition-all resize-none font-mono mb-6"
        />
        <button
          onClick={handlePaste}
          disabled={loading || !tokenInput.trim()}
          className="w-full bg-[#1e2536] hover:bg-[#252d43] border border-slate-700 disabled:opacity-50 text-slate-300 px-6 py-3.5 rounded-2xl font-semibold transition-all flex items-center justify-center gap-2 shadow-sm"
        >
          {loading ? <><Loader2 className="w-5 h-5 animate-spin" /> Checking...</> : "Start Checking"}
        </button>
      </div>

      {tokens.length > 0 && (
        <>
          {/* Filter Bar mimicking user screenshot exactly */}
          <div className="bg-[#151924] border border-slate-800 rounded-3xl p-8 mb-8 shadow-xl flex flex-col gap-6">
            <div className="flex flex-wrap items-center gap-6 text-sm font-semibold">
              <span className="text-slate-500 w-14 text-right">Status</span>
              <div className="flex flex-wrap bg-[#0b0e14] rounded-full p-1 border border-slate-800/80">
                {["All", "Valid", "Locked", "Invalid", "Error"].map(s => (
                  <button 
                    key={s}
                    onClick={() => setFilterStatus(s)}
                    className={`px-5 py-2 rounded-full transition-all ${filterStatus === s ? 'bg-[#1a2133] border border-[#2a3449] text-white shadow-sm' : 'text-slate-400 hover:text-slate-200 border border-transparent'}`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
            
            <div className="flex flex-wrap items-center gap-6 text-sm font-semibold">
              <span className="text-slate-500 w-14 text-right">Trial</span>
              <div className="flex flex-wrap bg-[#0b0e14] rounded-full p-1 border border-slate-800/80">
                {["2 Weeks", "1 Month", "3 Months", "Discount", "None"].map(s => (
                  <button key={s} className="px-5 py-2 rounded-full text-slate-500 border border-transparent opacity-50 cursor-not-allowed">
                    {s}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-4 mt-2 ml-[5.5rem]">
              <button onClick={() => setFilterNitro(!filterNitro)} className={`flex items-center gap-2 px-5 py-2.5 rounded-full border transition-all text-sm font-medium ${filterNitro ? 'bg-[#1a2133] border-[#2a3449] text-white' : 'bg-[#0b0e14] border-slate-800/80 text-slate-400 hover:border-slate-700'}`}>
                <Gift className="w-4 h-4" /> Nitro
              </button>
              <button onClick={() => setFilterAvatar(!filterAvatar)} className={`flex items-center gap-2 px-5 py-2.5 rounded-full border transition-all text-sm font-medium ${filterAvatar ? 'bg-[#1a2133] border-[#2a3449] text-white' : 'bg-[#0b0e14] border-slate-800/80 text-slate-400 hover:border-slate-700'}`}>
                <Fingerprint className="w-4 h-4" /> Avatar
              </button>
              <button onClick={() => setFilterPhone(!filterPhone)} className={`flex items-center gap-2 px-5 py-2.5 rounded-full border transition-all text-sm font-medium ${filterPhone ? 'bg-[#1a2133] border-[#2a3449] text-white' : 'bg-[#0b0e14] border-slate-800/80 text-slate-400 hover:border-slate-700'}`}>
                <Search className="w-4 h-4" /> Phone
              </button>
              <button onClick={() => setFilterEmail(!filterEmail)} className={`flex items-center gap-2 px-5 py-2.5 rounded-full border transition-all text-sm font-medium ${filterEmail ? 'bg-[#1a2133] border-[#2a3449] text-white' : 'bg-[#0b0e14] border-slate-800/80 text-slate-400 hover:border-slate-700'}`}>
                <CheckCircle2 className="w-4 h-4" /> Email
              </button>

              <div className="flex items-center gap-2 px-5 py-2.5 rounded-full border bg-[#0b0e14] border-slate-800/80 text-slate-400 text-sm font-medium">
                Nitro days &ge; <input type="number" min={0} value={filterNitroDays} onChange={(e) => setFilterNitroDays(Number(e.target.value) || 0)} className="w-12 bg-transparent border border-slate-700 rounded px-1 text-center text-white outline-none focus:border-blue-500/50" />
              </div>
              <div className="flex items-center gap-2 px-5 py-2.5 rounded-full border bg-[#0b0e14] border-slate-800/80 text-slate-400 text-sm font-medium">
                Age days &ge; <input type="number" min={0} value={filterAgeDays} onChange={(e) => setFilterAgeDays(Number(e.target.value) || 0)} className="w-12 bg-transparent border border-slate-700 rounded px-1 text-center text-white outline-none focus:border-blue-500/50" />
              </div>
            </div>
          </div>

          {/* Results list */}
          <div className="bg-[#151924] border border-slate-800 rounded-3xl p-8 shadow-xl">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-white flex items-center gap-3">
                Results 
                <span className="bg-transparent border border-slate-700 text-slate-300 px-3 py-1 rounded-full text-sm">{filteredTokens.length}</span>
              </h2>
              <button
                onClick={handleDownload}
                className="bg-[#1e2536] hover:bg-[#252d43] border border-slate-700 text-slate-300 px-5 py-2 rounded-xl text-sm font-semibold transition-all flex items-center gap-2"
              >
                Download Filtered
              </button>
            </div>

            <div className="space-y-4">
              {filteredTokens.map((token, idx) => (
                <div key={idx} style={{ animationDelay: `${idx * 0.05}s`, animationFillMode: 'both' }} className="group p-5 rounded-2xl border bg-[#0b0e14]/60 backdrop-blur-md border-slate-800/80 hover:border-blue-500/30 hover:bg-[#0b0e14] transition-all duration-300 hover:shadow-[0_0_30px_-5px_rgba(59,130,246,0.15)] relative overflow-hidden animate-fadeIn">
                  <div className={`absolute left-0 top-0 bottom-0 w-[3px] opacity-0 group-hover:opacity-100 transition-opacity ${token.status === 'ready' ? 'bg-gradient-to-b from-emerald-400 to-emerald-600' : token.status === 'error' ? 'bg-gradient-to-b from-rose-400 to-rose-600' : 'bg-gradient-to-b from-blue-400 to-blue-600'}`}></div>
                  <div className="flex justify-between items-center relative z-10">
                    <div>
                      <p className="font-semibold text-[15px] text-slate-200 tracking-wide font-mono group-hover:text-white transition-colors">{token.email}</p>
                    </div>
                    <div className="shrink-0 flex items-center gap-3">
                       {token.status === "ready" ? <span className="text-emerald-400 bg-emerald-500/10 px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider border border-emerald-500/20 shadow-[0_0_10px_rgba(16,185,129,0.1)] flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5"/> Valid</span> :
                       token.status === "error" ? <span className="text-rose-400 bg-rose-500/10 px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider border border-rose-500/20 shadow-[0_0_10px_rgba(225,29,72,0.1)] flex items-center gap-1.5"><XCircle className="w-3.5 h-3.5"/> Error</span> :
                       <span className="text-blue-400 bg-blue-500/10 px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider border border-blue-500/20 shadow-[0_0_10px_rgba(59,130,246,0.1)] flex items-center gap-1.5"><Loader2 className="w-3.5 h-3.5 animate-spin"/> Checking</span>}
                    </div>
                  </div>
                  {token.error && (
                    <div className="mt-4 text-sm text-rose-300 bg-rose-500/10 px-4 py-3 rounded-xl border border-rose-500/20 flex items-start gap-2 relative z-10">
                      <XCircle className="w-4 h-4 mt-0.5 shrink-0" />
                      <span>{token.error}</span>
                    </div>
                  )}
                  {token.checkResult && (
                    <div className="mt-5 pt-5 border-t border-slate-800/60 flex flex-wrap gap-4 text-sm font-medium relative z-10">
                      <span className="text-slate-200 font-bold bg-[#1a2133] px-3 py-1.5 rounded-lg border border-slate-700/50 shadow-sm">@{token.checkResult.user?.username}</span>
                      {token.checkResult.accountAge && <span className="text-slate-300 flex items-center gap-1.5 bg-[#151924] px-3 py-1.5 rounded-lg border border-slate-700/50 hover:bg-slate-800 transition-colors cursor-default"><Clock className="w-4 h-4 text-slate-400"/> {token.checkResult.accountAge}</span>}
                      {token.checkResult.hasNitro && <span className="text-fuchsia-300 flex items-center gap-1.5 bg-fuchsia-500/15 px-3 py-1.5 rounded-lg border border-fuchsia-500/20 shadow-[0_0_10px_rgba(217,70,239,0.1)]"><Gift className="w-4 h-4 text-fuchsia-400"/> Nitro</span>}
                      {token.checkResult.phoneVerified && <span className="text-blue-300 flex items-center gap-1.5 bg-blue-500/15 px-3 py-1.5 rounded-lg border border-blue-500/20 shadow-[0_0_10px_rgba(59,130,246,0.1)]"><Search className="w-4 h-4 text-blue-400"/> Phone</span>}
                      {token.checkResult.emailVerified && <span className="text-emerald-300 flex items-center gap-1.5 bg-emerald-500/15 px-3 py-1.5 rounded-lg border border-emerald-500/20 shadow-[0_0_10px_rgba(16,185,129,0.1)]"><CheckCircle2 className="w-4 h-4 text-emerald-400"/> Email</span>}
                      {token.checkResult.hasAvatar && <span className="text-indigo-300 flex items-center gap-1.5 bg-indigo-500/15 px-3 py-1.5 rounded-lg border border-indigo-500/20 shadow-[0_0_10px_rgba(99,102,241,0.1)]"><Fingerprint className="w-4 h-4 text-indigo-400"/> Avatar</span>}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

interface DiscordQuest {
  id: string;
  name: string;
  description: string;
  gameName: string;
  enrolled: boolean;
  completed: boolean;
  claimed: boolean;
  expiresAt: string | null;
  selected: boolean;
}

interface QuestTokenResult {
  email: string;
  originalLine: string;
  token: string;
  tokenHash: string;
  status: "pending" | "validating" | "valid" | "invalid" | "running" | "success" | "error";
  username?: string;
  error?: string;
  questResults?: Record<string, { status: "pending" | "running" | "success" | "error"; error?: string }>;
}

function QuestView({ onBack }: { onBack: () => void }) {
  const [tokenInput, setTokenInput] = useState("");
  const [tokens, setTokens] = useState<QuestTokenResult[]>([]);
  const [validating, setValidating] = useState(false);
  const [running, setRunning] = useState(false);
  const [operation, setOperation] = useState<"COMPLETE_QUEST" | "CLAIM_QUEST">("COMPLETE_QUEST");

  // Quest fetching
  const [quests, setQuests] = useState<DiscordQuest[]>([]);
  const [fetchingQuests, setFetchingQuests] = useState(false);
  const [questsFetched, setQuestsFetched] = useState(false);
  const [questCount, setQuestCount] = useState("");
  const [questError, setQuestError] = useState("");

  const validTokens = useMemo(() => tokens.filter(t => t.status === "valid" || t.status === "success"), [tokens]);
  const selectedQuests = useMemo(() => quests.filter(q => q.selected && !q.completed), [quests]);

  const handleValidate = async () => {
    if (!tokenInput.trim()) return;
    setValidating(true);

    const lines = tokenInput.split("\n").map(l => l.trim()).filter(l => l);
    if (lines.length === 0) {
      setValidating(false);
      return;
    }

    const initialTokens: QuestTokenResult[] = lines.map(line => {
      const parts = line.split(":");
      let email = "Unknown";
      let token = line;
      if (parts.length >= 3) {
        email = parts[0];
        token = parts[parts.length - 1];
      }
      return { email, originalLine: line, token, tokenHash: "", status: "validating" as const };
    });

    setTokens(initialTokens);

    let firstValidToken: string | null = null;

    await Promise.all(
      initialTokens.map(async (tokenObj, idx) => {
        try {
          const response = await fetch("/api/validate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ token: tokenObj.originalLine }),
          });
          const data = await response.json();
          setTokens(prev => {
            const updated = [...prev];
            if (data.success && data.data?.status !== "error") {
              updated[idx] = {
                ...updated[idx],
                tokenHash: data.data?.tokenHash || "",
                status: "valid",
                username: data.data?.result?.user?.username,
              };
              if (!firstValidToken) firstValidToken = tokenObj.token;
            } else {
              updated[idx] = {
                ...updated[idx],
                status: "invalid",
                error: data.error || data.data?.error || "Invalid token",
              };
            }
            return updated;
          });
        } catch {
          setTokens(prev => {
            const updated = [...prev];
            updated[idx] = { ...updated[idx], status: "invalid", error: "Validation failed" };
            return updated;
          });
        }
      })
    );

    setValidating(false);

    // Auto-fetch quests using the first valid token
    // We need to re-read tokens from the latest state
    const firstValid = initialTokens.find((_, idx) => {
      // Check if this token ended up valid - we need to use the token string directly
      return true;
    });
    // Use a small delay to let state settle, then fetch quests
    setTimeout(() => fetchQuests(), 500);
  };

  const fetchQuests = async () => {
    setFetchingQuests(true);
    setQuestError("");
    // Extract token from tokenInput
    const lines = tokenInput.split("\n").map(l => l.trim()).filter(l => l);
    let tokenToUse = "";
    for (const line of lines) {
      const parts = line.split(":");
      tokenToUse = parts.length >= 3 ? parts[parts.length - 1] : line;
      if (tokenToUse.length > 30) break;
    }

    if (!tokenToUse) {
      setFetchingQuests(false);
      setQuestError("No valid token found");
      setQuestsFetched(true);
      return;
    }

    try {
      const response = await fetch("/api/quests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: tokenToUse }),
      });
      const data = await response.json();
      if (data.success && data.data?.quests) {
        setQuests(data.data.quests.map((q: any) => ({ ...q, selected: false })));
        if (data.data.error) {
          setQuestError(data.data.error);
        }
      } else {
        setQuestError(data.error || "Failed to fetch quests");
      }
    } catch (err) {
      setQuestError("Network error fetching quests");
    }
    setQuestsFetched(true);
    setFetchingQuests(false);
  };


  // When user types a quest count, auto-select that many quests
  const handleQuestCountChange = (val: string) => {
    setQuestCount(val);
    const count = parseInt(val) || 0;
    if (count > 0) {
      const availableQuests = quests.filter(q => !q.completed);
      setQuests(prev => prev.map((q, idx) => {
        if (q.completed) return { ...q, selected: false };
        const availableIdx = availableQuests.findIndex(aq => aq.id === q.id);
        return { ...q, selected: availableIdx >= 0 && availableIdx < count };
      }));
    }
  };

  const toggleQuest = (questId: string) => {
    setQuests(prev => prev.map(q => q.id === questId ? { ...q, selected: !q.selected } : q));
    setQuestCount(""); // Clear the count field since user is manually selecting
  };

  const selectAll = () => {
    const allIncomplete = quests.filter(q => !q.completed);
    setQuests(prev => prev.map(q => q.completed ? q : { ...q, selected: true }));
    setQuestCount(String(allIncomplete.length));
  };

  const deselectAll = () => {
    setQuests(prev => prev.map(q => ({ ...q, selected: false })));
    setQuestCount("");
  };

  const handleRunQuests = async () => {
    if (selectedQuests.length === 0) return;
    const eligible = tokens.filter(t => t.status === "valid");
    if (eligible.length === 0) return;

    setRunning(true);

    // Mark eligible tokens as running and init quest results
    setTokens(prev => prev.map(t => {
      if (t.status !== "valid") return t;
      const questResults: Record<string, { status: "pending" | "running" | "success" | "error"; error?: string }> = {};
      selectedQuests.forEach(q => { questResults[q.id] = { status: "pending" }; });
      return { ...t, status: "running" as const, questResults };
    }));

    // For each token, run all selected quests sequentially
    await Promise.all(
      tokens.map(async (tokenObj, tokenIdx) => {
        if (tokenObj.status !== "valid" && tokenObj.status !== "running") return;

        let allSuccess = true;
        for (const quest of selectedQuests) {
          // Mark this quest as running for this token
          setTokens(prev => {
            const updated = [...prev];
            if (updated[tokenIdx].questResults) {
              updated[tokenIdx] = {
                ...updated[tokenIdx],
                questResults: {
                  ...updated[tokenIdx].questResults,
                  [quest.id]: { status: "running" },
                },
              };
            }
            return updated;
          });

          try {
            const response = await fetch("/api/execute", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                tokenHash: tokenObj.tokenHash,
                operation,
                questId: quest.id,
                token: tokenObj.token,
                email: tokenObj.email,
              }),
            });
            const data = await response.json();
            const success = data.success && data.data?.status === "success";
            if (!success) allSuccess = false;

            setTokens(prev => {
              const updated = [...prev];
              if (updated[tokenIdx].questResults) {
                updated[tokenIdx] = {
                  ...updated[tokenIdx],
                  questResults: {
                    ...updated[tokenIdx].questResults,
                    [quest.id]: {
                      status: success ? "success" : "error",
                      error: success ? undefined : (data.error || "Failed"),
                    },
                  },
                };
              }
              return updated;
            });
          } catch {
            allSuccess = false;
            setTokens(prev => {
              const updated = [...prev];
              if (updated[tokenIdx].questResults) {
                updated[tokenIdx] = {
                  ...updated[tokenIdx],
                  questResults: {
                    ...updated[tokenIdx].questResults,
                    [quest.id]: { status: "error", error: "Request failed" },
                  },
                };
              }
              return updated;
            });
          }
        }

        // Final status for token
        setTokens(prev => {
          const updated = [...prev];
          updated[tokenIdx] = {
            ...updated[tokenIdx],
            status: allSuccess ? "success" : "error",
            error: allSuccess ? undefined : "Some quests failed",
          };
          return updated;
        });
      })
    );

    setRunning(false);
  };

  const handleClear = () => {
    setTokens([]);
    setTokenInput("");
    setQuests([]);
    setQuestsFetched(false);
    setQuestCount("");
    setQuestError("");
  };

  const availableQuests = quests.filter(q => !q.completed);
  const completedQuests = quests.filter(q => q.completed);

  return (
    <div className="max-w-5xl mx-auto p-6 md:p-12">
      <button onClick={onBack} className="flex items-center gap-2 text-slate-400 hover:text-white mb-8 transition font-medium text-sm bg-[#151924] px-4 py-2 rounded-full border border-slate-800 hover:bg-slate-800 w-fit">
        <ArrowLeft className="w-4 h-4" /> Back to Dashboard
      </button>

      <div className="flex items-center gap-5 mb-10">
        <div className="w-14 h-14 rounded-2xl bg-purple-500/10 text-purple-400 flex items-center justify-center shadow-[0_0_15px_rgba(168,85,247,0.3)]">
          <Target className="w-7 h-7" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-white mb-1">Quest Tools</h1>
          <p className="text-slate-400 text-sm">Enroll and claim Discord quests automatically.</p>
        </div>
      </div>

      {/* Step 1: Token Input */}
      <div className="bg-[#151924] border border-slate-800 rounded-3xl p-8 mb-6 shadow-xl">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-8 h-8 rounded-full bg-purple-500/15 text-purple-400 flex items-center justify-center text-sm font-bold border border-purple-500/20">1</div>
          <h2 className="text-white font-bold text-lg">Paste Tokens</h2>
          {tokens.length > 0 && (
            <div className="ml-auto flex items-center gap-3 text-xs font-semibold">
              <span className="text-emerald-400 bg-emerald-500/10 px-3 py-1.5 rounded-full border border-emerald-500/20">{tokens.filter(t => t.status === "valid" || t.status === "success").length} Valid</span>
              <span className="text-rose-400 bg-rose-500/10 px-3 py-1.5 rounded-full border border-rose-500/20">{tokens.filter(t => t.status === "invalid").length} Invalid</span>
            </div>
          )}
        </div>
        <textarea
          value={tokenInput}
          onChange={e => setTokenInput(e.target.value)}
          placeholder="email:password:token (one per line)"
          disabled={tokens.length > 0}
          className="w-full h-36 bg-[#0b0e14] border border-slate-800 rounded-2xl px-5 py-4 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-purple-500/50 transition-all resize-none font-mono mb-5 disabled:opacity-50"
        />
        <div className="flex gap-3">
          <button
            onClick={handleValidate}
            disabled={validating || !tokenInput.trim() || tokens.length > 0}
            className="flex-1 bg-[#1e2536] hover:bg-[#252d43] border border-slate-700 disabled:opacity-50 text-slate-300 px-6 py-3.5 rounded-2xl font-semibold transition-all flex items-center justify-center gap-2 shadow-sm"
          >
            {validating ? <><Loader2 className="w-5 h-5 animate-spin" /> Validating...</> : <><ShieldCheck className="w-5 h-5" /> Validate Tokens</>}
          </button>
          {tokens.length > 0 && (
            <button
              onClick={handleClear}
              className="bg-[#1e2536] hover:bg-[#252d43] border border-slate-700 text-slate-400 hover:text-rose-400 px-5 py-3.5 rounded-2xl font-semibold transition-all flex items-center justify-center gap-2"
            >
              <RotateCcw className="w-4 h-4" /> Reset
            </button>
          )}
        </div>
      </div>

      {/* Step 2: Quest Selection - auto-fetched */}
      <div className={`bg-[#151924] border border-slate-800 rounded-3xl p-8 mb-6 shadow-xl transition-opacity ${validTokens.length === 0 && !fetchingQuests ? 'opacity-40 pointer-events-none' : ''}`}>
        <div className="flex items-center gap-3 mb-5">
          <div className="w-8 h-8 rounded-full bg-purple-500/15 text-purple-400 flex items-center justify-center text-sm font-bold border border-purple-500/20">2</div>
          <h2 className="text-white font-bold text-lg">Select Quests</h2>
          {fetchingQuests && <Loader2 className="w-4 h-4 animate-spin text-purple-400" />}
          {questsFetched && <span className="text-slate-500 text-xs">{availableQuests.length} available</span>}
        </div>

        {fetchingQuests && (
          <div className="flex items-center justify-center gap-3 py-8 text-slate-400 text-sm">
            <Loader2 className="w-5 h-5 animate-spin" />
            Fetching available quests...
          </div>
        )}

        {questsFetched && quests.length === 0 && (
          <div className="text-center py-8">
            <Target className="w-10 h-10 text-slate-700 mx-auto mb-3" />
            <p className="text-slate-500 text-sm mb-1">No quests available for this account.</p>
            {questError && (
              <p className="text-rose-400/70 text-xs mb-4">{questError}</p>
            )}
            <button
              onClick={fetchQuests}
              disabled={fetchingQuests}
              className="text-xs font-semibold text-purple-400 hover:text-purple-300 transition bg-purple-500/10 px-4 py-2 rounded-full border border-purple-500/20"
            >
              {fetchingQuests ? "Retrying..." : "Retry Fetch"}
            </button>
          </div>
        )}

        {questsFetched && quests.length > 0 && (
          <>
            {/* Quick select bar */}
            <div className="flex items-center gap-4 mb-5">
              <div className="flex items-center gap-2 bg-[#0b0e14] rounded-2xl px-4 py-3 border border-slate-800 flex-1">
                <span className="text-slate-400 text-sm font-medium whitespace-nowrap">Complete first</span>
                <input
                  type="number"
                  min={0}
                  max={availableQuests.length}
                  value={questCount}
                  onChange={e => handleQuestCountChange(e.target.value)}
                  placeholder={String(availableQuests.length)}
                  className="w-16 bg-transparent border border-slate-700 rounded-lg px-2 py-1.5 text-center text-white text-sm font-mono outline-none focus:border-purple-500/50"
                />
                <span className="text-slate-400 text-sm font-medium">quest{availableQuests.length !== 1 ? 's' : ''}</span>
              </div>
              <button onClick={selectAll} className="text-xs font-semibold text-purple-400 hover:text-purple-300 transition whitespace-nowrap">Select All</button>
              <button onClick={deselectAll} className="text-xs font-semibold text-slate-500 hover:text-slate-300 transition whitespace-nowrap">Clear</button>
            </div>

            {/* Quest list */}
            <div className="space-y-2 mb-6 max-h-80 overflow-y-auto pr-1 scrollbar-thin">
              {availableQuests.map((quest, idx) => (
                <button
                  key={quest.id}
                  onClick={() => toggleQuest(quest.id)}
                  className={`w-full text-left p-4 rounded-2xl border transition-all duration-200 flex items-center gap-4 group ${
                    quest.selected
                      ? 'bg-purple-500/10 border-purple-500/30 shadow-[0_0_15px_rgba(168,85,247,0.1)]'
                      : 'bg-[#0b0e14]/60 border-slate-800/80 hover:border-slate-700'
                  }`}
                >
                  <div className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center shrink-0 transition-all ${
                    quest.selected
                      ? 'bg-purple-500 border-purple-500 text-white'
                      : 'border-slate-600 group-hover:border-slate-500'
                  }`}>
                    {quest.selected && <CheckCircle2 className="w-4 h-4" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-white font-semibold text-sm truncate">{quest.name}</span>
                      {quest.gameName && (
                        <span className="text-slate-500 text-xs bg-slate-800/50 px-2 py-0.5 rounded-full border border-slate-700/50 shrink-0">{quest.gameName}</span>
                      )}
                    </div>
                    {quest.description && <p className="text-slate-500 text-xs mt-1 truncate">{quest.description}</p>}
                  </div>
                  <span className="text-slate-600 text-xs font-mono shrink-0">#{idx + 1}</span>
                </button>
              ))}

              {completedQuests.length > 0 && (
                <>
                  <div className="text-slate-600 text-xs font-semibold uppercase tracking-wider pt-3 pb-1 px-1">Already Completed</div>
                  {completedQuests.map(quest => (
                    <div key={quest.id} className="w-full text-left p-4 rounded-2xl border bg-[#0b0e14]/30 border-slate-800/50 flex items-center gap-4 opacity-50">
                      <div className="w-6 h-6 rounded-lg bg-emerald-500/20 border-2 border-emerald-500/30 flex items-center justify-center shrink-0">
                        <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <span className="text-slate-400 font-semibold text-sm truncate">{quest.name}</span>
                      </div>
                      <span className="text-emerald-500/50 text-xs font-bold">DONE</span>
                    </div>
                  ))}
                </>
              )}
            </div>

            {/* Operation toggle */}
            <div className="mb-6">
              <label className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-3 block">Operation</label>
              <div className="flex bg-[#0b0e14] rounded-full p-1 border border-slate-800/80 w-fit">
                <button
                  onClick={() => setOperation("COMPLETE_QUEST")}
                  className={`px-6 py-2.5 rounded-full transition-all text-sm font-semibold flex items-center gap-2 ${operation === "COMPLETE_QUEST" ? 'bg-[#1a2133] border border-[#2a3449] text-white shadow-sm' : 'text-slate-400 hover:text-slate-200 border border-transparent'}`}
                >
                  <Zap className="w-4 h-4" /> Complete Quest
                </button>
                <button
                  onClick={() => setOperation("CLAIM_QUEST")}
                  className={`px-6 py-2.5 rounded-full transition-all text-sm font-semibold flex items-center gap-2 ${operation === "CLAIM_QUEST" ? 'bg-[#1a2133] border border-[#2a3449] text-white shadow-sm' : 'text-slate-400 hover:text-slate-200 border border-transparent'}`}
                >
                  <Gift className="w-4 h-4" /> Complete & Claim
                </button>
              </div>
            </div>

            {/* Run button */}
            <button
              onClick={handleRunQuests}
              disabled={running || selectedQuests.length === 0 || validTokens.length === 0}
              className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 disabled:opacity-50 disabled:from-slate-700 disabled:to-slate-700 text-white px-6 py-4 rounded-2xl font-bold transition-all flex items-center justify-center gap-2.5 shadow-lg shadow-purple-500/20 text-sm"
            >
              {running ? (
                <><Loader2 className="w-5 h-5 animate-spin" /> Running {selectedQuests.length} quest{selectedQuests.length !== 1 ? 's' : ''} on {tokens.filter(t => t.status === "running").length} tokens...</>
              ) : (
                <><Target className="w-5 h-5" /> Run {selectedQuests.length} Quest{selectedQuests.length !== 1 ? 's' : ''} on {validTokens.length} Token{validTokens.length !== 1 ? 's' : ''}</>
              )}
            </button>
          </>
        )}
      </div>

      {/* Step 3: Results */}
      {tokens.length > 0 && (
        <div className="bg-[#151924] border border-slate-800 rounded-3xl p-8 shadow-xl">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-8 h-8 rounded-full bg-purple-500/15 text-purple-400 flex items-center justify-center text-sm font-bold border border-purple-500/20">3</div>
            <h2 className="text-white font-bold text-lg">Results</h2>
            <div className="ml-auto flex items-center gap-3 text-xs font-semibold">
              <span className="text-slate-300 bg-slate-700/30 px-3 py-1.5 rounded-full border border-slate-700/50">{tokens.length} Total</span>
              {tokens.filter(t => t.status === "success").length > 0 && <span className="text-emerald-400 bg-emerald-500/10 px-3 py-1.5 rounded-full border border-emerald-500/20 flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> {tokens.filter(t => t.status === "success").length}</span>}
              {tokens.filter(t => t.status === "error").length > 0 && <span className="text-rose-400 bg-rose-500/10 px-3 py-1.5 rounded-full border border-rose-500/20 flex items-center gap-1"><XCircle className="w-3 h-3" /> {tokens.filter(t => t.status === "error").length}</span>}
            </div>
          </div>

          <div className="space-y-3">
            {tokens.map((token, idx) => (
              <div key={idx} className="group p-4 rounded-2xl border bg-[#0b0e14]/60 backdrop-blur-md border-slate-800/80 hover:border-purple-500/30 hover:bg-[#0b0e14] transition-all duration-300 relative overflow-hidden">
                <div className={`absolute left-0 top-0 bottom-0 w-[3px] transition-opacity ${
                  token.status === 'success' ? 'bg-gradient-to-b from-emerald-400 to-emerald-600 opacity-100' :
                  token.status === 'error' || token.status === 'invalid' ? 'bg-gradient-to-b from-rose-400 to-rose-600 opacity-100' :
                  token.status === 'valid' ? 'bg-gradient-to-b from-blue-400 to-blue-600 opacity-100' :
                  token.status === 'running' ? 'bg-gradient-to-b from-purple-400 to-purple-600 opacity-100 animate-pulse' :
                  'opacity-0'
                }`}></div>
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-3">
                    <p className="font-semibold text-sm text-slate-200 font-mono">{token.email}</p>
                    {token.username && <span className="text-slate-400 text-xs bg-[#1a2133] px-2 py-1 rounded-lg border border-slate-700/50">@{token.username}</span>}
                  </div>
                  <div className="shrink-0">
                    {token.status === "validating" && <span className="text-blue-400 bg-blue-500/10 px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider border border-blue-500/20 flex items-center gap-1.5"><Loader2 className="w-3.5 h-3.5 animate-spin" /> Validating</span>}
                    {token.status === "valid" && <span className="text-blue-400 bg-blue-500/10 px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider border border-blue-500/20 flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5" /> Ready</span>}
                    {token.status === "invalid" && <span className="text-rose-400 bg-rose-500/10 px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider border border-rose-500/20 flex items-center gap-1.5"><XCircle className="w-3.5 h-3.5" /> Invalid</span>}
                    {token.status === "running" && <span className="text-purple-400 bg-purple-500/10 px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider border border-purple-500/20 flex items-center gap-1.5 animate-pulse"><Loader2 className="w-3.5 h-3.5 animate-spin" /> Running</span>}
                    {token.status === "success" && <span className="text-emerald-400 bg-emerald-500/10 px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider border border-emerald-500/20 shadow-[0_0_10px_rgba(16,185,129,0.1)] flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5" /> Done</span>}
                    {token.status === "error" && <span className="text-rose-400 bg-rose-500/10 px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider border border-rose-500/20 flex items-center gap-1.5"><XCircle className="w-3.5 h-3.5" /> Failed</span>}
                    {token.status === "pending" && <span className="text-slate-500 bg-slate-500/10 px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider border border-slate-500/20 flex items-center gap-1.5"><Clock className="w-3.5 h-3.5" /> Pending</span>}
                  </div>
                </div>
                {token.error && (
                  <div className="mt-3 text-xs text-rose-300 bg-rose-500/10 px-3 py-2 rounded-xl border border-rose-500/20 flex items-center gap-2">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    <span>{token.error}</span>
                  </div>
                )}
                {/* Per-quest results */}
                {token.questResults && Object.keys(token.questResults).length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {Object.entries(token.questResults).map(([qId, qResult]) => {
                      const questName = quests.find(q => q.id === qId)?.name || qId;
                      return (
                        <span key={qId} className={`text-xs px-2.5 py-1 rounded-lg border flex items-center gap-1.5 ${
                          qResult.status === "success" ? "text-emerald-300 bg-emerald-500/10 border-emerald-500/20" :
                          qResult.status === "error" ? "text-rose-300 bg-rose-500/10 border-rose-500/20" :
                          qResult.status === "running" ? "text-purple-300 bg-purple-500/10 border-purple-500/20 animate-pulse" :
                          "text-slate-400 bg-slate-500/10 border-slate-500/20"
                        }`}>
                          {qResult.status === "running" && <Loader2 className="w-3 h-3 animate-spin" />}
                          {qResult.status === "success" && <CheckCircle2 className="w-3 h-3" />}
                          {qResult.status === "error" && <XCircle className="w-3 h-3" />}
                          {questName}
                        </span>
                      );
                    })}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}


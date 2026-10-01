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
      <div className="flex items-center justify-center mb-12 gap-4">
        <div className="flex flex-wrap justify-center gap-3 text-[13px] font-semibold">
          <div className="flex items-center gap-3 bg-[#151924] px-4 py-2 rounded-full border border-slate-800">
            <span className="text-blue-400 font-bold flex items-center gap-1.5"><Fingerprint className="w-4 h-4"/> ayano</span>
            <span className="text-slate-300">0.4 USD</span>
            <button className="bg-emerald-500/10 text-emerald-400 px-3 py-1 rounded-full border border-emerald-500/30 hover:bg-emerald-500/20 transition">Deposit</button>
          </div>
          <button className="bg-[#151924] text-slate-300 px-5 py-2 rounded-full border border-slate-800 hover:bg-slate-800 transition flex items-center gap-2">
            Profile
          </button>
          <button className="bg-[#151924] text-slate-300 px-5 py-2 rounded-full border border-slate-800 hover:bg-slate-800 transition flex items-center gap-2">
            History
          </button>
          <button className="bg-[#151924] text-rose-400 px-5 py-2 rounded-full border border-slate-800 hover:bg-slate-800 transition flex items-center gap-2">
            Disconnect
          </button>
        </div>
      </div>

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

function QuestView({ onBack }: { onBack: () => void }) {
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
      <div className="bg-[#151924] border border-slate-800 rounded-3xl p-16 text-center shadow-xl">
        <Target className="w-16 h-16 text-slate-700 mx-auto mb-6" />
        <h2 className="text-xl text-white font-bold mb-3">Quest Automator</h2>
        <p className="text-slate-500 max-w-md mx-auto">This section is reserved for bulk Quest completing logic. Please check valid tokens first before proceeding to claim quests.</p>
      </div>
    </div>
  );
}

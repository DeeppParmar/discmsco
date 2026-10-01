"use client";

import React, { useState, useCallback, useMemo } from "react";
import { OperationType, AccountCheckResult, JobStatus, JobResult, ApiResponse } from "@/types";
import { CheckCircle2, XCircle, Clock, AlertCircle, ShieldCheck, Gift, Zap, Target, ChevronRight, Loader2, Trash2, ArrowLeft, Search, UserPlus, Fingerprint, Lock, ShieldAlert, KeyRound, RotateCcw } from "lucide-react";

interface TokenResult {
  hash: string;
  email: string;
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

  const validateToken = useCallback(async (tokenStr: string) => {
    try {
      const response = await fetch("/api/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: tokenStr }),
      });
      const data = (await response.json()) as ApiResponse<any>;
      if (!data.success) return { error: data.error };
      const jobId = data.data.jobId;
      const hash = data.data.tokenHash;

      const pollJob = setInterval(async () => {
        try {
          const statusResponse = await fetch(`/api/status?jobId=${jobId}`);
          const statusData = (await statusResponse.json()) as ApiResponse<JobResult>;
          if (statusData.success && statusData.data) {
            const jobResult = statusData.data;
            if (jobResult.status === JobStatus.SUCCESS || jobResult.status === JobStatus.FAILED) {
              clearInterval(pollJob);
              setTokens((prev) =>
                prev.map((t) =>
                  t.jobId === jobId
                    ? {
                        ...t,
                        status: jobResult.status === JobStatus.SUCCESS ? "ready" : "error",
                        checkResult: jobResult.result,
                        error: jobResult.error,
                      }
                    : t
                )
              );
            }
          }
        } catch (err) {}
      }, 1000);
      return { jobId, hash };
    } catch (error) {
      return { error: error instanceof Error ? error.message : "Unknown error" };
    }
  }, []);

  const handlePaste = async () => {
    setLoading(true);
    const lines = tokenInput.split("\n").map((l) => l.trim()).filter((l) => l && l.includes(":"));
    if (lines.length === 0) {
      alert("No valid token format found. Use: email:password:token");
      setLoading(false);
      return;
    }

    const newTokens: TokenResult[] = [];
    for (const line of lines) {
      const parts = line.split(":");
      if (parts.length >= 3) {
        const [email, password, token] = parts;
        const result = await validateToken(line);
        newTokens.push({
          hash: result.hash || "",
          email,
          jobId: result.jobId || "",
          status: result.error ? "error" : "pending",
          error: result.error,
        });
      }
    }
    setTokens(newTokens);
    setTokenInput("");
    setLoading(false);
  };

  const filteredTokens = useMemo(() => {
    return tokens.filter(t => {
      if (filterStatus !== "All") {
        if (filterStatus === "Valid" && t.status !== "ready") return false;
        if (filterStatus === "Error" && t.status === "ready") return false; // Error handles pending/error/validating
      }
      if (filterNitro && !t.checkResult?.hasNitro) return false;
      if (filterAvatar && !t.checkResult?.hasAvatar) return false;
      if (filterPhone && !t.checkResult?.phoneVerified) return false;
      return true;
    });
  }, [tokens, filterStatus, filterNitro, filterAvatar, filterPhone]);

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
          className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-slate-800 text-white disabled:text-slate-500 px-6 py-3.5 rounded-2xl font-semibold transition-all flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(37,99,235,0.2)] disabled:shadow-none"
        >
          {loading ? <><Loader2 className="w-5 h-5 animate-spin" /> Checking...</> : "Start Checking"}
        </button>
      </div>

      {/* Filter Bar mimicking user screenshot */}
      <div className="bg-[#151924] border border-slate-800 rounded-3xl p-8 mb-8 shadow-xl flex flex-col gap-6">
        <div className="flex flex-wrap items-center gap-6 text-sm font-semibold">
          <span className="text-slate-500 w-14 text-right">Status</span>
          <div className="flex flex-wrap bg-[#0b0e14] rounded-full p-1 border border-slate-800/80">
            {["All", "Valid", "Locked", "Invalid", "Error"].map(s => (
              <button 
                key={s}
                onClick={() => setFilterStatus(s)}
                className={`px-5 py-2 rounded-full transition-all ${filterStatus === s ? 'bg-slate-800 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'}`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
        
        <div className="flex flex-wrap items-center gap-4 mt-2 ml-[5.5rem]">
          <button onClick={() => setFilterNitro(!filterNitro)} className={`flex items-center gap-2 px-5 py-2.5 rounded-full border transition-all text-sm font-medium ${filterNitro ? 'bg-blue-500/20 border-blue-500/50 text-blue-400' : 'bg-[#0b0e14] border-slate-800 text-slate-400 hover:border-slate-700'}`}>
            <Gift className="w-4 h-4" /> Nitro
          </button>
          <button onClick={() => setFilterAvatar(!filterAvatar)} className={`flex items-center gap-2 px-5 py-2.5 rounded-full border transition-all text-sm font-medium ${filterAvatar ? 'bg-blue-500/20 border-blue-500/50 text-blue-400' : 'bg-[#0b0e14] border-slate-800 text-slate-400 hover:border-slate-700'}`}>
            <Fingerprint className="w-4 h-4" /> Avatar
          </button>
          <button onClick={() => setFilterPhone(!filterPhone)} className={`flex items-center gap-2 px-5 py-2.5 rounded-full border transition-all text-sm font-medium ${filterPhone ? 'bg-blue-500/20 border-blue-500/50 text-blue-400' : 'bg-[#0b0e14] border-slate-800 text-slate-400 hover:border-slate-700'}`}>
            <Search className="w-4 h-4" /> Phone
          </button>
        </div>
      </div>

      {tokens.length > 0 && (
        <div className="bg-[#151924] border border-slate-800 rounded-3xl p-8 shadow-xl">
          <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-3">
            Results 
            <span className="bg-[#0b0e14] text-slate-400 px-3 py-1 rounded-full text-sm border border-slate-800">{filteredTokens.length}</span>
          </h2>
          <div className="space-y-4">
            {filteredTokens.map((token, idx) => (
              <div key={idx} className="p-5 rounded-2xl border bg-[#0b0e14] border-slate-800/80 hover:border-slate-700 transition-colors">
                <div className="flex justify-between items-center">
                  <div>
                    <p className="font-semibold text-[15px] text-slate-200">{token.email}</p>
                  </div>
                  <div className="shrink-0 flex items-center gap-3">
                     {token.status === "ready" ? <span className="bg-emerald-500/10 text-emerald-400 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide border border-emerald-500/20 flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5"/> Valid</span> :
                     token.status === "error" ? <span className="bg-rose-500/10 text-rose-400 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide border border-rose-500/20 flex items-center gap-1.5"><XCircle className="w-3.5 h-3.5"/> Error</span> :
                     <span className="bg-blue-500/10 text-blue-400 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide border border-blue-500/20 flex items-center gap-1.5"><Loader2 className="w-3.5 h-3.5 animate-spin"/> Checking</span>}
                  </div>
                </div>
                {token.error && (
                  <div className="mt-4 text-sm text-rose-400 bg-rose-500/10 px-4 py-3 rounded-xl border border-rose-500/20">
                    {token.error}
                  </div>
                )}
                {token.checkResult && (
                  <div className="mt-5 pt-5 border-t border-slate-800/80 flex flex-wrap gap-4 text-sm font-medium">
                    <span className="text-slate-300 font-bold">@{token.checkResult.user?.username}</span>
                    {token.checkResult.hasNitro && <span className="text-fuchsia-400 flex items-center gap-1.5 bg-fuchsia-500/10 px-2.5 py-1 rounded-lg"><Gift className="w-4 h-4"/> Nitro</span>}
                    {token.checkResult.phoneVerified && <span className="text-blue-400 flex items-center gap-1.5 bg-blue-500/10 px-2.5 py-1 rounded-lg"><span className="w-4 h-4 flex items-center justify-center border border-blue-400 rounded text-[10px] font-bold">P</span> Phone</span>}
                    {token.checkResult.hasAvatar && <span className="text-indigo-400 flex items-center gap-1.5 bg-indigo-500/10 px-2.5 py-1 rounded-lg"><span className="w-4 h-4 flex items-center justify-center border border-indigo-400 rounded-full text-[10px] font-bold">A</span> Avatar</span>}
                    {token.checkResult.accountAge && <span className="text-slate-400 flex items-center gap-1.5 bg-slate-800 px-2.5 py-1 rounded-lg"><Clock className="w-4 h-4"/> {token.checkResult.accountAge}</span>}
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

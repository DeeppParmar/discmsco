"use client";

import React, { useState, useCallback } from "react";
import {
  OperationType,
  AccountCheckResult,
  JobStatus,
  JobResult,
  ApiResponse,
} from "@/types";
import { 
  CheckCircle2, 
  XCircle, 
  Clock, 
  AlertCircle,
  ShieldCheck,
  Gift,
  Zap,
  Target,
  ChevronRight,
  Loader2,
  Trash2
} from "lucide-react";

interface TokenResult {
  hash: string;
  email: string;
  jobId: string;
  status: "pending" | "validating" | "ready" | "error";
  checkResult?: AccountCheckResult;
  error?: string;
}

interface ProcessingJob {
  jobId: string;
  tokenHash: string;
  operation: OperationType;
  status: JobStatus;
  progress: number;
  result?: any;
  error?: string;
}

export default function DiscordDashboard() {
  const [tokenInput, setTokenInput] = useState("");
  const [tokens, setTokens] = useState<TokenResult[]>([]);
  const [processing, setProcessing] = useState<ProcessingJob[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedToken, setSelectedToken] = useState<TokenResult | null>(null);

  const validateToken = useCallback(async (tokenStr: string) => {
    setLoading(true);
    try {
      const response = await fetch("/api/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: tokenStr }),
      });

      const data = (await response.json()) as ApiResponse<any>;

      if (!data.success) {
        return { error: data.error };
      }

      const jobId = data.data.jobId;
      const hash = data.data.tokenHash;

      const pollJob = setInterval(async () => {
        try {
          const statusResponse = await fetch(`/api/status?jobId=${jobId}`);
          const statusData = (await statusResponse.json()) as ApiResponse<JobResult>;

          if (statusData.success && statusData.data) {
            const jobResult = statusData.data;

            if (
              jobResult.status === JobStatus.SUCCESS ||
              jobResult.status === JobStatus.FAILED
            ) {
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
              
              setTokens(currentTokens => {
                const updatedToken = currentTokens.find(t => t.jobId === jobId);
                if (updatedToken && updatedToken.status === "ready") {
                  setSelectedToken(current => current ? current : updatedToken);
                }
                return currentTokens;
              });
            }
          }
        } catch (err) {
          console.error("Polling error", err);
        }
      }, 1000);

      return { jobId, hash };
    } catch (error) {
      return {
        error: error instanceof Error ? error.message : "Unknown error",
      };
    } finally {
      setLoading(false);
    }
  }, []);

  const handlePaste = async () => {
    const lines = tokenInput
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l && l.includes(":"));

    if (lines.length === 0) {
      alert("No valid token format found. Use: email:password:token");
      return;
    }

    setTokens([]);
    setSelectedToken(null);
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
  };

  const executeOperation = async (
    token: TokenResult,
    operation: OperationType,
    questId?: string
  ) => {
    if (!selectedToken) return;

    try {
      const response = await fetch("/api/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tokenHash: token.hash,
          operation,
          questId,
          token: token.email,
          email: token.email,
        }),
      });

      const data = (await response.json()) as ApiResponse<any>;

      if (!data.success) {
        alert(`Error: ${data.error}`);
        return;
      }

      const jobId = data.data.jobId;

      setProcessing((prev) => [
        {
          jobId,
          tokenHash: token.hash,
          operation,
          status: JobStatus.PENDING,
          progress: 0,
        },
        ...prev,
      ]);

      const pollJob = setInterval(async () => {
        try {
          const statusResponse = await fetch(`/api/status?jobId=${jobId}`);
          const statusData = (await statusResponse.json()) as ApiResponse<JobResult>;

          if (statusData.success && statusData.data) {
            const jobResult = statusData.data;

            setProcessing((prev) =>
              prev.map((p) =>
                p.jobId === jobId
                  ? {
                      ...p,
                      status: jobResult.status,
                      progress: jobResult.progress || p.progress,
                      result: jobResult.result,
                      error: jobResult.error,
                    }
                  : p
              )
            );

            if (
              jobResult.status === JobStatus.SUCCESS ||
              jobResult.status === JobStatus.FAILED
            ) {
              clearInterval(pollJob);
            }
          }
        } catch (err) {
          console.error("Polling error", err);
        }
      }, 1000);
    } catch (error) {
      alert(
        `Error executing operation: ${error instanceof Error ? error.message : "Unknown"}`
      );
    }
  };

  const StatusIcon = ({ status }: { status: TokenResult["status"] }) => {
    switch (status) {
      case "ready":
        return <CheckCircle2 className="w-5 h-5 text-emerald-500" />;
      case "error":
        return <XCircle className="w-5 h-5 text-rose-500" />;
      case "validating":
      case "pending":
        return <Loader2 className="w-5 h-5 text-zinc-500 animate-spin" />;
    }
  };

  return (
    <div className="min-h-screen bg-black text-zinc-100 selection:bg-indigo-500/30 font-sans">
      <div className="max-w-6xl mx-auto p-6 md:p-12">
        <div className="mb-12">
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight mb-3 flex items-center gap-3">
            <Zap className="w-8 h-8 text-indigo-500" />
            Discord Multi-Tool
          </h1>
          <p className="text-zinc-400 max-w-2xl text-lg">
            A minimal, serverless interface to validate and manage your Discord accounts with precision.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          <div className="lg:col-span-5 space-y-8">
            <div className="bg-zinc-900/50 border border-zinc-800/80 rounded-2xl p-6 shadow-sm backdrop-blur-sm">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold tracking-tight">Add Accounts</h2>
              </div>
              <textarea
                value={tokenInput}
                onChange={(e) => setTokenInput(e.target.value)}
                placeholder="email:password:token"
                className="w-full h-32 bg-zinc-950/50 border border-zinc-800 rounded-xl px-4 py-3 text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 transition-all resize-none font-mono"
              />
              <button
                onClick={handlePaste}
                disabled={loading || !tokenInput.trim()}
                className="w-full mt-4 bg-zinc-100 text-zinc-900 hover:bg-white disabled:bg-zinc-800 disabled:text-zinc-500 px-6 py-2.5 rounded-xl font-medium transition-all duration-200 flex items-center justify-center gap-2 shadow-sm"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Validating...
                  </>
                ) : (
                  "Validate Tokens"
                )}
              </button>
            </div>

            <div className="bg-zinc-900/50 border border-zinc-800/80 rounded-2xl p-6 shadow-sm backdrop-blur-sm flex flex-col h-[500px]">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-semibold tracking-tight flex items-center gap-2">
                  Accounts
                  <span className="bg-zinc-800 text-zinc-400 text-xs py-0.5 px-2 rounded-full font-mono">
                    {tokens.length}
                  </span>
                </h2>
              </div>

              {tokens.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center text-zinc-500 space-y-4">
                  <AlertCircle className="w-8 h-8 opacity-50" />
                  <p className="text-sm">No accounts added yet</p>
                </div>
              ) : (
                <div className="space-y-3 overflow-y-auto pr-2 custom-scrollbar flex-1">
                  {tokens.map((token) => (
                    <div
                      key={token.jobId}
                      onClick={() => setSelectedToken(token)}
                      className={`group p-4 rounded-xl cursor-pointer transition-all duration-200 border ${
                        selectedToken?.jobId === token.jobId
                          ? "bg-indigo-500/10 border-indigo-500/30 shadow-[0_0_15px_rgba(99,102,241,0.1)]"
                          : "bg-zinc-950/50 border-zinc-800/80 hover:bg-zinc-800/50 hover:border-zinc-700"
                      }`}
                    >
                      <div className="flex justify-between items-start">
                        <div className="flex-1 min-w-0 pr-4">
                          <p className={`font-medium text-sm truncate ${selectedToken?.jobId === token.jobId ? 'text-indigo-300' : 'text-zinc-200'}`}>
                            {token.email}
                          </p>
                          <p className="text-xs text-zinc-500 font-mono mt-1 truncate">
                            {token.jobId.slice(0, 12)}...
                          </p>
                        </div>
                        <div className="shrink-0 mt-0.5">
                           <StatusIcon status={token.status} />
                        </div>
                      </div>

                      {token.error && (
                        <div className="mt-3 text-xs text-rose-400 bg-rose-500/10 px-3 py-2 rounded-lg border border-rose-500/20">
                          {token.error}
                        </div>
                      )}

                      {token.checkResult && (
                        <div className="mt-4 pt-4 border-t border-zinc-800/50 grid grid-cols-2 gap-2 text-xs">
                          <div className="flex items-center gap-1.5 text-zinc-400">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                            {token.checkResult.user?.username || "Unknown"}
                          </div>
                          {token.checkResult.hasNitro && (
                            <div className="flex items-center gap-1.5 text-fuchsia-400">
                              <Gift className="w-3.5 h-3.5" />
                              Nitro
                            </div>
                          )}
                          {token.checkResult.phoneVerified && (
                            <div className="flex items-center gap-1.5 text-blue-400">
                              <span className="w-3.5 h-3.5 flex items-center justify-center border border-blue-400 rounded text-[9px] font-bold">P</span>
                              Phone
                            </div>
                          )}
                          {token.checkResult.hasAvatar && (
                            <div className="flex items-center gap-1.5 text-indigo-400">
                              <span className="w-3.5 h-3.5 flex items-center justify-center border border-indigo-400 rounded-full text-[9px] font-bold">A</span>
                              Avatar
                            </div>
                          )}
                          {token.checkResult.accountAge && (
                            <div className="flex items-center gap-1.5 text-zinc-400 col-span-2">
                              <Clock className="w-3.5 h-3.5" />
                              Age: {token.checkResult.accountAge}
                            </div>
                          )}
                          {token.checkResult.isFlagged && (
                            <div className="flex items-center gap-1.5 text-rose-400 col-span-2 mt-1">
                              <AlertCircle className="w-3.5 h-3.5" />
                              Account Flagged
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="lg:col-span-7 space-y-8">
            
            <div className="bg-zinc-900/50 border border-zinc-800/80 rounded-2xl p-6 shadow-sm backdrop-blur-sm min-h-[220px] relative overflow-hidden">
              {!selectedToken ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center text-zinc-500 bg-zinc-950/40 backdrop-blur-[2px] z-10 rounded-2xl">
                  <ShieldCheck className="w-10 h-10 mb-3 opacity-20" />
                  <p className="text-sm">Select an account to view operations</p>
                </div>
              ) : selectedToken.status !== "ready" ? (
                 <div className="absolute inset-0 flex flex-col items-center justify-center text-zinc-500 bg-zinc-950/40 backdrop-blur-[2px] z-10 rounded-2xl">
                  <Clock className="w-10 h-10 mb-3 opacity-20" />
                  <p className="text-sm">Account is not ready for operations</p>
                </div>
              ) : null}

              <h2 className="text-lg font-semibold tracking-tight mb-6 flex items-center justify-between">
                <span>Operations</span>
                {selectedToken && (
                  <span className="text-xs font-mono text-indigo-400 bg-indigo-500/10 px-2.5 py-1 rounded-full border border-indigo-500/20">
                    {selectedToken.email}
                  </span>
                )}
              </h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  onClick={() => executeOperation(selectedToken!, OperationType.CHECK)}
                  className="flex items-center justify-between p-4 bg-zinc-950 border border-zinc-800 rounded-xl hover:bg-zinc-800 hover:border-zinc-700 transition-all text-sm group"
                >
                  <span className="flex items-center gap-3 text-zinc-300 group-hover:text-white transition-colors">
                    <ShieldCheck className="w-4 h-4 text-zinc-500 group-hover:text-emerald-400 transition-colors" />
                    Check Account
                  </span>
                  <ChevronRight className="w-4 h-4 text-zinc-600 group-hover:text-zinc-400" />
                </button>

                <button
                  onClick={() => executeOperation(selectedToken!, OperationType.CHECK_NITRO)}
                  className="flex items-center justify-between p-4 bg-zinc-950 border border-zinc-800 rounded-xl hover:bg-zinc-800 hover:border-zinc-700 transition-all text-sm group"
                >
                  <span className="flex items-center gap-3 text-zinc-300 group-hover:text-white transition-colors">
                    <Gift className="w-4 h-4 text-zinc-500 group-hover:text-fuchsia-400 transition-colors" />
                    Check Nitro
                  </span>
                  <ChevronRight className="w-4 h-4 text-zinc-600 group-hover:text-zinc-400" />
                </button>

                <button
                  onClick={() => {
                    const questId = prompt("Enter Quest ID to complete:");
                    if (questId) executeOperation(selectedToken!, OperationType.COMPLETE_QUEST, questId);
                  }}
                  className="flex items-center justify-between p-4 bg-zinc-950 border border-zinc-800 rounded-xl hover:bg-zinc-800 hover:border-zinc-700 transition-all text-sm group"
                >
                  <span className="flex items-center gap-3 text-zinc-300 group-hover:text-white transition-colors">
                    <Target className="w-4 h-4 text-zinc-500 group-hover:text-blue-400 transition-colors" />
                    Complete Quest
                  </span>
                  <ChevronRight className="w-4 h-4 text-zinc-600 group-hover:text-zinc-400" />
                </button>

                <button
                  onClick={() => {
                    const questId = prompt("Enter Quest ID to claim:");
                    if (questId) executeOperation(selectedToken!, OperationType.CLAIM_QUEST, questId);
                  }}
                  className="flex items-center justify-between p-4 bg-zinc-950 border border-zinc-800 rounded-xl hover:bg-zinc-800 hover:border-zinc-700 transition-all text-sm group"
                >
                  <span className="flex items-center gap-3 text-zinc-300 group-hover:text-white transition-colors">
                    <Zap className="w-4 h-4 text-zinc-500 group-hover:text-amber-400 transition-colors" />
                    Claim Quest
                  </span>
                  <ChevronRight className="w-4 h-4 text-zinc-600 group-hover:text-zinc-400" />
                </button>
              </div>
            </div>

            <div className="bg-zinc-900/50 border border-zinc-800/80 rounded-2xl p-6 shadow-sm backdrop-blur-sm h-[430px] flex flex-col">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-semibold tracking-tight flex items-center gap-2">
                  Activity Log
                </h2>
                {processing.length > 0 && (
                   <button 
                     onClick={() => setProcessing([])} 
                     className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors flex items-center gap-1"
                   >
                     <Trash2 className="w-3 h-3" /> Clear
                   </button>
                )}
              </div>

              {processing.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center text-zinc-600 space-y-4">
                  <Clock className="w-8 h-8 opacity-30" />
                  <p className="text-sm">No recent activity</p>
                </div>
              ) : (
                <div className="space-y-4 overflow-y-auto pr-2 custom-scrollbar flex-1">
                  {processing.map((job) => (
                    <div key={job.jobId} className="bg-zinc-950/80 border border-zinc-800/50 rounded-xl p-4">
                      <div className="flex justify-between items-start mb-4">
                        <div className="flex items-center gap-3">
                           {job.status === JobStatus.SUCCESS ? (
                             <div className="w-8 h-8 rounded-full bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20">
                               <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                             </div>
                           ) : job.status === JobStatus.FAILED ? (
                             <div className="w-8 h-8 rounded-full bg-rose-500/10 flex items-center justify-center border border-rose-500/20">
                               <XCircle className="w-4 h-4 text-rose-400" />
                             </div>
                           ) : (
                             <div className="w-8 h-8 rounded-full bg-indigo-500/10 flex items-center justify-center border border-indigo-500/20">
                               <Loader2 className="w-4 h-4 text-indigo-400 animate-spin" />
                             </div>
                           )}
                           
                          <div>
                            <p className="font-medium text-sm text-zinc-200 capitalize">
                              {job.operation.replace('_', ' ').toLowerCase()}
                            </p>
                            <p className="text-xs text-zinc-500 font-mono mt-0.5">
                              {job.jobId.slice(0, 18)}...
                            </p>
                          </div>
                        </div>
                        <span className={`text-[10px] uppercase font-bold tracking-wider px-2.5 py-1 rounded-full ${
                          job.status === JobStatus.SUCCESS ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" :
                          job.status === JobStatus.FAILED ? "bg-rose-500/10 text-rose-400 border border-rose-500/20" :
                          "bg-indigo-500/10 text-indigo-400 border border-indigo-500/20"
                        }`}>
                          {job.status}
                        </span>
                      </div>

                      {(job.status === JobStatus.RUNNING || job.status === JobStatus.PENDING) && (
                        <div className="w-full bg-zinc-900 rounded-full h-1.5 mb-2 overflow-hidden">
                          <div
                            className="bg-indigo-500 h-full rounded-full transition-all duration-500 ease-out relative"
                            style={{ width: `${job.progress || 5}%` }}
                          >
                             <div className="absolute top-0 right-0 bottom-0 left-0 bg-white/20 animate-pulse"></div>
                          </div>
                        </div>
                      )}

                      {job.error && (
                        <div className="mt-3 text-xs text-rose-400 bg-rose-500/10 border border-rose-500/20 px-3 py-2.5 rounded-lg">
                          {job.error}
                        </div>
                      )}

                      {job.result && job.status === JobStatus.SUCCESS && (
                        <div className="mt-3 text-[11px] bg-zinc-900 border border-zinc-800 rounded-lg p-3 text-zinc-300 font-mono">
                          <pre className="overflow-x-auto custom-scrollbar">
                            {JSON.stringify(job.result, null, 2)}
                          </pre>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
            
          </div>
        </div>
      </div>
    </div>
  );
}

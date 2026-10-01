// components/DiscordDashboard.tsx - Main dashboard component

"use client";

import React, { useState, useCallback, useEffect } from "react";
import {
  TokenStatus,
  OperationType,
  AccountCheckResult,
  JobStatus,
  JobResult,
  ApiResponse,
} from "@/types";

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

  // Validate single token
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
        return {
          error: data.error,
        };
      }

      const jobId = data.data.jobId;
      const hash = data.data.tokenHash;

      // Poll for job status
      const pollJob = setInterval(async () => {
        const statusResponse = await fetch(`/api/status?jobId=${jobId}`);
        const statusData = (await statusResponse.json()) as ApiResponse<JobResult>;

        if (statusData.success) {
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
          }
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

  // Parse and validate batch
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

  // Execute operation
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
          token: token.email, // Use email as placeholder (actual token stored in session)
          email: token.email,
        }),
      });

      const data = (await response.json()) as ApiResponse<any>;

      if (!data.success) {
        alert(`Error: ${data.error}`);
        return;
      }

      const jobId = data.data.jobId;

      // Add to processing queue
      setProcessing((prev) => [
        ...prev,
        {
          jobId,
          tokenHash: token.hash,
          operation,
          status: JobStatus.PENDING,
          progress: 0,
        },
      ]);

      // Poll for job completion
      const pollJob = setInterval(async () => {
        const statusResponse = await fetch(`/api/status?jobId=${jobId}`);
        const statusData = (await statusResponse.json()) as ApiResponse<JobResult>;

        if (statusData.success) {
          const jobResult = statusData.data;

          setProcessing((prev) =>
            prev.map((p) =>
              p.jobId === jobId
                ? {
                    ...p,
                    status: jobResult.status,
                    progress: jobResult.progress || 0,
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
      }, 1000);
    } catch (error) {
      alert(
        `Error executing operation: ${error instanceof Error ? error.message : "Unknown"}`
      );
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2">Discord Multi-Tool</h1>
          <p className="text-slate-400">
            Validate and manage Discord accounts with precision
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Token Input Section */}
          <div className="lg:col-span-1 space-y-4">
            <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
              <h2 className="text-xl font-semibold mb-4">Add Tokens</h2>
              <textarea
                value={tokenInput}
                onChange={(e) => setTokenInput(e.target.value)}
                placeholder="Paste tokens here&#10;Format: email:password:token&#10;One per line"
                className="w-full h-32 bg-slate-900 border border-slate-600 rounded px-4 py-2 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 resize-none"
              />
              <button
                onClick={handlePaste}
                disabled={loading}
                className="w-full mt-4 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-600 px-6 py-2 rounded font-medium transition"
              >
                {loading ? "Validating..." : "Validate Tokens"}
              </button>
            </div>
          </div>

          {/* Tokens List */}
          <div className="lg:col-span-2">
            <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
              <h2 className="text-xl font-semibold mb-4">
                Tokens ({tokens.length})
              </h2>

              {tokens.length === 0 ? (
                <p className="text-slate-400 text-center py-8">
                  No tokens added yet
                </p>
              ) : (
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {tokens.map((token) => (
                    <div
                      key={token.jobId}
                      onClick={() => setSelectedToken(token)}
                      className={`p-4 rounded cursor-pointer transition border ${
                        selectedToken?.jobId === token.jobId
                          ? "bg-blue-900 border-blue-500"
                          : token.status === "ready"
                            ? "bg-green-900 border-green-600"
                            : token.status === "error"
                              ? "bg-red-900 border-red-600"
                              : "bg-slate-700 border-slate-600 hover:bg-slate-600"
                      }`}
                    >
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <p className="font-medium">{token.email}</p>
                          <p className="text-sm text-slate-400 truncate">
                            {token.jobId}
                          </p>
                        </div>
                        <span
                          className={`text-xs font-medium px-2 py-1 rounded ${
                            token.status === "ready"
                              ? "bg-green-600"
                              : token.status === "error"
                                ? "bg-red-600"
                                : "bg-yellow-600"
                          }`}
                        >
                          {token.status.toUpperCase()}
                        </span>
                      </div>

                      {token.error && (
                        <p className="text-sm text-red-300 mt-2">{token.error}</p>
                      )}

                      {token.checkResult && (
                        <div className="mt-3 text-sm space-y-1">
                          <p>
                            Status:{" "}
                            <span className="font-medium">
                              {token.checkResult.status}
                            </span>
                          </p>
                          {token.checkResult.user && (
                            <p>
                              Account: {token.checkResult.user.username}
                            </p>
                          )}
                          {token.checkResult.hasNitro && (
                            <p className="text-green-300">✓ Has Nitro</p>
                          )}
                          {token.checkResult.isFlagged && (
                            <p className="text-red-300">⚠️ Flagged</p>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Operations Section */}
        {selectedToken && selectedToken.status === "ready" && (
          <div className="mt-6 bg-slate-800 rounded-lg p-6 border border-slate-700">
            <h2 className="text-xl font-semibold mb-4">
              Operations for {selectedToken.email}
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <button
                onClick={() =>
                  executeOperation(selectedToken, OperationType.CHECK)
                }
                className="bg-blue-600 hover:bg-blue-700 px-6 py-3 rounded font-medium transition"
              >
                Check Account
              </button>

              <button
                onClick={() => {
                  const questId = prompt("Enter Quest ID:");
                  if (questId) {
                    executeOperation(
                      selectedToken,
                      OperationType.COMPLETE_QUEST,
                      questId
                    );
                  }
                }}
                className="bg-purple-600 hover:bg-purple-700 px-6 py-3 rounded font-medium transition"
              >
                Complete Quest
              </button>

              <button
                onClick={() => {
                  const questId = prompt("Enter Quest ID:");
                  if (questId) {
                    executeOperation(
                      selectedToken,
                      OperationType.CLAIM_QUEST,
                      questId
                    );
                  }
                }}
                className="bg-indigo-600 hover:bg-indigo-700 px-6 py-3 rounded font-medium transition"
              >
                Claim Quest
              </button>

              <button
                onClick={() =>
                  executeOperation(selectedToken, OperationType.CHECK_NITRO)
                }
                className="bg-pink-600 hover:bg-pink-700 px-6 py-3 rounded font-medium transition"
              >
                Check Nitro
              </button>
            </div>
          </div>
        )}

        {/* Processing Jobs */}
        {processing.length > 0 && (
          <div className="mt-6 bg-slate-800 rounded-lg p-6 border border-slate-700">
            <h2 className="text-xl font-semibold mb-4">
              Processing ({processing.length})
            </h2>

            <div className="space-y-4">
              {processing.map((job) => (
                <div key={job.jobId} className="bg-slate-700 rounded p-4">
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <p className="font-medium">{job.operation}</p>
                      <p className="text-sm text-slate-400">
                        {job.jobId}
                      </p>
                    </div>
                    <span
                      className={`text-xs font-medium px-2 py-1 rounded ${
                        job.status === JobStatus.SUCCESS
                          ? "bg-green-600"
                          : job.status === JobStatus.FAILED
                            ? "bg-red-600"
                            : "bg-yellow-600"
                      }`}
                    >
                      {job.status}
                    </span>
                  </div>

                  <div className="w-full bg-slate-600 rounded-full h-2">
                    <div
                      className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${job.progress}%` }}
                    />
                  </div>

                  {job.error && (
                    <p className="text-sm text-red-300 mt-2">{job.error}</p>
                  )}

                  {job.result && (
                    <div className="mt-3 text-sm bg-slate-600 rounded p-2">
                      <pre className="overflow-auto">
                        {JSON.stringify(job.result, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

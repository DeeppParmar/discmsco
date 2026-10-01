// lib/validation.ts - Token validation pipeline

import crypto from "crypto";
import { ParsedToken, TokenValidationResult, ValidationGate } from "@/types";

const DISCORD_TOKEN_PATTERN = /^[A-Za-z0-9_-]{68,72}$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PASSWORD_MIN_LENGTH = 6;

export class ValidationError extends Error {
  constructor(
    public code: string,
    public gate: "format" | "structure" | "content",
    message: string
  ) {
    super(message);
    this.name = "ValidationError";
  }
}

export function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export function validateFormat(input: string): ValidationGate {
  const trimmed = input.trim();

  if (!trimmed) {
    return {
      passed: false,
      reason: "Input is empty",
      severity: "critical",
    };
  }

  if (!trimmed.includes(":")) {
    return {
      passed: false,
      reason: "Missing colon separators in format",
      severity: "critical",
    };
  }

  const parts = trimmed.split(":");
  if (parts.length < 3) {
    return {
      passed: false,
      reason: "Expected format: email:password:token",
      severity: "critical",
    };
  }

  if (parts.length > 3) {
    return {
      passed: false,
      reason: "Too many colons. Ensure token doesn't contain colons",
      severity: "critical",
    };
  }

  return {
    passed: true,
    severity: "info",
  };
}

export function validateStructure(input: string): ValidationGate {
  const parts = input.trim().split(":");
  const [email, password, token] = parts;

  // Email validation
  if (!email || email.length === 0) {
    return {
      passed: false,
      reason: "Email is empty",
      severity: "critical",
    };
  }

  if (!EMAIL_PATTERN.test(email)) {
    return {
      passed: false,
      reason: `Invalid email format: ${email}`,
      severity: "critical",
    };
  }

  if (email.length > 254) {
    return {
      passed: false,
      reason: "Email exceeds maximum length (254 chars)",
      severity: "critical",
    };
  }

  // Password validation
  if (!password || password.length === 0) {
    return {
      passed: false,
      reason: "Password is empty",
      severity: "critical",
    };
  }

  if (password.length < PASSWORD_MIN_LENGTH) {
    return {
      passed: false,
      reason: `Password too short (minimum ${PASSWORD_MIN_LENGTH} chars)`,
      severity: "critical",
    };
  }

  // Token validation
  if (!token || token.length === 0) {
    return {
      passed: false,
      reason: "Discord token is empty",
      severity: "critical",
    };
  }

  if (token.length < 68 || token.length > 72) {
    return {
      passed: false,
      reason: `Token length invalid: ${token.length} chars (expected 68-72)`,
      severity: "critical",
    };
  }

  if (!DISCORD_TOKEN_PATTERN.test(token)) {
    return {
      passed: false,
      reason: "Token contains invalid characters for Discord",
      severity: "critical",
    };
  }

  return {
    passed: true,
    severity: "info",
  };
}

export function validateContent(token: string): ValidationGate {
  // Discord tokens have structure: ID.TIMESTAMP.SIGNATURE
  // First two parts are base64url encoded

  const parts = token.split(".");
  if (parts.length !== 3) {
    return {
      passed: false,
      reason: "Token structure invalid (expected 3 dot-separated parts)",
      severity: "critical",
    };
  }

  const [userId, timestamp, signature] = parts;

  // Validate each part exists and has reasonable length
  if (userId.length < 5 || userId.length > 30) {
    return {
      passed: false,
      reason: "Token user ID segment invalid",
      severity: "critical",
    };
  }

  if (timestamp.length < 5 || timestamp.length > 30) {
    return {
      passed: false,
      reason: "Token timestamp segment invalid",
      severity: "critical",
    };
  }

  if (signature.length < 10 || signature.length > 40) {
    return {
      passed: false,
      reason: "Token signature segment invalid",
      severity: "critical",
    };
  }

  return {
    passed: true,
    severity: "info",
  };
}

export function parseToken(input: string): ParsedToken {
  const parts = input.trim().split(":");
  const [email, password, token] = parts;

  return {
    email: email.trim(),
    password: password.trim(),
    token: token.trim(),
    hash: hashToken(token.trim()),
  };
}

export function validateToken(input: string): TokenValidationResult {
  try {
    // Gate 1: Format
    const formatGate = validateFormat(input);
    if (!formatGate.passed) {
      return {
        isValid: false,
        error: formatGate.reason,
      };
    }

    // Gate 2: Structure
    const structureGate = validateStructure(input);
    if (!structureGate.passed) {
      return {
        isValid: false,
        error: structureGate.reason,
      };
    }

    // Gate 3: Content
    const parsed = parseToken(input);
    const contentGate = validateContent(parsed.token);
    if (!contentGate.passed) {
      return {
        isValid: false,
        error: contentGate.reason,
      };
    }

    return {
      isValid: true,
      format: parsed,
    };
  } catch (error) {
    return {
      isValid: false,
      error: error instanceof Error ? error.message : "Unknown validation error",
    };
  }
}

export function validateBatch(inputs: string[]): TokenValidationResult[] {
  return inputs.map((input) => validateToken(input));
}

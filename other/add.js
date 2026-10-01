// pages/api/v1/accounts/add.js - Add account with verification
import { AccountManager } from '../../../../lib/accountManager.js';

// Global instance (shared across requests)
let accountManager = null;

function getAccountManager() {
  if (!accountManager) {
    accountManager = new AccountManager({
      maxAccountsPerSession: 200,
      verifyOnAdd: true,
      enableHealthMonitoring: true,
      autoLockUnhealthy: true,
      healthThreshold: 40
    });
  }
  return accountManager;
}

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { email, password, token, skipVerification } = req.body;

  // Validate input
  if (!email || !password || !token) {
    return res.status(400).json({
      error: 'Missing required fields',
      required: ['email', 'password', 'token']
    });
  }

  // Validate email format
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: 'Invalid email format' });
  }

  // Validate token format (basic check)
  if (token.length < 20) {
    return res.status(400).json({ error: 'Invalid token format' });
  }

  try {
    const manager = getAccountManager();

    // Check if account already exists
    const existingAccounts = manager.getAllAccounts();
    if (existingAccounts.some(acc => acc.email === email)) {
      return res.status(409).json({
        error: 'Account already added',
        email
      });
    }

    // Add account with verification
    const result = await manager.addAccount(email, password, token);

    if (!result.success) {
      return res.status(400).json({
        error: result.error,
        type: 'VERIFICATION_FAILED'
      });
    }

    // Return detailed response
    return res.status(200).json({
      status: 'success',
      message: 'Account added and verified',
      account_id: result.account_id,
      profile: result.profile,
      stats: {
        totalAccounts: manager.accounts.size,
        healthyAccounts: manager.getHealthyAccounts().length,
        totalBoosts: manager.getHealthyAccounts().reduce((sum, acc) => sum + acc.boosts_remaining, 0)
      }
    });

  } catch (error) {
    console.error('Add account error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
}

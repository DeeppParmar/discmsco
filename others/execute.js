// pages/api/v1/boost/execute.js - Execute boost with orchestration
import { AccountManager } from '../../../../lib/accountManager.js';
import { BoostOrchestrator } from '../../../../lib/boostOrchestrator.js';

let accountManager = null;
let orchestrator = null;

function getManagers() {
  if (!accountManager) {
    accountManager = new AccountManager({
      maxAccountsPerSession: 200,
      enableHealthMonitoring: true
    });
  }
  if (!orchestrator) {
    orchestrator = new BoostOrchestrator(accountManager, {
      maxConcurrentSessions: 10,
      requestedBoostTimeout: 120000
    });
  }
  return { accountManager, orchestrator };
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { boost_count, server_link } = req.body;

  // Validate input
  if (!boost_count || !server_link) {
    return res.status(400).json({
      error: 'Missing required fields',
      required: ['boost_count', 'server_link']
    });
  }

  const boostCount = parseInt(boost_count);
  if (isNaN(boostCount) || boostCount < 1 || boostCount > 100) {
    return res.status(400).json({
      error: 'Invalid boost count',
      message: 'Boost count must be between 1 and 100'
    });
  }

  if (typeof server_link !== 'string' || server_link.length < 5) {
    return res.status(400).json({
      error: 'Invalid server link',
      message: 'Must be valid Discord invite (discord.gg/xxx)'
    });
  }

  try {
    const { accountManager: manager, orchestrator: boost } = getManagers();

    // Check account availability
    const healthyAccounts = manager.getHealthyAccounts(1);
    if (healthyAccounts.length === 0) {
      return res.status(400).json({
        error: 'No healthy accounts available',
        suggestion: 'Add verified accounts with active Nitro'
      });
    }

    if (healthyAccounts.length < boostCount) {
      console.warn(`Requested ${boostCount} boosts but only ${healthyAccounts.length} available`);
    }

    // Execute boost session
    const result = await boost.executeSession(server_link, boostCount);

    if (!result.success) {
      return res.status(400).json(result);
    }

    // Get session details
    const sessionStatus = boost.getSessionStatus(result.sessionId);

    return res.status(200).json({
      status: 'queued',
      sessionId: result.sessionId,
      message: result.message,
      session: {
        ...sessionStatus,
        inviteCode: server_link.includes('discord.gg/') 
          ? server_link.split('discord.gg/')[1].split(/[/?#]/)[0]
          : server_link
      },
      accounts: {
        total: manager.accounts.size,
        healthy: healthyAccounts.length,
        selected: result.selectedAccounts,
        totalBoosts: healthyAccounts.reduce((sum, acc) => sum + acc.boosts_remaining, 0)
      }
    });

  } catch (error) {
    console.error('Boost execution error:', error);
    return res.status(500).json({
      error: 'Boost execution failed',
      message: error.message,
      type: 'EXECUTION_ERROR'
    });
  }
}

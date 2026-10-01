// pages/api/v1/boost/execute.js - Execute boost with orchestration
import { getAccountManager, getBoostOrchestrator } from '../../../../lib/expertSingleton.js';

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

  let { boost_count, server_link, boost_mode, targets } = req.body;

  // Backward compatibility
  if (!targets) {
    if (!boost_count || !server_link) {
      return res.status(400).json({
        error: 'Missing required fields',
        required: ['boost_count', 'server_link']
      });
    }
    boost_mode = '2x';
    targets = [
      { server_link, boosts_per_account: parseInt(boost_count) }
    ];
  } else {
    // Validate new format
    if (!boost_mode || !['2x', '1x-split'].includes(boost_mode)) {
      return res.status(400).json({ error: 'Invalid boost_mode' });
    }
    if (!Array.isArray(targets) || targets.length === 0) {
      return res.status(400).json({ error: 'Invalid targets array' });
    }
  }

  try {
    const manager = getAccountManager();
    const boost = getBoostOrchestrator();

    const healthyAccounts = manager.getHealthyAccounts(1);
    if (healthyAccounts.length === 0) {
      return res.status(400).json({
        error: 'No healthy accounts available',
        suggestion: 'Add verified accounts with active Nitro'
      });
    }

    const results = [];
    let totalRequested = 0;

    for (const target of targets) {
      const count = parseInt(target.boosts_per_account);
      if (isNaN(count) || count < 1) {
        return res.status(400).json({ error: 'Invalid boosts_per_account' });
      }
      totalRequested += count;
    }

    if (healthyAccounts.length < totalRequested) {
      console.warn(`Requested ${totalRequested} boosts but only ${healthyAccounts.length} available`);
    }

    for (const target of targets) {
      const result = await boost.executeSession(target.server_link, parseInt(target.boosts_per_account));
      results.push({
        server_link: target.server_link,
        ...result,
        session: result.success ? boost.getSessionStatus(result.sessionId) : null
      });
    }

    const allSuccess = results.every(r => r.success);

    return res.status(allSuccess ? 200 : 207).json({
      status: allSuccess ? 'queued' : 'partial',
      mode: boost_mode,
      results,
      accounts: {
        total: manager.accounts.size,
        healthy: healthyAccounts.length,
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

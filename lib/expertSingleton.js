import { AccountManager } from './accountManager.js';
import { BoostOrchestrator } from './boostOrchestrator.js';

let accountManager = null;
let boostOrchestrator = null;

export function getAccountManager() {
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

export function getBoostOrchestrator() {
  if (!boostOrchestrator) {
    const am = getAccountManager();
    boostOrchestrator = new BoostOrchestrator(am, {
      maxConcurrentSessions: 10,
      requestedBoostTimeout: 120000
    });
  }
  return boostOrchestrator;
}

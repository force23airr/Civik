import Bull from 'bull';
import { registerEnrichmentProcessors } from './processors/enrichmentProcessor.js';
import { registerNotificationProcessors } from './processors/notificationProcessor.js';
import { setupOrchestrator } from './orchestrator.js';

let enrichmentQueue = null;
let notificationQueue = null;

export function getEnrichmentQueue() {
  return enrichmentQueue;
}

export function getNotificationQueue() {
  return notificationQueue;
}

export async function initQueues() {
  const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

  enrichmentQueue = new Bull('incident-enrichment', redisUrl, {
    defaultJobOptions: {
      attempts: 3,
      backoff: { type: 'exponential', delay: 2000 },
      removeOnComplete: 100,
      removeOnFail: 500
    }
  });

  notificationQueue = new Bull('notifications', redisUrl, {
    defaultJobOptions: {
      attempts: 2,
      backoff: { type: 'fixed', delay: 1000 },
      removeOnComplete: 50,
      removeOnFail: 100
    }
  });

  // Register processors
  registerEnrichmentProcessors(enrichmentQueue);
  registerNotificationProcessors(notificationQueue);

  // Set up job chaining
  setupOrchestrator(enrichmentQueue, notificationQueue);

  // Health check logging
  enrichmentQueue.on('error', (err) => console.error('[EnrichmentQueue] Error:', err.message));
  notificationQueue.on('error', (err) => console.error('[NotificationQueue] Error:', err.message));

  console.log('[Queues] Bull queues initialized');
}

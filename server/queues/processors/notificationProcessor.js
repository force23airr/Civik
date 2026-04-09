// Notification processor — stub for Phase 3 (Firebase FCM)
// Will be implemented when firebase-admin is integrated

export function registerNotificationProcessors(queue) {
  queue.process('incident-enriched', 1, async (job) => {
    // Phase 3: Look up user, send FCM push with enrichment summary
    const { incidentId, userId } = job.data;
    if (process.env.NODE_ENV !== 'production') {
      console.log(`[Notification] Would notify user ${userId} about enriched incident ${incidentId}`);
    }
    return { incidentId, notified: false, reason: 'FCM not configured yet' };
  });

  queue.process('nearby-alert', 1, async (job) => {
    // Phase 3: Find users near coordinates, batch send FCM
    const { alertId, lat, lng } = job.data;
    if (process.env.NODE_ENV !== 'production') {
      console.log(`[Notification] Would send nearby alert ${alertId} at ${lat},${lng}`);
    }
    return { alertId, notified: false, reason: 'FCM not configured yet' };
  });
}

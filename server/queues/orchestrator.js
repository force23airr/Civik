// Pipeline orchestrator — chains Bull jobs based on completion events
// plate-detection → here-traffic + azure-weather (parallel) → notify-user

// Track which enrichment steps are complete per incident
const pipelineState = new Map();

function getPipelineState(incidentId) {
  if (!pipelineState.has(incidentId)) {
    pipelineState.set(incidentId, { traffic: false, weather: false });
  }
  return pipelineState.get(incidentId);
}

function cleanupPipeline(incidentId) {
  pipelineState.delete(incidentId);
}

export function setupOrchestrator(enrichmentQueue, notificationQueue) {
  enrichmentQueue.on('global:completed', async (jobId, resultJson) => {
    try {
      const job = await enrichmentQueue.getJob(jobId);
      if (!job) return;

      const jobName = job.name;
      const { incidentId } = job.data;
      const result = JSON.parse(resultJson || '{}');

      // After plate detection completes, dispatch traffic + weather in parallel
      if (jobName === 'plate-detection' && incidentId) {
        if (result.skipped) return; // No media, no need for traffic/weather

        await Promise.all([
          enrichmentQueue.add('here-traffic', { incidentId }, { jobId: `traffic-${incidentId}` }),
          enrichmentQueue.add('azure-weather', { incidentId }, { jobId: `weather-${incidentId}` })
        ]);
      }

      // Track traffic + weather completion, dispatch notification when both done
      if (jobName === 'here-traffic' && incidentId) {
        const state = getPipelineState(incidentId);
        state.traffic = true;
        if (state.weather) {
          await dispatchPostEnrichment(incidentId, job.data.userId, enrichmentQueue, notificationQueue);
          cleanupPipeline(incidentId);
        }
      }

      if (jobName === 'azure-weather' && incidentId) {
        const state = getPipelineState(incidentId);
        state.weather = true;
        if (state.traffic) {
          await dispatchPostEnrichment(incidentId, job.data.userId, enrichmentQueue, notificationQueue);
          cleanupPipeline(incidentId);
        }
      }
    } catch (err) {
      console.error('[Orchestrator] Error handling job completion:', err.message);
    }
  });

  // Clean up pipeline state on failure to prevent memory leaks
  enrichmentQueue.on('global:failed', async (jobId) => {
    try {
      const job = await enrichmentQueue.getJob(jobId);
      if (job?.data?.incidentId) {
        cleanupPipeline(job.data.incidentId);
      }
    } catch {
      // Ignore cleanup errors
    }
  });
}

async function dispatchPostEnrichment(incidentId, userId, enrichmentQueue, notificationQueue) {
  // Phase 4: Add rekor-scoring here before notification
  // For now, go straight to notification
  await notificationQueue.add('incident-enriched', {
    incidentId,
    userId
  }, { jobId: `notify-${incidentId}` });
}

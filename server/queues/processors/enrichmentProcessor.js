import Incident from '../../models/Incident.js';
import { detectPlatesFromImage, detectPlatesFromVideo } from '../../services/plateRecognition/plateDetector.js';
import { awardIncidentCredits } from '../../services/rewards/rewardService.js';
import { routeIncident } from '../../services/municipal/routingService.js';
import { fetchTrafficFlow, fetchTrafficIncidents } from '../../services/traffic/hereTrafficService.js';
import { fetchCurrentWeather } from '../../services/weather/azureWeatherService.js';
import { checkLimit, increment } from '../../services/apiRateLimit.js';
import path from 'path';
import fs from 'fs';

export function registerEnrichmentProcessors(queue) {
  // Plate detection — wraps existing logic from incidentController
  queue.process('plate-detection', 2, async (job) => {
    const { incidentId } = job.data;
    const incident = await Incident.findById(incidentId);
    if (!incident) throw new Error(`Incident ${incidentId} not found`);

    if (!incident.mediaFiles || incident.mediaFiles.length === 0) {
      return { skipped: true, reason: 'no media files' };
    }

    const uploadsDir = path.resolve(process.cwd(), 'uploads');
    const allPlates = [];

    for (const file of incident.mediaFiles) {
      const filePath = path.resolve(process.cwd(), file.path.startsWith('/') ? file.path.slice(1) : file.path);
      if (!filePath.startsWith(uploadsDir)) continue;
      if (!fs.existsSync(filePath)) continue;

      const isVideo = file.mimetype?.startsWith('video/');
      const plates = isVideo
        ? await detectPlatesFromVideo(filePath)
        : await detectPlatesFromImage(filePath);

      for (const plate of plates) {
        plate.sourceFile = file.filename;
        allPlates.push(plate);
      }
    }

    if (allPlates.length > 0) {
      await Incident.findByIdAndUpdate(incidentId, {
        $push: { detectedPlates: { $each: allPlates } },
        $set: { 'enrichment.plateDetection': { status: 'completed', completedAt: new Date() } }
      });
    } else {
      await Incident.findByIdAndUpdate(incidentId, {
        $set: { 'enrichment.plateDetection': { status: 'completed', completedAt: new Date() } }
      });
    }

    return { platesFound: allPlates.length, incidentId };
  });

  // Award credits — wraps existing reward service
  queue.process('award-credits', 2, async (job) => {
    const { incidentId, userId } = job.data;
    const incident = await Incident.findById(incidentId);
    if (!incident) throw new Error(`Incident ${incidentId} not found`);
    await awardIncidentCredits(incident, userId);
    return { incidentId, userId };
  });

  // Municipal routing — wraps existing routing service
  queue.process('route-municipal', 2, async (job) => {
    const { incidentId } = job.data;
    const incident = await Incident.findById(incidentId);
    if (!incident) throw new Error(`Incident ${incidentId} not found`);
    await routeIncident(incident);
    return { incidentId };
  });

  // HERE Traffic enrichment
  queue.process('here-traffic', 2, async (job) => {
    const { incidentId } = job.data;
    const incident = await Incident.findById(incidentId);
    if (!incident?.location?.lat || !incident?.location?.lng) {
      return { skipped: true, reason: 'no GPS coordinates' };
    }

    if (!checkLimit('here')) {
      await Incident.findByIdAndUpdate(incidentId, {
        $set: { 'enrichment.traffic': { status: 'skipped', completedAt: new Date(), error: 'rate limit reached' } }
      });
      return { skipped: true, reason: 'rate limit' };
    }

    const { lat, lng } = incident.location;
    const [flow, nearbyIncidents] = await Promise.all([
      fetchTrafficFlow(lat, lng),
      fetchTrafficIncidents(lat, lng)
    ]);
    increment('here', 2); // Two API calls

    const trafficData = {
      fetchedAt: new Date(),
      flow: flow || {},
      nearbyIncidents: nearbyIncidents || []
    };

    await Incident.findByIdAndUpdate(incidentId, {
      $set: {
        trafficData,
        'enrichment.traffic': { status: 'completed', completedAt: new Date() }
      }
    });

    return { incidentId, jamFactor: flow?.jamFactor };
  });

  // Azure Weather enrichment
  queue.process('azure-weather', 2, async (job) => {
    const { incidentId } = job.data;
    const incident = await Incident.findById(incidentId);
    if (!incident?.location?.lat || !incident?.location?.lng) {
      return { skipped: true, reason: 'no GPS coordinates' };
    }

    if (!checkLimit('azure')) {
      await Incident.findByIdAndUpdate(incidentId, {
        $set: { 'enrichment.weather': { status: 'skipped', completedAt: new Date(), error: 'rate limit reached' } }
      });
      return { skipped: true, reason: 'rate limit' };
    }

    const { lat, lng } = incident.location;
    const weatherData = await fetchCurrentWeather(lat, lng);
    increment('azure');

    if (weatherData) {
      await Incident.findByIdAndUpdate(incidentId, {
        $set: {
          weatherData,
          'enrichment.weather': { status: 'completed', completedAt: new Date() }
        }
      });
    } else {
      await Incident.findByIdAndUpdate(incidentId, {
        $set: { 'enrichment.weather': { status: 'failed', completedAt: new Date(), error: 'no data returned' } }
      });
    }

    return { incidentId, weather: weatherData?.conditions?.description };
  });
}

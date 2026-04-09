const HERE_API_KEY = () => process.env.HERE_API_KEY;

/**
 * Fetch real-time traffic flow data near a GPS coordinate
 * HERE Traffic API v7 — flow endpoint
 */
export async function fetchTrafficFlow(lat, lng) {
  const apiKey = HERE_API_KEY();
  if (!apiKey) {
    console.warn('[HERETraffic] HERE_API_KEY not set, skipping traffic flow');
    return null;
  }

  try {
    const url = new URL('https://data.traffic.hereapi.com/v7/flow');
    url.searchParams.set('locationReferencing', 'shape');
    url.searchParams.set('in', `circle:${lat},${lng};r=500`);
    url.searchParams.set('apiKey', apiKey);

    const response = await fetch(url.toString(), { signal: AbortSignal.timeout(10000) });

    if (!response.ok) {
      console.error(`[HERETraffic] Flow API error: ${response.status}`);
      return null;
    }

    const data = await response.json();
    const result = data.results?.[0]?.currentFlow;

    if (!result) return null;

    return {
      currentSpeed: result.speed ? Math.round(result.speed * 3.6) : null, // m/s to km/h
      freeFlowSpeed: result.freeFlow ? Math.round(result.freeFlow * 3.6) : null,
      jamFactor: result.jamFactor ?? null,
      confidence: result.confidence ?? null
    };
  } catch (error) {
    console.error('[HERETraffic] Flow fetch error:', error.message);
    return null;
  }
}

/**
 * Fetch nearby traffic incidents
 * HERE Traffic API v7 — incidents endpoint
 */
export async function fetchTrafficIncidents(lat, lng, radiusMeters = 2000) {
  const apiKey = HERE_API_KEY();
  if (!apiKey) return [];

  try {
    const url = new URL('https://data.traffic.hereapi.com/v7/incidents');
    url.searchParams.set('in', `circle:${lat},${lng};r=${radiusMeters}`);
    url.searchParams.set('apiKey', apiKey);

    const response = await fetch(url.toString(), { signal: AbortSignal.timeout(10000) });

    if (!response.ok) {
      console.error(`[HERETraffic] Incidents API error: ${response.status}`);
      return [];
    }

    const data = await response.json();

    return (data.results || []).slice(0, 10).map(incident => ({
      type: incident.incidentDetails?.type || 'UNKNOWN',
      description: incident.incidentDetails?.description?.value || '',
      severity: incident.incidentDetails?.severity || 'unknown',
      distanceMeters: null // HERE doesn't return distance directly; could compute with haversine
    }));
  } catch (error) {
    console.error('[HERETraffic] Incidents fetch error:', error.message);
    return [];
  }
}

const AZURE_MAPS_KEY = () => process.env.AZURE_MAPS_KEY;

/**
 * Fetch current weather conditions at a GPS coordinate
 * Azure Maps Weather API
 */
export async function fetchCurrentWeather(lat, lng) {
  const apiKey = AZURE_MAPS_KEY();
  if (!apiKey) {
    console.warn('[AzureWeather] AZURE_MAPS_KEY not set, skipping weather');
    return null;
  }

  try {
    const url = new URL('https://atlas.microsoft.com/weather/currentConditions/json');
    url.searchParams.set('api-version', '1.1');
    url.searchParams.set('query', `${lat},${lng}`);
    url.searchParams.set('subscription-key', apiKey);

    const response = await fetch(url.toString(), { signal: AbortSignal.timeout(10000) });

    if (!response.ok) {
      console.error(`[AzureWeather] API error: ${response.status}`);
      return null;
    }

    const data = await response.json();
    const current = data.results?.[0];

    if (!current) return null;

    const conditions = {
      description: current.phrase || '',
      temperature: current.temperature?.value ?? null,
      humidity: current.relativeHumidity ?? null,
      windSpeed: current.wind?.speed?.value ?? null,
      visibility: current.visibility?.value ?? null,
      precipitation: current.hasPrecipitation ?? false,
      precipitationType: current.precipitationType || null,
      uvIndex: current.uvIndex ?? null
    };

    const hazards = assessWeatherHazards(conditions, current);

    return {
      fetchedAt: new Date(),
      conditions,
      hazards
    };
  } catch (error) {
    console.error('[AzureWeather] Fetch error:', error.message);
    return null;
  }
}

/**
 * Derive weather hazard flags from conditions
 */
function assessWeatherHazards(conditions, rawData) {
  const hazards = [];

  if (conditions.temperature !== null && conditions.temperature <= 0 && conditions.precipitation) {
    hazards.push({ type: 'ice', severity: 'high' });
  }
  if (conditions.visibility !== null && conditions.visibility < 1) {
    hazards.push({ type: 'fog', severity: 'high' });
  } else if (conditions.visibility !== null && conditions.visibility < 5) {
    hazards.push({ type: 'low_visibility', severity: 'medium' });
  }
  if (conditions.windSpeed !== null && conditions.windSpeed > 80) {
    hazards.push({ type: 'high_wind', severity: 'high' });
  } else if (conditions.windSpeed !== null && conditions.windSpeed > 50) {
    hazards.push({ type: 'wind', severity: 'medium' });
  }
  if (conditions.precipitation && conditions.precipitationType === 'Snow') {
    hazards.push({ type: 'snow', severity: 'medium' });
  }
  if (conditions.precipitation && conditions.precipitationType === 'Rain') {
    hazards.push({ type: 'rain', severity: 'low' });
  }

  return hazards;
}

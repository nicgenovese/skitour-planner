'use client';

import { useState, useEffect } from 'react';
import type { WeatherDay, WeatherForecast } from '@/types';
import { WEATHER_CODES } from '@/types';

interface Props {
  lat: number | null;
  lon: number | null;
  onWeatherLoaded?: (days: WeatherDay[]) => void;
}

function WeatherIcon({ code }: { code: number }) {
  const info = WEATHER_CODES[code] || { label: 'Unknown', icon: 'cloud' };
  const icon = info.icon;

  if (icon === 'sun') return <span className="text-yellow-400 text-lg">&#9728;</span>;
  if (icon === 'cloud-sun') return <span className="text-yellow-300 text-lg">&#9925;</span>;
  if (icon === 'cloud') return <span className="text-slate-400 text-lg">&#9729;</span>;
  if (icon === 'cloud-rain') return <span className="text-blue-400 text-lg">&#127783;</span>;
  if (icon === 'snowflake') return <span className="text-blue-200 text-lg">&#10052;</span>;
  if (icon === 'cloud-lightning') return <span className="text-yellow-500 text-lg">&#9889;</span>;
  return <span className="text-slate-400 text-lg">&#9729;</span>;
}

export default function WeatherPanel({ lat, lon, onWeatherLoaded }: Props) {
  const [forecast, setForecast] = useState<WeatherDay[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!lat || !lon) return;

    let cancelled = false;
    setLoading(true);
    setError(null);

    fetch(`/api/weather?lat=${lat}&lon=${lon}`)
      .then(res => res.json())
      .then(data => {
        if (cancelled) return;
        if (data.error) {
          setError(data.error);
          return;
        }

        const days: WeatherDay[] = (data.daily?.time || []).map((date: string, i: number) => ({
          date,
          tempMax: data.daily.temperature_2m_max[i],
          tempMin: data.daily.temperature_2m_min[i],
          precipitation: data.daily.precipitation_sum[i],
          snowfall: data.daily.snowfall_sum[i],
          windSpeedMax: data.daily.wind_speed_10m_max[i],
          weatherCode: data.daily.weather_code[i],
          freezingLevel: data.hourly?.freezing_level_height?.[i * 24 + 12],
        }));

        setForecast(days);
        onWeatherLoaded?.(days);
      })
      .catch(() => {
        if (!cancelled) setError('Failed to load weather');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [lat, lon, onWeatherLoaded]);

  if (!lat || !lon) {
    return (
      <div className="p-3 text-xs text-slate-500">
        Search for a location to see weather.
      </div>
    );
  }

  if (loading) {
    return (
      <div className="p-3 flex items-center gap-2 text-xs text-slate-400">
        <div className="w-3 h-3 border-2 border-slate-500 border-t-blue-400 rounded-full spinner" />
        Loading weather...
      </div>
    );
  }

  if (error) {
    return <div className="p-3 text-xs text-red-400">{error}</div>;
  }

  return (
    <div className="p-2">
      <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">
        7-Day Forecast
      </h3>
      <div className="space-y-1">
        {forecast.map(day => {
          const weekday = new Date(day.date + 'T12:00:00').toLocaleDateString('en', { weekday: 'short' });
          const info = WEATHER_CODES[day.weatherCode] || { label: 'Unknown' };

          return (
            <div key={day.date} className="flex items-center gap-2 py-1.5 px-2 rounded hover:bg-slate-700/50 text-xs">
              <span className="w-8 font-medium text-slate-300">{weekday}</span>
              <WeatherIcon code={day.weatherCode} />
              <span className="flex-1 text-slate-400 truncate">{info.label}</span>
              <span className="text-blue-300 font-mono w-8 text-right">{day.tempMin}°</span>
              <span className="text-slate-500">/</span>
              <span className="text-orange-300 font-mono w-8">{day.tempMax}°</span>
              {day.snowfall > 0 && (
                <span className="text-blue-200 font-mono text-[10px]">
                  {day.snowfall}cm
                </span>
              )}
              {day.windSpeedMax > 40 && (
                <span className="text-red-400 text-[10px]" title={`Wind: ${day.windSpeedMax} km/h`}>
                  &#128168;
                </span>
              )}
            </div>
          );
        })}
      </div>
      {forecast[0]?.freezingLevel && (
        <p className="mt-2 text-[10px] text-slate-500 px-2">
          Freezing level ~{Math.round(forecast[0].freezingLevel)}m (midday)
        </p>
      )}
    </div>
  );
}

'use client';

import { useState } from 'react';
import { SWISSTOPO_LAYERS } from '@/lib/swisstopo-layers';

interface Props {
  activeLayers: Record<string, boolean>;
  activeBase: string;
  onToggle: (key: string) => void;
}

export default function MapLayerControl({ activeLayers, activeBase, onToggle }: Props) {
  const [open, setOpen] = useState(false);

  const baseLayers = Object.entries(SWISSTOPO_LAYERS).filter(([, l]) => l.isBase);
  const overlayLayers = Object.entries(SWISSTOPO_LAYERS).filter(([, l]) => !l.isBase);

  const categories = [...new Set(overlayLayers.map(([, l]) => l.category))];

  return (
    <div className="layer-control bg-slate-800/90 rounded-lg shadow-lg">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-slate-200 hover:text-white transition-colors"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
        </svg>
        Layers
        <svg className={`w-3 h-3 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="px-3 pb-3 max-h-[60vh] overflow-y-auto">
          {/* Base maps */}
          <div className="mb-3">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1.5">Base Map</p>
            {baseLayers.map(([key, layer]) => (
              <label
                key={key}
                className="flex items-center gap-2 py-1 cursor-pointer text-sm text-slate-300 hover:text-white"
              >
                <input
                  type="radio"
                  name="baseLayer"
                  checked={activeBase === key}
                  onChange={() => onToggle(key)}
                  className="accent-blue-500"
                />
                {layer.label}
              </label>
            ))}
          </div>

          {/* Overlays by category */}
          {categories.map(cat => {
            const layers = overlayLayers.filter(([, l]) => l.category === cat);
            return (
              <div key={cat} className="mb-3">
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1.5">
                  {cat}
                </p>
                {layers.map(([key, layer]) => (
                  <label
                    key={key}
                    className="flex items-center gap-2 py-1 cursor-pointer text-sm text-slate-300 hover:text-white"
                  >
                    <input
                      type="checkbox"
                      checked={activeLayers[key] || false}
                      onChange={() => onToggle(key)}
                      className="accent-blue-500 rounded"
                    />
                    <span className="flex-1">{layer.label}</span>
                    {layer.opacity && layer.opacity < 1 && (
                      <span className="text-[10px] text-slate-500">{Math.round(layer.opacity * 100)}%</span>
                    )}
                  </label>
                ))}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

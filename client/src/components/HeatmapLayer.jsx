import { useEffect, useRef } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet.heat';

const HeatmapLayer = ({ points = [], options = {} }) => {
  const map = useMap();
  const heatLayerRef = useRef(null);

  useEffect(() => {
    if (!map) return;

    // Remove existing layer
    if (heatLayerRef.current) {
      map.removeLayer(heatLayerRef.current);
    }

    if (points.length === 0) return;

    const defaultOptions = {
      radius: 25,
      blur: 15,
      maxZoom: 17,
      gradient: {
        0.2: '#3b82f6',
        0.4: '#06b6d4',
        0.6: '#eab308',
        0.8: '#f97316',
        1.0: '#ef4444'
      }
    };

    heatLayerRef.current = L.heatLayer(points, { ...defaultOptions, ...options });
    heatLayerRef.current.addTo(map);

    return () => {
      if (heatLayerRef.current) {
        map.removeLayer(heatLayerRef.current);
        heatLayerRef.current = null;
      }
    };
  }, [map, points, options]);

  return null;
};

export default HeatmapLayer;

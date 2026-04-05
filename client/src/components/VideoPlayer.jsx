import React, { useState, useEffect } from 'react';
import { API_URL } from '../services/api';
import './VideoPlayer.css';

const ASSET_ORIGIN = API_URL.replace(/\/api\/?$/, '');

const buildAssetUrl = (src) => {
  if (!src) return null;
  if (/^https?:\/\//i.test(src)) return src;
  return `${ASSET_ORIGIN}${src.startsWith('/') ? src : `/${src}`}`;
};

export default function VideoPlayer({ src, className = 'video-player__video' }) {
  const [videoUrl, setVideoUrl] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!src) return undefined;

    let objectUrl = null;
    let active = true;

    const loadVideo = async () => {
      try {
        setError(null);
        setVideoUrl(null);

        const token = localStorage.getItem('token');
        const response = await fetch(buildAssetUrl(src), {
          credentials: 'include',
          headers: token ? { Authorization: `Bearer ${token}` } : {}
        });

        if (!response.ok) {
          throw new Error('Video request failed');
        }

        const blob = await response.blob();
        objectUrl = URL.createObjectURL(blob);

        if (active) {
          setVideoUrl(objectUrl);
        }
      } catch (err) {
        if (active) {
          setError('Unable to load video');
        }
      }
    };

    loadVideo();

    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [src]);

  if (error) {
    return <div className="video-player"><p style={{ color: '#94a3b8', textAlign: 'center', padding: 20 }}>{error}</p></div>;
  }

  return (
    <div className="video-player">
      {videoUrl ? (
        <video
          controls
          width="100%"
          preload="metadata"
          className={className}
        >
          <source src={videoUrl} type="video/mp4" />
          Your browser does not support video playback.
        </video>
      ) : (
        <p style={{ color: '#94a3b8', textAlign: 'center', padding: 20 }}>Loading video...</p>
      )}
    </div>
  );
}

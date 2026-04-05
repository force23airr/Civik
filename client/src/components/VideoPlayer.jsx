import React, { useState, useEffect } from 'react';
import './VideoPlayer.css';

export default function VideoPlayer({ src }) {
  const [videoUrl, setVideoUrl] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!src) return;

    let objectUrl = null;

    const loadVideo = async () => {
      try {
        const token = localStorage.getItem('token');
        const response = await fetch(src, {
          headers: token ? { Authorization: `Bearer ${token}` } : {}
        });

        if (!response.ok) {
          setError('Unable to load video');
          return;
        }

        const blob = await response.blob();
        objectUrl = URL.createObjectURL(blob);
        setVideoUrl(objectUrl);
      } catch (err) {
        setError('Unable to load video');
      }
    };

    loadVideo();

    return () => {
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
          className="video-player__video"
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

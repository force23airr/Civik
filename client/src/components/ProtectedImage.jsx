import { useEffect, useState } from 'react';
import { API_URL } from '../services/api';

const ASSET_ORIGIN = API_URL.replace(/\/api\/?$/, '');

const buildAssetUrl = (src) => {
  if (!src) return null;
  if (/^https?:\/\//i.test(src)) return src;
  return `${ASSET_ORIGIN}${src.startsWith('/') ? src : `/${src}`}`;
};

function ProtectedImage({ src, alt, className, fallback = 'Unable to load image' }) {
  const [imageUrl, setImageUrl] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!src) return undefined;

    let objectUrl = null;
    let active = true;

    const loadImage = async () => {
      try {
        setError(null);
        setImageUrl(null);

        const token = localStorage.getItem('token');
        const response = await fetch(buildAssetUrl(src), {
          credentials: 'include',
          headers: token ? { Authorization: `Bearer ${token}` } : {}
        });

        if (!response.ok) {
          throw new Error('Image request failed');
        }

        const blob = await response.blob();
        objectUrl = URL.createObjectURL(blob);

        if (active) {
          setImageUrl(objectUrl);
        }
      } catch (err) {
        if (active) {
          setError(fallback);
        }
      }
    };

    loadImage();

    return () => {
      active = false;
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [fallback, src]);

  if (error) {
    return <div className={className}>{fallback}</div>;
  }

  if (!imageUrl) {
    return <div className={className}>Loading image...</div>;
  }

  return <img src={imageUrl} alt={alt} className={className} />;
}

export default ProtectedImage;

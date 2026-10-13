import { useState, useEffect } from "react";
import { API_BASE, getAuthHeaders } from "../../services/api";
import { Loader2, Image as ImageIcon } from "lucide-react";

interface SecureImageProps {
  investigationId?: string;
  evidenceId: string;
  type?: "download" | "heatmap" | "spectrum";
  alt?: string;
  className?: string;
  fallbackClassName?: string;
}

// Global in-memory cache for instant zero-latency image reuse
const blobCache = new Map<string, string>();

export function SecureImage({ 
  investigationId, 
  evidenceId, 
  type = "download", 
  alt = "Evidence Image", 
  className = "",
  fallbackClassName = ""
}: SecureImageProps) {
  const cacheKey = `${evidenceId}_${type}`;
  const cachedUrl = blobCache.get(cacheKey) || null;
  const [imgUrl, setImgUrl] = useState<string | null>(cachedUrl);
  const [loading, setLoading] = useState<boolean>(!cachedUrl);
  const [error, setError] = useState<boolean>(false);

  useEffect(() => {
    let mounted = true;

    if (!evidenceId) {
      setLoading(false);
      return;
    }

    // If already in memory cache, use it immediately
    if (blobCache.has(cacheKey)) {
      setImgUrl(blobCache.get(cacheKey)!);
      setLoading(false);
      return;
    }

    async function loadImage() {
      try {
        setLoading(true);
        setError(false);
        const endpoint = investigationId
          ? `/api/v2/investigations/${investigationId}/evidence/${evidenceId}/${type}`
          : `/api/v2/investigations/evidence/${evidenceId}/${type}`;
        
        const response = await fetch(`${API_BASE}${endpoint}`, {
          headers: getAuthHeaders(),
          credentials: 'include'
        });
        
        if (!response.ok) {
          throw new Error('Failed to fetch image');
        }
        
        const blob = await response.blob();
        if (mounted) {
          const objectUrl = URL.createObjectURL(blob);
          blobCache.set(cacheKey, objectUrl);
          setImgUrl(objectUrl);
        }
      } catch (err) {
        if (mounted) setError(true);
      } finally {
        if (mounted) setLoading(false);
      }
    }

    loadImage();

    return () => {
      mounted = false;
    };
  }, [investigationId, evidenceId, type, cacheKey]);

  if (loading) {
    return (
      <div className={`flex items-center justify-center bg-surface-container-highest ${className} ${fallbackClassName}`}>
        <Loader2 className="w-5 h-5 text-on-surface-variant animate-spin" />
      </div>
    );
  }

  if (error || !imgUrl) {
    return (
      <div className={`flex flex-col items-center justify-center bg-surface-container-highest text-on-surface-variant ${className} ${fallbackClassName}`}>
        <ImageIcon className="w-6 h-6 opacity-50 mb-1" />
        <span className="text-[10px] font-label-mono">Image Unavailable</span>
      </div>
    );
  }

  return (
    <img 
      src={imgUrl} 
      alt={alt} 
      className={className} 
      loading="lazy"
    />
  );
}

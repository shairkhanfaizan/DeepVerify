import { useState, useEffect } from "react";
import { API_BASE } from "../../services/api";
import { Loader2, Image as ImageIcon } from "lucide-react";

interface SecureImageProps {
  investigationId: string;
  evidenceId: string;
  type?: "download" | "heatmap";
  alt?: string;
  className?: string;
  fallbackClassName?: string;
}

export function SecureImage({ 
  investigationId, 
  evidenceId, 
  type = "download", 
  alt = "Evidence Image", 
  className = "",
  fallbackClassName = ""
}: SecureImageProps) {
  const [imgUrl, setImgUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let objectUrl: string | null = null;
    let mounted = true;

    async function loadImage() {
      try {
        setLoading(true);
        setError(false);
        const endpoint = `/api/v2/investigations/${investigationId}/evidence/${evidenceId}/${type}`;
        
        const response = await fetch(`${API_BASE}${endpoint}`, {
          credentials: 'include' // Important to send auth cookies
        });
        
        if (!response.ok) {
          throw new Error('Failed to fetch image');
        }
        
        const blob = await response.blob();
        if (mounted) {
          objectUrl = URL.createObjectURL(blob);
          setImgUrl(objectUrl);
        }
      } catch (err) {
        if (mounted) setError(true);
      } finally {
        if (mounted) setLoading(false);
      }
    }

    if (investigationId && evidenceId) {
      loadImage();
    }

    return () => {
      mounted = false;
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [investigationId, evidenceId, type]);

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

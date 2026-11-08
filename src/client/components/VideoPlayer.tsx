import { useState } from 'react';

interface VideoPlayerProps {
  url?: string;
  poster?: string;
  title?: string;
  className?: string;
}

function getYouTubeId(url: string): string | null {
  const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([\w-]{11})/);
  return match ? match[1] : null;
}

export function VideoPlayer({ url, poster, title = 'فيديو توضيحي للمنتج', className = '' }: VideoPlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false);

  if (!url) return null;

  const ytId = getYouTubeId(url);

  // If it's a YouTube video
  if (ytId) {
    const thumbUrl = poster || `https://img.youtube.com/vi/${ytId}/hqdefault.jpg`;

    if (!isPlaying) {
      return (
        <div
          onClick={() => setIsPlaying(true)}
          className={`group relative aspect-video w-full cursor-pointer overflow-hidden rounded-2xl bg-black border border-line shadow-sm ${className}`}
          role="button"
          tabIndex={0}
          aria-label="تشغيل الفيديو"
        >
          <img src={thumbUrl} alt={title} className="size-full object-cover opacity-90 transition-transform duration-300 group-hover:scale-105" />
          <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
            <div className="flex size-16 items-center justify-center rounded-full bg-brand text-on-brand shadow-lg transition-transform duration-200 group-hover:scale-110">
              <svg className="size-8 translate-x-0.5 fill-current" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z" />
              </svg>
            </div>
          </div>
          <div className="absolute bottom-3 end-3 rounded-lg bg-black/70 px-2.5 py-1 text-xs text-white backdrop-blur-sm">
            ▶️ انقر لمشاهدة الفيديو
          </div>
        </div>
      );
    }

    return (
      <div className={`relative aspect-video w-full overflow-hidden rounded-2xl bg-black border border-line ${className}`}>
        <iframe
          src={`https://www.youtube.com/embed/${ytId}?autoplay=1&rel=0`}
          title={title}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          className="size-full border-0"
        />
      </div>
    );
  }

  // Direct MP4 / WebM video
  return (
    <div className={`relative aspect-video w-full overflow-hidden rounded-2xl bg-black border border-line ${className}`}>
      <video
        src={url}
        poster={poster}
        controls
        playsInline
        preload="none"
        className="size-full object-contain"
      />
    </div>
  );
}

import { Download, ExternalLink, Play, Server, TriangleAlert, X } from 'lucide-react';
import { useMemo, useRef, useState } from 'react';
import type { MediaItem } from '../types';
import { normalizeMediaUrl } from '../utils/media';

interface VideoModalProps {
  item: MediaItem;
  onClose: () => void;
}

export function VideoModal({ item, onClose }: VideoModalProps) {
  const [streamMode, setStreamMode] = useState<'stream' | 'play'>('stream');
  const [videoFailed, setVideoFailed] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const isLiveChannel = item.category_id === 'live';
  const mediaKey = isLiveChannel && item.series_code ? item.series_code : String(item.id);

  const activeSrc = useMemo(() => {
    if (streamMode === 'play') {
      return `/movie/${mediaKey}/play`;
    }
    return item.streamurl || normalizeMediaUrl(item.playingurl) || `/stream/${mediaKey}`;
  }, [item, mediaKey, streamMode]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md"
      role="dialog"
      aria-modal="true"
      aria-label={`Playing ${item.title}`}
    >
      <div className="relative w-full max-w-4xl bg-slate-900 rounded-2xl overflow-hidden border border-slate-800 shadow-2xl flex flex-col">
        <div className="px-5 py-3.5 bg-slate-950 border-b border-slate-800 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <span className="text-xs font-semibold text-rose-400 shrink-0 whitespace-nowrap">
              {item.vj || 'VJ Junior'}
            </span>
            <span className="text-slate-600" aria-hidden="true">/</span>
            <h3 className="font-bold text-sm sm:text-base text-white truncate">
              {item.title}
            </h3>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => {
                setVideoFailed(false);
                setStreamMode((prev) => (prev === 'stream' ? 'play' : 'stream'));
              }}
              className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-mono text-emerald-400 border border-slate-700 transition-colors whitespace-nowrap shrink-0"
              title="Switch between /stream/:id and /movie/:id/play endpoints"
            >
              Route: {streamMode === 'stream' ? '/stream' : '/play'}
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close player"
              className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="relative aspect-video bg-black flex items-center justify-center">
          {activeSrc && !videoFailed ? (
            <video
              key={activeSrc}
              ref={videoRef}
              src={activeSrc}
              poster={item.backdrop || item.image}
              controls
              autoPlay
              playsInline
              preload="metadata"
              onError={() => {
                if (streamMode === 'stream' && mediaKey) {
                  setStreamMode('play');
                } else {
                  setVideoFailed(true);
                }
              }}
              className="w-full h-full object-contain"
            />
          ) : (
            <div className="text-center p-8 space-y-3">
              <TriangleAlert className="w-10 h-10 text-amber-500 mx-auto" />
              <p className="text-sm text-slate-300">
                Stream ready via UG SHACKS player endpoint
              </p>
              <div className="flex flex-wrap items-center justify-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setVideoFailed(false);
                    setStreamMode('stream');
                  }}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold whitespace-nowrap"
                >
                  <span>Retry Inline Player</span>
                </button>
                <a
                  href={`/movie/${mediaKey}/play`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold whitespace-nowrap"
                >
                  <Play className="w-4 h-4 fill-white" />
                  <span>Open Direct Watch</span>
                </a>
              </div>
            </div>
          )}
        </div>

        <div className="p-5 bg-slate-950 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex flex-wrap items-center gap-2 text-slate-400 tabular-nums">
              <span className="font-mono text-slate-200">{item.quality || '1080p HD'}</span>
              <span aria-hidden="true">·</span>
              <span>Duration: {item.duration || '01h 35m'}</span>
              <span aria-hidden="true">·</span>
              <span>Size: {item.size || '1.1 GB'}</span>
              <span aria-hidden="true">·</span>
              <span className="font-mono text-emerald-400">no-referrer</span>
            </div>

            <div className="flex items-center gap-2">
              <a
                href={`/api/dl/${mediaKey}`}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium transition-colors whitespace-nowrap shrink-0"
              >
                <Download className="w-3.5 h-3.5 text-cyan-400" />
                <span>Download MP4</span>
              </a>
              <a
                href={`/stream/${mediaKey}`}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium transition-colors whitespace-nowrap shrink-0 font-mono"
              >
                <Server className="w-3.5 h-3.5 text-amber-400" />
                <span>/stream/{mediaKey}</span>
              </a>
              <a
                href={isLiveChannel ? '/api/channels' : `/movie/${mediaKey}`}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium transition-colors whitespace-nowrap shrink-0"
              >
                <ExternalLink className="w-3.5 h-3.5 text-emerald-400" />
                <span>API JSON</span>
              </a>
            </div>
          </div>

          <p className="text-xs text-slate-400 leading-relaxed">
            {item.description || `Streamed via UG SHACKS Movie API endpoint /stream/${mediaKey}.`}
          </p>
        </div>
      </div>
    </div>
  );
}

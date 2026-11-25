import { LoaderCircle, Play, Radio, Server, Wifi } from 'lucide-react';
import type { LiveChannel, MediaItem } from '../types';
import { FALLBACK_POSTER, normalizeMediaUrl } from '../utils/media';

interface ChannelsViewProps {
  channels: LiveChannel[];
  activeChannel: LiveChannel | null;
  loading: boolean;
  onSelectChannel: (channel: LiveChannel) => void;
  onWatchChannel: (item: MediaItem) => void;
}

export function ChannelsView({
  channels,
  activeChannel,
  loading,
  onSelectChannel,
  onWatchChannel,
}: ChannelsViewProps) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2.5">
          <Radio className="w-6 h-6 text-rose-500" />
          <span>Live TV Broadcast Feeds</span>
        </h2>
        <p className="text-sm text-slate-400 mt-1">
          Active multiplex channels served from <code className="text-emerald-400 font-mono">GET /api/channels</code>.
        </p>
      </div>

      {loading ? (
        <div className="p-12 text-center text-slate-400 flex items-center justify-center gap-2">
          <LoaderCircle className="w-5 h-5 animate-spin text-rose-500" />
          <span>Loading live channels from API...</span>
        </div>
      ) : channels.length === 0 ? (
        <div className="p-8 text-center bg-slate-900 rounded-2xl border border-slate-800 text-slate-400">
          No channels returned by /api/channels.
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {activeChannel && (
            <div className="lg:col-span-2 space-y-4">
              <div className="relative rounded-2xl overflow-hidden bg-black border border-slate-800 aspect-video flex items-center justify-center">
                <img
                  src={activeChannel.thumbnail}
                  alt={activeChannel.name}
                  referrerPolicy="no-referrer"
                  onError={(e) => {
                    e.currentTarget.src = FALLBACK_POSTER;
                  }}
                  className="w-full h-full object-cover opacity-65"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/35 to-transparent" />

                <div className="absolute top-4 left-4 right-4 flex items-center justify-between gap-4 text-xs tabular-nums">
                  <span className="px-2.5 py-1 rounded-md font-bold uppercase bg-rose-600 text-white">
                    LIVE · {activeChannel.resolution}
                  </span>
                  <span className="font-mono text-slate-200 bg-black/70 px-2.5 py-1 rounded-md">
                    {activeChannel.bitrate} · {activeChannel.viewers}
                  </span>
                </div>

                <div className="absolute bottom-5 left-5 right-5 flex flex-wrap items-end justify-between gap-4">
                  <div className="space-y-1">
                    <span className="text-xs font-semibold text-rose-400">
                      {activeChannel.category}
                    </span>
                    <h3 className="text-xl sm:text-2xl font-extrabold text-white">
                      {activeChannel.name}
                    </h3>
                    <p className="text-xs text-slate-300">
                      Now Playing: <span className="font-semibold text-white">{activeChannel.currentShow}</span>
                    </p>
                  </div>

                  {activeChannel.playingurl && (
                    <button
                      type="button"
                      onClick={() =>
                        onWatchChannel({
                          id: Number(activeChannel.id.replace(/\D/g, '')) || 1,
                          title: `${activeChannel.name} — ${activeChannel.currentShow}`,
                          vj: activeChannel.vj,
                          category_id: 'live',
                          category_name: activeChannel.category,
                          duration: 'LIVE 24/7',
                          size: activeChannel.bitrate,
                          image: activeChannel.thumbnail,
                          playingurl: normalizeMediaUrl(activeChannel.playingurl),
                          streamurl: `/stream/${activeChannel.id}`,
                          description: `Live 24/7 broadcast feed (${activeChannel.resolution}, ${activeChannel.bitrate})`,
                          type: 'MOVIE',
                          media_type: 'movie',
                          is_series: false,
                          series_code: activeChannel.id,
                          quality: activeChannel.resolution,
                        })
                      }
                      className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-semibold text-xs transition-colors whitespace-nowrap shrink-0"
                    >
                      <Play className="w-4 h-4 fill-white" />
                      <span>Watch Live</span>
                    </button>
                  )}
                </div>
              </div>

              <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 flex flex-wrap items-center justify-between gap-4 text-xs">
                <div className="flex items-center gap-2 text-slate-400">
                  <Server className="w-4 h-4 text-emerald-400" />
                  <span>Edge Relay:</span>
                  <span className="font-mono text-slate-200">{activeChannel.edgeNode}</span>
                </div>
                <div className="flex items-center gap-2 text-slate-400">
                  <Wifi className="w-4 h-4 text-cyan-400" />
                  <span>Audio Master:</span>
                  <span className="font-mono text-slate-200">{activeChannel.vj}</span>
                </div>
              </div>
            </div>
          )}

          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Channel Directory
            </h4>
            {channels.map((ch) => {
              const isSelected = activeChannel?.id === ch.id;
              return (
                <button
                  key={ch.id}
                  type="button"
                  onClick={() => onSelectChannel(ch)}
                  className={`w-full text-left p-3.5 rounded-xl border transition-colors flex items-center gap-3 ${
                    isSelected
                      ? 'bg-rose-950/30 border-rose-500 text-white'
                      : 'bg-slate-900 border-slate-800 text-slate-300 hover:border-slate-700'
                  }`}
                >
                  <img
                    src={ch.thumbnail}
                    alt={ch.name}
                    referrerPolicy="no-referrer"
                    onError={(e) => {
                      e.currentTarget.src = FALLBACK_POSTER;
                    }}
                    className="w-16 h-11 rounded-lg object-cover bg-slate-950 shrink-0"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-bold text-xs text-white truncate">{ch.name}</span>
                      <span className="text-[11px] font-mono text-rose-400 shrink-0 tabular-nums">
                        {ch.viewers}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 truncate mt-0.5">{ch.currentShow}</p>
                    <div className="text-[11px] text-slate-500 mt-1 font-mono tabular-nums">
                      {ch.resolution} · {ch.bitrate}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

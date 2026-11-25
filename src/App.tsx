import { useCallback, useEffect, useRef, useState } from 'react';
import { AuditView } from './components/AuditView';
import { CatalogView } from './components/CatalogView';
import { ChannelsView } from './components/ChannelsView';
import { ProxyLabView } from './components/ProxyLabView';
import { VideoModal } from './components/VideoModal';
import { WorkerScriptView } from './components/WorkerScriptView';
import type {
  AuditReport,
  EndpointPreset,
  LiveChannel,
  LiveTestResponse,
  MediaItem,
  WorkerFeature,
} from './types';
import { normalizeMediaUrl } from './utils/media';

type ActiveTab = 'catalog' | 'channels' | 'simulator' | 'worker-code' | 'security';

const NAV_ITEMS: Array<{ id: ActiveTab; label: string }> = [
  { id: 'catalog', label: 'Catalog' },
  { id: 'channels', label: 'Live TV' },
  { id: 'simulator', label: 'Proxy Lab' },
  { id: 'worker-code', label: 'Worker Script' },
  { id: 'security', label: 'Audit' },
];

export default function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('catalog');

  const [movies, setMovies] = useState<MediaItem[]>([]);
  const [loadingDashboard, setLoadingDashboard] = useState(true);
  const [dashboardError, setDashboardError] = useState<string | null>(null);

  const [channels, setChannels] = useState<LiveChannel[]>([]);
  const [activeChannel, setActiveChannel] = useState<LiveChannel | null>(null);
  const [loadingChannels, setLoadingChannels] = useState(true);

  const [presets, setPresets] = useState<EndpointPreset[]>([]);
  const [activePreset, setActivePreset] = useState<EndpointPreset | null>(null);
  const [workerFeatures, setWorkerFeatures] = useState<WorkerFeature[]>([]);
  const [workerSource, setWorkerSource] = useState('');
  const [audit, setAudit] = useState<AuditReport | null>(null);

  const [searchQuery, setSearchQuery] = useState(() => {
    return new URLSearchParams(window.location.search).get('q') || '';
  });
  const [searchResults, setSearchResults] = useState<MediaItem[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  const [seriesEpisodes, setSeriesEpisodes] = useState<MediaItem[]>([]);
  const [seriesTitle, setSeriesTitle] = useState<string | null>(null);
  const [loadingSeries, setLoadingSeries] = useState(false);

  const [playingItem, setPlayingItem] = useState<MediaItem | null>(null);

  const [testPath, setTestPath] = useState('/search?q=silo');
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<LiveTestResponse | null>(null);

  const searchCounter = useRef(0);

  const fetchDashboard = useCallback(async () => {
    setLoadingDashboard(true);
    setDashboardError(null);
    try {
      const res = await fetch('/dashboard', { headers: { Accept: 'application/json' } });
      if (!res.ok) throw new Error(`Dashboard API error: ${res.status}`);
      const payload = await res.json();
      const normalized = (payload.movies || []).map((m: MediaItem) => ({
        ...m,
        playingurl: normalizeMediaUrl(m.playingurl),
      }));
      setMovies(normalized);
    } catch (err) {
      setDashboardError(err instanceof Error ? err.message : 'Failed to load catalog');
    } finally {
      setLoadingDashboard(false);
    }
  }, []);

  const fetchChannels = useCallback(async () => {
    setLoadingChannels(true);
    try {
      const res = await fetch('/api/channels');
      if (res.ok) {
        const list: LiveChannel[] = await res.json();
        setChannels(list);
        if (list.length > 0) setActiveChannel((prev) => prev || list[0]);
      }
    } catch (err) {
      console.error('Channels fetch failed', err);
    } finally {
      setLoadingChannels(false);
    }
  }, []);

  const fetchPresets = useCallback(async () => {
    try {
      const res = await fetch('/api/presets');
      if (res.ok) {
        const list: EndpointPreset[] = await res.json();
        setPresets(list);
        if (list.length > 0) setActivePreset((prev) => prev || list[0]);
      }
    } catch (err) {
      console.error('Presets fetch failed', err);
    }
  }, []);

  const fetchWorkerCode = useCallback(async () => {
    try {
      const res = await fetch('/api/worker-code');
      if (res.ok) {
        const data = await res.json();
        setWorkerFeatures(data.features || []);
        setWorkerSource(data.workerSource || '');
      }
    } catch (err) {
      console.error('Worker code fetch failed', err);
    }
  }, []);

  const fetchAudit = useCallback(async () => {
    try {
      const res = await fetch('/api/audit');
      if (res.ok) {
        setAudit(await res.json());
      }
    } catch (err) {
      console.error('Audit fetch failed', err);
    }
  }, []);

  useEffect(() => {
    fetchDashboard();
    fetchChannels();
    fetchPresets();
    fetchWorkerCode();
    fetchAudit();
  }, [fetchDashboard, fetchChannels, fetchPresets, fetchWorkerCode, fetchAudit]);

  const executeSearch = useCallback(async (rawQuery: string) => {
    const trimmed = rawQuery.trim();
    if (!trimmed) {
      setSearchResults(null);
      setSearching(false);
      setSearchError(null);
      return;
    }

    const requestId = ++searchCounter.current;
    setSearching(true);
    setSearchError(null);

    try {
      const res = await fetch(`/search?q=${encodeURIComponent(trimmed)}`, {
        headers: { Accept: 'application/json' },
      });
      if (!res.ok) throw new Error(`Search failed with status ${res.status}`);
      const data = await res.json();
      if (requestId !== searchCounter.current) return;

      const seen = new Set<string>();
      const collected: MediaItem[] = [];

      const pushItem = (raw: Partial<MediaItem>, fallbackCat?: string) => {
        if (!raw) return;
        const key = String(raw.id || Math.random());
        if (seen.has(key)) return;
        seen.add(key);
        const baseTitle = raw.title || `Media #${key}`;
        const formattedTitle =
          raw.code && !baseTitle.toUpperCase().includes(raw.code.toUpperCase())
            ? `${baseTitle} (${raw.code})`
            : baseTitle;
        collected.push({
          id: Number(raw.id) || 0,
          title: formattedTitle,
          vj: raw.vj && raw.vj.trim() ? raw.vj.trim() : 'VJ Junior',
          category_id: raw.category_id || '1',
          category_name:
            raw.category_name || fallbackCat || (raw.type === 'SERIES' ? 'TV Series' : 'Movies'),
          duration: raw.duration || '01h 30m',
          size: raw.size || '750 MB',
          image: raw.image || '',
          backdrop: raw.backdrop || raw.image || '',
          playingurl: normalizeMediaUrl(raw.playingurl),
          streamurl: raw.streamurl || `/stream/${key}`,
          description: raw.description || '',
          type: raw.type === 'SERIES' ? 'SERIES' : 'MOVIE',
          media_type: raw.type === 'SERIES' ? 'serie' : 'movie',
          is_series:
            Boolean(raw.is_series) ||
            raw.type === 'SERIES' ||
            Boolean(raw.series_code && String(raw.series_code) !== String(raw.id)),
          series_code: String(raw.series_code || key),
          series_title: raw.series_title,
          season: raw.season,
          episode: raw.episode,
          code: raw.code,
          quality: raw.quality || '1080p HD',
        });
      };

      if (Array.isArray(data.items)) {
        data.items.forEach((m: Partial<MediaItem>) => pushItem(m));
      }
      if (Array.isArray(data.movies)) {
        data.movies.forEach((m: Partial<MediaItem>) => pushItem(m, 'Movies'));
      }
      if (Array.isArray(data.series)) {
        data.series.forEach(
          (s: {
            episodes?: Partial<MediaItem>[];
            seasons?: Array<{ episodes?: Partial<MediaItem>[] }>;
          }) => {
            s.seasons?.forEach((season) => {
              season.episodes?.forEach((ep) => pushItem(ep, 'TV Series'));
            });
            s.episodes?.forEach((ep) => pushItem(ep, 'TV Series'));
          }
        );
      }

      setSearchResults(collected);
    } catch (err) {
      if (requestId !== searchCounter.current) return;
      setSearchError(err instanceof Error ? err.message : 'Search request failed');
      setSearchResults([]);
    } finally {
      if (requestId === searchCounter.current) {
        setSearching(false);
      }
    }
  }, []);

  useEffect(() => {
    if (!searchQuery.trim()) {
      searchCounter.current += 1;
      setSearchResults(null);
      setSearching(false);
      setSearchError(null);
      return;
    }
    const timer = setTimeout(() => {
      executeSearch(searchQuery);
    }, 250);
    return () => clearTimeout(timer);
  }, [searchQuery, executeSearch]);

  const handleFetchSeries = async (item: MediaItem) => {
    setLoadingSeries(true);
    setSeriesTitle(item.series_title || item.title);
    setSeriesEpisodes([]);
    try {
      const res = await fetch(`/series/${item.id}`);
      if (res.ok) {
        const data = await res.json();
        const eps: MediaItem[] = (data.episodes || []).map((ep: MediaItem) => ({
          ...ep,
          title:
            ep.code && !ep.title?.toUpperCase().includes(ep.code.toUpperCase())
              ? `${ep.title} (${ep.code})`
              : ep.title,
          vj: ep.vj || item.vj || 'VJ Junior',
          duration: ep.duration || '00h 55m',
          category_name: ep.category_name || 'TV Series Episode',
          playingurl: normalizeMediaUrl(ep.playingurl),
          streamurl: ep.streamurl || `/stream/${ep.id}`,
        }));
        setSeriesEpisodes(eps.length > 0 ? eps : [item]);
      } else {
        setSeriesEpisodes([item]);
      }
    } catch {
      setSeriesEpisodes([item]);
    } finally {
      setLoadingSeries(false);
    }
  };

  const handlePlayItem = async (item: MediaItem) => {
    if (!item.playingurl) {
      try {
        const res = await fetch(`/movie/${item.id}`);
        if (res.ok) {
          const detail: MediaItem = await res.json();
          setPlayingItem({
            ...item,
            ...detail,
            playingurl: normalizeMediaUrl(detail.playingurl),
            streamurl: detail.streamurl || `/stream/${item.id}`,
          });
          return;
        }
      } catch (err) {
        console.error('Failed to resolve movie detail', err);
      }
    }
    setPlayingItem({
      ...item,
      playingurl: normalizeMediaUrl(item.playingurl),
      streamurl: item.streamurl || `/stream/${item.id}`,
    });
  };

  const handleRunLiveTest = async (path: string) => {
    setTesting(true);
    setTestResult(null);
    try {
      const start = performance.now();
      const res = await fetch(path, { headers: { Accept: 'application/json' } });
      const elapsed = Math.round(performance.now() - start);
      const contentType = res.headers.get('content-type') || '';
      const payload = contentType.includes('application/json')
        ? await res.json()
        : await res.text();
      setTestResult({
        status: res.status,
        statusText: res.statusText,
        duration: `${elapsed}ms`,
        headers: Object.fromEntries(res.headers.entries()),
        data: payload,
      });
    } catch (err) {
      setTestResult({
        error: true,
        message: err instanceof Error ? err.message : 'Request failed',
      });
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col selection:bg-rose-500/30 selection:text-rose-200">
      <header className="sticky top-0 z-40 bg-slate-950/90 backdrop-blur-xl border-b border-slate-800 px-4 lg:px-8 py-3.5">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-8">
          <a
            href="/"
            onClick={(e) => {
              e.preventDefault();
              setActiveTab('catalog');
            }}
            className="text-lg font-extrabold tracking-tight text-white whitespace-nowrap shrink-0"
          >
            UG SHACKS Movie API
          </a>

          <nav
            aria-label="Primary navigation"
            className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-400"
          >
            {NAV_ITEMS.map((nav) => (
              <button
                key={nav.id}
                type="button"
                onClick={() => setActiveTab(nav.id)}
                className={`whitespace-nowrap shrink-0 transition-colors pb-0.5 ${
                  activeTab === nav.id
                    ? 'text-white border-b-2 border-rose-500'
                    : 'text-slate-400 hover:text-slate-100'
                }`}
              >
                {nav.label}
              </button>
            ))}
          </nav>

          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={() => {
                setActiveTab('simulator');
                handleRunLiveTest(testPath);
              }}
              className="px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold transition-colors whitespace-nowrap shrink-0"
            >
              Test API
            </button>
          </div>
        </div>

        <nav
          aria-label="Mobile navigation"
          className="flex md:hidden items-center gap-4 overflow-x-auto pt-3 mt-3 border-t border-slate-800/80 text-xs font-medium"
        >
          {NAV_ITEMS.map((nav) => (
            <button
              key={nav.id}
              type="button"
              onClick={() => setActiveTab(nav.id)}
              className={`whitespace-nowrap shrink-0 pb-1 ${
                activeTab === nav.id
                  ? 'text-white border-b-2 border-rose-500'
                  : 'text-slate-400'
              }`}
            >
              {nav.label}
            </button>
          ))}
        </nav>
      </header>

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 lg:px-8 py-6 lg:py-8">
        {activeTab === 'catalog' && (
          <CatalogView
            movies={movies}
            searchResults={searchResults}
            searchQuery={searchQuery}
            onSearchQueryChange={setSearchQuery}
            onTriggerSearch={executeSearch}
            onRefreshDashboard={fetchDashboard}
            loading={loadingDashboard}
            searching={searching}
            error={dashboardError}
            searchError={searchError}
            seriesEpisodes={seriesEpisodes}
            seriesTitle={seriesTitle}
            loadingSeries={loadingSeries}
            onFetchSeries={handleFetchSeries}
            onClearSeries={() => {
              setSeriesEpisodes([]);
              setSeriesTitle(null);
            }}
            onPlayItem={handlePlayItem}
          />
        )}

        {activeTab === 'channels' && (
          <ChannelsView
            channels={channels}
            activeChannel={activeChannel}
            loading={loadingChannels}
            onSelectChannel={setActiveChannel}
            onWatchChannel={(item) => setPlayingItem(item)}
          />
        )}

        {activeTab === 'simulator' && (
          <ProxyLabView
            presets={presets}
            activePreset={activePreset}
            workerFeatures={workerFeatures}
            testPath={testPath}
            testing={testing}
            testResult={testResult}
            onSelectPreset={setActivePreset}
            onTestPathChange={setTestPath}
            onRunTest={handleRunLiveTest}
          />
        )}

        {activeTab === 'worker-code' && (
          <WorkerScriptView features={workerFeatures} workerSource={workerSource} />
        )}

        {activeTab === 'security' && <AuditView audit={audit} />}
      </main>

      {playingItem && (
        <VideoModal item={playingItem} onClose={() => setPlayingItem(null)} />
      )}

      <footer className="mt-auto border-t border-slate-800 bg-slate-950 py-6 px-4 lg:px-8 text-xs text-slate-400">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="font-medium text-slate-300">
            UG SHACKS Movie API · Streaming Portal & Edge Proxy Hub
          </div>
          <div className="flex flex-wrap items-center gap-3 font-mono text-[11px] text-slate-400">
            <a href="/dashboard" target="_blank" rel="noreferrer" className="hover:text-white transition-colors">
              GET /dashboard
            </a>
            <span aria-hidden="true">·</span>
            <a href="/search?q=silo" target="_blank" rel="noreferrer" className="hover:text-white transition-colors">
              GET /search?q=
            </a>
            <span aria-hidden="true">·</span>
            <a href="/movie/67861" target="_blank" rel="noreferrer" className="hover:text-white transition-colors">
              GET /movie/:id
            </a>
            <span aria-hidden="true">·</span>
            <a href="/series/39409" target="_blank" rel="noreferrer" className="hover:text-white transition-colors">
              GET /series/:id
            </a>
            <span aria-hidden="true">·</span>
            <a href="/api/channels" target="_blank" rel="noreferrer" className="hover:text-white transition-colors">
              GET /api/channels
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}

import {
  ChevronLeft,
  ChevronRight,
  Clock,
  Download,
  ExternalLink,
  Film,
  Flame,
  Filter,
  Layers,
  LoaderCircle,
  Play,
  RefreshCw,
  Search,
  Terminal,
  TriangleAlert,
  X,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import type { MediaItem } from '../types';

interface CatalogViewProps {
  movies: MediaItem[];
  searchResults: MediaItem[] | null;
  searchQuery: string;
  onSearchQueryChange: (val: string) => void;
  onTriggerSearch: (query: string) => void;
  onRefreshDashboard: () => void;
  loading: boolean;
  searching: boolean;
  error: string | null;
  searchError: string | null;
  seriesEpisodes: MediaItem[];
  seriesTitle: string | null;
  loadingSeries: boolean;
  onFetchSeries: (item: MediaItem) => void;
  onClearSeries: () => void;
  onPlayItem: (item: MediaItem) => void;
}

const QUICK_QUERIES = ['silo', 'action', 'demon', 'mesach', 'prison'];

export function CatalogView({
  movies,
  searchResults,
  searchQuery,
  onSearchQueryChange,
  onTriggerSearch,
  onRefreshDashboard,
  loading,
  searching,
  error,
  searchError,
  seriesEpisodes,
  seriesTitle,
  loadingSeries,
  onFetchSeries,
  onClearSeries,
  onPlayItem,
}: CatalogViewProps) {
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [selectedVj, setSelectedVj] = useState('All');

  const sourceList = useMemo(() => {
    if (searchResults !== null) return searchResults;
    return movies.filter(
      (item) =>
        item.id !== 67861 &&
        !/rachael\s*magoola|rachel\s*magoola|just say it:\s*rachael/i.test(
          `${item.title || ''} ${item.description || ''}`
        )
    );
  }, [movies, searchResults]);

  const categories = useMemo(() => {
    const set = new Set<string>();
    sourceList.forEach((item) => {
      if (item.category_name) {
        item.category_name.split('/').forEach((part) => {
          const clean = part.trim();
          if (clean) set.add(clean);
        });
      }
    });
    return ['All', ...Array.from(set)];
  }, [sourceList]);

  const vjs = useMemo(() => {
    const map = new Map<string, string>();
    sourceList.forEach((item) => {
      if (item.vj && item.vj.trim()) {
        const key = item.vj.trim().toLowerCase();
        if (!map.has(key)) map.set(key, item.vj.trim());
      }
    });
    return ['All', ...Array.from(map.values())];
  }, [sourceList]);

  const filteredItems = useMemo(() => {
    return sourceList.filter((item) => {
      const catMatch =
        selectedCategory === 'All' ||
        !item.category_name ||
        item.category_name.toLowerCase().includes(selectedCategory.toLowerCase());
      const vjMatch =
        selectedVj === 'All' ||
        (item.vj && item.vj.trim().toLowerCase() === selectedVj.trim().toLowerCase());
      return catMatch && vjMatch;
    });
  }, [sourceList, selectedCategory, selectedVj]);

  const [slideIndex, setSlideIndex] = useState(0);
  const [isSliderPaused, setIsSliderPaused] = useState(false);

  const featuredSlides = useMemo(() => {
    if (searchQuery.trim() || filteredItems.length === 0) return [];

    const hasRealTitle = (item: MediaItem) =>
      Boolean(item.title && !/^Media #\d+$/i.test(item.title.trim()));

    const isActionItem = (item: MediaItem) =>
      /action/i.test(item.category_name || '') ||
      /\b(fighter|war|kill|mission|prejudice|dawn|agents|dunkirk|heist|hunter|cyber)\b/i.test(
        `${item.title || ''} ${item.description || ''}`
      );

    const isLatestItem = (item: MediaItem) =>
      /latest/i.test(item.category_name || '');

    if (selectedCategory === 'All' && selectedVj === 'All') {
      const titled = filteredItems.filter(hasRealTitle);
      const sourcePool = titled.length > 0 ? titled : filteredItems;

      const actionPool = sourcePool.filter((m) => isActionItem(m));
      const latestPool = sourcePool.filter((m) => isLatestItem(m) && !isActionItem(m));
      const fallbackLatest = latestPool.length > 0 ? latestPool : sourcePool;

      const combined: Array<{ item: MediaItem; trackLabel: 'Action' | 'Latest' }> = [];
      const seen = new Set<number>();

      const pushUnique = (item: MediaItem | undefined, trackLabel: 'Action' | 'Latest') => {
        if (!item || seen.has(item.id)) return;
        seen.add(item.id);
        combined.push({ item, trackLabel });
      };

      const maxPairs = Math.max(fallbackLatest.length, actionPool.length);
      for (let i = 0; i < maxPairs && combined.length < 12; i++) {
        pushUnique(fallbackLatest[i], 'Latest');
        if (combined.length >= 12) break;
        pushUnique(actionPool[i], 'Action');
      }

      for (const item of sourcePool) {
        if (combined.length >= 12) break;
        pushUnique(item, isActionItem(item) ? 'Action' : 'Latest');
      }

      return combined;
    }

    const titledFiltered = filteredItems.filter(hasRealTitle);
    const pool = (titledFiltered.length > 0 ? titledFiltered : filteredItems).slice(0, 12);
    return pool.map((item) => ({
      item,
      trackLabel: (isActionItem(item) ? 'Action' : 'Latest') as 'Action' | 'Latest',
    }));
  }, [searchQuery, filteredItems, selectedCategory, selectedVj]);

  useEffect(() => {
    setSlideIndex(0);
  }, [selectedCategory, selectedVj]);

  useEffect(() => {
    if (featuredSlides.length <= 1 || isSliderPaused) return;
    const timer = window.setInterval(() => {
      setSlideIndex((prev) => (prev + 1) % featuredSlides.length);
    }, 3000);
    return () => window.clearInterval(timer);
  }, [featuredSlides.length, isSliderPaused]);

  const activeSlideIndex =
    featuredSlides.length > 0 ? slideIndex % featuredSlides.length : 0;
  const activeSlide =
    featuredSlides.length > 0 ? featuredSlides[activeSlideIndex] : null;
  const featured = activeSlide?.item ?? null;

  return (
    <div className="space-y-8">
      {featured && activeSlide && (
        <section
          aria-roledescription="carousel"
          aria-label="Featured Premiere Movies"
          onMouseEnter={() => setIsSliderPaused(true)}
          onMouseLeave={() => setIsSliderPaused(false)}
          className="relative rounded-2xl overflow-hidden border border-slate-800 bg-slate-900 group min-h-[340px] sm:min-h-[400px] flex flex-col justify-end"
        >
          {featuredSlides.map((slide, idx) => {
            const isActive = idx === activeSlideIndex;
            return (
              <img
                key={slide.item.id}
                src={slide.item.backdrop || slide.item.image}
                alt={slide.item.title}
                referrerPolicy="no-referrer"
                onError={(e) => {
                  e.currentTarget.style.opacity = '0';
                }}
                className={`absolute inset-0 w-full h-full object-cover transition-all duration-700 ease-out ${
                  isActive
                    ? 'opacity-45 scale-100 group-hover:scale-105'
                    : 'opacity-0 scale-105 pointer-events-none'
                }`}
              />
            );
          })}
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/75 to-transparent pointer-events-none" />
          <div className="absolute inset-0 bg-gradient-to-r from-slate-950 via-slate-950/70 to-transparent pointer-events-none" />

          <div className="relative p-6 sm:p-10 lg:p-12 flex flex-col lg:flex-row lg:items-end justify-between gap-6">
            <div key={featured.id} className="max-w-3xl space-y-4">
              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-300 tabular-nums">
                <span className="font-semibold text-rose-400">Featured Premiere</span>
                <span aria-hidden="true">·</span>
                <span
                  className={`font-semibold ${
                    activeSlide.trackLabel === 'Action' ? 'text-cyan-300' : 'text-emerald-300'
                  }`}
                >
                  {activeSlide.trackLabel} Movie
                </span>
                <span aria-hidden="true">·</span>
                <span className="text-amber-300 font-medium">{featured.vj || 'VJ Junior'}</span>
                <span aria-hidden="true">·</span>
                <span className="font-mono">{featured.duration || '01h 45m'}</span>
                <span aria-hidden="true">·</span>
                <span className="font-mono">{featured.size || '1.1 GB'}</span>
                <span aria-hidden="true">·</span>
                <span className="font-mono text-emerald-400">{featured.quality || '1080p HD'}</span>
              </div>

              <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-white leading-tight [text-wrap:balance]">
                {featured.title}
              </h1>

              <p className="text-sm sm:text-base text-slate-300 line-clamp-3 leading-relaxed max-w-2xl">
                {featured.description}
              </p>

              <div className="pt-2 flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={() => onPlayItem(featured)}
                  className="flex items-center gap-2 px-6 py-3 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-semibold text-sm transition-colors whitespace-nowrap shrink-0"
                >
                  <Play className="w-4 h-4 fill-white" />
                  <span>Stream Now</span>
                </button>

                <a
                  href={`/movie/${featured.id}`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-2 px-4 py-3 rounded-xl bg-slate-900/90 hover:bg-slate-800 text-slate-200 border border-slate-700 font-medium text-sm transition-colors whitespace-nowrap shrink-0"
                >
                  <Terminal className="w-4 h-4 text-emerald-400" />
                  <span>API JSON</span>
                  <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
                </a>

                <a
                  href={`/movie/${featured.id}/play`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-2 px-4 py-3 rounded-xl bg-slate-900/90 hover:bg-slate-800 text-slate-200 border border-slate-700 font-medium text-sm transition-colors whitespace-nowrap shrink-0"
                >
                  <Download className="w-4 h-4 text-cyan-400" />
                  <span>Direct Stream</span>
                </a>
              </div>
            </div>

            {featuredSlides.length > 1 && (
              <div className="flex flex-col sm:flex-row lg:flex-col items-start sm:items-center lg:items-end gap-3 shrink-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono text-slate-300 tabular-nums mr-1">
                    {String(activeSlideIndex + 1).padStart(2, '0')} /{' '}
                    {String(featuredSlides.length).padStart(2, '0')}
                  </span>
                  <button
                    type="button"
                    aria-label="Previous featured movie"
                    onClick={() =>
                      setSlideIndex(
                        (prev) => (prev - 1 + featuredSlides.length) % featuredSlides.length
                      )
                    }
                    className="p-2 rounded-lg bg-slate-900/90 hover:bg-slate-800 text-slate-200 border border-slate-700 transition-colors"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    aria-label="Next featured movie"
                    onClick={() =>
                      setSlideIndex((prev) => (prev + 1) % featuredSlides.length)
                    }
                    className="p-2 rounded-lg bg-slate-900/90 hover:bg-slate-800 text-slate-200 border border-slate-700 transition-colors"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>

                <div
                  className="flex items-center gap-1.5"
                  role="tablist"
                  aria-label="Select featured movie slide"
                >
                  {featuredSlides.map((slide, idx) => {
                    const isActive = idx === activeSlideIndex;
                    return (
                      <button
                        key={slide.item.id}
                        type="button"
                        role="tab"
                        aria-selected={isActive}
                        aria-label={`Slide ${idx + 1}: ${slide.item.title}`}
                        onClick={() => setSlideIndex(idx)}
                        className={`h-1.5 rounded-full transition-all duration-300 ${
                          isActive
                            ? 'w-7 bg-rose-500'
                            : 'w-2.5 bg-slate-600/80 hover:bg-slate-400'
                        }`}
                      />
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </section>
      )}

      <section className="flex flex-col gap-4 bg-slate-900/70 p-4 sm:p-5 rounded-2xl border border-slate-800">
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              setSelectedCategory('All');
              setSelectedVj('All');
              onTriggerSearch(searchQuery);
            }}
            className="relative flex-1 flex items-center gap-2"
          >
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search UG SHACKS API (/search?q=silo, action, demon, kampala)..."
                value={searchQuery}
                onChange={(e) => {
                  setSelectedCategory('All');
                  setSelectedVj('All');
                  onSearchQueryChange(e.target.value);
                }}
                className="w-full pl-10 pr-10 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-rose-500/50 focus:border-rose-500"
              />
              {searching ? (
                <div className="absolute right-3.5 top-1/2 -translate-y-1/2">
                  <LoaderCircle className="w-4 h-4 text-rose-500 animate-spin" />
                </div>
              ) : (
                searchQuery && (
                  <button
                    type="button"
                    aria-label="Clear search"
                    onClick={() => onSearchQueryChange('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )
              )}
            </div>
            <button
              type="submit"
              className="px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold transition-colors whitespace-nowrap shrink-0"
            >
              Search API
            </button>
          </form>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1.5 text-xs text-slate-400 mr-1">
              <Filter className="w-3.5 h-3.5" />
              <span>Category:</span>
            </div>

            {categories.slice(0, 5).map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                  selectedCategory === cat
                    ? 'bg-rose-600 text-white'
                    : 'bg-slate-800/80 text-slate-400 hover:text-slate-200'
                }`}
              >
                {cat}
              </button>
            ))}

            <select
              aria-label="Filter by VJ"
              value={selectedVj}
              onChange={(e) => setSelectedVj(e.target.value)}
              className="px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-300 focus:outline-none focus:ring-2 focus:ring-rose-500"
            >
              <option value="All">All VJs</option>
              {vjs
                .filter((v) => v !== 'All')
                .map((vj) => (
                  <option key={vj} value={vj}>
                    {vj}
                  </option>
                ))}
            </select>

            <button
              type="button"
              onClick={() => {
                if (searchQuery.trim()) {
                  onTriggerSearch(searchQuery);
                } else {
                  onRefreshDashboard();
                }
              }}
              disabled={loading || searching}
              title="Refresh from API"
              className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading || searching ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs pt-2 border-t border-slate-800/80">
          <span className="text-slate-500 font-mono text-[11px]">Quick Queries:</span>
          {QUICK_QUERIES.map((q) => (
            <button
              key={q}
              type="button"
              onClick={() => {
                setSelectedCategory('All');
                setSelectedVj('All');
                onSearchQueryChange(q);
                onTriggerSearch(q);
              }}
              className={`px-2.5 py-1 rounded-md font-mono text-[11px] transition-colors whitespace-nowrap shrink-0 ${
                searchQuery.toLowerCase() === q
                  ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                  : 'bg-slate-950 text-slate-400 hover:text-slate-200 border border-slate-800'
              }`}
            >
              /search?q={q}
            </button>
          ))}

          {searchQuery.trim() && (
            <a
              href={`/search?q=${encodeURIComponent(searchQuery.trim())}`}
              target="_blank"
              rel="noreferrer"
              className="ml-auto flex items-center gap-1 text-[11px] font-mono text-emerald-400 hover:underline whitespace-nowrap shrink-0"
            >
              <span>Open Raw /search?q={searchQuery.trim()} JSON</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          )}
        </div>
      </section>

      {(loadingSeries || seriesEpisodes.length > 0) && (
        <section className="p-5 rounded-2xl bg-slate-900 border border-rose-500/40 space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-2">
              <Layers className="w-4 h-4 text-rose-400" />
              <h3 className="text-sm font-bold text-white">
                Series Episodes: {seriesTitle}
              </h3>
              <span className="text-xs font-mono text-slate-400 tabular-nums">
                ({seriesEpisodes.length} episodes via /series/:id)
              </span>
            </div>
            <button
              type="button"
              onClick={onClearSeries}
              aria-label="Close series drawer"
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {loadingSeries ? (
            <div className="py-6 flex items-center justify-center gap-2 text-xs text-slate-400">
              <LoaderCircle className="w-4 h-4 animate-spin text-rose-500" />
              <span>Resolving series seasons and episodes...</span>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {seriesEpisodes.map((ep) => (
                <div
                  key={ep.id}
                  className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between gap-3 hover:border-rose-500/50 transition-colors"
                >
                  <div className="min-w-0">
                    <div className="font-bold text-xs text-white truncate">{ep.title}</div>
                    <div className="text-[11px] font-mono text-slate-400 mt-0.5 tabular-nums">
                      ID #{ep.id} · {ep.size || '700 MB'}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => onPlayItem(ep)}
                    aria-label={`Play ${ep.title}`}
                    className="p-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-white shrink-0 transition-colors"
                  >
                    <Play className="w-3.5 h-3.5 fill-white" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      <section>
        <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
          <div className="flex items-center gap-2">
            <Flame className="w-5 h-5 text-rose-500" />
            <h2 className="text-lg font-bold text-slate-100">
              {searchQuery.trim() ? `Search Results for "${searchQuery}"` : 'Catalog Feed'}
            </h2>
            <span className="text-xs text-slate-400 font-mono tabular-nums">
              ({filteredItems.length} items)
            </span>
          </div>

          <div className="text-xs text-slate-400 font-mono">
            Endpoint:{' '}
            <span className="text-emerald-400">
              {searchQuery.trim()
                ? `/search?q=${encodeURIComponent(searchQuery.trim())}`
                : '/dashboard'}
            </span>
          </div>
        </div>

        {loading || searching ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
            {Array.from({ length: 8 }).map((_, idx) => (
              <div
                key={idx}
                className="bg-slate-900 rounded-2xl overflow-hidden border border-slate-800 animate-pulse h-72 flex flex-col"
              >
                <div className="aspect-[16/10] bg-slate-800/60" />
                <div className="p-4 space-y-3 flex-1 flex flex-col justify-between">
                  <div className="space-y-2">
                    <div className="h-4 bg-slate-800 rounded w-3/4" />
                    <div className="h-3 bg-slate-800 rounded w-1/2" />
                  </div>
                  <div className="h-8 bg-slate-800 rounded" />
                </div>
              </div>
            ))}
          </div>
        ) : error || searchError ? (
          <div className="text-center py-16 bg-slate-900/50 rounded-2xl border border-rose-900/50 p-6 space-y-3">
            <TriangleAlert className="w-10 h-10 text-rose-500 mx-auto" />
            <p className="text-slate-300 font-medium">{searchError || error}</p>
            <button
              type="button"
              onClick={() => (searchQuery.trim() ? onTriggerSearch(searchQuery) : onRefreshDashboard())}
              className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold"
            >
              Retry API Request
            </button>
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="text-center py-16 bg-slate-900/40 rounded-2xl border border-dashed border-slate-800">
            <Film className="w-10 h-10 text-slate-600 mx-auto mb-3" />
            <p className="text-slate-400 font-medium">
              No items matched "{searchQuery}" with current filters
            </p>
            <button
              type="button"
              onClick={() => {
                onSearchQueryChange('');
                setSelectedCategory('All');
                setSelectedVj('All');
              }}
              className="mt-3 text-xs text-rose-400 hover:underline"
            >
              Reset search & filters
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
            {filteredItems.map((item) => (
              <article
                key={`${item.id}-${item.series_code || ''}`}
                className="group bg-slate-900 rounded-2xl overflow-hidden border border-slate-800 hover:border-rose-500/50 transition-colors flex flex-col"
              >
                <div className="relative aspect-[16/10] overflow-hidden bg-slate-950">
                  <img
                    src={item.image}
                    alt={item.title}
                    referrerPolicy="no-referrer"
                    loading="lazy"
                    onError={(e) => {
                      e.currentTarget.style.opacity = '0';
                    }}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/30 to-transparent" />

                  <div className="absolute bottom-2.5 left-3 right-3 flex items-center justify-between gap-2 text-[11px] text-slate-200 tabular-nums">
                    <span className="font-semibold text-rose-400 truncate">
                      {item.vj || 'VJ Junior'} · {item.is_series || item.type === 'SERIES' ? 'SERIES' : 'MOVIE'}
                    </span>
                    <span className="flex items-center gap-1 font-mono text-slate-300 shrink-0">
                      <Clock className="w-3 h-3 text-slate-400" />
                      {item.duration || '01h 35m'}
                    </span>
                  </div>

                  <button
                    type="button"
                    aria-label={`Play ${item.title}`}
                    onClick={() => onPlayItem(item)}
                    className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/45"
                  >
                    <div className="w-12 h-12 rounded-full bg-rose-600 text-white flex items-center justify-center shadow-lg">
                      <Play className="w-5 h-5 fill-white ml-0.5" />
                    </div>
                  </button>
                </div>

                <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
                  <div>
                    <div className="flex items-center justify-between text-xs text-slate-400 mb-1 tabular-nums">
                      <span className="truncate">{item.category_name || (item.is_series ? 'TV Series' : 'Action')}</span>
                      <span className="font-mono text-slate-500 shrink-0 ml-2">{item.size || '1.0 GB'}</span>
                    </div>

                    <h3 className="font-bold text-slate-100 group-hover:text-rose-400 transition-colors line-clamp-1">
                      {item.title}
                    </h3>

                    <p className="text-xs text-slate-400 line-clamp-2 mt-1 leading-relaxed">
                      {item.description || `ID #${item.id} · Streamed via UG SHACKS Movie API.`}
                    </p>
                  </div>

                  <div className="pt-2.5 border-t border-slate-800 flex items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => onPlayItem(item)}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold transition-colors whitespace-nowrap"
                    >
                      <Play className="w-3 h-3 fill-white" />
                      <span>Play</span>
                    </button>

                    {(item.is_series || item.type === 'SERIES') && (
                      <button
                        type="button"
                        onClick={() => onFetchSeries(item)}
                        title="Fetch all episodes via /series/:id"
                        className="px-2.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-amber-300 text-xs font-medium transition-colors flex items-center gap-1 whitespace-nowrap shrink-0"
                      >
                        <Layers className="w-3.5 h-3.5" />
                        <span>Eps</span>
                      </button>
                    )}

                    <a
                      href={`/movie/${item.id}/play`}
                      title="Direct stream"
                      target="_blank"
                      rel="noreferrer"
                      className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors shrink-0"
                    >
                      <Download className="w-3.5 h-3.5" />
                    </a>

                    <a
                      href={`/movie/${item.id}`}
                      title="Direct JSON from API"
                      target="_blank"
                      rel="noreferrer"
                      className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors shrink-0"
                    >
                      <Terminal className="w-3.5 h-3.5" />
                    </a>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

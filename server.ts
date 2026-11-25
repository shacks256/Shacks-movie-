import 'dotenv/config';
import crypto from 'crypto';
import express, { type Request, type Response } from 'express';
import fs from 'fs';
import path from 'path';
import { Readable } from 'stream';
import { fileURLToPath } from 'url';
import {
  AUDIT_REPORT,
  CATALOG_MOVIES,
  DASHBOARD_SECTIONS,
  ENDPOINT_PRESETS,
  LIVE_CHANNELS,
  SERIES_CATALOG,
  WORKER_CODE_DATA,
  findAllMediaItems,
} from './server/data.js';
import type { LiveChannel, MediaItem, SeriesRecord, SeriesSeason } from './src/types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;
const UPSTREAM_SOURCE = process.env.UPSTREAM_API_URL?.trim() || 'https://mumowatch.ai.studio';
const UPSTREAM_KEY = process.env.UPSTREAM_API_KEY?.trim() || '';
function resolveLocalAsset(relPath: string): string | undefined {
  const cleanRel = relPath.replace(/^\/+/, '');
  const devCandidate = path.resolve(__dirname, cleanRel);
  if (fs.existsSync(devCandidate)) return devCandidate;
  const distCandidate = path.resolve(__dirname, 'dist', cleanRel);
  if (fs.existsSync(distCandidate)) return distCandidate;
  return undefined;
}

const FALLBACK_IMAGE_REL = 'src/assets/images/cinema_hero_premiere_1795637611164.jpg';
const MEDIA_FETCH_UA = 'Mozilla/5.0 (compatible; UGShacksGateway/1.0)';
const MAX_REGISTRY_SIZE = 5000;

// Private server-only registries — never serialized or exposed to clients
const videoRegistry = new Map<string, { url: string; title: string }>();
const imageRegistry = new Map<string, string>();
const seriesCodeIndex = new Map<string, string>();
let warmPromise: Promise<void> | null = null;
let lastWarmAt = 0;

function setBoundedMap<K, V>(map: Map<K, V>, key: K, val: V): void {
  if (map.size >= MAX_REGISTRY_SIZE && !map.has(key)) {
    const oldest = map.keys().next().value;
    if (oldest !== undefined) map.delete(oldest);
  }
  map.set(key, val);
}

function safeExternalUrl(rawUrl: string): string {
  const trimmed = rawUrl.trim();
  try {
    const parsed = new URL(trimmed);
    parsed.pathname = parsed.pathname
      .split('/')
      .map((seg) => encodeURIComponent(decodeURIComponent(seg)))
      .join('/');
    return parsed.toString();
  } catch {
    return trimmed.replace(/ /g, '%20');
  }
}

function hashKey(value: string): string {
  return crypto.createHash('sha256').update(value).digest('hex').slice(0, 16);
}

function getPublicOrigin(req: Request): string {
  const fwdProto = (req.headers['x-forwarded-proto'] as string | undefined)
    ?.split(',')[0]
    ?.trim();
  const proto = fwdProto || req.protocol || 'http';
  const fwdHost = (req.headers['x-forwarded-host'] as string | undefined)
    ?.split(',')[0]
    ?.trim();
  const host = fwdHost || req.get('host');
  if (host) return `${proto}://${host}`;
  if (process.env.APP_URL) return process.env.APP_URL.replace(/\/$/, '');
  return `http://localhost:${PORT}`;
}

function sanitizeText(input: unknown, fallback = ''): string {
  if (typeof input !== 'string') return fallback;
  return input
    .replace(/https?:\/\/[^\s"'<>]+/gi, '')
    .replace(
      /mumowatch|munowatch|munotek|munotech|jesse\s*network|jesse|b-cdn|apposters|bunnycdn|bunny\.net/gi,
      'UG SHACKS'
    )
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function registerImage(key: string, rawUrl?: string): void {
  if (!rawUrl || typeof rawUrl !== 'string') return;
  const trimmed = rawUrl.trim();
  if (!trimmed) return;
  setBoundedMap(imageRegistry, key, trimmed);
  setBoundedMap(imageRegistry, `p:${hashKey(trimmed)}`, trimmed);
}

function registerVideo(id: string, rawUrl?: string, title = 'media'): void {
  if (!rawUrl || typeof rawUrl !== 'string') return;
  const trimmed = rawUrl.trim();
  if (!trimmed) return;
  const cleanTitle = sanitizeText(title, `media_${id}`) || `media_${id}`;
  setBoundedMap(videoRegistry, id, { url: trimmed, title: cleanTitle });
}

function toPublicMediaItem(raw: Partial<MediaItem>, baseUrl: string): MediaItem {
  const id = Number(raw.id) || 0;
  const idStr = String(id || raw.series_code || '0');

  if (raw.playingurl) {
    registerVideo(idStr, raw.playingurl, raw.title || `media_${idStr}`);
  }
  if (raw.image) {
    registerImage(`m:${idStr}`, raw.image);
  }
  if (raw.backdrop) {
    registerImage(`b:${idStr}`, raw.backdrop);
  }
  if (raw.series_code && id) {
    setBoundedMap(seriesCodeIndex, String(raw.series_code).trim().toLowerCase(), idStr);
    if (raw.image) {
      registerImage(`s:${String(raw.series_code).trim()}`, raw.image);
    }
  }

  const publicImage = raw.image ? `${baseUrl}/img/m/${idStr}.jpg` : `${baseUrl}/img/m/default.jpg`;
  const publicBackdrop = raw.backdrop
    ? `${baseUrl}/img/b/${idStr}.jpg`
    : publicImage;
  const publicStream = `${baseUrl}/stream/${idStr}`;

  return {
    id,
    title: sanitizeText(raw.title, `Media #${idStr}`),
    vj: sanitizeText(raw.vj, 'VJ Junior') || 'VJ Junior',
    category_id: String(raw.category_id || '1'),
    category_name: sanitizeText(
      raw.category_name,
      raw.type === 'SERIES' ? 'TV Series' : 'Movies'
    ),
    duration: String(raw.duration || '01h 30m'),
    size: String(raw.size || '850 MB'),
    image: publicImage,
    backdrop: publicBackdrop,
    playingurl: publicStream,
    streamurl: publicStream,
    description: sanitizeText(
      raw.description,
      `Streamed via UG SHACKS Movie API (${idStr}).`
    ),
    type: raw.type === 'SERIES' ? 'SERIES' : 'MOVIE',
    media_type: raw.type === 'SERIES' || raw.media_type === 'serie' ? 'serie' : 'movie',
    is_series:
      Boolean(raw.is_series) ||
      raw.type === 'SERIES' ||
      Boolean(raw.series_code && String(raw.series_code) !== idStr),
    series_code: String(raw.series_code || idStr),
    ...(raw.series_title ? { series_title: sanitizeText(raw.series_title) } : {}),
    ...(raw.season !== undefined ? { season: raw.season } : {}),
    ...(raw.episode !== undefined ? { episode: raw.episode } : {}),
    ...(raw.code ? { code: sanitizeText(String(raw.code)) } : {}),
    quality: String(raw.quality || '1080p HD'),
    ...(raw.timestamp ? { timestamp: raw.timestamp } : {}),
  };
}

function toPublicSeries(raw: Partial<SeriesRecord>, baseUrl: string): SeriesRecord {
  const rawSeriesKey = String(raw.series_code || raw.slug || 'series').trim();
  const encodedSeriesKey = encodeURIComponent(rawSeriesKey);
  if (raw.image) {
    registerImage(`s:${rawSeriesKey}`, raw.image);
    if (raw.slug) registerImage(`s:${String(raw.slug).trim()}`, raw.image);
    if (Array.isArray(raw.series_codes)) {
      raw.series_codes.forEach((sc) => {
        if (sc) registerImage(`s:${String(sc).trim()}`, raw.image);
      });
    }
  }
  const publicSeriesImage = raw.image
    ? `${baseUrl}/img/s/${encodedSeriesKey}.jpg`
    : `${baseUrl}/img/m/default.jpg`;

  const seasons: SeriesSeason[] = Array.isArray(raw.seasons)
    ? raw.seasons.map((season) => {
        const rawSeasonKey = String(season.series_code || `${rawSeriesKey}-s${season.season}`).trim();
        const encodedSeasonKey = encodeURIComponent(rawSeasonKey);
        if (season.image) {
          registerImage(`s:${rawSeasonKey}`, season.image);
        }
        return {
          season: season.season,
          title: sanitizeText(season.title, `Season ${season.season}`),
          series_code: String(season.series_code || ''),
          image: season.image ? `${baseUrl}/img/s/${encodedSeasonKey}.jpg` : publicSeriesImage,
          vj: sanitizeText(season.vj, 'VJ Junior') || 'VJ Junior',
          count: Number(season.count || season.episodes?.length || 0),
          episodes: Array.isArray(season.episodes)
            ? season.episodes.map((ep) => toPublicMediaItem(ep, baseUrl))
            : [],
        };
      })
    : [];

  const episodes: MediaItem[] = Array.isArray(raw.episodes)
    ? raw.episodes.map((ep) => toPublicMediaItem(ep, baseUrl))
    : seasons.flatMap((s) => s.episodes);

  const firstEpId = episodes[0]?.id ? String(episodes[0].id) : String(raw.slug || '').trim();
  if (firstEpId) {
    if (raw.series_code) {
      setBoundedMap(seriesCodeIndex, String(raw.series_code).trim().toLowerCase(), firstEpId);
    }
    if (raw.slug) {
      setBoundedMap(seriesCodeIndex, String(raw.slug).trim().toLowerCase(), firstEpId);
    }
    if (Array.isArray(raw.series_codes)) {
      raw.series_codes.forEach((sc) => {
        if (sc) setBoundedMap(seriesCodeIndex, String(sc).trim().toLowerCase(), firstEpId);
      });
    }
  }

  return {
    title: sanitizeText(raw.title, 'Series'),
    slug: sanitizeText(String(raw.slug || '')),
    series_code: String(raw.series_code || ''),
    series_codes: Array.isArray(raw.series_codes) ? raw.series_codes : [],
    season_count: Number(raw.season_count || seasons.length),
    episode_count: Number(raw.episode_count || episodes.length),
    count: Number(raw.count || episodes.length),
    image: publicSeriesImage,
    vj: sanitizeText(raw.vj, 'VJ Junior') || 'VJ Junior',
    description: sanitizeText(raw.description, ''),
    seasons,
    episodes,
  };
}

function toPublicChannel(raw: Partial<LiveChannel>, baseUrl: string): LiveChannel {
  const id = String(raw.id || 'ch-1');
  if (raw.playingurl) {
    registerVideo(id, raw.playingurl, raw.name || id);
  }
  if (raw.thumbnail) {
    registerImage(`c:${id}`, raw.thumbnail);
  }

  return {
    id,
    name: sanitizeText(raw.name, `UG SHACKS Channel ${id}`),
    category: sanitizeText(raw.category, 'Live 24/7'),
    bitrate: String(raw.bitrate || '10.0 Mbps'),
    resolution: String(raw.resolution || '1080p HD'),
    currentShow: sanitizeText(raw.currentShow, 'Live Feature'),
    vj: sanitizeText(raw.vj, 'VJ Junior') || 'VJ Junior',
    viewers: String(raw.viewers || '8.5K Watching'),
    thumbnail: raw.thumbnail ? `${baseUrl}/img/c/${id}.jpg` : `${baseUrl}/img/m/default.jpg`,
    playingurl: `${baseUrl}/stream/${id}`,
    edgeNode: `edge-${id}.ugshacks.api`,
  };
}

async function tryUpstreamJson<T>(routePath: string): Promise<T | null> {
  if (!UPSTREAM_SOURCE) return null;
  try {
    const targetUrl = new URL(routePath, UPSTREAM_SOURCE).toString();
    const headers: Record<string, string> = { Accept: 'application/json' };
    if (UPSTREAM_KEY) {
      headers.Authorization = `Bearer ${UPSTREAM_KEY}`;
    }
    const res = await fetch(targetUrl, {
      headers,
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

function findLocalMediaById(rawId: string): MediaItem | undefined {
  const numId = Number(rawId);
  if (!Number.isFinite(numId)) return undefined;
  return findAllMediaItems().find((item) => item.id === numId);
}

async function fetchRawMediaById(rawId: string): Promise<MediaItem | undefined> {
  const upstream = await tryUpstreamJson<MediaItem>(`/movie/${encodeURIComponent(rawId)}`);
  if (upstream && (upstream.id || upstream.playingurl)) {
    return upstream;
  }
  return findLocalMediaById(rawId);
}

function findLocalSeriesByKey(rawKey: string): SeriesRecord | undefined {
  const key = rawKey.trim().toLowerCase();
  if (!key) return undefined;

  const direct = SERIES_CATALOG.find(
    (s) =>
      s.slug.toLowerCase() === key ||
      s.title.toLowerCase() === key ||
      s.series_code === key ||
      s.series_codes.includes(key)
  );
  if (direct) return direct;

  const numId = Number(key);
  if (Number.isFinite(numId)) {
    return SERIES_CATALOG.find((s) =>
      s.seasons.some((season) => season.episodes.some((ep) => ep.id === numId))
    );
  }
  return undefined;
}

async function resolveVideoTarget(
  id: string
): Promise<{ url: string; title: string } | undefined> {
  const cached = videoRegistry.get(id);
  if (cached) return cached;

  if (id.startsWith('ch-')) {
    const upstreamChannels = await tryUpstreamJson<LiveChannel[]>('/api/channels');
    const foundUp = upstreamChannels?.find((c) => c.id === id);
    if (foundUp?.playingurl) {
      registerVideo(id, foundUp.playingurl, foundUp.name);
      return videoRegistry.get(id);
    }
    const foundLocal = LIVE_CHANNELS.find((c) => c.id === id);
    if (foundLocal?.playingurl) {
      registerVideo(id, foundLocal.playingurl, foundLocal.name);
      return videoRegistry.get(id);
    }
  }

  const media = await fetchRawMediaById(id);
  if (media?.playingurl) {
    registerVideo(id, media.playingurl, media.title || `video_${id}`);
    return videoRegistry.get(id);
  }

  return undefined;
}

function hasSeriesEpisodes(raw?: Partial<SeriesRecord> | null): raw is Partial<SeriesRecord> {
  if (!raw) return false;
  return (
    Number(raw.episode_count || 0) > 0 ||
    (Array.isArray(raw.episodes) && raw.episodes.length > 0) ||
    (Array.isArray(raw.seasons) && raw.seasons.some((s) => (s.episodes?.length ?? 0) > 0))
  );
}

async function resolveLiveSeries(rawKey: string): Promise<Partial<SeriesRecord> | undefined> {
  const key = rawKey.trim();
  if (!key) return undefined;

  const directUpstream = await tryUpstreamJson<Partial<SeriesRecord>>(
    `/series/${encodeURIComponent(key)}`
  );
  if (hasSeriesEpisodes(directUpstream)) {
    return directUpstream;
  }

  await ensureRegistriesWarmed();
  const mappedKey = seriesCodeIndex.get(key.toLowerCase());
  if (mappedKey && mappedKey !== key) {
    const mappedUpstream = await tryUpstreamJson<Partial<SeriesRecord>>(
      `/series/${encodeURIComponent(mappedKey)}`
    );
    if (hasSeriesEpisodes(mappedUpstream)) {
      return mappedUpstream;
    }
  }

  const localSeries = findLocalSeriesByKey(key);
  if (localSeries) {
    const altKeys = [
      localSeries.slug,
      localSeries.seasons[0]?.episodes[0]?.id ? String(localSeries.seasons[0].episodes[0].id) : '',
    ].filter((alt) => alt && alt !== key);

    for (const alt of altKeys) {
      const upAlt = await tryUpstreamJson<Partial<SeriesRecord>>(
        `/series/${encodeURIComponent(alt)}`
      );
      if (hasSeriesEpisodes(upAlt)) {
        return upAlt;
      }
    }
  }

  const searchHit = await tryUpstreamJson<{ series?: Partial<SeriesRecord>[] }>(
    `/search?q=${encodeURIComponent(key)}`
  );
  const matchedUpSeries = searchHit?.series?.find(
    (s) =>
      String(s.series_code || '').toLowerCase() === key.toLowerCase() ||
      String(s.slug || '').toLowerCase() === key.toLowerCase() ||
      String(s.title || '').toLowerCase() === key.toLowerCase() ||
      (Array.isArray(s.series_codes) && s.series_codes.includes(key))
  );
  if (matchedUpSeries) {
    const epId =
      matchedUpSeries.episodes?.[0]?.id ||
      matchedUpSeries.seasons?.[0]?.episodes?.[0]?.id ||
      matchedUpSeries.slug;
    if (epId) {
      const full = await tryUpstreamJson<Partial<SeriesRecord>>(
        `/series/${encodeURIComponent(String(epId))}`
      );
      if (hasSeriesEpisodes(full)) return full;
    }
    if (hasSeriesEpisodes(matchedUpSeries)) return matchedUpSeries;
  }

  return localSeries;
}

async function resolveImageTarget(kind: string, key: string): Promise<string | undefined> {
  const mapKey = `${kind}:${key}`;
  const cached = imageRegistry.get(mapKey);
  if (cached) return cached;

  if (kind === 'm' || kind === 'b') {
    const media = await fetchRawMediaById(key);
    const chosen = kind === 'b' ? media?.backdrop || media?.image : media?.image;
    if (chosen) {
      registerImage(mapKey, chosen);
      return chosen;
    }
  }

  if (kind === 'c') {
    const upstreamChannels = await tryUpstreamJson<LiveChannel[]>('/api/channels');
    const foundUp = upstreamChannels?.find((c) => c.id === key);
    if (foundUp?.thumbnail) {
      registerImage(mapKey, foundUp.thumbnail);
      return foundUp.thumbnail;
    }
    const foundLocal = LIVE_CHANNELS.find((c) => c.id === key);
    if (foundLocal?.thumbnail) {
      registerImage(mapKey, foundLocal.thumbnail);
      return foundLocal.thumbnail;
    }
  }

  if (kind === 's') {
    const upstreamSeries = await tryUpstreamJson<SeriesRecord>(`/series/${encodeURIComponent(key)}`);
    if (upstreamSeries?.image) {
      registerImage(mapKey, upstreamSeries.image);
      return upstreamSeries.image;
    }

    await ensureRegistriesWarmed();
    const afterWarm = imageRegistry.get(mapKey);
    if (afterWarm) return afterWarm;

    const liveSeries = await resolveLiveSeries(key);
    if (liveSeries?.image) {
      registerImage(mapKey, liveSeries.image);
      return liveSeries.image;
    }

    const mediaFallback = await fetchRawMediaById(key);
    if (mediaFallback?.image) {
      registerImage(mapKey, mediaFallback.image);
      return mediaFallback.image;
    }
  }

  return undefined;
}

async function warmRegistries(): Promise<void> {
  try {
    const [dash, chans] = await Promise.all([
      tryUpstreamJson<{ movies?: MediaItem[] }>('/dashboard'),
      tryUpstreamJson<LiveChannel[]>('/api/channels'),
    ]);
    dash?.movies?.forEach((m) => {
      const idStr = String(m.id);
      if (m.playingurl) registerVideo(idStr, m.playingurl, m.title);
      if (m.image) registerImage(`m:${idStr}`, m.image);
      if (m.backdrop) registerImage(`b:${idStr}`, m.backdrop);
      if (m.series_code) {
        setBoundedMap(seriesCodeIndex, String(m.series_code).trim().toLowerCase(), idStr);
        if (m.image) registerImage(`s:${String(m.series_code).trim()}`, m.image);
      }
    });
    chans?.forEach((c) => {
      if (c.playingurl) registerVideo(c.id, c.playingurl, c.name);
      if (c.thumbnail) registerImage(`c:${c.id}`, c.thumbnail);
    });
    lastWarmAt = Date.now();
  } catch {
    // Non-fatal background warm-up
  }
}

async function ensureRegistriesWarmed(): Promise<void> {
  if (Date.now() - lastWarmAt < 5 * 60 * 1000 && imageRegistry.size > 0) {
    return;
  }
  if (!warmPromise) {
    warmPromise = warmRegistries().finally(() => {
      warmPromise = null;
    });
  }
  await warmPromise;
}

async function createApp() {
  const app = express();
  app.set('trust proxy', true);
  app.disable('x-powered-by');

  app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
    res.setHeader(
      'Access-Control-Allow-Headers',
      'Range, If-Range, Content-Type, Accept, Authorization, Origin'
    );
    res.setHeader(
      'Access-Control-Expose-Headers',
      'Content-Length, Content-Range, Accept-Ranges, Content-Disposition, Content-Type'
    );
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    res.setHeader('Referrer-Policy', 'no-referrer');
    if (req.method === 'OPTIONS') {
      res.status(204).end();
      return;
    }
    next();
  });

  app.get('/api/health', (req: Request, res: Response) => {
    const baseUrl = getPublicOrigin(req);
    res.json({
      status: 'ok',
      service: 'UG SHACKS Movie API',
      version: '1.0.0',
      baseUrl,
      endpoints: [
        `${baseUrl}/dashboard`,
        `${baseUrl}/search?q=<query>`,
        `${baseUrl}/movie/:id`,
        `${baseUrl}/movie/:id/play`,
        `${baseUrl}/series/:id`,
        `${baseUrl}/stream/:id`,
        `${baseUrl}/img/m/:id.jpg`,
        `${baseUrl}/api/dl/:id`,
        `${baseUrl}/api/preview/v2/:id`,
        `${baseUrl}/api/channels`,
        `${baseUrl}/api/presets`,
        `${baseUrl}/api/worker-code`,
        `${baseUrl}/api/audit`,
      ],
    });
  });

  app.get('/dashboard', async (req: Request, res: Response) => {
    const baseUrl = getPublicOrigin(req);
    const upstream = await tryUpstreamJson<{
      sections?: Array<{ id: number; category: string; count: number }>;
      unique_movies?: number;
      movies?: Partial<MediaItem>[];
    }>('/dashboard');

    if (upstream && Array.isArray(upstream.movies)) {
      const sections = (upstream.sections || DASHBOARD_SECTIONS).map((sec) => ({
        ...sec,
        category: sanitizeText(sec.category, sec.category),
      }));
      const movies = upstream.movies.map((m) => toPublicMediaItem(m, baseUrl));
      res.json({
        sections,
        unique_movies: upstream.unique_movies ?? movies.length,
        movies,
      });
      return;
    }

    res.json({
      sections: DASHBOARD_SECTIONS,
      unique_movies: CATALOG_MOVIES.length,
      movies: CATALOG_MOVIES.map((m) => toPublicMediaItem(m, baseUrl)),
    });
  });

  app.get('/search', async (req: Request, res: Response) => {
    const baseUrl = getPublicOrigin(req);
    const query = String(req.query.q || '').trim();
    const typeFilter = String(req.query.type || 'all').trim().toLowerCase();

    const upstream = await tryUpstreamJson<{
      query?: string;
      type_filter?: string;
      total?: number;
      items?: Partial<MediaItem>[];
      movies?: Partial<MediaItem>[];
      series?: Partial<SeriesRecord>[];
    }>(`/search?q=${encodeURIComponent(query)}&type=${encodeURIComponent(typeFilter)}`);

    if (upstream) {
      const movies = Array.isArray(upstream.movies)
        ? upstream.movies.map((m) => toPublicMediaItem(m, baseUrl))
        : [];
      const series = Array.isArray(upstream.series)
        ? upstream.series.map((s) => toPublicSeries(s, baseUrl))
        : [];
      const items = Array.isArray(upstream.items)
        ? upstream.items.map((it) => toPublicMediaItem(it, baseUrl))
        : undefined;

      res.json({
        query: sanitizeText(upstream.query, query) || query,
        type_filter: upstream.type_filter ?? typeFilter,
        total: upstream.total ?? movies.length + series.reduce((a, s) => a + s.count, 0),
        movies,
        series,
        ...(items ? { items } : {}),
      });
      return;
    }

    const q = query.toLowerCase();
    const matchedMovies = CATALOG_MOVIES.filter((item) => {
      if (typeFilter === 'movie' && item.is_series) return false;
      if (typeFilter === 'serie' && !item.is_series) return false;
      if (!q) return true;
      return (
        item.title.toLowerCase().includes(q) ||
        item.vj.toLowerCase().includes(q) ||
        item.category_name.toLowerCase().includes(q) ||
        item.description.toLowerCase().includes(q) ||
        String(item.id).includes(q)
      );
    })
      .filter((item) => !item.is_series)
      .map((m) => toPublicMediaItem(m, baseUrl));

    const matchedSeries = SERIES_CATALOG.filter((series) => {
      if (typeFilter === 'movie') return false;
      if (!q) return true;
      const seriesHit =
        series.title.toLowerCase().includes(q) ||
        series.slug.toLowerCase().includes(q) ||
        series.vj.toLowerCase().includes(q) ||
        series.description.toLowerCase().includes(q) ||
        series.series_code.includes(q);
      const epHit = series.seasons.some((season) =>
        season.episodes.some(
          (ep) =>
            ep.title.toLowerCase().includes(q) ||
            ep.description.toLowerCase().includes(q) ||
            ep.category_name.toLowerCase().includes(q) ||
            String(ep.id).includes(q)
        )
      );
      return seriesHit || epHit;
    }).map((s) => toPublicSeries(s, baseUrl));

    const total =
      matchedMovies.length + matchedSeries.reduce((acc, s) => acc + s.episode_count, 0);

    res.json({
      query,
      type_filter: typeFilter,
      total,
      movies: matchedMovies,
      series: matchedSeries,
    });
  });

  app.get('/movie/:id', async (req: Request, res: Response) => {
    const baseUrl = getPublicOrigin(req);
    const id = String(req.params.id || '');
    const raw = await fetchRawMediaById(id);
    if (!raw) {
      res.status(404).json({ error: `Media #${id} not found` });
      return;
    }
    res.json(toPublicMediaItem(raw, baseUrl));
  });

  app.get('/api/preview/v2/:vid', async (req: Request, res: Response) => {
    const baseUrl = getPublicOrigin(req);
    const vid = String(req.params.vid || '');
    const raw = await fetchRawMediaById(vid);
    if (!raw) {
      res.status(404).json({ error: `Preview #${vid} not found` });
      return;
    }
    const pub = toPublicMediaItem(raw, baseUrl);
    res.json({
      preview: {
        id: pub.id,
        title: pub.title,
        image: pub.image,
        playingUrl: pub.streamurl,
        nxt_playing_url: pub.streamurl,
        streamUrl: pub.streamurl,
        quality: pub.quality,
        duration: pub.duration,
        vj: pub.vj,
      },
    });
  });

  app.get('/series/:id', async (req: Request, res: Response) => {
    const baseUrl = getPublicOrigin(req);
    const key = String(req.params.id || '');
    const resolved = await resolveLiveSeries(key);
    if (!resolved) {
      res.json({
        title: `Series ${key}`,
        slug: `series-${key}`,
        series_code: key,
        series_codes: [],
        season_count: 0,
        episode_count: 0,
        count: 0,
        image: `${baseUrl}/img/m/default.jpg`,
        vj: 'VJ Junior',
        description: '',
        seasons: [],
        episodes: [],
      });
      return;
    }

    res.json(toPublicSeries(resolved, baseUrl));
  });

  // Self-hosted image proxy: streams real artwork through UG SHACKS URL without leaking origin domains
  app.get('/img/:kind/:key', async (req: Request, res: Response) => {
    const kind = String(req.params.kind || 'm').toLowerCase();
    const rawKey = String(req.params.key || '').replace(/\.(jpg|jpeg|png|webp)$/i, '');
    const fallbackAsset = resolveLocalAsset(FALLBACK_IMAGE_REL);

    if (rawKey === 'default') {
      if (fallbackAsset) {
        res.setHeader('Content-Type', 'image/jpeg');
        res.setHeader('Cache-Control', 'public, max-age=86400');
        res.sendFile(fallbackAsset);
        return;
      }
      res.status(404).end();
      return;
    }

    const targetImageUrl = await resolveImageTarget(kind, rawKey);

    if (targetImageUrl && targetImageUrl.startsWith('/')) {
      const localPath = resolveLocalAsset(targetImageUrl);
      if (localPath) {
        res.setHeader('Content-Type', 'image/jpeg');
        res.setHeader('Cache-Control', 'public, max-age=86400');
        res.sendFile(localPath);
        return;
      }
    }

    if (targetImageUrl && /^https?:\/\//i.test(targetImageUrl)) {
      try {
        const upstream = await fetch(safeExternalUrl(targetImageUrl), {
          headers: {
            'User-Agent': MEDIA_FETCH_UA,
            Accept: 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
          },
          redirect: 'follow',
          signal: AbortSignal.timeout(10000),
        });
        if (upstream.ok && upstream.body) {
          const ct = upstream.headers.get('content-type') || 'image/jpeg';
          res.setHeader('Content-Type', ct);
          res.setHeader('Cache-Control', 'public, max-age=86400');
          const cl = upstream.headers.get('content-length');
          if (cl) res.setHeader('Content-Length', cl);
          const nodeStream = Readable.fromWeb(
            upstream.body as unknown as import('stream/web').ReadableStream
          );
          nodeStream.on('error', () => {
            if (!res.headersSent) res.status(502);
            res.end();
          });
          nodeStream.pipe(res);
          return;
        }
      } catch {
        // Fall through to local fallback artwork
      }
    }

    if (fallbackAsset) {
      res.setHeader('Content-Type', 'image/jpeg');
      res.setHeader('Cache-Control', 'public, max-age=3600');
      res.sendFile(fallbackAsset);
      return;
    }
    res.status(404).end();
  });

  const MAX_STREAM_CHUNK = 4 * 1024 * 1024; // 4 MB keeps every Cloud Run HTTP response well under 32 MB

  function escapeHtml(value: string): string {
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function buildBoundedRangeHeader(rangeHeader?: string): string {
    if (!rangeHeader) {
      return `bytes=0-${MAX_STREAM_CHUNK - 1}`;
    }
    const std = /^bytes=(\d+)-(\d*)$/i.exec(rangeHeader.trim());
    if (std) {
      const start = Number(std[1]);
      const reqEnd = std[2] ? Number(std[2]) : undefined;
      const cappedEnd =
        reqEnd !== undefined && Number.isFinite(reqEnd) && reqEnd >= start
          ? Math.min(reqEnd, start + MAX_STREAM_CHUNK - 1)
          : start + MAX_STREAM_CHUNK - 1;
      return `bytes=${start}-${cappedEnd}`;
    }
    const suffix = /^bytes=-(\d+)$/i.exec(rangeHeader.trim());
    if (suffix) {
      const len = Math.min(Number(suffix[1]), MAX_STREAM_CHUNK);
      return `bytes=-${len}`;
    }
    return `bytes=0-${MAX_STREAM_CHUNK - 1}`;
  }

  async function fetchUpstreamMedia(
    url: string,
    method: 'GET' | 'HEAD',
    headers: Record<string, string>
  ): Promise<globalThis.Response> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000);
    try {
      const res = await fetch(safeExternalUrl(url), {
        method,
        headers,
        redirect: 'follow',
        signal: controller.signal,
      });
      clearTimeout(timer);
      return res;
    } catch (err) {
      clearTimeout(timer);
      throw err;
    }
  }

  function renderHtmlPlayerPage(id: string, title: string, baseUrl: string): string {
    const isChannel = id.startsWith('ch-');
    const safeTitle = escapeHtml(title || `UG SHACKS #${id}`);
    const posterUrl = `${baseUrl}/img/${isChannel ? 'c' : 'm'}/${encodeURIComponent(id)}.jpg`;
    const streamUrl = `${baseUrl}/stream/${encodeURIComponent(id)}`;
    const dlUrl = `${baseUrl}/api/dl/${encodeURIComponent(id)}`;
    const jsonUrl = isChannel ? `${baseUrl}/api/channels` : `${baseUrl}/movie/${encodeURIComponent(id)}`;
    return `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="referrer" content="no-referrer" />
  <title>${safeTitle} — UG SHACKS Movie API</title>
  <style>
    * { box-sizing: border-box; }
    body { margin: 0; background: #020617; color: #f8fafc; font-family: system-ui, -apple-system, sans-serif; min-height: 100vh; display: flex; flex-direction: column; }
    header { padding: 14px 20px; border-bottom: 1px solid #1e293b; display: flex; align-items: center; justify-content: space-between; gap: 12px; background: #020617; }
    .brand { font-weight: 800; font-size: 15px; color: #fff; text-decoration: none; }
    .title { font-size: 13px; color: #cbd5e1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 50vw; }
    .actions { display: flex; gap: 8px; flex-wrap: wrap; }
    .btn { padding: 8px 12px; border-radius: 8px; background: #1e293b; color: #f1f5f9; text-decoration: none; font-size: 12px; font-weight: 600; border: 1px solid #334155; }
    .btn:hover { background: #334155; }
    main { flex: 1; display: flex; align-items: center; justify-content: center; padding: 16px; background: #000; }
    video { width: 100%; max-width: 1120px; max-height: 82vh; background: #000; border-radius: 12px; border: 1px solid #1e293b; outline: none; }
  </style>
</head>
<body>
  <header>
    <a class="brand" href="${escapeHtml(baseUrl)}/">UG SHACKS Movie API</a>
    <div class="title">${safeTitle}</div>
    <div class="actions">
      <a class="btn" href="${escapeHtml(dlUrl)}">Download MP4</a>
      <a class="btn" href="${escapeHtml(jsonUrl)}" target="_blank" rel="noreferrer">API JSON</a>
    </div>
  </header>
  <main>
    <video controls autoplay playsinline preload="metadata" poster="${escapeHtml(posterUrl)}" src="${escapeHtml(streamUrl)}"></video>
  </main>
</body>
</html>`;
  }

  function renderHtmlDownloaderPage(
    id: string,
    title: string,
    totalBytes: number,
    baseUrl: string
  ): string {
    const safeTitle = escapeHtml(title || `UG SHACKS #${id}`);
    const safeFile =
      (title || `ugshacks_${id}`).replace(/[^a-zA-Z0-9._-]+/g, '_') + '.mp4';
    const streamUrl = `${baseUrl}/stream/${encodeURIComponent(id)}`;
    const sizeMb = totalBytes > 0 ? `${(totalBytes / (1024 * 1024)).toFixed(1)} MB` : 'Large MP4';
    return `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="referrer" content="no-referrer" />
  <title>Download ${safeTitle} — UG SHACKS Movie API</title>
  <style>
    * { box-sizing: border-box; }
    body { margin: 0; background: #020617; color: #f8fafc; font-family: system-ui, -apple-system, sans-serif; min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 20px; }
    .card { width: 100%; max-width: 520px; background: #0f172a; border: 1px solid #1e293b; border-radius: 16px; padding: 24px; }
    h1 { margin: 0 0 8px; font-size: 18px; }
    p { margin: 0 0 16px; font-size: 13px; color: #94a3b8; line-height: 1.5; }
    .bar-wrap { width: 100%; height: 10px; background: #020617; border-radius: 999px; overflow: hidden; border: 1px solid #1e293b; margin-bottom: 12px; }
    .bar { height: 100%; width: 0%; background: #e11d48; transition: width .2s; }
    .status { font-size: 12px; font-family: monospace; color: #34d399; margin-bottom: 18px; }
    .row { display: flex; gap: 10px; flex-wrap: wrap; }
    button, a.btn { padding: 10px 16px; border-radius: 10px; font-size: 13px; font-weight: 600; cursor: pointer; text-decoration: none; border: none; }
    button.primary { background: #e11d48; color: #fff; }
    button.primary:disabled { opacity: 0.5; cursor: not-allowed; }
    a.btn { background: #1e293b; color: #e2e8f0; border: 1px solid #334155; }
  </style>
</head>
<body>
  <div class="card">
    <h1>${safeTitle}</h1>
    <p>File: <strong>${escapeHtml(safeFile)}</strong> (${escapeHtml(sizeMb)})<br/>Streamed in parallel 4 MB chunks directly from UG SHACKS Movie API.</p>
    <div class="bar-wrap"><div id="bar" class="bar"></div></div>
    <div id="status" class="status">Ready to download</div>
    <div class="row">
      <button id="dlBtn" class="primary" onclick="startDownload()">Start MP4 Download</button>
      <a class="btn" href="${escapeHtml(baseUrl)}/movie/${encodeURIComponent(id)}/play">Watch in Browser</a>
    </div>
  </div>
  <script>
    const STREAM_URL = ${JSON.stringify(streamUrl)};
    const FILE_NAME = ${JSON.stringify(safeFile)};
    const TOTAL = ${Number(totalBytes) || 0};
    const CHUNK = ${MAX_STREAM_CHUNK};

    async function startDownload() {
      const btn = document.getElementById('dlBtn');
      const status = document.getElementById('status');
      const bar = document.getElementById('bar');
      btn.disabled = true;
      try {
        let total = TOTAL;
        if (!total) {
          const head = await fetch(STREAM_URL, { method: 'HEAD' });
          total = Number(head.headers.get('content-length') || 0);
        }
        if (!total) throw new Error('Could not determine file size');

        if (window.showSaveFilePicker) {
          const handle = await window.showSaveFilePicker({
            suggestedName: FILE_NAME,
            types: [{ description: 'MP4 Video', accept: { 'video/mp4': ['.mp4'] } }]
          });
          const writable = await handle.createWritable();
          for (let offset = 0; offset < total; offset += CHUNK) {
            const end = Math.min(offset + CHUNK - 1, total - 1);
            const r = await fetch(STREAM_URL, { headers: { Range: 'bytes=' + offset + '-' + end } });
            if (!r.ok && r.status !== 206) throw new Error('Chunk failed: ' + r.status);
            await writable.write(await r.arrayBuffer());
            const pct = Math.min(100, Math.round(((end + 1) / total) * 100));
            bar.style.width = pct + '%';
            status.textContent = pct + '% (' + ((end + 1) / 1048576).toFixed(1) + ' / ' + (total / 1048576).toFixed(1) + ' MB)';
          }
          await writable.close();
          status.textContent = 'Download complete: ' + FILE_NAME;
        } else {
          if (total > 600 * 1024 * 1024) {
            status.textContent = 'Large file (' + (total / 1048576).toFixed(0) + ' MB) — use Desktop Chrome for chunked save or Watch in Browser.';
            btn.disabled = false;
            return;
          }
          const parts = [];
          for (let offset = 0; offset < total; offset += CHUNK) {
            const end = Math.min(offset + CHUNK - 1, total - 1);
            const r = await fetch(STREAM_URL, { headers: { Range: 'bytes=' + offset + '-' + end } });
            if (!r.ok && r.status !== 206) throw new Error('Chunk failed: ' + r.status);
            parts.push(await r.arrayBuffer());
            const pct = Math.min(100, Math.round(((end + 1) / total) * 100));
            bar.style.width = pct + '%';
            status.textContent = pct + '%';
          }
          const blob = new Blob(parts, { type: 'video/mp4' });
          const a = document.createElement('a');
          a.href = URL.createObjectURL(blob);
          a.download = FILE_NAME;
          a.click();
          status.textContent = 'Download complete: ' + FILE_NAME;
        }
      } catch (e) {
        status.textContent = e && e.message ? e.message : 'Download interrupted';
      } finally {
        btn.disabled = false;
      }
    }
  </script>
</body>
</html>`;
  }

  const proxyVideoStream = async (
    req: Request,
    res: Response,
    asAttachment = false
  ) => {
    const baseUrl = getPublicOrigin(req);
    const id = String(req.params.id || '');
    const resolved = await resolveVideoTarget(id);

    if (!resolved?.url) {
      res.status(404).json({ error: `Media stream #${id} not found` });
      return;
    }

    const isBrowserDocNav =
      req.method === 'GET' &&
      !req.headers.range &&
      Boolean(req.headers.accept?.includes('text/html')) &&
      req.headers['sec-fetch-dest'] !== 'video';

    if (isBrowserDocNav && !asAttachment) {
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.setHeader('Cache-Control', 'no-store');
      res.send(renderHtmlPlayerPage(id, resolved.title, baseUrl));
      return;
    }

    try {
      const targetUrl = resolved.url;
      const baseFetchHeaders: Record<string, string> = {
        'User-Agent': MEDIA_FETCH_UA,
      };

      let skipRangeCap = false;
      if (asAttachment && isBrowserDocNav) {
        let totalBytes = 0;
        try {
          const headRes = await fetchUpstreamMedia(targetUrl, 'HEAD', baseFetchHeaders);
          totalBytes = Number(headRes.headers.get('content-length') || 0);
        } catch {
          totalBytes = 0;
        }
        if (totalBytes === 0 || totalBytes > 24 * 1024 * 1024) {
          res.setHeader('Content-Type', 'text/html; charset=utf-8');
          res.setHeader('Cache-Control', 'no-store');
          res.send(renderHtmlDownloaderPage(id, resolved.title, totalBytes, baseUrl));
          return;
        }
        skipRangeCap = true;
      }

      const fetchHeaders: Record<string, string> = { ...baseFetchHeaders };
      if (req.method !== 'HEAD' && !skipRangeCap) {
        fetchHeaders.Range = buildBoundedRangeHeader(req.headers.range);
        if (req.headers['if-range']) {
          fetchHeaders['If-Range'] = String(req.headers['if-range']);
        }
      }

      let upstream = await fetchUpstreamMedia(
        targetUrl,
        req.method === 'HEAD' ? 'HEAD' : 'GET',
        fetchHeaders
      );

      if (!upstream.ok && upstream.status !== 206) {
        const localFallback = findLocalMediaById(id);
        if (localFallback?.playingurl && localFallback.playingurl !== targetUrl) {
          upstream = await fetchUpstreamMedia(
            localFallback.playingurl,
            req.method === 'HEAD' ? 'HEAD' : 'GET',
            fetchHeaders
          );
        }
      }

      if (!upstream.ok && upstream.status !== 206) {
        res.status(upstream.status === 416 ? 416 : 502).json({
          error:
            upstream.status === 416
              ? 'Requested byte range out of bounds'
              : 'Media stream temporarily unavailable',
        });
        return;
      }

      res.status(upstream.status);
      const safeHeaders = ['content-type', 'content-length', 'content-range', 'accept-ranges', 'etag'];
      for (const h of safeHeaders) {
        const val = upstream.headers.get(h);
        if (val) res.setHeader(h, val);
      }
      if (!upstream.headers.get('accept-ranges')) {
        res.setHeader('Accept-Ranges', 'bytes');
      }
      if (!upstream.headers.get('content-type')) {
        res.setHeader('Content-Type', 'video/mp4');
      }
      if (asAttachment) {
        const safeFilename =
          (resolved.title || `ugshacks_${id}`).replace(/[^a-zA-Z0-9._-]+/g, '_') + '.mp4';
        res.setHeader('Content-Disposition', `attachment; filename="${safeFilename}"`);
      }

      if (req.method === 'HEAD' || !upstream.body) {
        res.end();
        return;
      }

      const nodeStream = Readable.fromWeb(
        upstream.body as unknown as import('stream/web').ReadableStream
      );
      nodeStream.on('error', () => {
        if (!res.headersSent) res.status(502);
        res.end();
      });
      req.on('close', () => {
        nodeStream.destroy();
      });
      nodeStream.pipe(res);
    } catch {
      if (!res.headersSent) {
        res.status(502).json({ error: 'Media stream temporarily unavailable' });
      }
    }
  };

  // All playback & download routes stream directly through UG SHACKS Movie API (no external Location leaks)
  app.get('/stream/:id', (req, res) => proxyVideoStream(req, res, false));
  app.head('/stream/:id', (req, res) => proxyVideoStream(req, res, false));
  app.get('/movie/:id/play', (req, res) => proxyVideoStream(req, res, false));
  app.head('/movie/:id/play', (req, res) => proxyVideoStream(req, res, false));
  app.get('/api/dl/:id', (req, res) => proxyVideoStream(req, res, true));
  app.head('/api/dl/:id', (req, res) => proxyVideoStream(req, res, true));

  app.get('/api/channels', async (req: Request, res: Response) => {
    const baseUrl = getPublicOrigin(req);
    const upstream = await tryUpstreamJson<Partial<LiveChannel>[]>('/api/channels');
    if (Array.isArray(upstream) && upstream.length > 0) {
      res.json(upstream.map((ch) => toPublicChannel(ch, baseUrl)));
      return;
    }
    res.json(LIVE_CHANNELS.map((ch) => toPublicChannel(ch, baseUrl)));
  });

  app.get('/api/presets', (req: Request, res: Response) => {
    const baseUrl = getPublicOrigin(req);
    const localizedPresets = ENDPOINT_PRESETS.map((preset) => {
      const sampleId =
        preset.id === 'direct-movie-query'
          ? '67861'
          : preset.id === 'series-resolver'
            ? '39409'
            : '57865';

      return {
        ...preset,
        path: `${baseUrl}${preset.path}`,
        upstreamCall: {
          ...preset.upstreamCall,
          target: `${baseUrl}${preset.path}`,
        },
        responsePreview: {
          ...preset.responsePreview,
          body:
            preset.id === 'preview-enrich'
              ? {
                  preview: {
                    id: 57865,
                    title: 'Neon Hunter: Cyber Protocol',
                    image: `${baseUrl}/img/m/57865.jpg`,
                    playingUrl: `${baseUrl}/stream/57865`,
                    nxt_playing_url: `${baseUrl}/stream/57865`,
                    streamUrl: `${baseUrl}/stream/57865`,
                    quality: '4K HDR',
                    duration: '01h 39m',
                  },
                }
              : preset.id === 'direct-movie-query'
                ? {
                    id: 67861,
                    title: 'Kampala Echoes: The Mesach Story',
                    vj: 'VJ Junior',
                    size: '1.84 GB',
                    duration: '01h 24m',
                    image: `${baseUrl}/img/m/67861.jpg`,
                    playingurl: `${baseUrl}/stream/67861`,
                    streamurl: `${baseUrl}/stream/67861`,
                  }
                : preset.id === 'series-resolver'
                  ? {
                      title: 'Silo',
                      slug: 'silo',
                      series_code: '91002',
                      season_count: 3,
                      episode_count: 30,
                      image: `${baseUrl}/img/s/91002.jpg`,
                      sampleStream: `${baseUrl}/stream/${sampleId}`,
                    }
                  : '',
        },
      };
    });
    res.json(localizedPresets);
  });

  app.get('/api/worker-code', (req: Request, res: Response) => {
    const baseUrl = getPublicOrigin(req);
    const localizedFeatures = WORKER_CODE_DATA.features.map((feat) => ({
      ...feat,
      behavior: feat.behavior.map((b) => sanitizeText(b, b)),
    }));
    const localizedSource = WORKER_CODE_DATA.workerSource.replace(
      /const gatewayOrigin = env\.GATEWAY_ORIGIN;/g,
      `const gatewayOrigin = env.GATEWAY_ORIGIN || '${baseUrl}';`
    );
    res.json({
      baseUrl,
      features: localizedFeatures,
      workerSource: localizedSource,
    });
  });

  app.get('/api/audit', (_req: Request, res: Response) => {
    res.json(AUDIT_REPORT);
  });

  // Shorthand numeric route /:id -> movie JSON resolver
  app.get(/^\/(\d+)$/, async (req: Request, res: Response) => {
    const baseUrl = getPublicOrigin(req);
    const id = req.params[0];
    const raw = await fetchRawMediaById(id);
    if (!raw) {
      res.status(404).json({ error: `Media #${id} not found` });
      return;
    }
    res.json(toPublicMediaItem(raw, baseUrl));
  });

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req: Request, res: Response) => {
      const indexFile = path.join(distDir, 'index.html');
      if (fs.existsSync(indexFile)) {
        res.sendFile(indexFile);
      } else {
        res.status(404).send('Build output not found. Run npm run build.');
      }
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`UG SHACKS Movie API server listening on http://0.0.0.0:${PORT}`);
    warmRegistries();
  });
}

createApp().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});

export interface MediaItem {
  id: number;
  title: string;
  vj: string;
  category_id: string;
  category_name: string;
  duration: string;
  size: string;
  image: string;
  backdrop?: string;
  playingurl: string;
  streamurl: string;
  description: string;
  type: 'MOVIE' | 'SERIES';
  media_type: 'movie' | 'serie';
  is_series: boolean;
  series_code: string;
  series_title?: string;
  season?: number;
  episode?: number;
  code?: string;
  quality: string;
  timestamp?: string;
}

export interface SeriesSeason {
  season: number;
  title: string;
  series_code: string;
  image: string;
  vj: string;
  count: number;
  episodes: MediaItem[];
}

export interface SeriesRecord {
  title: string;
  slug: string;
  series_code: string;
  series_codes: string[];
  season_count: number;
  episode_count: number;
  count: number;
  image: string;
  vj: string;
  description: string;
  seasons: SeriesSeason[];
  episodes?: MediaItem[];
}

export interface DashboardSection {
  id: number;
  category: string;
  count: number;
}

export interface LiveChannel {
  id: string;
  name: string;
  category: string;
  bitrate: string;
  resolution: string;
  currentShow: string;
  vj: string;
  viewers: string;
  thumbnail: string;
  playingurl: string;
  edgeNode: string;
}

export interface ExecutionStep {
  step: number;
  title: string;
  status: 'pass' | 'info' | 'route' | 'redirect';
  detail: string;
}

export interface EndpointPreset {
  id: string;
  name: string;
  method: 'GET' | 'POST';
  path: string;
  headers: Record<string, string>;
  upstreamCall: {
    method: string;
    target: string;
    body: string;
  };
  executionFlow: ExecutionStep[];
  responsePreview: {
    status: number;
    statusText: string;
    headers: Record<string, string>;
    body: unknown;
    notes: string;
  };
}

export interface WorkerFeature {
  id: string;
  title: string;
  pattern: string;
  purpose: string;
  behavior: string[];
  keyFunctions: string[];
}

export interface WorkerCodePayload {
  features: WorkerFeature[];
  workerSource: string;
}

export interface AuditControl {
  id: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  category: string;
  title: string;
  cwe: string;
  status: 'ENFORCED' | 'RECOMMENDED';
  description: string;
  impact: string;
  remediation: string;
}

export interface AuditReport {
  tokenPolicy: {
    algorithm: string;
    issuer: string;
    audience: string;
    expirationPolicy: string;
    claimsSchema: Record<string, string>;
    checks: Array<{
      check: string;
      status: 'PASS' | 'MONITOR';
      detail: string;
    }>;
  };
  vulnerabilities: AuditControl[];
}

export interface LiveTestResponse {
  status?: number;
  statusText?: string;
  duration?: string;
  headers?: Record<string, string>;
  data?: unknown;
  error?: boolean;
  message?: string;
}

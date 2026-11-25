import { Check, Code2, Copy, ExternalLink, Play, RefreshCw, Server, Terminal } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { EndpointPreset, LiveTestResponse, WorkerFeature } from '../types';

interface ProxyLabViewProps {
  presets: EndpointPreset[];
  activePreset: EndpointPreset | null;
  workerFeatures: WorkerFeature[];
  testPath: string;
  testing: boolean;
  testResult: LiveTestResponse | null;
  onSelectPreset: (preset: EndpointPreset) => void;
  onTestPathChange: (path: string) => void;
  onRunTest: (path: string) => void;
}

type CodeLang = 'curl' | 'fetch' | 'react' | 'html' | 'python';

const SAMPLE_ENDPOINTS = [
  { label: 'Catalog Feed', path: '/dashboard' },
  { label: 'Search Silo', path: '/search?q=silo' },
  { label: 'Movie JSON', path: '/movie/67891' },
  { label: 'Series Graph', path: '/series/39409' },
  { label: 'Live Channels', path: '/api/channels' },
  { label: 'Preview Enrich', path: '/api/preview/v2/67891' },
];

const CODE_TABS: Array<{ id: CodeLang; label: string }> = [
  { id: 'curl', label: 'cURL' },
  { id: 'fetch', label: 'JavaScript' },
  { id: 'react', label: 'React' },
  { id: 'html', label: 'HTML5 Video' },
  { id: 'python', label: 'Python' },
];

export function ProxyLabView({
  presets,
  activePreset,
  workerFeatures,
  testPath,
  testing,
  testResult,
  onSelectPreset,
  onTestPathChange,
  onRunTest,
}: ProxyLabViewProps) {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [codeLang, setCodeLang] = useState<CodeLang>('curl');
  const copyTimerRef = useRef<number | null>(null);

  const origin = typeof window !== 'undefined' ? window.location.origin : '';

  const toFullUrl = (pathOrUrl: string) => {
    const trimmed = pathOrUrl.trim();
    if (!trimmed) return origin;
    if (/^https?:\/\//i.test(trimmed)) return trimmed;
    const normalized = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
    return `${origin}${normalized}`;
  };

  const toRelativePath = (pathOrUrl: string) => {
    try {
      if (/^https?:\/\//i.test(pathOrUrl)) {
        const parsed = new URL(pathOrUrl);
        return `${parsed.pathname}${parsed.search}`;
      }
    } catch {
      // ignore parse errors
    }
    return pathOrUrl.startsWith('/') ? pathOrUrl : `/${pathOrUrl}`;
  };

  useEffect(() => {
    return () => {
      if (copyTimerRef.current) window.clearTimeout(copyTimerRef.current);
    };
  }, []);

  const handleCopy = (key: string, text: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    if (copyTimerRef.current) window.clearTimeout(copyTimerRef.current);
    copyTimerRef.current = window.setTimeout(() => setCopiedKey(null), 1800);
  };

  const activeFullUrl = toFullUrl(testPath || '/dashboard');

  const sampleCode = useMemo(() => {
    const targetUrl = activeFullUrl;
    const streamSampleUrl = `${origin}/stream/67891`;
    const movieSampleUrl = `${origin}/movie/67891`;

    switch (codeLang) {
      case 'curl':
        return `# Fetch JSON from UG SHACKS Movie API
curl -s "${targetUrl}" \\
  -H "Accept: application/json"

# Stream MP4 byte-range directly from your site endpoint
curl -i "${streamSampleUrl}" \\
  -H "Range: bytes=0-1048575"`;

      case 'fetch':
        return `// Fetch catalog or movie metadata in any browser or Node.js app
const response = await fetch("${targetUrl}", {
  headers: { Accept: "application/json" },
});
const data = await response.json();

// Original poster URL + site-hosted video stream
console.log("Items:", data.movies || data.episodes || data);

// Example single movie lookup
const movieRes = await fetch("${movieSampleUrl}");
const movie = await movieRes.json();
// movie.image -> real poster URL
// movie.playingurl -> ${streamSampleUrl}`;

      case 'react':
        return `import { useEffect, useState } from "react";

export function MovieCard({ id = 67891 }: { id?: number }) {
  const [movie, setMovie] = useState<any>(null);

  useEffect(() => {
    fetch(\`${origin}/movie/\${id}\`)
      .then((res) => res.json())
      .then(setMovie);
  }, [id]);

  if (!movie) return null;

  return (
    <div>
      <img src={movie.image} alt={movie.title} referrerPolicy="no-referrer" />
      <h3>{movie.title}</h3>
      <video controls playsInline poster={movie.image} src={movie.playingurl} />
    </div>
  );
}`;

      case 'html':
        return `<!-- Embed UG SHACKS Movie API poster + MP4 stream in any webpage -->
<div class="ug-movie-player">
  <video
    controls
    playsinline
    preload="metadata"
    src="${streamSampleUrl}"
    width="100%"
  ></video>
</div>

<script>
  fetch("${targetUrl}")
    .then((r) => r.json())
    .then((payload) => console.log("Loaded UG SHACKS API:", payload));
</script>`;

      case 'python':
        return `import requests

url = "${targetUrl}"
res = requests.get(url, headers={"Accept": "application/json"}, timeout=15)
res.raise_for_status()
data = res.json()
print(data)`;
    }
  }, [activeFullUrl, codeLang, origin]);

  const presetBodyString = useMemo(() => {
    if (!activePreset) return '';
    const body = activePreset.responsePreview.body;
    return typeof body === 'object' && body !== null
      ? JSON.stringify(body, null, 2)
      : String(body || '(Binary MP4 Stream — Content-Disposition Attachment)');
  }, [activePreset]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2.5">
            <Terminal className="w-6 h-6 text-rose-500" />
            <span>API Proxy Lab</span>
          </h2>
          <p className="text-sm text-slate-400 mt-1">
            Test live UG SHACKS Movie API routes, copy ready-to-use GET URLs, and grab integration code snippets.
          </p>
        </div>

        <button
          type="button"
          onClick={() => onRunTest(testPath)}
          disabled={testing}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-semibold text-xs transition-colors whitespace-nowrap shrink-0"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${testing ? 'animate-spin' : ''}`} />
          <span>Execute Live Test</span>
        </button>
      </div>

      <section className="p-5 sm:p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
          <span className="font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
            <Server className="w-3.5 h-3.5" />
            <span>Live Endpoint Tester &amp; GET Links</span>
          </span>
          <span className="font-mono text-slate-400">CORS Enabled · Cross-Origin Ready</span>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
          <div className="flex-1 flex items-center bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs font-mono text-slate-200 gap-2">
            <span className="px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-400 font-bold select-none shrink-0">
              GET
            </span>
            <input
              type="text"
              aria-label="API endpoint path"
              value={testPath}
              onChange={(e) => onTestPathChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') onRunTest(testPath);
              }}
              className="w-full bg-transparent focus:outline-none text-slate-100 font-mono min-w-0"
              placeholder="/search?q=silo or /movie/67891 or /dashboard"
            />
            <button
              type="button"
              onClick={() => handleCopy('url-bar', activeFullUrl)}
              title="Copy full GET URL"
              aria-label="Copy full GET URL"
              className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-800 transition-colors shrink-0"
            >
              {copiedKey === 'url-bar' ? (
                <Check className="w-3.5 h-3.5 text-emerald-400" />
              ) : (
                <Copy className="w-3.5 h-3.5" />
              )}
            </button>
            <a
              href={activeFullUrl}
              target="_blank"
              rel="noreferrer"
              title="Open GET endpoint in new tab"
              aria-label="Open GET endpoint in new tab"
              className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-800 transition-colors shrink-0"
            >
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
          {SAMPLE_ENDPOINTS.map((sample) => {
            const fullSampleUrl = toFullUrl(sample.path);
            const isSelected = toRelativePath(testPath) === sample.path;
            const key = `sample-${sample.path}`;
            return (
              <div
                key={sample.path}
                className={`flex items-center justify-between gap-2 px-3 py-2 rounded-xl border transition-colors ${
                  isSelected
                    ? 'bg-rose-950/30 border-rose-500/70'
                    : 'bg-slate-950/80 border-slate-800 hover:border-slate-700'
                }`}
              >
                <button
                  type="button"
                  onClick={() => {
                    onTestPathChange(sample.path);
                    onRunTest(sample.path);
                  }}
                  className="flex-1 min-w-0 text-left group"
                >
                  <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
                    <span className="font-mono font-bold text-emerald-400">GET</span>
                    <span className="truncate font-medium text-slate-300 group-hover:text-white">
                      {sample.label}
                    </span>
                  </div>
                  <div className="font-mono text-xs text-rose-400 truncate mt-0.5">
                    {sample.path}
                  </div>
                </button>

                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => handleCopy(key, fullSampleUrl)}
                    title={`Copy ${fullSampleUrl}`}
                    aria-label={`Copy ${sample.label} URL`}
                    className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-800 transition-colors"
                  >
                    {copiedKey === key ? (
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      onTestPathChange(sample.path);
                      onRunTest(sample.path);
                    }}
                    title={`Run ${sample.path}`}
                    aria-label={`Test ${sample.label}`}
                    className="p-1.5 rounded-lg bg-slate-900 hover:bg-emerald-600 text-slate-400 hover:text-white border border-slate-800 transition-colors"
                  >
                    <Play className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {testResult && (
          <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
            <div className="flex items-center justify-between text-xs font-mono tabular-nums">
              <div className="flex items-center gap-3">
                <span
                  className={`font-bold ${
                    testResult.status && testResult.status >= 200 && testResult.status < 400
                      ? 'text-emerald-400'
                      : 'text-rose-400'
                  }`}
                >
                  HTTP {testResult.status || 'ERR'} {testResult.statusText || ''}
                </span>
                {testResult.duration && (
                  <span className="text-slate-400">RTT: {testResult.duration}</span>
                )}
              </div>

              <button
                type="button"
                onClick={() =>
                  handleCopy('live-json', JSON.stringify(testResult.data ?? testResult, null, 2))
                }
                aria-label="Copy live response JSON"
                className="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-white flex items-center gap-1.5 text-xs transition-colors"
              >
                {copiedKey === 'live-json' ? (
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                ) : (
                  <Copy className="w-3.5 h-3.5" />
                )}
                <span>{copiedKey === 'live-json' ? 'Copied' : 'Copy JSON'}</span>
              </button>
            </div>

            <pre className="text-xs font-mono text-emerald-300 overflow-x-auto p-3 bg-black/60 rounded-lg max-h-72 leading-relaxed">
              {JSON.stringify(testResult.data ?? testResult, null, 2)}
            </pre>
          </div>
        )}
      </section>

      <section className="p-5 sm:p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Code2 className="w-4 h-4 text-cyan-400" />
              <span>Sample Integration Code</span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5 font-mono truncate max-w-xl">
              Target: {activeFullUrl}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            {CODE_TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setCodeLang(tab.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                  codeLang === tab.id
                    ? 'bg-rose-600 text-white'
                    : 'bg-slate-950 text-slate-400 hover:text-slate-200 border border-slate-800'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <div className="relative rounded-xl bg-slate-950 border border-slate-800 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-800/80 bg-slate-900/60">
            <span className="text-[11px] font-mono text-slate-400 uppercase tracking-wider">
              {CODE_TABS.find((t) => t.id === codeLang)?.label} Example
            </span>
            <button
              type="button"
              onClick={() => handleCopy(`snippet-${codeLang}`, sampleCode)}
              aria-label="Copy sample code"
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-700 text-xs font-medium transition-colors"
            >
              {copiedKey === `snippet-${codeLang}` ? (
                <Check className="w-3.5 h-3.5 text-emerald-400" />
              ) : (
                <Copy className="w-3.5 h-3.5" />
              )}
              <span>{copiedKey === `snippet-${codeLang}` ? 'Copied' : 'Copy Code'}</span>
            </button>
          </div>

          <pre className="p-4 font-mono text-xs text-cyan-200 overflow-x-auto leading-relaxed">
            <code>{sampleCode}</code>
          </pre>
        </div>
      </section>

      {presets.length > 0 && activePreset && (
        <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Endpoint Pipeline Presets
            </h3>

            {presets.map((preset) => {
              const selected = activePreset.id === preset.id;
              const copyId = `preset-list-${preset.id}`;
              return (
                <div
                  key={preset.id}
                  className={`rounded-xl border transition-colors flex items-center justify-between gap-2 pr-3 ${
                    selected
                      ? 'bg-rose-950/30 border-rose-500 text-white'
                      : 'bg-slate-900 border-slate-800 text-slate-300 hover:border-slate-700'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => onSelectPreset(preset)}
                    className="flex-1 min-w-0 text-left p-4"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-bold text-xs truncate">{preset.name}</span>
                      <span className="text-[11px] font-mono text-emerald-400 shrink-0">
                        {preset.method}
                      </span>
                    </div>
                    <div className="mt-1 font-mono text-[11px] text-rose-400 truncate">
                      {toRelativePath(preset.path)}
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleCopy(copyId, toFullUrl(preset.path))}
                    title={`Copy ${toFullUrl(preset.path)}`}
                    aria-label={`Copy ${preset.name} URL`}
                    className="p-2 rounded-lg bg-slate-950/80 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-800 transition-colors shrink-0"
                  >
                    {copiedKey === copyId ? (
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>
              );
            })}

            {workerFeatures.length > 0 && (
              <div className="pt-4 border-t border-slate-800 space-y-2">
                <h4 className="text-xs font-bold text-slate-400">Registered Route Handlers</h4>
                {workerFeatures.map((feat) => {
                  const key = `handler-${feat.id}`;
                  return (
                    <div
                      key={feat.id}
                      className="p-3 rounded-lg bg-slate-900/70 border border-slate-800 text-xs flex items-center justify-between gap-2"
                    >
                      <div className="min-w-0 space-y-1">
                        <div className="font-semibold text-slate-200 truncate">{feat.title}</div>
                        <div className="font-mono text-[11px] text-slate-400 truncate">
                          {feat.pattern}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleCopy(key, feat.pattern)}
                        title={`Copy ${feat.pattern}`}
                        aria-label={`Copy ${feat.title} route pattern`}
                        className="p-1.5 rounded-lg bg-slate-950 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-800 transition-colors shrink-0"
                      >
                        {copiedKey === key ? (
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="lg:col-span-2">
            <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-4">
                <div className="min-w-0">
                  <span className="text-xs font-bold uppercase tracking-wider text-rose-400">
                    Preset Pipeline
                  </span>
                  <h3 className="text-lg font-bold text-white mt-0.5">{activePreset.name}</h3>
                  <div className="flex items-center gap-2 mt-1">
                    <code className="font-mono text-xs text-slate-300 truncate max-w-md">
                      {activePreset.method} {toFullUrl(activePreset.path)}
                    </code>
                    <button
                      type="button"
                      onClick={() =>
                        handleCopy('preset-header-url', toFullUrl(activePreset.path))
                      }
                      title="Copy preset URL"
                      aria-label="Copy preset URL"
                      className="p-1 rounded-md bg-slate-950 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-800 transition-colors shrink-0"
                    >
                      {copiedKey === 'preset-header-url' ? (
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      const rel = toRelativePath(activePreset.path);
                      onTestPathChange(rel);
                      onRunTest(rel);
                    }}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold transition-colors whitespace-nowrap shrink-0"
                  >
                    <Play className="w-3.5 h-3.5" />
                    <span>Run in Tester</span>
                  </button>
                </div>
              </div>

              <div className="space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Execution Graph
                </h4>
                <div className="space-y-2.5">
                  {activePreset.executionFlow.map((step) => (
                    <div
                      key={step.step}
                      className="flex items-start gap-3 p-3.5 rounded-xl bg-slate-950 border border-slate-800"
                    >
                      <div className="w-6 h-6 rounded-full bg-slate-800 text-slate-200 text-xs font-mono font-bold flex items-center justify-center shrink-0 mt-0.5 tabular-nums">
                        {step.step}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-semibold text-xs text-slate-200">{step.title}</span>
                          <span
                            className={`text-[11px] font-mono uppercase font-semibold ${
                              step.status === 'pass'
                                ? 'text-emerald-400'
                                : step.status === 'route'
                                  ? 'text-rose-400'
                                  : step.status === 'redirect'
                                    ? 'text-amber-400'
                                    : 'text-cyan-400'
                            }`}
                          >
                            {step.status}
                          </span>
                        </div>
                        <p className="text-xs text-slate-400 mt-1 leading-relaxed">{step.detail}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-2 pt-3 border-t border-slate-800">
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs tabular-nums">
                  <span className="font-bold text-slate-400 uppercase tracking-wider">
                    Response Payload
                  </span>
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-emerald-400">
                      HTTP {activePreset.responsePreview.status} ({activePreset.responsePreview.statusText})
                    </span>
                    <button
                      type="button"
                      onClick={() => handleCopy('preset-payload', presetBodyString)}
                      aria-label="Copy preset response payload"
                      className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-950 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800 transition-colors"
                    >
                      {copiedKey === 'preset-payload' ? (
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                      <span>{copiedKey === 'preset-payload' ? 'Copied' : 'Copy'}</span>
                    </button>
                  </div>
                </div>
                <pre className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 font-mono text-xs text-emerald-300 overflow-x-auto leading-relaxed">
                  {presetBodyString}
                </pre>
                <p className="text-xs text-slate-400">{activePreset.responsePreview.notes}</p>
              </div>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}

import { Check, Copy, RefreshCw, Server, Terminal } from 'lucide-react';
import { useState } from 'react';
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

const SAMPLE_PATHS = [
  '/search?q=silo',
  '/movie/67861',
  '/series/39409',
  '/dashboard',
  '/api/channels',
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
  const [copied, setCopied] = useState(false);

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2.5">
            <Terminal className="w-6 h-6 text-rose-500" />
            <span>API Proxy Lab</span>
          </h2>
          <p className="text-sm text-slate-400 mt-1">
            Test live UG SHACKS Movie API routes and inspect request routing pipelines from{' '}
            <code className="text-emerald-400 font-mono">GET /api/presets</code>.
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
        <div className="flex items-center justify-between gap-4 text-xs">
          <span className="font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
            <Server className="w-3.5 h-3.5" />
            <span>Live Express Endpoint Tester</span>
          </span>
          <span className="font-mono text-slate-400">PORT 3000 · CORS Enabled</span>
        </div>

        <div className="flex flex-col lg:flex-row items-stretch lg:items-center gap-2.5">
          <div className="flex-1 flex items-center bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs font-mono text-slate-200">
            <span className="text-slate-500 mr-2.5 select-none">GET</span>
            <input
              type="text"
              aria-label="API endpoint path"
              value={testPath}
              onChange={(e) => onTestPathChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') onRunTest(testPath);
              }}
              className="w-full bg-transparent focus:outline-none text-slate-100 font-mono"
              placeholder="/search?q=silo or /movie/67861 or /dashboard"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {SAMPLE_PATHS.map((sample) => (
              <button
                key={sample}
                type="button"
                onClick={() => {
                  onTestPathChange(sample);
                  onRunTest(sample);
                }}
                className="px-2.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-slate-300 font-mono transition-colors whitespace-nowrap shrink-0"
              >
                {sample}
              </button>
            ))}
          </div>
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
                onClick={() => handleCopy(JSON.stringify(testResult, null, 2))}
                className="text-slate-400 hover:text-slate-200 flex items-center gap-1.5 text-xs transition-colors"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? 'Copied' : 'Copy JSON'}</span>
              </button>
            </div>

            <pre className="text-xs font-mono text-emerald-300 overflow-x-auto p-3 bg-black/60 rounded-lg max-h-72 leading-relaxed">
              {JSON.stringify(testResult.data ?? testResult, null, 2)}
            </pre>
          </div>
        )}
      </section>

      {presets.length > 0 && activePreset && (
        <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Endpoint Pipeline Presets
            </h3>

            {presets.map((preset) => {
              const selected = activePreset.id === preset.id;
              return (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => onSelectPreset(preset)}
                  className={`w-full text-left p-4 rounded-xl border transition-colors ${
                    selected
                      ? 'bg-rose-950/30 border-rose-500 text-white'
                      : 'bg-slate-900 border-slate-800 text-slate-300 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold text-xs">{preset.name}</span>
                    <span className="text-[11px] font-mono text-slate-400">{preset.method}</span>
                  </div>
                  <div className="mt-1 font-mono text-[11px] text-rose-400 truncate">
                    {preset.path}
                  </div>
                </button>
              );
            })}

            {workerFeatures.length > 0 && (
              <div className="pt-4 border-t border-slate-800 space-y-2">
                <h4 className="text-xs font-bold text-slate-400">Registered Route Handlers</h4>
                {workerFeatures.map((feat) => (
                  <div
                    key={feat.id}
                    className="p-3 rounded-lg bg-slate-900/70 border border-slate-800 text-xs space-y-1"
                  >
                    <div className="font-semibold text-slate-200">{feat.title}</div>
                    <div className="font-mono text-[11px] text-slate-400 truncate">{feat.pattern}</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="lg:col-span-2">
            <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-4">
                <div>
                  <span className="text-xs font-bold uppercase tracking-wider text-rose-400">
                    Preset Pipeline
                  </span>
                  <h3 className="text-lg font-bold text-white mt-0.5">{activePreset.name}</h3>
                  <div className="font-mono text-xs text-slate-400 mt-0.5">
                    {activePreset.method} {activePreset.path}
                  </div>
                </div>
                <div className="text-left sm:text-right">
                  <span className="text-xs text-slate-400">Handler Target</span>
                  <div className="font-mono text-xs text-amber-400 mt-0.5">
                    {activePreset.upstreamCall.target}
                  </div>
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
                <div className="flex items-center justify-between text-xs tabular-nums">
                  <span className="font-bold text-slate-400 uppercase tracking-wider">
                    Response Payload
                  </span>
                  <span className="font-mono text-emerald-400">
                    HTTP {activePreset.responsePreview.status} ({activePreset.responsePreview.statusText})
                  </span>
                </div>
                <pre className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 font-mono text-xs text-emerald-300 overflow-x-auto leading-relaxed">
                  {typeof activePreset.responsePreview.body === 'object' &&
                  activePreset.responsePreview.body !== null
                    ? JSON.stringify(activePreset.responsePreview.body, null, 2)
                    : String(activePreset.responsePreview.body || '(Binary MP4 Stream — Content-Disposition Attachment)')}
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

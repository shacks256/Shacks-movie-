import { Check, Code2, Copy, ExternalLink } from 'lucide-react';
import { useState } from 'react';
import type { WorkerFeature } from '../types';

interface WorkerScriptViewProps {
  features: WorkerFeature[];
  workerSource: string;
}

export function WorkerScriptView({ features, workerSource }: WorkerScriptViewProps) {
  const [copied, setCopied] = useState(false);

  const copySource = () => {
    navigator.clipboard.writeText(workerSource);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2.5">
            <Code2 className="w-6 h-6 text-rose-500" />
            <span>Edge Worker Router & Endpoints</span>
          </h2>
          <p className="text-sm text-slate-400 mt-1">
            Complete route specifications and ES Module edge adapter from{' '}
            <code className="text-emerald-400 font-mono">GET /api/worker-code</code>.
          </p>
        </div>

        <a
          href="/api/worker-code"
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs transition-colors border border-slate-700 whitespace-nowrap shrink-0"
        >
          <ExternalLink className="w-4 h-4 text-emerald-400" />
          <span>View API JSON</span>
        </a>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {features.map((feat) => (
          <article
            key={feat.id}
            className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-3 flex flex-col justify-between"
          >
            <div className="space-y-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="font-bold text-white text-sm">{feat.title}</h3>
                <span className="text-xs font-mono text-rose-400">{feat.pattern}</span>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">{feat.purpose}</p>
            </div>

            <div className="space-y-2 pt-3 border-t border-slate-800">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Execution Behavior
              </span>
              <ul className="list-disc list-inside text-xs text-slate-400 space-y-1">
                {feat.behavior.map((line, idx) => (
                  <li key={idx}>{line}</li>
                ))}
              </ul>
              <div className="pt-2 text-xs text-slate-500 font-mono">
                Handlers:{' '}
                <span className="text-emerald-400">{feat.keyFunctions.join(', ')}</span>
              </div>
            </div>
          </article>
        ))}
      </div>

      {workerSource && (
        <section className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h3 className="text-sm font-bold text-white">Cloudflare Worker ES Module Template</h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Uses <code className="font-mono text-slate-300">env.GATEWAY_ORIGIN</code> and{' '}
                <code className="font-mono text-slate-300">env.GATEWAY_API_KEY</code> environment variables.
              </p>
            </div>
            <button
              type="button"
              onClick={copySource}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-slate-200 font-medium transition-colors whitespace-nowrap shrink-0"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Copied' : 'Copy Worker Code'}</span>
            </button>
          </div>

          <pre className="p-4 rounded-xl bg-slate-950 border border-slate-800 font-mono text-xs text-cyan-300 overflow-x-auto leading-relaxed">
            {workerSource}
          </pre>
        </section>
      )}
    </div>
  );
}

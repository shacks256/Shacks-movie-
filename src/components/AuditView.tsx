import { CheckCircle2, ShieldCheck } from 'lucide-react';
import type { AuditReport } from '../types';

interface AuditViewProps {
  audit: AuditReport | null;
}

export function AuditView({ audit }: AuditViewProps) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2.5">
          <ShieldCheck className="w-6 h-6 text-rose-500" />
          <span>Security Posture & Architecture Audit</span>
        </h2>
        <p className="text-sm text-slate-400 mt-1">
          API gateway security controls and token validation baseline served from{' '}
          <code className="text-emerald-400 font-mono">GET /api/audit</code>.
        </p>
      </div>

      {!audit ? (
        <div className="p-8 text-center bg-slate-900 rounded-2xl border border-slate-800 text-slate-400 text-sm">
          Loading security audit specification...
        </div>
      ) : (
        <>
          <section className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4" />
                <span>Bearer Token & Environment Policy</span>
              </span>
              <span className="text-xs font-mono text-slate-300">
                {audit.tokenPolicy.algorithm} · {audit.tokenPolicy.expirationPolicy}
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                  Recommended Claims Schema
                </span>
                <pre className="text-xs font-mono text-cyan-300 overflow-x-auto p-2 bg-black/50 rounded-lg">
                  {JSON.stringify(audit.tokenPolicy.claimsSchema, null, 2)}
                </pre>
              </div>

              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                  Gateway Verification Checks
                </span>
                <div className="space-y-2.5">
                  {audit.tokenPolicy.checks.map((item, idx) => (
                    <div key={idx} className="text-xs">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-semibold text-slate-100">{item.check}</span>
                        <span className="font-mono text-emerald-400 font-bold">{item.status}</span>
                      </div>
                      <p className="text-slate-400 mt-0.5 leading-relaxed">{item.detail}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>

          <section className="space-y-3">
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400">
              CWE Control Matrix
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {audit.vulnerabilities.map((ctrl) => (
                <article
                  key={ctrl.id}
                  className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-3 flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-2 text-xs font-mono">
                      <span
                        className={`font-bold uppercase ${
                          ctrl.severity === 'CRITICAL'
                            ? 'text-rose-400'
                            : ctrl.severity === 'HIGH'
                              ? 'text-amber-400'
                              : 'text-cyan-400'
                        }`}
                      >
                        {ctrl.severity} · {ctrl.status}
                      </span>
                      <span className="text-slate-400">{ctrl.cwe}</span>
                    </div>
                    <h4 className="font-bold text-slate-100 text-sm">{ctrl.title}</h4>
                    <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
                      {ctrl.description}
                    </p>
                  </div>

                  <div className="pt-3 border-t border-slate-800 space-y-2 text-xs">
                    <div>
                      <span className="font-bold text-slate-200">Impact: </span>
                      <span className="text-slate-400">{ctrl.impact}</span>
                    </div>
                    <div>
                      <span className="font-bold text-emerald-400">Implementation: </span>
                      <span className="text-slate-300">{ctrl.remediation}</span>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </section>
        </>
      )}
    </div>
  );
}

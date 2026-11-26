interface CerebusLoaderProps {
  label?: string;
  sublabel?: string;
  compact?: boolean;
}

export function CerebusLoader({
  label = 'Synchronizing Ledger',
  sublabel = 'Cerebus Cyber Forensics · Payment & Compliance Control',
  compact = false,
}: CerebusLoaderProps) {
  if (compact) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-8">
        <div className="relative w-12 h-12 flex items-center justify-center">
          <svg
            viewBox="0 0 64 64"
            className="w-12 h-12"
            aria-hidden="true"
          >
            <g
              strokeLinecap="round"
              strokeWidth="2.4"
              fill="none"
              transform="translate(32 32)"
            >
              {[
                { x1: -10, y1: -20, x2: 14, y2: -6, delay: '0ms' },
                { x1: -16, y1: -14, x2: 18, y2: 5, delay: '90ms' },
                { x1: -20, y1: -7, x2: 8, y2: 9, delay: '180ms' },
                { x1: -20, y1: 1, x2: 18, y2: 22, delay: '270ms' },
                { x1: -16, y1: 9, x2: 12, y2: 25, delay: '360ms' },
              ].map((line, i) => (
                <line
                  key={i}
                  x1={line.x1}
                  y1={line.y1}
                  x2={line.x2}
                  y2={line.y2}
                  stroke="#0812B8"
                  className="cerebus-scan-line"
                  style={{ animationDelay: line.delay }}
                />
              ))}
            </g>
          </svg>
        </div>
        <p className="text-xs font-medium text-slate-600">{label}</p>
      </div>
    );
  }

  return (
    <div
      className="flex flex-col items-center justify-center py-16 px-6 text-center"
      role="status"
      aria-live="polite"
    >
      <div className="relative flex flex-col items-center gap-5 bg-white border border-slate-200 rounded-xl px-10 py-8 max-w-sm w-full">
        {/* Isometric Hexagonal Scan-Line Emblem */}
        <div className="relative w-20 h-20 flex items-center justify-center">
          <svg
            viewBox="0 0 80 80"
            className="w-20 h-20"
            aria-hidden="true"
          >
            <polygon
              points="40,6 70,23 70,57 40,74 10,57 10,23"
              fill="none"
              stroke="#E2E8F0"
              strokeWidth="1.2"
            />
            <g strokeLinecap="round" strokeWidth="3.2">
              {[
                { x1: 28, y1: 15, x2: 60, y2: 33, delay: '0ms', color: '#0B1120' },
                { x1: 20, y1: 21, x2: 63, y2: 45, delay: '80ms', color: '#0812B8' },
                { x1: 16, y1: 28, x2: 42, y2: 43, delay: '160ms', color: '#0812B8' },
                { x1: 16, y1: 37, x2: 42, y2: 52, delay: '240ms', color: '#0812B8' },
                { x1: 17, y1: 46, x2: 61, y2: 65, delay: '320ms', color: '#0812B8' },
                { x1: 22, y1: 55, x2: 51, y2: 71, delay: '400ms', color: '#0B1120' },
              ].map((bar, idx) => (
                <line
                  key={idx}
                  x1={bar.x1}
                  y1={bar.y1}
                  x2={bar.x2}
                  y2={bar.y2}
                  stroke={bar.color}
                  className="cerebus-scan-line"
                  style={{ animationDelay: bar.delay }}
                />
              ))}
            </g>
          </svg>
        </div>

        <img
          src="/assets/aistudio/image_3b1feb10.png"
          alt="Cerebus Cyber Forensics"
          referrerPolicy="no-referrer"
          className="h-12 w-auto object-contain"
        />

        <div className="space-y-1">
          <p className="text-sm font-semibold text-slate-900 tracking-tight">
            {label}
          </p>
          <p className="text-xs text-slate-500">{sublabel}</p>
        </div>

        <div className="w-full h-1 bg-slate-100 rounded-full overflow-hidden">
          <div className="h-full w-2/5 bg-[#0812B8] cerebus-progress-bar rounded-full" />
        </div>
      </div>
    </div>
  );
}

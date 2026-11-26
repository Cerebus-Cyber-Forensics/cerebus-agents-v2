import { useEffect, useState } from 'react';
import { Download, Loader2, Maximize2, X } from 'lucide-react';
import { fetchDocumentById } from '../services/ledgerService';

export interface ExpandedPhotoTarget {
  title: string;
  subtitle?: string;
  docId?: string;
  inlineUrl?: string;
  fallbackThumbUrl?: string;
  fileName?: string;
}

interface PhotoLightboxModalProps {
  target: ExpandedPhotoTarget | null;
  onClose: () => void;
}

export function PhotoLightboxModal({
  target,
  onClose,
}: PhotoLightboxModalProps) {
  const [fullUrl, setFullUrl] = useState<string>('');
  const [resolvedFileName, setResolvedFileName] = useState<string>('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!target) {
      setFullUrl('');
      setResolvedFileName('');
      setLoading(false);
      return;
    }

    if (target.inlineUrl) {
      setFullUrl(target.inlineUrl);
      setResolvedFileName(target.fileName || 'agent-photo.jpg');
      setLoading(false);
      return;
    }

    if (!target.docId) {
      setFullUrl(target.fallbackThumbUrl || '');
      setResolvedFileName(target.fileName || 'agent-photo.jpg');
      setLoading(false);
      return;
    }

    let active = true;
    setLoading(true);
    setFullUrl(target.fallbackThumbUrl || '');
    setResolvedFileName(target.fileName || 'agent-photo.jpg');

    fetchDocumentById(target.docId)
      .then((docData) => {
        if (!active) return;
        if (docData?.dataUrl) {
          setFullUrl(docData.dataUrl);
          if (docData.fileName) {
            setResolvedFileName(docData.fileName);
          }
        }
      })
      .catch(() => {
        // Keep fallbackThumbUrl visible if full-resolution fetch fails
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [target]);

  useEffect(() => {
    if (!target) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [target, onClose]);

  if (!target) return null;

  const displaySrc = fullUrl || target.fallbackThumbUrl || '';

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`${target.title} full picture`}
      onClick={onClose}
      className="fixed inset-0 z-[70] bg-slate-950/90 backdrop-blur-xs flex flex-col"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="px-4 sm:px-6 py-3.5 border-b border-white/10 bg-slate-950/80 flex items-center justify-between gap-4"
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center text-white shrink-0">
            <Maximize2 className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-white truncate">
              {target.title}
            </h3>
            {(target.subtitle || resolvedFileName) && (
              <p className="text-xs text-slate-300 truncate">
                {target.subtitle || resolvedFileName}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {loading && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs text-slate-200 bg-white/10 rounded-md">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              <span className="hidden sm:inline">Loading full image...</span>
            </span>
          )}
          {displaySrc && (
            <a
              href={displaySrc}
              download={resolvedFileName || 'agent-photo.jpg'}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-white/10 hover:bg-white/20 rounded-lg transition-colors whitespace-nowrap"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download</span>
            </a>
          )}
          <button
            type="button"
            onClick={onClose}
            aria-label="Close expanded picture"
            className="p-2 text-slate-200 hover:text-white hover:bg-white/15 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div className="flex-1 min-h-0 flex items-center justify-center p-4 sm:p-8">
        {displaySrc ? (
          <img
            src={displaySrc}
            alt={target.title}
            onClick={(e) => e.stopPropagation()}
            referrerPolicy="no-referrer"
            className="max-w-full max-h-[85vh] w-auto h-auto object-contain rounded-xl shadow-2xl bg-slate-900 border border-white/15"
          />
        ) : loading ? (
          <div className="flex flex-col items-center gap-3 text-slate-200">
            <Loader2 className="w-7 h-7 animate-spin" />
            <span className="text-xs">Loading full-size picture...</span>
          </div>
        ) : (
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-slate-900 border border-white/15 rounded-xl px-6 py-4 text-sm text-slate-200"
          >
            Full-size picture is unavailable.
          </div>
        )}
      </div>
    </div>
  );
}

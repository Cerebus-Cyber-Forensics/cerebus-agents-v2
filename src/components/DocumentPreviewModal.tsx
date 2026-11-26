import { useEffect, useState } from 'react';
import { Download, FileText, X } from 'lucide-react';
import { fetchDocumentById } from '../services/ledgerService';
import { AgentDocument } from '../types';
import { formatTimestamp } from '../utils/cycleUtils';
import { formatBytes } from '../utils/fileUtils';
import { CerebusLoader } from './CerebusLoader';

interface DocumentPreviewModalProps {
  docId: string | null;
  docTitle?: string;
  onClose: () => void;
}

export function DocumentPreviewModal({
  docId,
  docTitle,
  onClose,
}: DocumentPreviewModalProps) {
  const [loading, setLoading] = useState(false);
  const [docData, setDocData] = useState<AgentDocument | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!docId) {
      setDocData(null);
      return;
    }
    let active = true;
    setLoading(true);
    setError('');
    fetchDocumentById(docId)
      .then((res) => {
        if (!active) return;
        if (!res) {
          setError('Document record could not be found.');
        } else {
          setDocData(res);
        }
      })
      .catch((err) => {
        if (!active) return;
        setError(err instanceof Error ? err.message : 'Failed to load document.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [docId]);

  if (!docId) return null;

  const isPdf = docData?.mimeType === 'application/pdf';
  const isImage =
    docData?.mimeType.startsWith('image/') ||
    docData?.dataUrl.startsWith('data:image/');

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
      <div className="bg-white border border-slate-200 rounded-xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between gap-4">
          <div className="min-w-0">
            <h3 className="text-base font-semibold text-slate-900 truncate">
              {docData?.fileName || docTitle || 'Document Preview'}
            </h3>
            {docData && (
              <div className="flex items-center gap-2 text-xs text-slate-500 mt-0.5">
                <span>{docData.docCategory.replace('_', ' ')}</span>
                {docData.cycleMonth && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span className="font-mono tabular-nums">
                      Cycle {docData.cycleMonth}
                    </span>
                  </>
                )}
                <span aria-hidden="true">·</span>
                <span className="font-mono tabular-nums">
                  {formatBytes(docData.fileSize)}
                </span>
                <span aria-hidden="true">·</span>
                <span>Uploaded by {docData.uploadedByName}</span>
                <span aria-hidden="true">·</span>
                <span className="font-mono tabular-nums">
                  {formatTimestamp(docData.uploadedAt)}
                </span>
              </div>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {docData && (
              <a
                href={docData.dataUrl}
                download={docData.fileName}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors whitespace-nowrap"
              >
                <Download className="w-3.5 h-3.5" />
                Download
              </a>
            )}
            <button
              type="button"
              onClick={onClose}
              aria-label="Close document preview"
              className="p-2 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-auto bg-slate-100 p-6 flex items-center justify-center min-h-[420px]">
          {loading && (
            <CerebusLoader
              compact
              label="Retrieving compliance document..."
            />
          )}
          {!loading && error && (
            <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
              {error}
            </div>
          )}
          {!loading && docData && isImage && (
            <img
              src={docData.dataUrl}
              alt={docData.fileName}
              referrerPolicy="no-referrer"
              className="max-w-full max-h-[68vh] object-contain bg-white border border-slate-200 rounded-lg"
            />
          )}
          {!loading && docData && isPdf && (
            <iframe
              src={docData.dataUrl}
              title={docData.fileName}
              className="w-full h-[68vh] bg-white border border-slate-200 rounded-lg"
            />
          )}
          {!loading && docData && !isImage && !isPdf && (
            <div className="bg-white border border-slate-200 rounded-lg p-8 text-center space-y-3">
              <FileText className="w-8 h-8 text-slate-400 mx-auto" />
              <p className="text-sm text-slate-700">
                Preview unavailable for {docData.mimeType}. Use Download above to inspect the file.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

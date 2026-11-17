import React, { useState, useRef } from 'react';
import { 
  X, 
  UploadCloud, 
  FileText, 
  Trash2, 
  CheckCircle2, 
  AlertCircle, 
  Lock,
  RefreshCw 
} from 'lucide-react';
import { validateResumeFile } from '../services/storage.js';

export default function ResumeUpload({
  isOpen,
  onClose,
  storedResume,
  onSaveResume,
  onDeleteResume
}) {
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef(null);

  if (!isOpen) return null;

  const handleProcessFile = async (file) => {
    if (!file) return;
    setError(null);

    const validation = validateResumeFile(file);
    if (!validation.valid) {
      setError(validation.error);
      return;
    }

    try {
      setLoading(true);
      await onSaveResume(file);
      setError(null);
    } catch (err) {
      setError(err.message || 'Failed to save resume into IndexedDB');
    } finally {
      setLoading(false);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setDragOver(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      handleProcessFile(files[0]);
    }
  };

  const handleFileChange = (e) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleProcessFile(files[0]);
    }
    // reset input so the same file can be selected again
    e.target.value = '';
  };

  const handleDelete = async () => {
    try {
      setLoading(true);
      await onDeleteResume();
      setError(null);
    } catch (err) {
      setError(err.message || 'Failed to remove resume');
    } finally {
      setLoading(false);
    }
  };

  const formatFileSize = (bytes) => {
    if (!bytes) return '0 KB';
    if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div 
        className="bg-slate-900 border border-slate-800 rounded-t-2xl sm:rounded-2xl w-full max-w-lg shadow-2xl text-slate-100 overflow-hidden flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between bg-slate-900/90 shrink-0">
          <div>
            <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
              <FileText className="w-5 h-5 text-emerald-400" />
              Candidate PDF Resume
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Securely stored in your browser for 1-click email attachment.
            </p>
          </div>
          <button
            onClick={onClose}
            type="button"
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg min-h-[44px] min-w-[44px] flex items-center justify-center transition"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 sm:p-6 space-y-4">
          {error && (
            <div className="p-3 rounded-lg bg-red-950/70 border border-red-800/80 text-red-200 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {storedResume ? (
            /* Active Resume Card */
            <div className="p-4 rounded-xl bg-slate-800/80 border border-emerald-600/40 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-lg bg-emerald-950 text-emerald-400 border border-emerald-700/60 flex items-center justify-center shrink-0">
                    <CheckCircle2 className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-white truncate" title={storedResume.name}>
                      {storedResume.name}
                    </p>
                    <p className="text-xs text-slate-400">
                      {formatFileSize(storedResume.size)} • PDF Document
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={loading}
                  className="p-2 text-red-400 hover:text-red-300 hover:bg-red-950/50 rounded-lg min-h-[44px] min-w-[44px] flex items-center justify-center transition"
                  title="Delete Resume"
                  aria-label="Delete Resume"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>

              <div className="pt-2 border-t border-slate-700/60 flex items-center justify-between text-xs text-slate-400">
                <span>Status: Attached by default</span>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={loading}
                  className="text-emerald-400 hover:text-emerald-300 font-medium py-1 px-2 rounded min-h-[44px] flex items-center gap-1"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  Replace File
                </button>
              </div>
            </div>
          ) : (
            /* Upload Drop Area */
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`p-6 sm:p-8 rounded-xl border-2 border-dashed text-center cursor-pointer transition flex flex-col items-center justify-center gap-2 ${
                dragOver
                  ? 'border-emerald-500 bg-emerald-950/30'
                  : 'border-slate-700 bg-slate-800/40 hover:bg-slate-800/70 hover:border-slate-600'
              }`}
            >
              <div className="w-12 h-12 rounded-full bg-slate-800 flex items-center justify-center text-emerald-400 mb-1">
                <UploadCloud className="w-6 h-6" />
              </div>
              <p className="text-sm font-semibold text-white">
                Drag and drop your Corporate Banking CV
              </p>
              <p className="text-xs text-slate-400">
                Supports PDF only (Max 5MB)
              </p>
              <button
                type="button"
                className="mt-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold shadow min-h-[44px] transition"
              >
                Browse PDF File
              </button>
            </div>
          )}

          <input
            ref={fileInputRef}
            type="file"
            accept="application/pdf,.pdf"
            onChange={handleFileChange}
            className="hidden"
          />

          {/* Privacy Note */}
          <div className="flex items-center gap-2 text-[11px] text-slate-400 bg-slate-800/40 p-3 rounded-lg border border-slate-800">
            <Lock className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>
              Zero Server Uploads: Resume resides strictly in your browser's IndexedDB. Direct emails transmit attachments securely via Google's official Gmail API.
            </span>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-900 flex justify-end shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 text-xs font-semibold text-white bg-slate-800 hover:bg-slate-700 rounded-lg min-h-[44px] transition"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

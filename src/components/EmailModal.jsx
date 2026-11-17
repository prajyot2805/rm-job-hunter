import React, { useState, useEffect } from 'react';
import { 
  X, 
  Mail, 
  Send, 
  CheckCircle2, 
  AlertCircle, 
  Paperclip, 
  Building2, 
  Loader2, 
  ShieldCheck 
} from 'lucide-react';
import { generateCorporateCoverPitch } from '../services/mimeBuilder.js';
import { sendJobApplicationEmail } from '../services/gmailService.js';
import { requestGoogleAccessToken } from '../services/googleAuth.js';

export default function EmailModal({
  isOpen,
  onClose,
  job,
  candidatePreferences,
  storedResume,
  googleUser,
  onSendSuccess
}) {
  const [recipientEmail, setRecipientEmail] = useState('');
  const [subject, setSubject] = useState('');
  const [pitchBody, setPitchBody] = useState('');
  const [attachResume, setAttachResume] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);
  const [successInfo, setSuccessInfo] = useState(null);

  useEffect(() => {
    if (job && isOpen) {
      const candidateName = candidatePreferences?.candidateName || 'Corporate Banking Relationship Manager';
      const email = job.applyEmail || '';
      const initialSubject = `Application for ${job.title} - ${candidateName}`;

      const generatedPitch = generateCorporateCoverPitch({
        candidateName: candidatePreferences?.candidateName || '',
        candidateEmail: candidatePreferences?.candidateEmail || '',
        candidatePhone: candidatePreferences?.candidatePhone || '',
        jobTitle: job.title || 'Corporate Banking Relationship Manager',
        organization: job.organization || 'Bank',
        targetSegment: job.segment || 'Large Corporate',
        minCtc: candidatePreferences?.targetCtcMin || candidatePreferences?.minCtc || 25,
        preferredProducts: candidatePreferences?.products || candidatePreferences?.preferredProducts || ['Working Capital', 'Trade Finance']
      });

      setRecipientEmail(email);
      setSubject(initialSubject);
      setPitchBody(generatedPitch);
      setAttachResume(Boolean(storedResume));
      setErrorMessage(null);
      setSuccessInfo(null);
      setIsSubmitting(false);
    }
  }, [job, isOpen, candidatePreferences, storedResume]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen && !isSubmitting) onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isSubmitting, onClose]);

  if (!isOpen || !job) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isSubmitting) return; // Prevent double tap

    setErrorMessage(null);
    const to = recipientEmail.trim();
    if (!to) {
      setErrorMessage('Please provide a valid recipient email address.');
      return;
    }

    setIsSubmitting(true);

    try {
      // 1. Ensure access token
      let token = googleUser?.token;
      if (!token) {
        token = await requestGoogleAccessToken('consent');
      }

      // 2. Prepare resume attachment if selected
      let resumeArrayBuffer = null;
      let resumeFilename = 'Corporate_Banking_RM_Resume.pdf';

      if (attachResume && storedResume) {
        resumeFilename = storedResume.name || resumeFilename;
        if (storedResume.buffer) {
          resumeArrayBuffer = storedResume.buffer;
        } else if (storedResume.blob) {
          if (typeof storedResume.blob.arrayBuffer === 'function') {
            resumeArrayBuffer = await storedResume.blob.arrayBuffer();
          } else if (typeof Response !== 'undefined') {
            resumeArrayBuffer = await new Response(storedResume.blob).arrayBuffer();
          }
        }
      }

      // 3. Dispatch application email via Gmail REST API
      const result = await sendJobApplicationEmail({
        toEmail: to,
        to,
        jobTitle: job.title,
        organization: job.organization,
        candidateName: candidatePreferences?.candidateName || 'Candidate',
        candidateEmail: candidatePreferences?.candidateEmail || undefined,
        candidatePhone: candidatePreferences?.candidatePhone || undefined,
        customBody: pitchBody,
        customPitch: pitchBody,
        customSubject: subject,
        subject,
        resumeFileName: resumeFilename,
        resumeFilename,
        resumeArrayBuffer,
        accessToken: token
      });

      if (result.success) {
        setSuccessInfo(result.messageId || 'SENT');
        if (typeof onSendSuccess === 'function') {
          onSendSuccess(result.messageId);
        }
        setTimeout(() => {
          onClose();
        }, 2200);
      } else {
        setErrorMessage(result.error || 'Failed to dispatch email via Gmail API.');
        setIsSubmitting(false);
      }
    } catch (err) {
      setErrorMessage(err.message || 'An unexpected error occurred while sending email.');
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div 
        className="bg-slate-900 border border-slate-800 rounded-t-2xl sm:rounded-2xl w-full max-w-2xl max-h-[92vh] sm:max-h-[88vh] flex flex-col shadow-2xl text-slate-100 overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Mobile Pull Handle Indicator */}
        <div className="w-12 h-1.5 bg-slate-700 rounded-full mx-auto my-2 sm:hidden shrink-0" />

        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between bg-slate-900/90 shrink-0">
          <div className="min-w-0 pr-3">
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-950 text-emerald-400 border border-emerald-800">
                {job.organization}
              </span>
              <h2 className="text-base font-bold text-white truncate">
                Direct Apply — {job.title}
              </h2>
            </div>
            <p className="text-xs text-slate-400 mt-0.5 truncate">
              Direct dispatch from your Gmail to the hiring desk
            </p>
          </div>
          <button
            onClick={onClose}
            type="button"
            disabled={isSubmitting}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg min-h-[44px] min-w-[44px] flex items-center justify-center transition shrink-0"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body Content */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
          {successInfo ? (
            /* Success State */
            <div className="py-12 flex flex-col items-center justify-center text-center space-y-3">
              <div className="w-16 h-16 rounded-full bg-emerald-950 border border-emerald-600/60 text-emerald-400 flex items-center justify-center animate-bounce">
                <CheckCircle2 className="w-9 h-9" />
              </div>
              <h3 className="text-lg font-bold text-white">Application Email Sent!</h3>
              <p className="text-xs text-slate-300 max-w-sm">
                Your pitch and resume were delivered to <span className="text-emerald-400 font-semibold">{recipientEmail}</span> via Gmail API.
              </p>
              <span className="text-[11px] font-mono text-slate-500 bg-slate-800 px-3 py-1 rounded">
                Message ID: {successInfo}
              </span>
            </div>
          ) : (
            <>
              {errorMessage && (
                <div className="p-3 rounded-lg bg-red-950/70 border border-red-800/80 text-red-200 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                  <span>{errorMessage}</span>
                </div>
              )}

              {/* Recipient Email */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Recipient Recruiter / Corporate Desk Email
                </label>
                <input
                  type="email"
                  required
                  value={recipientEmail}
                  onChange={e => setRecipientEmail(e.target.value)}
                  placeholder="e.g. careers.corporate@bank.com"
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 min-h-[44px]"
                />
              </div>

              {/* Subject */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Email Subject
                </label>
                <input
                  type="text"
                  required
                  value={subject}
                  onChange={e => setSubject(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 min-h-[44px]"
                />
              </div>

              {/* Executive Cover Pitch */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-semibold text-slate-300">
                    Executive Banking Pitch (RFC 2822 Body)
                  </label>
                  <span className="text-[10px] text-emerald-400">Pre-tailored for Corporate RM</span>
                </div>
                <textarea
                  rows={8}
                  required
                  value={pitchBody}
                  onChange={e => setPitchBody(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg p-3 text-xs sm:text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-sans leading-relaxed"
                />
              </div>

              {/* Attachment Checkbox */}
              <div className="p-3 rounded-lg bg-slate-800/70 border border-slate-700/80 flex items-center justify-between gap-3">
                <label className="flex items-center gap-2.5 cursor-pointer text-xs font-medium text-slate-200 min-h-[44px]">
                  <input
                    type="checkbox"
                    checked={attachResume}
                    disabled={!storedResume}
                    onChange={e => setAttachResume(e.target.checked)}
                    className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 bg-slate-700 border-slate-600"
                  />
                  <div className="flex items-center gap-1.5">
                    <Paperclip className="w-3.5 h-3.5 text-emerald-400" />
                    <span>
                      {storedResume
                        ? `Attach PDF Resume (${storedResume.name})`
                        : 'No PDF resume stored in browser'}
                    </span>
                  </div>
                </label>
                {storedResume && (
                  <span className="text-[10px] text-slate-400 bg-slate-700/50 px-2 py-1 rounded">
                    {Math.round(storedResume.size / 1024)} KB
                  </span>
                )}
              </div>
            </>
          )}
        </form>

        {/* Footer */}
        {!successInfo && (
          <div className="p-4 border-t border-slate-800 bg-slate-900 flex items-center justify-between gap-3 shrink-0">
            <div className="hidden sm:flex items-center gap-1.5 text-[11px] text-slate-400">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>Direct via client-side Gmail API</span>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                className="px-4 py-2 text-xs font-medium text-slate-300 hover:bg-slate-800 rounded-lg min-h-[44px] transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={isSubmitting}
                className="flex-1 sm:flex-initial flex items-center justify-center gap-2 px-5 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 disabled:bg-emerald-900 disabled:cursor-not-allowed rounded-lg shadow min-h-[44px] transition"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Sending Application...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    <span>Send Application Email</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

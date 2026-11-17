import React from 'react';
import { 
  Building2, 
  SlidersHorizontal, 
  Upload, 
  CheckCircle2, 
  Mail, 
  LogOut, 
  WifiOff, 
  Sparkles 
} from 'lucide-react';

export default function Header({
  matchCount = 0,
  totalJobs = 0,
  hasResume = false,
  resumeName = null,
  preferences = null,
  googleUser = { isAuthenticated: false, token: null },
  onOpenPreferences,
  onOpenResume,
  onGoogleSignIn,
  onGoogleSignOut,
  isOnline = true
}) {
  return (
    <header className="sticky top-0 z-30 bg-slate-900 border-b border-slate-800 text-white shadow-md">
      {!isOnline && (
        <div className="bg-amber-500/20 text-amber-300 border-b border-amber-500/30 px-4 py-1.5 text-xs flex items-center justify-center gap-2">
          <WifiOff className="w-3.5 h-3.5" />
          <span>Offline Mode — Displaying cached Indian Corporate Banking opportunities</span>
        </div>
      )}

      <div className="max-w-6xl mx-auto px-3 sm:px-6 py-2.5 sm:py-3">
        <div className="flex items-center justify-between gap-2 sm:gap-4">
          {/* Logo & Title */}
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-lg bg-emerald-600 flex items-center justify-center text-white shrink-0 shadow">
              <Building2 className="w-5 h-5 sm:w-6 sm:h-6" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <h1 className="text-base sm:text-lg font-bold tracking-tight text-white truncate">
                  CorpBank RM
                </h1>
                <span className="hidden xs:inline-block text-[10px] font-semibold bg-emerald-950 text-emerald-400 border border-emerald-800/80 px-1.5 py-0.5 rounded">
                  India
                </span>
              </div>
              <p className="text-[11px] sm:text-xs text-slate-400 truncate">
                Corporate Banking Relationship Manager Switch Tool
              </p>
            </div>
          </div>

          {/* Quick Action Buttons */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            {/* Top Matches Pill */}
            <div className="hidden md:flex items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-emerald-950/80 text-emerald-400 border border-emerald-700/60 text-xs font-semibold">
              <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
              <span>{matchCount} Top Matches</span>
            </div>

            {/* Resume Upload Pill Button */}
            <button
              onClick={onOpenResume}
              type="button"
              className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-2 rounded-lg text-xs font-medium min-h-[44px] transition border ${
                hasResume
                  ? 'bg-emerald-950/60 text-emerald-300 border-emerald-600/60 hover:bg-emerald-900/60'
                  : 'bg-slate-800 text-amber-300 border-amber-500/40 hover:bg-slate-700'
              }`}
              title={hasResume ? `Active Resume: ${resumeName || 'Uploaded'}` : 'Upload PDF Resume'}
            >
              {hasResume ? (
                <>
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span className="hidden sm:inline">Resume Active</span>
                  <span className="sm:hidden">Resume</span>
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4 text-amber-400 shrink-0" />
                  <span className="hidden sm:inline">Upload Resume</span>
                  <span className="sm:hidden">Resume</span>
                </>
              )}
            </button>

            {/* Preferences Modal Trigger */}
            <button
              onClick={onOpenPreferences}
              type="button"
              className="flex items-center justify-center gap-1.5 px-2.5 sm:px-3 py-2 rounded-lg text-xs font-medium min-h-[44px] min-w-[44px] bg-slate-800 text-slate-200 border border-slate-700 hover:bg-slate-700 transition"
              title="Configure Target Segment, Metro, & CTC"
            >
              <SlidersHorizontal className="w-4 h-4 text-slate-300 shrink-0" />
              <span className="hidden sm:inline">Preferences</span>
            </button>

            {/* Google OAuth Connect / Disconnect */}
            {googleUser.isAuthenticated ? (
              <button
                onClick={onGoogleSignOut}
                type="button"
                className="flex items-center gap-1.5 px-2.5 sm:px-3 py-2 rounded-lg text-xs font-medium min-h-[44px] bg-slate-800 text-emerald-400 border border-emerald-600/50 hover:bg-slate-700 transition"
                title="Google Authenticated. Click to Sign Out."
              >
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                <span className="hidden sm:inline">Gmail Connected</span>
                <LogOut className="w-3.5 h-3.5 text-slate-400 ml-1" />
              </button>
            ) : (
              <button
                onClick={onGoogleSignIn}
                type="button"
                className="flex items-center gap-1.5 px-2.5 sm:px-3 py-2 rounded-lg text-xs font-medium min-h-[44px] bg-emerald-600 text-white hover:bg-emerald-500 shadow-sm transition"
                title="Connect Gmail for 1-Click Direct Recruiter Email Apply"
              >
                <Mail className="w-4 h-4 shrink-0" />
                <span className="hidden sm:inline">Connect Gmail</span>
                <span className="sm:hidden">Gmail</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}

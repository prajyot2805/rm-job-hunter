import React, { useState, useEffect, useMemo, useCallback } from 'react';
import Header from './components/Header.jsx';
import JobFilters from './components/JobFilters.jsx';
import JobCard from './components/JobCard.jsx';
import PreferencesModal from './components/PreferencesModal.jsx';
import ResumeUpload from './components/ResumeUpload.jsx';
import EmailModal from './components/EmailModal.jsx';

import { 
  getPreferences, 
  savePreferences, 
  getResume, 
  saveResume, 
  deleteResume,
  DEFAULT_PREFERENCES 
} from './services/storage.js';

import { 
  calculateMatchScore, 
  computeLocationScore 
} from './services/scoring.js';

import { fetchJobs } from './services/n8nService.js';

import { 
  initGoogleAuth, 
  getStoredAccessToken, 
  requestGoogleAccessToken, 
  revokeStoredToken 
} from './services/googleAuth.js';

import { 
  Building2, 
  RefreshCw, 
  AlertCircle, 
  CheckCircle2, 
  Briefcase 
} from 'lucide-react';

export default function App() {
  const [preferences, setPreferences] = useState(null);
  const [storedResume, setStoredResume] = useState(null);
  const [rawJobs, setRawJobs] = useState([]);
  const [loadingJobs, setLoadingJobs] = useState(true);
  const [jobsError, setJobsError] = useState(null);

  const [activeFilter, setActiveFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeModal, setActiveModal] = useState(null); // 'preferences' | 'resume' | 'email' | null
  const [selectedJobForEmail, setSelectedJobForEmail] = useState(null);

  const [googleUser, setGoogleUser] = useState({
    isAuthenticated: false,
    token: null
  });

  const [isOnline, setIsOnline] = useState(
    typeof navigator !== 'undefined' && 'onLine' in navigator ? navigator.onLine : true
  );

  const [toast, setToast] = useState(null);

  const showToast = useCallback((message, type = 'info') => {
    setToast({ message, type });
    setTimeout(() => {
      setToast(null);
    }, 3500);
  }, []);

  // 1. Initial Data & Auth Hydration
  useEffect(() => {
    // Load preferences
    const storedPrefs = getPreferences();
    if (storedPrefs) {
      setPreferences(storedPrefs);
    } else {
      setPreferences(DEFAULT_PREFERENCES);
    }

    // Load resume from IndexedDB
    getResume()
      .then(res => {
        if (res) setStoredResume(res);
      })
      .catch(err => {
        console.warn('Failed to load resume from IndexedDB:', err);
      });

    // Initialize Google GIS client
    initGoogleAuth(
      (tokenResponse) => {
        const token = typeof tokenResponse === 'string' ? tokenResponse : tokenResponse?.access_token;
        setGoogleUser({
          isAuthenticated: true,
          token
        });
        showToast('Google account connected for Gmail apply', 'success');
      },
      (error) => {
        console.warn('Google auth error callback:', error);
      }
    );

    // Check stored token
    const token = getStoredAccessToken();
    if (token) {
      setGoogleUser({ isAuthenticated: true, token });
    }

    // Network listeners
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Hash-based routing check
    const handleHash = () => {
      const hash = window.location.hash;
      if (hash === '#preferences') setActiveModal('preferences');
      else if (hash === '#resume') setActiveModal('resume');
    };
    handleHash();
    window.addEventListener('hashchange', handleHash);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('hashchange', handleHash);
    };
  }, [showToast]);

  // 2. Fetch Jobs from n8n / Fallback
  const loadJobFeed = useCallback(async () => {
    try {
      setLoadingJobs(true);
      setJobsError(null);
      const res = await fetchJobs();
      if (res && res.jobs) {
        setRawJobs(res.jobs);
      }
    } catch (err) {
      setJobsError(err.message || 'Failed to fetch job postings');
    } finally {
      setLoadingJobs(false);
    }
  }, []);

  useEffect(() => {
    loadJobFeed();
  }, [loadJobFeed]);

  // 3. Relevance Scoring Pipeline
  const scoredJobs = useMemo(() => {
    return (rawJobs || []).map(job => {
      const scoreResult = calculateMatchScore(job, preferences);
      return {
        ...job,
        matchScore: scoreResult.score,
        matchTier: scoreResult.tier,
        subScores: scoreResult.subScores
      };
    });
  }, [rawJobs, preferences]);

  // 4. Counts for Filter Pills
  const filterCounts = useMemo(() => {
    const counts = {
      all: scoredJobs.length,
      top_matches: 0,
      large_corp: 0,
      mid_corp: 0,
      mnc: 0,
      commercial: 0,
      mumbai: 0,
      delhi: 0,
      bengaluru: 0
    };

    scoredJobs.forEach(job => {
      if (job.matchScore >= 80) counts.top_matches++;

      const seg = (job.segment || '').toLowerCase();
      if (seg.includes('large corporate') || seg.includes('lcg')) counts.large_corp++;
      if (seg.includes('mid corporate') || seg.includes('mcg')) counts.mid_corp++;
      if (seg.includes('mnc') || seg.includes('multinational')) counts.mnc++;
      if (seg.includes('commercial') || seg.includes('fig')) counts.commercial++;

      if (computeLocationScore(['Mumbai'], job.location) > 0) counts.mumbai++;
      if (computeLocationScore(['Delhi NCR'], job.location) > 0) counts.delhi++;
      if (computeLocationScore(['Bengaluru'], job.location) > 0) counts.bengaluru++;
    });

    return counts;
  }, [scoredJobs]);

  // 5. Filtered & Ranked Jobs
  const visibleJobs = useMemo(() => {
    let result = [...scoredJobs];

    // Filter by active pill
    if (activeFilter === 'top_matches') {
      result = result.filter(j => j.matchScore >= 80);
    } else if (activeFilter === 'large_corp') {
      result = result.filter(j => (j.segment || '').toLowerCase().includes('large corporate') || (j.segment || '').toLowerCase().includes('lcg'));
    } else if (activeFilter === 'mid_corp') {
      result = result.filter(j => (j.segment || '').toLowerCase().includes('mid corporate') || (j.segment || '').toLowerCase().includes('mcg'));
    } else if (activeFilter === 'mnc') {
      result = result.filter(j => (j.segment || '').toLowerCase().includes('mnc') || (j.segment || '').toLowerCase().includes('multinational'));
    } else if (activeFilter === 'commercial') {
      result = result.filter(j => (j.segment || '').toLowerCase().includes('commercial') || (j.segment || '').toLowerCase().includes('fig'));
    } else if (activeFilter === 'mumbai') {
      result = result.filter(j => computeLocationScore(['Mumbai'], j.location) > 0);
    } else if (activeFilter === 'delhi') {
      result = result.filter(j => computeLocationScore(['Delhi NCR'], j.location) > 0);
    } else if (activeFilter === 'bengaluru') {
      result = result.filter(j => computeLocationScore(['Bengaluru'], j.location) > 0);
    }

    // Filter by search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(j => {
        return (
          (j.title || '').toLowerCase().includes(q) ||
          (j.organization || '').toLowerCase().includes(q) ||
          (j.location || '').toLowerCase().includes(q) ||
          (j.segment || '').toLowerCase().includes(q) ||
          (j.description || '').toLowerCase().includes(q) ||
          (j.ctc || '').toLowerCase().includes(q)
        );
      });
    }

    // Sort descending by matchScore
    result.sort((a, b) => b.matchScore - a.matchScore);
    return result;
  }, [scoredJobs, activeFilter, searchQuery]);

  // Handlers
  const handleSavePreferences = (newPrefs) => {
    savePreferences(newPrefs);
    setPreferences(newPrefs);
    showToast('Preferences updated & jobs re-ranked', 'success');
  };

  const handleSaveResume = async (file) => {
    await saveResume(file);
    const updated = await getResume();
    setStoredResume(updated);
    showToast(`Resume "${file.name}" saved`, 'success');
  };

  const handleDeleteResume = async () => {
    await deleteResume();
    setStoredResume(null);
    showToast('Resume removed from browser storage', 'info');
  };

  const handleGoogleSignIn = async () => {
    try {
      const token = await requestGoogleAccessToken('consent');
      if (token) {
        setGoogleUser({ isAuthenticated: true, token });
        showToast('Gmail successfully connected!', 'success');
      }
    } catch (err) {
      showToast(`Google Sign-In failed: ${err.message}`, 'error');
    }
  };

  const handleGoogleSignOut = async () => {
    await revokeStoredToken();
    setGoogleUser({ isAuthenticated: false, token: null });
    showToast('Signed out of Google', 'info');
  };

  const handleOpenEmailModal = (job) => {
    setSelectedJobForEmail(job);
    setActiveModal('email');
  };

  const handleSendSuccess = (messageId) => {
    showToast(`Application email dispatched! (ID: ${messageId})`, 'success');
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col font-sans selection:bg-emerald-600 selection:text-white">
      {/* Toast Notification */}
      {toast && (
        <div className="fixed top-16 right-4 z-50 animate-fade-in transition duration-200">
          <div className={`flex items-center gap-2 px-4 py-3 rounded-xl shadow-xl text-xs font-semibold border ${
            toast.type === 'success'
              ? 'bg-emerald-950 text-emerald-200 border-emerald-600'
              : toast.type === 'error'
              ? 'bg-red-950 text-red-200 border-red-600'
              : 'bg-slate-800 text-white border-slate-700'
          }`}>
            {toast.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            ) : toast.type === 'error' ? (
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
            ) : (
              <Briefcase className="w-4 h-4 text-emerald-400 shrink-0" />
            )}
            <span>{toast.message}</span>
          </div>
        </div>
      )}

      {/* Header */}
      <Header
        matchCount={filterCounts.top_matches}
        totalJobs={rawJobs.length}
        hasResume={Boolean(storedResume)}
        resumeName={storedResume?.name || null}
        preferences={preferences}
        googleUser={googleUser}
        onOpenPreferences={() => setActiveModal('preferences')}
        onOpenResume={() => setActiveModal('resume')}
        onGoogleSignIn={handleGoogleSignIn}
        onGoogleSignOut={handleGoogleSignOut}
        isOnline={isOnline}
      />

      {/* Main Container */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-3 sm:px-6 py-4 sm:py-6">
        {/* Filter and Search Bar */}
        <JobFilters
          activeFilter={activeFilter}
          onFilterChange={setActiveFilter}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          filterCounts={filterCounts}
        />

        {/* Job Listings Feed */}
        {loadingJobs ? (
          <div className="py-24 flex flex-col items-center justify-center gap-3 text-slate-400">
            <RefreshCw className="w-8 h-8 animate-spin text-emerald-400" />
            <p className="text-sm font-medium">Loading Corporate Banking RM Postings...</p>
          </div>
        ) : visibleJobs.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {visibleJobs.map(job => (
              <JobCard
                key={job.id}
                job={job}
                onApplyEmail={handleOpenEmailModal}
              />
            ))}
          </div>
        ) : (
          /* Empty State */
          <div className="py-16 text-center bg-slate-900/60 rounded-2xl border border-slate-800 p-8 space-y-3">
            <div className="w-12 h-12 rounded-full bg-slate-800 flex items-center justify-center text-slate-400 mx-auto">
              <Building2 className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-white">No Corporate Banking Opportunities Found</h3>
            <p className="text-xs text-slate-400 max-w-md mx-auto">
              No listings match the current filters ({activeFilter}) or search keywords ("{searchQuery}").
            </p>
            <button
              type="button"
              onClick={() => { setActiveFilter('all'); setSearchQuery(''); }}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold min-h-[44px] transition"
            >
              Reset All Filters
            </button>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="bg-slate-950 border-t border-slate-800/80 py-5 text-center text-xs text-slate-400">
        <div className="max-w-6xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>Corporate Banking Relationship Manager Switch Portal • India</span>
          <span>Zero Server Storage • Client-Side Gmail Direct Apply</span>
        </div>
      </footer>

      {/* Modals */}
      <PreferencesModal
        isOpen={activeModal === 'preferences'}
        onClose={() => setActiveModal(null)}
        initialPreferences={preferences}
        onSavePreferences={handleSavePreferences}
      />

      <ResumeUpload
        isOpen={activeModal === 'resume'}
        onClose={() => setActiveModal(null)}
        storedResume={storedResume}
        onSaveResume={handleSaveResume}
        onDeleteResume={handleDeleteResume}
      />

      <EmailModal
        isOpen={activeModal === 'email'}
        onClose={() => { setActiveModal(null); setSelectedJobForEmail(null); }}
        job={selectedJobForEmail}
        candidatePreferences={preferences}
        storedResume={storedResume}
        googleUser={googleUser}
        onSendSuccess={handleSendSuccess}
      />
    </div>
  );
}

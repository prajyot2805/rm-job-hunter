import React, { useState } from 'react';
import { 
  Building2, 
  MapPin, 
  IndianRupee, 
  ExternalLink, 
  Mail, 
  Clock, 
  Sparkles, 
  ChevronDown, 
  ChevronUp 
} from 'lucide-react';

const BANK_COLOR_MAP = {
  'hdfc bank': 'bg-blue-700 text-white',
  'icici bank': 'bg-rose-700 text-white',
  'axis bank': 'bg-pink-800 text-white',
  'kotak mahindra bank': 'bg-red-600 text-white',
  'standard chartered bank': 'bg-emerald-700 text-white',
  'standard chartered': 'bg-emerald-700 text-white',
  'hsbc india': 'bg-red-700 text-white',
  'hsbc': 'bg-red-700 text-white',
  'state bank of india': 'bg-sky-700 text-white',
  'sbi': 'bg-sky-700 text-white',
  'citi india': 'bg-indigo-700 text-white',
  'citi': 'bg-indigo-700 text-white',
  'barclays india': 'bg-cyan-700 text-white',
  'barclays': 'bg-cyan-700 text-white',
  'idfc first bank': 'bg-amber-700 text-white',
  'yes bank': 'bg-blue-800 text-white',
  'federal bank': 'bg-yellow-700 text-white',
  'indusind bank': 'bg-orange-700 text-white'
};

export default function JobCard({ job, onApplyEmail }) {
  const [expanded, setExpanded] = useState(false);

  const bankKey = (job.organization || '').toLowerCase().trim();
  const bankBadgeClass = BANK_COLOR_MAP[bankKey] || 'bg-slate-700 text-slate-100';

  const score = job.matchScore !== undefined ? job.matchScore : 70;
  const tier = job.matchTier || (score >= 85 ? 'Top Match' : score >= 70 ? 'Good Match' : score >= 50 ? 'Moderate Fit' : 'Low Fit');

  const getScoreBadgeStyles = () => {
    if (score >= 85) {
      return 'bg-emerald-950/80 text-emerald-300 border-emerald-500/60';
    }
    if (score >= 70) {
      return 'bg-blue-950/80 text-blue-300 border-blue-500/60';
    }
    if (score >= 50) {
      return 'bg-amber-950/80 text-amber-300 border-amber-500/60';
    }
    return 'bg-slate-800 text-slate-400 border-slate-700';
  };

  return (
    <div className="bg-slate-900/90 border border-slate-800 hover:border-slate-700 rounded-xl p-4 sm:p-5 shadow-sm hover:shadow-md transition flex flex-col justify-between">
      <div>
        {/* Top Header: Bank Badge + Match Pill */}
        <div className="flex items-start justify-between gap-3 mb-2.5">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`px-2.5 py-1 rounded text-xs font-bold tracking-tight shadow-sm ${bankBadgeClass}`}>
              {job.organization}
            </span>
            <span className="text-[11px] font-medium text-slate-400 bg-slate-800/80 border border-slate-700 px-2 py-0.5 rounded">
              {job.segment || 'Corporate Banking'}
            </span>
          </div>

          {/* Match Score Badge */}
          <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-bold shrink-0 shadow-sm ${getScoreBadgeStyles()}`}>
            <Sparkles className="w-3.5 h-3.5" />
            <span>{score}% Match</span>
          </div>
        </div>

        {/* Job Title */}
        <h2 className="text-sm sm:text-base font-bold text-white tracking-tight mb-2 leading-snug">
          {job.title}
        </h2>

        {/* Key Metadata Row */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-slate-300 mb-3">
          <div className="flex items-center gap-1">
            <MapPin className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <span>{job.location}</span>
          </div>
          <div className="flex items-center gap-1 font-semibold text-emerald-300">
            <span>₹</span>
            <span>{job.ctc || 'Not Disclosed'}</span>
          </div>
          <div className="flex items-center gap-1 text-slate-400">
            <Clock className="w-3.5 h-3.5 shrink-0" />
            <span>{job.postedDate} • {job.source || 'Curated'}</span>
          </div>
        </div>

        {/* Job Description */}
        <p className={`text-xs text-slate-300 leading-relaxed mb-3 ${expanded ? '' : 'line-clamp-2'}`}>
          {job.description}
        </p>

        {job.description && job.description.length > 120 && (
          <button
            type="button"
            onClick={() => setExpanded(!expanded)}
            className="text-[11px] text-emerald-400 hover:text-emerald-300 font-medium min-h-[44px] my-1 flex items-center gap-1"
          >
            {expanded ? (
              <>Show Less <ChevronUp className="w-3 h-3" /></>
            ) : (
              <>Read Full Requirement <ChevronDown className="w-3 h-3" /></>
            )}
          </button>
        )}
      </div>

      {/* Action Footer */}
      <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between gap-2">
        {/* Direct URL */}
        <a
          href={job.directUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-300 hover:text-white bg-slate-800/90 hover:bg-slate-700 rounded-lg min-h-[44px] transition border border-slate-700/60"
          title="View Original Job Posting"
        >
          <ExternalLink className="w-3.5 h-3.5" />
          <span>View Job</span>
        </a>

        {/* Direct Apply / Send Email CTA */}
        <button
          type="button"
          onClick={() => onApplyEmail(job)}
          className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg min-h-[44px] shadow-sm transition"
          title="Send Application Email via Gmail API"
        >
          <Mail className="w-4 h-4" />
          <span>Direct Apply</span>
        </button>
      </div>
    </div>
  );
}

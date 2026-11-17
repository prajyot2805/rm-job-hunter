import React, { useState, useEffect } from 'react';
import { X, Check, RotateCcw, Building2, MapPin, IndianRupee, Layers } from 'lucide-react';
import { DEFAULT_PREFERENCES } from '../services/storage.js';

const AVAILABLE_LOCATIONS = [
  { id: 'Mumbai', label: 'Mumbai (BKC / Lower Parel / Fort)' },
  { id: 'Delhi NCR', label: 'Delhi NCR (Gurugram / Cyber City / CP / Noida)' },
  { id: 'Bengaluru', label: 'Bengaluru (MG Road / Whitefield / Koramangala)' },
  { id: 'Hyderabad', label: 'Hyderabad (Hitec City / Gachibowli)' },
  { id: 'Chennai', label: 'Chennai (OMR / Anna Salai)' },
  { id: 'Pune', label: 'Pune (Hinjewadi / Magarpatta)' }
];

const AVAILABLE_SEGMENTS = [
  { id: 'Large Corporate', title: 'Large Corporate Group (LCG)', sub: 'Turnover > ₹1,000 Cr' },
  { id: 'Mid Corporate', title: 'Mid Corporate Group (MCG)', sub: 'Turnover ₹200 - ₹1,000 Cr' },
  { id: 'MNC Banking', title: 'Multinational Banking (MNC)', sub: 'Global Subsidiaries & Cross-Border' },
  { id: 'Commercial Banking', title: 'Commercial Banking / Emerging', sub: 'Turnover ₹50 - ₹200 Cr' },
  { id: 'FIG', title: 'Financial Institutions Group (FIG)', sub: 'NBFCs, Funds & Microfinance' }
];

const AVAILABLE_PRODUCTS = [
  'Working Capital',
  'Trade Finance',
  'Syndication',
  'Forex',
  'Term Loans',
  'Cash Management Services (CMS)'
];

const CTC_OPTIONS = [20, 25, 30, 35, 40, 50];

export default function PreferencesModal({
  isOpen,
  onClose,
  initialPreferences,
  onSavePreferences
}) {
  const [formData, setFormData] = useState({
    candidateName: '',
    candidateEmail: '',
    candidatePhone: '',
    targetLocations: ['Mumbai', 'Delhi NCR', 'Bengaluru'],
    targetSegments: ['Large Corporate', 'Mid Corporate', 'MNC Banking'],
    targetCtcMin: 25,
    products: ['Working Capital', 'Trade Finance', 'Syndication', 'Forex']
  });

  useEffect(() => {
    if (initialPreferences) {
      setFormData({
        candidateName: initialPreferences.candidateName || '',
        candidateEmail: initialPreferences.candidateEmail || '',
        candidatePhone: initialPreferences.candidatePhone || '',
        targetLocations: initialPreferences.targetLocations || initialPreferences.preferredLocations || ['Mumbai', 'Delhi NCR', 'Bengaluru'],
        targetSegments: initialPreferences.targetSegments || initialPreferences.preferredSegments || ['Large Corporate', 'Mid Corporate', 'MNC Banking'],
        targetCtcMin: initialPreferences.targetCtcMin || initialPreferences.minCtc || 25,
        products: initialPreferences.products || initialPreferences.preferredProducts || ['Working Capital', 'Trade Finance', 'Syndication', 'Forex']
      });
    }
  }, [initialPreferences, isOpen]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const toggleLocation = (loc) => {
    setFormData(prev => {
      const exists = prev.targetLocations.includes(loc);
      const next = exists ? prev.targetLocations.filter(l => l !== loc) : [...prev.targetLocations, loc];
      return { ...prev, targetLocations: next.length > 0 ? next : [loc] };
    });
  };

  const toggleSegment = (seg) => {
    setFormData(prev => {
      const exists = prev.targetSegments.includes(seg);
      const next = exists ? prev.targetSegments.filter(s => s !== seg) : [...prev.targetSegments, seg];
      return { ...prev, targetSegments: next.length > 0 ? next : [seg] };
    });
  };

  const toggleProduct = (prod) => {
    setFormData(prev => {
      const exists = prev.products.includes(prod);
      const next = exists ? prev.products.filter(p => p !== prod) : [...prev.products, prod];
      return { ...prev, products: next.length > 0 ? next : [prod] };
    });
  };

  const handleReset = () => {
    setFormData({
      ...DEFAULT_PREFERENCES,
      targetCtcMin: 25
    });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const payload = {
      ...formData,
      preferredLocations: formData.targetLocations,
      preferredSegments: formData.targetSegments,
      minCtc: formData.targetCtcMin,
      preferredProducts: formData.products
    };
    onSavePreferences(payload);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div 
        className="bg-slate-900 border border-slate-800 rounded-t-2xl sm:rounded-2xl w-full max-w-2xl max-h-[92vh] sm:max-h-[88vh] flex flex-col shadow-2xl text-slate-100 overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between bg-slate-900/90 shrink-0">
          <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Building2 className="w-5 h-5 text-emerald-400" />
              Corporate Banking RM Profile & Preferences
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Personalize job relevance ranking and automated email pitch generation.
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

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
          {/* Candidate Identity */}
          <div className="space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
              Candidate Details (For Email Applications)
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs text-slate-400 mb-1">Full Name</label>
                <input
                  type="text"
                  value={formData.candidateName}
                  onChange={e => setFormData({ ...formData, candidateName: e.target.value })}
                  placeholder="e.g. Prajyot Chakrawarti"
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 min-h-[44px]"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Your Email</label>
                <input
                  type="email"
                  value={formData.candidateEmail}
                  onChange={e => setFormData({ ...formData, candidateEmail: e.target.value })}
                  placeholder="e.g. prajyot@example.com"
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 min-h-[44px]"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Phone / Mobile</label>
                <input
                  type="tel"
                  value={formData.candidatePhone}
                  onChange={e => setFormData({ ...formData, candidatePhone: e.target.value })}
                  placeholder="e.g. +91 98200 12345"
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 min-h-[44px]"
                />
              </div>
            </div>
          </div>

          {/* Target Locations */}
          <div className="space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5" />
              Target Banking Metros (Multi-select)
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {AVAILABLE_LOCATIONS.map(loc => {
                const isSelected = formData.targetLocations.includes(loc.id);
                return (
                  <button
                    key={loc.id}
                    type="button"
                    onClick={() => toggleLocation(loc.id)}
                    className={`flex items-start text-left gap-2.5 p-3 rounded-lg border text-xs min-h-[44px] transition ${
                      isSelected
                        ? 'bg-emerald-950/60 border-emerald-500 text-white font-medium'
                        : 'bg-slate-800/80 border-slate-700 text-slate-300 hover:bg-slate-800'
                    }`}
                  >
                    <div className={`w-4 h-4 rounded mt-0.5 flex items-center justify-center shrink-0 border ${
                      isSelected ? 'bg-emerald-600 border-emerald-500 text-white' : 'border-slate-600'
                    }`}>
                      {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                    </div>
                    <span>{loc.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Corporate Segments */}
          <div className="space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
              <Building2 className="w-3.5 h-3.5" />
              Target Corporate Banking Segments (Multi-select)
            </h3>
            <div className="space-y-2">
              {AVAILABLE_SEGMENTS.map(seg => {
                const isSelected = formData.targetSegments.includes(seg.id);
                return (
                  <button
                    key={seg.id}
                    type="button"
                    onClick={() => toggleSegment(seg.id)}
                    className={`w-full flex items-center justify-between p-3 rounded-lg border text-left text-xs min-h-[44px] transition ${
                      isSelected
                        ? 'bg-emerald-950/60 border-emerald-500 text-white'
                        : 'bg-slate-800/80 border-slate-700 text-slate-300 hover:bg-slate-800'
                    }`}
                  >
                    <div>
                      <div className="font-semibold text-white">{seg.title}</div>
                      <div className="text-[11px] text-slate-400">{seg.sub}</div>
                    </div>
                    <div className={`w-5 h-5 rounded flex items-center justify-center shrink-0 border ml-3 ${
                      isSelected ? 'bg-emerald-600 border-emerald-500 text-white' : 'border-slate-600'
                    }`}>
                      {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Minimum Target CTC */}
          <div className="space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
              <IndianRupee className="w-3.5 h-3.5" />
              Target Minimum CTC (₹ Lacs P.A.)
            </h3>
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
              {CTC_OPTIONS.map(ctc => {
                const isSelected = formData.targetCtcMin === ctc;
                return (
                  <button
                    key={ctc}
                    type="button"
                    onClick={() => setFormData({ ...formData, targetCtcMin: ctc })}
                    className={`py-2 px-3 rounded-lg border text-center text-xs font-semibold min-h-[44px] transition ${
                      isSelected
                        ? 'bg-emerald-600 border-emerald-500 text-white shadow'
                        : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700'
                    }`}
                  >
                    ₹{ctc} LPA{ctc === 50 ? '+' : ''}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Products & Domain Capabilities */}
          <div className="space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5" />
              Products & Underwriting Strengths
            </h3>
            <div className="flex flex-wrap gap-2">
              {AVAILABLE_PRODUCTS.map(prod => {
                const isSelected = formData.products.includes(prod);
                return (
                  <button
                    key={prod}
                    type="button"
                    onClick={() => toggleProduct(prod)}
                    className={`px-3 py-2 rounded-lg text-xs font-medium border min-h-[44px] transition ${
                      isSelected
                        ? 'bg-emerald-950/80 border-emerald-500 text-emerald-300'
                        : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {isSelected ? '✓ ' : '+ '} {prod}
                  </button>
                );
              })}
            </div>
          </div>
        </form>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-900 flex items-center justify-between gap-3 shrink-0">
          <button
            type="button"
            onClick={handleReset}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-400 hover:text-white rounded-lg min-h-[44px] transition"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Reset Defaults
          </button>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-slate-300 hover:bg-slate-800 rounded-lg min-h-[44px] transition"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              className="px-5 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg shadow min-h-[44px] transition"
            >
              Save Preferences
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

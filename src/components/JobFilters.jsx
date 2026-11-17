import React from 'react';
import { Search, X, Filter } from 'lucide-react';

const FILTER_PILLS = [
  { id: 'all', label: 'All Jobs' },
  { id: 'top_matches', label: 'Top Matches (≥80%)' },
  { id: 'large_corp', label: 'Large Corporate (LCG)' },
  { id: 'mid_corp', label: 'Mid Corporate (MCG)' },
  { id: 'mnc', label: 'MNC Banking' },
  { id: 'commercial', label: 'Commercial / FIG' },
  { id: 'mumbai', label: 'Mumbai (BKC)' },
  { id: 'delhi', label: 'Delhi NCR' },
  { id: 'bengaluru', label: 'Bengaluru' }
];

export default function JobFilters({
  activeFilter = 'all',
  onFilterChange,
  searchQuery = '',
  onSearchChange,
  filterCounts = {}
}) {
  return (
    <div className="space-y-3 mb-5">
      {/* Search Input Row */}
      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
          <Search className="w-4 h-4" />
        </div>
        <input
          type="text"
          value={searchQuery}
          onChange={e => onSearchChange(e.target.value)}
          placeholder="Search by Bank (HDFC, ICICI, StanChart), Role, City (BKC, Gurgaon), or Product..."
          className="w-full pl-10 pr-10 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 min-h-[44px] shadow-sm"
        />
        {searchQuery && (
          <button
            type="button"
            onClick={() => onSearchChange('')}
            className="absolute inset-y-0 right-0 min-w-[44px] min-h-[44px] flex items-center justify-center text-slate-400 hover:text-white"
            aria-label="Clear search"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Horizontal Scrollable Filter Chips */}
      <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1 -mx-3 px-3 sm:mx-0 sm:px-0">
        <div className="flex items-center gap-1.5 text-xs text-slate-400 shrink-0 pr-1">
          <Filter className="w-3.5 h-3.5 text-emerald-400" />
          <span className="font-semibold uppercase tracking-wider text-[10px]">Filter:</span>
        </div>

        {FILTER_PILLS.map(pill => {
          const isActive = activeFilter === pill.id;
          const count = filterCounts[pill.id];

          return (
            <button
              key={pill.id}
              type="button"
              onClick={() => onFilterChange(pill.id)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-full text-xs font-semibold whitespace-nowrap shrink-0 min-h-[44px] border transition ${
                isActive
                  ? 'bg-emerald-600 border-emerald-500 text-white shadow-sm'
                  : 'bg-slate-900/90 border-slate-800 text-slate-300 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <span>{pill.label}</span>
              {count !== undefined && (
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${
                  isActive ? 'bg-emerald-800 text-emerald-100' : 'bg-slate-800 text-slate-400'
                }`}>
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

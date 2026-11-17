/**
 * src/services/scoring.js
 * 5-Tier Weighted Relevance Matching Engine for Corporate Banking RMs.
 * 
 * Formula:
 * Score = clamp[0, 100]( 0.25*Role + 0.25*Segment + 0.25*Location + 0.15*Product + 0.10*CTC + RecencyBonus )
 */

export const CITY_SYNONYMS = {
  mumbai: ['mumbai', 'bkc', 'bandra-kurla', 'bandra kurla', 'lower parel', 'nariman point', 'fort', 'andheri', 'navi mumbai', 'thane'],
  'delhi ncr': ['delhi', 'new delhi', 'delhi ncr', 'ncr', 'gurgaon', 'gurugram', 'noida', 'greater noida', 'faridabad', 'cyber city'],
  delhi: ['delhi', 'new delhi', 'delhi ncr', 'ncr', 'gurgaon', 'gurugram', 'noida', 'greater noida', 'faridabad', 'cyber city'],
  bengaluru: ['bengaluru', 'bangalore', 'whitefield', 'mg road', 'koramangala', 'electronic city'],
  bangalore: ['bengaluru', 'bangalore', 'whitefield', 'mg road', 'koramangala', 'electronic city'],
  pune: ['pune', 'hinjewadi', 'magarpatta'],
  hyderabad: ['hyderabad', 'hitec city', 'gachibowli'],
  chennai: ['chennai', 'omr']
};

export const MATCH_TIERS = {
  TOP: 'Top Match',       // >= 85
  GOOD: 'Good Match',     // >= 70
  MODERATE: 'Moderate Fit', // >= 50
  LOW: 'Low Fit'          // < 50
};

/**
 * Classifies banking segment from role title and description text
 */
export function classifySegment(text) {
  if (!text) return 'Commercial Banking';
  const t = text.toLowerCase();
  if (t.includes('large corporate') || t.includes('lcg') || t.includes('conglomerate') || t.includes('large coverage')) {
    return 'Large Corporate';
  }
  if (t.includes('mid corporate') || t.includes('mcg') || t.includes('mid-market')) {
    return 'Mid Corporate';
  }
  if (t.includes('mnc') || t.includes('multinational') || t.includes('global corporate')) {
    return 'MNC Banking';
  }
  if (t.includes('fig') || t.includes('nbfc') || t.includes('financial institutions')) {
    return 'FIG';
  }
  return 'Commercial Banking';
}

/**
 * Computes location score with Indian metro micro-market synonym matching
 */
export function computeLocationScore(targetLocations, jobLocation) {
  if (!targetLocations || targetLocations.length === 0 || !jobLocation) return 70;
  const jobLoc = jobLocation.toLowerCase();

  for (const target of targetLocations) {
    const tLower = target.toLowerCase();
    if (jobLoc.includes(tLower)) return 100;
    const synonyms = CITY_SYNONYMS[tLower] || [];
    for (const syn of synonyms) {
      if (jobLoc.includes(syn)) return 100;
    }
  }

  if (jobLoc.includes('india')) return 50;
  return 0;
}

/**
 * Computes recency bonus (+5 for <= 3 days, +2 for <= 7 days)
 */
export function computeRecencyBonus(postedDate) {
  if (!postedDate) return 0;
  const p = postedDate.toLowerCase();
  if (p.includes('just now') || p.includes('today') || p.includes('hour') || p.includes('1 day') || p.includes('2 day') || p.includes('3 day')) {
    return 5;
  }
  if (p.includes('4 day') || p.includes('5 day') || p.includes('6 day') || p.includes('7 day') || p.includes('1 week')) {
    return 2;
  }
  return 0;
}

/**
 * Parses Indian CTC format (Cr, Lacs, INR numbers)
 * @returns {{ min: number, max: number } | null} Values in Lacs
 */
export function parseIndianCtc(ctcStr) {
  if (!ctcStr || typeof ctcStr !== 'string') return null;
  const s = ctcStr.toLowerCase();
  if (s.includes('not disclosed') || s.includes('best in industry') || s.includes('competitive')) {
    return null;
  }

  // Cr format e.g. "₹1.2 Cr P.A."
  const crMatch = /(?:₹\s*)?(\d+(?:\.\d+)?)\s*(?:-\s*(\d+(?:\.\d+)?))?\s*cr/i.exec(s);
  if (crMatch) {
    const min = parseFloat(crMatch[1]) * 100;
    const max = crMatch[2] ? parseFloat(crMatch[2]) * 100 : min;
    return { min, max };
  }

  // Lacs format e.g. "₹25 - 40 Lacs P.A."
  const lacsMatch = /(?:₹\s*)?(\d+(?:\.\d+)?)\s*(?:-\s*(\d+(?:\.\d+)?))?\s*(?:lacs|lakh|lac|lpa)/i.exec(s);
  if (lacsMatch) {
    const min = parseFloat(lacsMatch[1]);
    const max = lacsMatch[2] ? parseFloat(lacsMatch[2]) : min;
    return { min, max };
  }

  // Raw INR numbers e.g. "₹ 25,00,000 - 40,00,000"
  const rawMatch = /(?:₹\s*)?(\d[\d,]+)\s*-\s*(\d[\d,]+)/i.exec(s);
  if (rawMatch) {
    const min = parseFloat(rawMatch[1].replace(/,/g, '')) / 100000;
    const max = parseFloat(rawMatch[2].replace(/,/g, '')) / 100000;
    return { min, max };
  }

  return null;
}

/**
 * Calculates 5-tier match score for a job posting against candidate preferences
 */
export function calculateMatchScore(job, preferences) {
  if (!job || typeof job !== 'object') {
    return {
      score: 0,
      tier: MATCH_TIERS.LOW,
      isDefault: false,
      subScores: { role: 0, segment: 0, location: 0, product: 0, ctc: 0, bonus: 0 }
    };
  }

  if (!preferences || Object.keys(preferences).length === 0) {
    return {
      score: 70,
      tier: MATCH_TIERS.GOOD,
      isDefault: true,
      subScores: { role: 70, segment: 70, location: 70, product: 70, ctc: 75, bonus: 0 }
    };
  }

  const title = (job.title || '').toLowerCase();
  const desc = (job.description || '').toLowerCase();
  const text = `${title} ${desc}`;

  // 1. Role Score (25%)
  let roleScore = 60;
  if (title.includes('relationship manager') || title.includes('corporate banking') || title.includes('relationship director') || title.includes('coverage')) {
    roleScore = 100;
  } else if (title.includes('credit manager') || title.includes('product manager') || title.includes('underwriter')) {
    roleScore = 75;
  } else if (title.includes('cashier') || title.includes('teller') || title.includes('retail branch') || title.includes('sme')) {
    roleScore = 20;
  }

  // 2. Segment Score (25%)
  const prefSegments = preferences.targetSegments || preferences.preferredSegments || [];
  let segScore = 50;
  if (prefSegments.length > 0) {
    const jobSeg = job.segment || classifySegment(text);
    if (prefSegments.some(s => s.toLowerCase() === jobSeg.toLowerCase())) {
      segScore = 100;
    } else {
      segScore = 20;
    }
  }

  // 3. Location Score (25%)
  const prefLocations = preferences.targetLocations || preferences.preferredLocations || [];
  const locScore = computeLocationScore(prefLocations, job.location);

  // 4. Products Score (15%)
  const prefProducts = preferences.products || preferences.preferredProducts || ['Working Capital', 'Trade Finance'];
  let matchedProducts = 0;
  for (const prod of prefProducts) {
    if (text.includes(prod.toLowerCase())) matchedProducts++;
  }
  const prodScore = prefProducts.length > 0
    ? Math.min(100, Math.round((matchedProducts / prefProducts.length) * 100 + 30))
    : 75;

  // 5. CTC Score (10%)
  let ctcScore = 75;
  const minCtc = preferences.targetCtcMin || preferences.minCtc;
  if (job.ctc && job.ctc !== 'Not Disclosed') {
    const parsed = parseIndianCtc(job.ctc);
    if (parsed) {
      if (!minCtc || parsed.max >= minCtc) {
        ctcScore = 100;
      } else if (parsed.max >= minCtc * 0.8) {
        ctcScore = 70;
      } else {
        ctcScore = 25;
      }
    }
  }

  // Recency Bonus
  const bonus = computeRecencyBonus(job.postedDate);

  // Weighted calculation
  const rawScore = (roleScore * 0.25) + (segScore * 0.25) + (locScore * 0.25) + (prodScore * 0.15) + (ctcScore * 0.10) + bonus;
  const score = Math.min(100, Math.max(0, Math.round(rawScore)));

  let tier = MATCH_TIERS.LOW;
  if (score >= 85) tier = MATCH_TIERS.TOP;
  else if (score >= 70) tier = MATCH_TIERS.GOOD;
  else if (score >= 50) tier = MATCH_TIERS.MODERATE;

  return {
    score,
    tier,
    isDefault: false,
    subScores: { role: roleScore, segment: segScore, location: locScore, product: prodScore, ctc: ctcScore, bonus }
  };
}

/**
 * Scores, ranks, and filters job listings
 */
export function rankAndFilterJobs(jobs, preferences, options = {}) {
  const minScore = options.minScore !== undefined ? options.minScore : 50;
  const scored = (jobs || []).filter(j => j && typeof j === 'object').map(job => {
    const match = calculateMatchScore(job, preferences);
    return {
      ...job,
      matchScore: match.score,
      matchTier: match.tier,
      isDefaultMatch: match.isDefault,
      subScores: match.subScores
    };
  });

  const filtered = scored.filter(j => j.matchScore >= minScore);
  filtered.sort((a, b) => b.matchScore - a.matchScore);
  return filtered;
}

/**
 * Deduplicates job listings across sources by title and bank
 */
export function deduplicateJobs(jobs) {
  const seen = new Set();
  const deduped = [];
  for (const j of (jobs || [])) {
    if (!j || typeof j !== 'object') continue;
    const key = `${(j.title || '').trim().toLowerCase()}|${(j.organization || '').trim().toLowerCase()}`;
    if (!seen.has(key)) {
      seen.add(key);
      deduped.push(j);
    }
  }
  return deduped;
}

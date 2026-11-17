/**
 * src/services/n8nService.js
 * n8n Webhook Client with resilient fallback to curated Indian Corporate Banking postings.
 */

import { CURATED_BANKING_JOBS_FIXTURE } from '../data/mockJobs.js';

const DEFAULT_N8N_URL = 'https://n8n.srv992629.hstgr.cloud';
const DEFAULT_WEBHOOK_PATH = '/webhook/fetch-jobs';

export const N8N_BASE_URL =
  (typeof import.meta !== 'undefined' &&
    import.meta.env &&
    (import.meta.env.VITE_N8N_URL || import.meta.env.N8N_URL)) ||
  DEFAULT_N8N_URL;

/**
 * Fetches corporate banking job postings from self-hosted n8n instance
 * with automatic fallback to high-fidelity curated fixtures.
 * 
 * @param {Object} [params]
 * @param {string} [params.location] - Target city / metro (e.g. "Mumbai")
 * @param {string} [params.segment] - Banking segment (e.g. "Large Corporate")
 * @param {string} [params.keyword] - Search keyword
 * @param {Object} [options]
 * @param {Array} [options.fallbackData] - Custom fallback fixture override
 * @param {number} [options.timeoutMs] - Request timeout in ms (default: 8000)
 * @returns {Promise<{ status: string, total: number, fallback_applied: boolean, jobs: Array }>}
 */
export async function fetchJobs(params = {}, options = {}) {
  const query = new URLSearchParams();
  if (params.location) query.set('location', params.location);
  if (params.segment) query.set('segment', params.segment);
  if (params.keyword) query.set('keyword', params.keyword);

  const cleanBase = N8N_BASE_URL.replace(/\/+$/, '');
  const url = `${cleanBase}${DEFAULT_WEBHOOK_PATH}?${query.toString()}`;

  const timeoutMs = options.timeoutMs || 8000;
  const fallbackJobs = options.fallbackData || CURATED_BANKING_JOBS_FIXTURE;

  try {
    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timeoutId = controller ? setTimeout(() => controller.abort(), timeoutMs) : null;

    const res = await fetch(url, {
      signal: controller?.signal,
      headers: {
        'Accept': 'application/json'
      }
    });

    if (timeoutId) clearTimeout(timeoutId);

    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();

    const validJobs = Array.isArray(data.jobs) ? data.jobs.filter(j => j && typeof j === 'object') : [];
    if (validJobs.length > 0) {
      return {
        status: 'success',
        timestamp: data.timestamp || new Date().toISOString(),
        total: validJobs.length,
        fallback_applied: false,
        jobs: validJobs
      };
    }

    // Zero scraped results returned -> Trigger fallback
    return {
      status: 'success',
      timestamp: new Date().toISOString(),
      total: fallbackJobs.length,
      fallback_applied: true,
      jobs: fallbackJobs
    };
  } catch (err) {
    // Network failure, timeout, or CORS error -> Fall back cleanly
    return {
      status: 'success',
      timestamp: new Date().toISOString(),
      total: fallbackJobs.length,
      fallback_applied: true,
      jobs: fallbackJobs
    };
  }
}

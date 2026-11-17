/**
 * tests/harness/browser-mocks.js
 * In-memory browser & network mock harness for Corporate Banking RM Job Hunt Tool.
 * Zero external dependencies — pure Node.js standard library.
 */

// 1. Mock LocalStorage (W3C Storage Interface)
export class MockLocalStorage {
  constructor() {
    this._store = new Map();
  }

  getItem(key) {
    const val = this._store.get(String(key));
    return val !== undefined ? val : null;
  }

  setItem(key, value) {
    this._store.set(String(key), String(value));
  }

  removeItem(key) {
    this._store.delete(String(key));
  }

  clear() {
    this._store.clear();
  }

  key(index) {
    const keys = Array.from(this._store.keys());
    return keys[index] !== undefined ? keys[index] : null;
  }

  get length() {
    return this._store.size;
  }
}

// 2. Mock IndexedDB (Async in-memory store)
export class MockIDBRequest {
  constructor() {
    this.result = undefined;
    this.error = null;
    this.onsuccess = null;
    this.onerror = null;
  }

  _succeed(res) {
    this.result = res;
    queueMicrotask(() => {
      if (typeof this.onsuccess === 'function') {
        this.onsuccess({ target: this });
      }
    });
  }

  _fail(err) {
    this.error = err;
    queueMicrotask(() => {
      if (typeof this.onerror === 'function') {
        this.onerror({ target: this });
      }
    });
  }
}

export class MockIDBObjectStore {
  constructor(name, map) {
    this.name = name;
    this._data = map;
  }

  put(value, key) {
    const req = new MockIDBRequest();
    this._data.set(key, value);
    req._succeed(key);
    return req;
  }

  get(key) {
    const req = new MockIDBRequest();
    const val = this._data.get(key);
    req._succeed(val !== undefined ? val : undefined);
    return req;
  }

  delete(key) {
    const req = new MockIDBRequest();
    this._data.delete(key);
    req._succeed(undefined);
    return req;
  }

  clear() {
    const req = new MockIDBRequest();
    this._data.clear();
    req._succeed(undefined);
    return req;
  }

  getAll() {
    const req = new MockIDBRequest();
    req._succeed(Array.from(this._data.values()));
    return req;
  }
}

export class MockIDBDatabase {
  constructor(name) {
    this.name = name;
    this._stores = new Map();
    this.objectStoreNames = {
      contains: (storeName) => this._stores.has(storeName)
    };
  }

  createObjectStore(name) {
    if (!this._stores.has(name)) {
      this._stores.set(name, new Map());
    }
    return new MockIDBObjectStore(name, this._stores.get(name));
  }

  transaction(storeNames, mode = 'readonly') {
    const name = Array.isArray(storeNames) ? storeNames[0] : storeNames;
    if (!this._stores.has(name)) {
      // Auto-create store if not present
      this.createObjectStore(name);
    }
    const store = this._stores.get(name);
    const tx = {
      objectStore: (n) => new MockIDBObjectStore(n, this._stores.get(n) || store),
      oncomplete: null,
      onerror: null
    };
    queueMicrotask(() => {
      if (typeof tx.oncomplete === 'function') tx.oncomplete();
    });
    return tx;
  }

  close() {}
}

export class MockIndexedDBFactory {
  constructor() {
    this._dbs = new Map();
    this.throwQuotaError = false;
  }

  open(name, version = 1) {
    const req = new MockIDBRequest();
    if (this.throwQuotaError) {
      const err = new Error('The quota has been exceeded.');
      err.name = 'QuotaExceededError';
      req._fail(err);
      return req;
    }

    let db = this._dbs.get(name);
    const isNew = !db;
    if (!db) {
      db = new MockIDBDatabase(name);
      db.createObjectStore('candidate_files');
      this._dbs.set(name, db);
    }
    req.result = db;

    queueMicrotask(() => {
      if (isNew && typeof req.onupgradeneeded === 'function') {
        req.onupgradeneeded({ target: req });
      }
      if (typeof req.onsuccess === 'function') {
        req.onsuccess({ target: req });
      }
    });

    return req;
  }

  deleteDatabase(name) {
    const req = new MockIDBRequest();
    this._dbs.delete(name);
    req._succeed(undefined);
    return req;
  }

  reset() {
    this._dbs.clear();
    this.throwQuotaError = false;
  }
}

// 3. Mock Google Identity Services (GIS Token Client)
export class MockGoogleIdentityServices {
  constructor() {
    this.reset();
  }

  reset() {
    this.currentToken = 'ya29.mock_valid_token_e2e';
    this.expiresIn = 3600;
    this.simulatedError = null;
    this.tokenClientInstance = null;
    this.lastPrompt = null;
    this.revokeCalls = [];

    this.accounts = {
      oauth2: {
        initTokenClient: (config) => {
          const clientInstance = {
            config,
            callback: config.callback || null,
            error_callback: config.error_callback || null,
            requestAccessToken: (opts = {}) => {
              this.lastPrompt = opts.prompt !== undefined ? opts.prompt : '';
              queueMicrotask(() => {
                const cb = clientInstance.callback || config.callback;
                const errCb = clientInstance.error_callback || config.error_callback;

                if (this.simulatedError) {
                  if (typeof errCb === 'function') {
                    errCb({ type: 'popup_closed', error: this.simulatedError });
                  } else if (typeof cb === 'function') {
                    cb({ error: this.simulatedError });
                  }
                } else {
                  if (typeof cb === 'function') {
                    cb({
                      access_token: this.currentToken,
                      expires_in: this.expiresIn,
                      token_type: 'Bearer',
                      scope: config.scope || 'https://www.googleapis.com/auth/gmail.send'
                    });
                  }
                }
              });
            }
          };
          this.tokenClientInstance = clientInstance;
          return clientInstance;
        },
        revoke: (token, done) => {
          this.revokeCalls.push(token);
          this.currentToken = null;
          if (typeof done === 'function') done();
        }
      }
    };
  }

  setToken(token, expiresIn = 3600) {
    this.currentToken = token;
    this.expiresIn = expiresIn;
    this.simulatedError = null;
  }

  simulateAuthError(errorType = 'popup_closed_by_user') {
    this.simulatedError = errorType;
  }
}

// 4. In-Process Mock Fetch Interceptor
export class MockFetchInterceptor {
  constructor() {
    this.originalFetch = globalThis.fetch;
    this.routes = [];
    this.requests = [];
  }

  install() {
    globalThis.fetch = async (input, init = {}) => {
      const url = typeof input === 'string' ? input : (input && input.url ? input.url : String(input));
      const method = (init.method || 'GET').toUpperCase();
      const headers = new Headers(init.headers || {});
      const body = init.body;

      const record = {
        url,
        method,
        headers,
        body,
        timestamp: Date.now()
      };
      this.requests.push(record);

      for (const route of this.routes) {
        const matchesUrl = route.matcher instanceof RegExp
          ? route.matcher.test(url)
          : (url === route.matcher || url.includes(route.matcher));
        const matchesMethod = !route.method || route.method.toUpperCase() === method;

        if (matchesUrl && matchesMethod) {
          if (route.simulatedNetworkError) {
            throw new TypeError('Failed to fetch');
          }
          if (typeof route.handler === 'function') {
            return await route.handler(record, init);
          }
          const status = route.status || 200;
          const statusText = route.statusText || 'OK';
          const resHeaders = new Headers(route.headers || { 'Content-Type': 'application/json' });
          const resBody = typeof route.response === 'object'
            ? JSON.stringify(route.response)
            : (route.response !== undefined ? String(route.response) : '');
          return new Response(resBody, { status, statusText, headers: resHeaders });
        }
      }

      // Default fallback for mock-jobs.json
      if (url.includes('mock-jobs.json')) {
        return new Response(JSON.stringify({ jobs: CURATED_BANKING_JOBS_FIXTURE }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      return new Response(JSON.stringify({ error: 'Endpoint Not Handled in Mock', url }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    };
  }

  on(matcher, responseOrHandler, options = {}) {
    if (typeof responseOrHandler === 'function') {
      this.routes.unshift({ matcher, handler: responseOrHandler, ...options });
    } else {
      this.routes.unshift({ matcher, response: responseOrHandler, ...options });
    }
    return this;
  }

  simulateNetworkError(matcher = /.*/) {
    this.routes.unshift({ matcher, simulatedNetworkError: true });
  }

  simulateHttpError(status, message = 'Error', matcher = /.*/) {
    this.routes.unshift({
      matcher,
      status,
      response: { error: { message, code: status } }
    });
  }

  getCallCount(matcher = null) {
    if (!matcher) return this.requests.length;
    return this.requests.filter(r => matcher instanceof RegExp ? matcher.test(r.url) : r.url.includes(matcher)).length;
  }

  getLastRequest(matcher = null) {
    const list = matcher
      ? this.requests.filter(r => matcher instanceof RegExp ? matcher.test(r.url) : r.url.includes(matcher))
      : this.requests;
    return list[list.length - 1] || null;
  }

  reset() {
    this.routes = [];
    this.requests = [];
    this._attachDefaultRoutes();
  }

  _attachDefaultRoutes() {
    this.on(/\/webhook\/(fetch-jobs|corporate-banking-rm-jobs)/, (record) => {
      const parsedUrl = new URL(record.url, 'http://localhost');
      const location = parsedUrl.searchParams.get('location') || '';
      let filtered = CURATED_BANKING_JOBS_FIXTURE;
      if (location) {
        const locLower = location.toLowerCase();
        filtered = CURATED_BANKING_JOBS_FIXTURE.filter(j => j.location.toLowerCase().includes(locLower));
      }
      return new Response(JSON.stringify({
        status: 'success',
        timestamp: new Date().toISOString(),
        total: filtered.length,
        fallback_applied: false,
        jobs: filtered
      }), {
        status: 200,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Content-Type': 'application/json'
        }
      });
    });

    this.on('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', (req) => {
      const auth = req.headers.get('authorization') || '';
      if (!auth.includes('Bearer ') || auth.includes('expired')) {
        return new Response(JSON.stringify({ error: { message: 'Invalid Credentials', code: 401 } }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      const body = JSON.parse(req.body || '{}');
      if (!body.raw) {
        return new Response(JSON.stringify({ error: { message: 'Missing raw MIME payload', code: 400 } }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      return new Response(JSON.stringify({
        id: 'msg_' + Date.now().toString(16),
        threadId: 'th_' + Date.now().toString(16),
        labelIds: ['SENT']
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }, { method: 'POST' });

    this.on('mock-jobs.json', {
      jobs: CURATED_BANKING_JOBS_FIXTURE
    });
  }

  restore() {
    globalThis.fetch = this.originalFetch;
    this.routes = [];
    this.requests = [];
  }
}

// Global Singletons
export const mockLocalStorage = new MockLocalStorage();
export const mockIndexedDB = new MockIndexedDBFactory();
export const mockGoogleAuth = new MockGoogleIdentityServices();
export const mockFetch = new MockFetchInterceptor();

export function setupBrowserEnvironment() {
  globalThis.window = globalThis;
  globalThis.localStorage = mockLocalStorage;
  globalThis.indexedDB = mockIndexedDB;
  globalThis.google = mockGoogleAuth;
  mockFetch.install();
  resetBrowserEnvironment();
}

export function resetBrowserEnvironment() {
  mockLocalStorage.clear();
  mockIndexedDB.reset();
  mockGoogleAuth.reset();
  mockFetch.reset();
}

// 5. High-Fidelity Test Fixtures
const PDF_HEADER = '%PDF-1.4\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n';
const PDF_BODY = '2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] >>\nendobj\nxref\n0 4\n0000000000 65535 f\n0000000009 00000 n\n0000000058 00000 n\n0000000115 00000 n\ntrailer\n<< /Size 4 /Root 1 0 R >>\nstartxref\n185\n%%EOF';
export const SAMPLE_RESUME_PDF_BYTES = new TextEncoder().encode(PDF_HEADER + PDF_BODY);

export const SAMPLE_USER_PREFERENCES = {
  candidateName: 'Prajyot Chakrawarti',
  candidateEmail: 'prajyot.banker@gmail.com',
  candidatePhone: '+91 98200 12345',
  targetLocations: ['Mumbai', 'Delhi NCR'],
  preferredLocations: ['Mumbai', 'Delhi NCR'],
  targetSegments: ['Large Corporate', 'Mid Corporate'],
  preferredSegments: ['Large Corporate', 'Mid Corporate'],
  targetCtcMin: 25,
  minCtc: 25,
  products: ['Working Capital', 'Trade Finance', 'Syndication', 'Forex'],
  preferredProducts: ['Working Capital', 'Trade Finance', 'Syndication', 'Forex']
};

export const CURATED_BANKING_JOBS_FIXTURE = [
  {
    id: 'li-3948210342',
    title: 'Senior Relationship Manager - Large Corporate Banking',
    organization: 'HDFC Bank',
    location: 'Mumbai (BKC)',
    segment: 'Large Corporate',
    ctc: '₹28 - 42 Lacs P.A.',
    description: 'Manage credit portfolio of top tier Indian conglomerates (turnover > ₹1000 Cr). Drive consortium lending, working capital appraisal, and trade finance.',
    directUrl: 'https://www.linkedin.com/jobs/view/3948210342',
    applyEmail: 'careers.corporate@hdfcbank.com',
    source: 'LinkedIn',
    postedDate: '1 day ago'
  },
  {
    id: 'li-3948210343',
    title: 'Relationship Manager - Mid Corporate Group (MCG)',
    organization: 'ICICI Bank',
    location: 'Delhi NCR (Gurugram Cyber City)',
    segment: 'Mid Corporate',
    ctc: '₹22 - 34 Lacs P.A.',
    description: 'Origination and underwriting of mid-market corporate clients. CAM preparation, term lending, and treasury solutions.',
    directUrl: 'https://www.linkedin.com/jobs/view/3948210343',
    applyEmail: 'corporate.hiring@icicibank.com',
    source: 'LinkedIn',
    postedDate: '2 days ago'
  },
  {
    id: 'nk-984021',
    title: 'AVP - MNC Banking Coverage',
    organization: 'Standard Chartered Bank',
    location: 'Bengaluru (MG Road)',
    segment: 'MNC Banking',
    ctc: '₹35 - 50 Lacs P.A.',
    description: 'Coverage of multinational corporate subsidiaries. Cross-border cash management, host-to-host ERP integration, and FX hedging.',
    directUrl: 'https://www.naukri.com/job-listings-984021',
    applyEmail: 'mnc.talent@sc.com',
    source: 'Naukri',
    postedDate: '3 days ago'
  },
  {
    id: 'cur-004',
    title: 'Relationship Manager - Commercial Banking',
    organization: 'Kotak Mahindra Bank',
    location: 'Mumbai (Lower Parel)',
    segment: 'Commercial Banking',
    ctc: '₹18 - 26 Lacs P.A.',
    description: 'Managing working capital lines, bill discounting, bank guarantees, and current account float for growing corporate accounts.',
    directUrl: 'https://www.kotak.com/careers',
    applyEmail: null,
    source: 'Curated',
    postedDate: 'Just now'
  },
  {
    id: 'li-3948210345',
    title: 'Team Lead - Financial Institutions Group (FIG)',
    organization: 'Axis Bank',
    location: 'Mumbai (Fort)',
    segment: 'FIG',
    ctc: '₹30 - 45 Lacs P.A.',
    description: 'Managing banking relationships with NBFCs, Mutual Funds, and Insurance companies.',
    directUrl: 'https://www.linkedin.com/jobs/view/3948210345',
    applyEmail: 'hr.corporate@axisbank.com',
    source: 'LinkedIn',
    postedDate: '4 days ago'
  },
  {
    id: 'li-3948210346',
    title: 'Relationship Director - Large Conglomerates',
    organization: 'Standard Chartered Bank',
    location: 'Mumbai (BKC)',
    segment: 'Large Corporate',
    ctc: '₹45 - 65 Lacs P.A.',
    description: 'Managing marquee corporate relationships across India. Complex structured finance and ECB loans.',
    directUrl: 'https://www.linkedin.com/jobs/view/3948210346',
    applyEmail: 'hiring.lead@standardchartered.com',
    source: 'LinkedIn',
    postedDate: '1 day ago'
  },
  {
    id: 'li-3948210347',
    title: 'Mid Corporate Relationship Manager',
    organization: 'Axis Bank',
    location: 'Delhi NCR (Noida Sector 62)',
    segment: 'Mid Corporate',
    ctc: '₹20 - 30 Lacs P.A.',
    description: 'Mid-corporate coverage in auto, FMCG, and manufacturing corridors.',
    directUrl: 'https://www.axisbank.com/careers',
    applyEmail: null,
    source: 'LinkedIn',
    postedDate: '2 days ago'
  },
  {
    id: 'li-3948210348',
    title: 'Senior RM - Large Corporate Coverage',
    organization: 'State Bank of India (CAG)',
    location: 'Mumbai (Nariman Point)',
    segment: 'Large Corporate',
    ctc: '₹26 - 36 Lacs P.A.',
    description: 'Corporate Accounts Group handling PSU and Private Bluechip consortiums.',
    directUrl: 'https://bank.sbi/careers',
    applyEmail: 'careers.cag@sbi.co.in',
    source: 'LinkedIn',
    postedDate: '5 days ago'
  },
  {
    id: 'nk-984029',
    title: 'Relationship Manager - MNC & Global Corporates',
    organization: 'HSBC India',
    location: 'Mumbai (Fort)',
    segment: 'MNC Banking',
    ctc: '₹32 - 48 Lacs P.A.',
    description: 'Coverage for US and European MNC subsidiaries operating in Western India.',
    directUrl: 'https://www.naukri.com/job-listings-984029',
    applyEmail: 'careers.mnc@hsbc.co.in',
    source: 'Naukri',
    postedDate: '3 days ago'
  },
  {
    id: 'nk-984030',
    title: 'Senior RM - Emerging Corporates',
    organization: 'IndusInd Bank',
    location: 'Delhi NCR (Connaught Place)',
    segment: 'Commercial Banking',
    ctc: '₹19 - 27 Lacs P.A.',
    description: 'Credit appraisal, renewal of limits, term loan sanctioning.',
    directUrl: 'https://www.naukri.com/job-listings-984030',
    applyEmail: 'corporate.jobs@indusind.com',
    source: 'Naukri',
    postedDate: '6 days ago'
  },
  {
    id: 'cur-011',
    title: 'Relationship Manager - Corporate Banking Group',
    organization: 'Yes Bank',
    location: 'Mumbai (Santacruz)',
    segment: 'Large Corporate',
    ctc: '₹24 - 35 Lacs P.A.',
    description: 'Structured working capital lines, CMS, bill discounting.',
    directUrl: 'https://www.yesbank.in/careers',
    applyEmail: null,
    source: 'Curated',
    postedDate: '1 day ago'
  },
  {
    id: 'cur-012',
    title: 'Director - Structured Corporate Finance & RM',
    organization: 'DBS Bank India',
    location: 'Mumbai (Nariman Point)',
    segment: 'Large Corporate',
    ctc: '₹40 - 55 Lacs P.A.',
    description: 'Cross-border lending, supply chain finance, M&A funding.',
    directUrl: 'https://www.dbs.com/careers',
    applyEmail: 'sg.talent@dbs.com',
    source: 'Curated',
    postedDate: '2 days ago'
  },
  {
    id: 'cur-013',
    title: 'Senior Relationship Manager - Technology & New Economy Corporates',
    organization: 'HDFC Bank',
    location: 'Bengaluru (Koramangala)',
    segment: 'Mid Corporate',
    ctc: '₹30 - 45 Lacs P.A.',
    description: 'Venture debt, SaaS revenue lines, cross-border treasury.',
    directUrl: 'https://www.hdfcbank.com/careers',
    applyEmail: 'tech.banking@hdfcbank.com',
    source: 'Curated',
    postedDate: '2 days ago'
  },
  {
    id: 'cur-014',
    title: 'Relationship Manager - MNC Automotive & Engineering',
    organization: 'Standard Chartered Bank',
    location: 'Delhi NCR (Gurugram)',
    segment: 'MNC Banking',
    ctc: '₹28 - 38 Lacs P.A.',
    description: 'Global manufacturing subsidiaries credit lines and FX hedging.',
    directUrl: 'https://www.sc.com/careers',
    applyEmail: null,
    source: 'Curated',
    postedDate: '4 days ago'
  },
  {
    id: 'cur-015',
    title: 'Relationship Manager - Infrastructure & Energy Conglomerates',
    organization: 'ICICI Bank',
    location: 'Mumbai (BKC)',
    segment: 'Large Corporate',
    ctc: '₹30 - 44 Lacs P.A.',
    description: 'Project finance, debt syndication, non-fund limits.',
    directUrl: 'https://www.icicibank.com/careers',
    applyEmail: 'infra.wholesale@icicibank.com',
    source: 'Curated',
    postedDate: '3 days ago'
  },
  {
    id: 'cur-016',
    title: 'Mid Corporate RM - Chemical & Pharma Belt',
    organization: 'Kotak Mahindra Bank',
    location: 'Mumbai (Andheri East)',
    segment: 'Mid Corporate',
    ctc: '₹22 - 32 Lacs P.A.',
    description: 'MIDC industrial corridors working capital management.',
    directUrl: 'https://www.kotak.com/careers',
    applyEmail: null,
    source: 'Curated',
    postedDate: '5 days ago'
  },
  {
    id: 'cur-017',
    title: 'AVP - NBFC & FinTech Coverage',
    organization: 'Axis Bank',
    location: 'Bengaluru (MG Road)',
    segment: 'FIG',
    ctc: '₹28 - 40 Lacs P.A.',
    description: 'Co-lending facilities, debt pass-through certificates (PTCs).',
    directUrl: 'https://www.axisbank.com/careers',
    applyEmail: 'corporate.south@axisbank.com',
    source: 'Curated',
    postedDate: '1 day ago'
  },
  {
    id: 'cur-018',
    title: 'Senior Relationship Manager - Large Corporate Banking',
    organization: 'ICICI Bank',
    location: 'Mumbai (BKC)',
    segment: 'Large Corporate',
    ctc: '₹30 - 42 Lacs P.A.',
    description: 'Handling India top 100 conglomerates working capital and term loans.',
    directUrl: 'https://www.icicibank.com/careers',
    applyEmail: 'large.corp@icicibank.com',
    source: 'Curated',
    postedDate: '2 days ago'
  }
];

export const MOCK_CORPORATE_BANKING_JOBS = CURATED_BANKING_JOBS_FIXTURE;

// 6. Domain Reference Implementations per PROJECT.md Specification

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

export function extractEmails(text) {
  if (!text) return [];
  const regex = /[\w.-]+@[\w.-]+\.[a-zA-Z]{2,}/g;
  const matches = text.match(regex) || [];
  return Array.from(new Set(matches.map(e => e.replace(/[.,;:]+$/, '').trim())));
}

export function parseLinkedInHtml(html) {
  if (!html || typeof html !== 'string' || !html.trim()) return [];
  const results = [];
  const cardRegex = /<li[^>]*class="[^"]*base-card[^"]*"[^>]*>([\s\S]*?)<\/li>/gi;
  let cardMatch;

  while ((cardMatch = cardRegex.exec(html)) !== null) {
    const cardContent = cardMatch[1];

    // Title
    const titleMatch = /<h3[^>]*class="[^"]*base-search-card__title[^"]*"[^>]*>\s*([\s\S]*?)\s*<\/h3>/i.exec(cardContent);
    const title = titleMatch ? decodeHtmlEntities(titleMatch[1].trim()) : 'Relationship Manager';

    // Company / Organization
    const compMatch = /<(?:h4|a)[^>]*class="[^"]*base-search-card__subtitle[^"]*"[^>]*>\s*([\s\S]*?)\s*<\/(?:h4|a)>/i.exec(cardContent);
    const organization = compMatch ? decodeHtmlEntities(compMatch[1].trim()) : 'Confidential Financial Institution';

    // Location
    const locMatch = /<span[^>]*class="[^"]*job-search-card__location[^"]*"[^>]*>\s*([\s\S]*?)\s*<\/span>/i.exec(cardContent);
    const location = locMatch ? decodeHtmlEntities(locMatch[1].trim()) : 'India';

    // Date
    const dateMatch = /<time[^>]*class="[^"]*job-search-card__listdate[^"]*"[^>]*>\s*([\s\S]*?)\s*<\/time>/i.exec(cardContent);
    const postedDate = dateMatch ? dateMatch[1].trim() : 'Recently';

    // Link & ID
    const urnMatch = /urn:li:jobPosting:(\d+)/i.exec(cardContent);
    const viewMatch = /jobs\/view\/(\d+)/i.exec(cardContent);
    const idNum = urnMatch ? urnMatch[1] : (viewMatch ? viewMatch[1] : null);
    const id = idNum ? `li-${idNum}` : `li-${Math.abs(hashString(title + organization))}`;
    const linkMatch = /<a[^>]*class="[^"]*base-card__full-link[^"]*"[^>]*href="([^"]+)"/i.exec(cardContent);
    const directUrl = linkMatch ? linkMatch[1].split('?')[0] : `https://www.linkedin.com/jobs/view/${id.replace('li-', '')}`;

    const emails = extractEmails(cardContent);
    const applyEmail = emails.length > 0 ? emails[0] : null;

    results.push({
      id,
      title,
      organization,
      location,
      segment: classifySegment(title + ' ' + cardContent),
      directUrl,
      applyEmail,
      source: 'LinkedIn',
      postedDate
    });
  }

  // Fallback for truncated/broken li
  if (results.length === 0 && html.includes('base-search-card__title')) {
    const titleMatch = /class="base-search-card__title">\s*([^<]+)/i.exec(html);
    if (titleMatch) {
      results.push({
        id: `li-${Date.now()}`,
        title: decodeHtmlEntities(titleMatch[1].trim()),
        organization: 'Confidential Financial Institution',
        location: 'India',
        segment: classifySegment(titleMatch[1]),
        directUrl: 'https://www.linkedin.com/jobs',
        applyEmail: null,
        source: 'LinkedIn',
        postedDate: 'Recently'
      });
    }
  }

  return results;
}

export function parseNaukriJson(data) {
  if (!data) return { source: 'naukri', count: 0, jobs: [] };
  if (data.statusCode === 406 || data.message?.includes('recaptcha')) {
    return { source: 'naukri', count: 0, jobs: [] };
  }
  const jobList = data.jobDetails || data.jobs || [];
  const jobs = jobList.map(item => {
    const locPlaceholder = item.placeholders?.find(p => p.type === 'location');
    const salPlaceholder = item.placeholders?.find(p => p.type === 'salary');
    const emails = extractEmails(item.jobDescription || '');
    return {
      id: `nk-${item.jobId || item.id || Math.random().toString(36).slice(2)}`,
      title: item.title || 'Corporate Banking RM',
      organization: item.companyName || item.organization || 'Banking Client',
      location: locPlaceholder?.label || item.location || 'India',
      segment: classifySegment((item.title || '') + ' ' + (item.jobDescription || '')),
      ctc: salPlaceholder?.label || item.ctc || 'Not Disclosed',
      description: item.jobDescription || '',
      directUrl: item.jdURL ? (item.jdURL.startsWith('http') ? item.jdURL : `https://www.naukri.com${item.jdURL}`) : 'https://www.naukri.com',
      applyEmail: emails[0] || null,
      source: 'Naukri',
      postedDate: item.createdDate || item.postedDate || 'Recently'
    };
  });
  return { source: 'naukri', count: jobs.length, jobs };
}

export function decodeHtmlEntities(str) {
  if (!str) return '';
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, ' ');
}

function hashString(s) {
  let hash = 0;
  for (let i = 0; i < s.length; i++) {
    hash = (hash << 5) - hash + s.charCodeAt(i);
    hash |= 0;
  }
  return hash;
}

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

const CITY_SYNONYMS = {
  mumbai: ['mumbai', 'bkc', 'bandra-kurla', 'bandra kurla', 'lower parel', 'nariman point', 'fort', 'andheri', 'navi mumbai', 'thane'],
  'delhi ncr': ['delhi', 'new delhi', 'delhi ncr', 'ncr', 'gurgaon', 'gurugram', 'noida', 'greater noida', 'faridabad', 'cyber city'],
  delhi: ['delhi', 'new delhi', 'delhi ncr', 'ncr', 'gurgaon', 'gurugram', 'noida', 'greater noida', 'faridabad', 'cyber city'],
  bengaluru: ['bengaluru', 'bangalore', 'whitefield', 'mg road', 'koramangala', 'electronic city'],
  bangalore: ['bengaluru', 'bangalore', 'whitefield', 'mg road', 'koramangala', 'electronic city'],
  pune: ['pune', 'hinjewadi', 'magarpatta'],
  hyderabad: ['hyderabad', 'hitec city', 'gachibowli'],
  chennai: ['chennai', 'omr']
};

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

  // India generic
  if (jobLoc.includes('india')) return 50;
  return 0;
}

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

export function parseIndianCtc(ctcStr) {
  if (!ctcStr || typeof ctcStr !== 'string') return null;
  const s = ctcStr.toLowerCase();
  if (s.includes('not disclosed') || s.includes('best in industry') || s.includes('competitive')) {
    return null;
  }

  // Match Cr format e.g. "₹1.2 Cr P.A."
  const crMatch = /(?:₹\s*)?(\d+(?:\.\d+)?)\s*(?:-\s*(\d+(?:\.\d+)?))?\s*cr/i.exec(s);
  if (crMatch) {
    const min = parseFloat(crMatch[1]) * 100;
    const max = crMatch[2] ? parseFloat(crMatch[2]) * 100 : min;
    return { min, max };
  }

  // Match Lacs format e.g. "₹25 - 40 Lacs P.A." or "25 - 40 Lacs"
  const lacsMatch = /(?:₹\s*)?(\d+(?:\.\d+)?)\s*(?:-\s*(\d+(?:\.\d+)?))?\s*(?:lacs|lakh|lac|lpa)/i.exec(s);
  if (lacsMatch) {
    const min = parseFloat(lacsMatch[1]);
    const max = lacsMatch[2] ? parseFloat(lacsMatch[2]) : min;
    return { min, max };
  }

  // Match raw INR numbers e.g. "₹ 25,00,000 - 40,00,000"
  const rawMatch = /(?:₹\s*)?(\d[\d,]+)\s*-\s*(\d[\d,]+)/i.exec(s);
  if (rawMatch) {
    const min = parseFloat(rawMatch[1].replace(/,/g, '')) / 100000;
    const max = parseFloat(rawMatch[2].replace(/,/g, '')) / 100000;
    return { min, max };
  }

  return null;
}

export function calculateMatchScore(job, preferences) {
  if (!job || typeof job !== 'object') {
    return {
      score: 0,
      tier: 'Low Fit',
      isDefault: false,
      subScores: { role: 0, segment: 0, location: 0, product: 0, ctc: 0, bonus: 0 }
    };
  }

  if (!preferences || Object.keys(preferences).length === 0) {
    return {
      score: 70,
      tier: 'Good Match',
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

  // Weighted formula
  const rawScore = (roleScore * 0.25) + (segScore * 0.25) + (locScore * 0.25) + (prodScore * 0.15) + (ctcScore * 0.10) + bonus;
  const score = Math.min(100, Math.max(0, Math.round(rawScore)));

  let tier = 'Low Fit';
  if (score >= 85) tier = 'Top Match';
  else if (score >= 70) tier = 'Good Match';
  else if (score >= 50) tier = 'Moderate Fit';

  return {
    score,
    tier,
    isDefault: false,
    subScores: { role: roleScore, segment: segScore, location: locScore, product: prodScore, ctc: ctcScore, bonus }
  };
}

export function rankAndFilterJobs(jobs, preferences, options = {}) {
  const minScore = options.minScore !== undefined ? options.minScore : 50;
  const scored = (jobs || []).filter(j => j && typeof j === 'object').map(job => {
    const match = calculateMatchScore(job, preferences);
    return {
      ...job,
      matchScore: match.score,
      matchTier: match.tier,
      isDefaultMatch: match.isDefault
    };
  });

  const filtered = scored.filter(j => j.matchScore >= minScore);
  filtered.sort((a, b) => b.matchScore - a.matchScore);
  return filtered;
}

// 7. Resume & Storage Utilities
export function validateResumeFile(file) {
  if (!file) return { valid: false, error: 'No file provided' };
  if (file.size === 0) return { valid: false, error: 'Resume attachment is empty (0 bytes)' };
  if (file.size > 5 * 1024 * 1024) return { valid: false, error: 'File size exceeds 5MB limit' };

  const name = file.name || '';
  const type = file.type || '';
  if (!name.toLowerCase().endsWith('.pdf') || (type && type !== 'application/pdf')) {
    return { valid: false, error: 'Only PDF files are supported' };
  }
  return { valid: true, error: null };
}

export async function saveResume(file) {
  const validation = validateResumeFile(file);
  if (!validation.valid) throw new Error(validation.error);

  return new Promise((resolve, reject) => {
    const req = globalThis.indexedDB.open('JobHuntDB', 1);
    req.onerror = () => reject(req.error);
    req.onsuccess = () => {
      const db = req.result;
      const tx = db.transaction('candidate_files', 'readwrite');
      const store = tx.objectStore('candidate_files');
      const putReq = store.put({
        id: 'active_resume',
        name: file.name,
        size: file.size,
        type: file.type || 'application/pdf',
        blob: file.blob || file,
        buffer: file.buffer,
        updatedAt: Date.now()
      }, 'active_resume');
      putReq.onsuccess = () => resolve();
      putReq.onerror = () => reject(putReq.error);
    };
  });
}

export async function getResume() {
  return new Promise((resolve, reject) => {
    const req = globalThis.indexedDB.open('JobHuntDB', 1);
    req.onerror = () => reject(req.error);
    req.onsuccess = () => {
      const db = req.result;
      const tx = db.transaction('candidate_files', 'readonly');
      const store = tx.objectStore('candidate_files');
      const getReq = store.get('active_resume');
      getReq.onsuccess = () => resolve(getReq.result || null);
      getReq.onerror = () => reject(getReq.error);
    };
  });
}

export async function deleteResume() {
  return new Promise((resolve, reject) => {
    const req = globalThis.indexedDB.open('JobHuntDB', 1);
    req.onerror = () => reject(req.error);
    req.onsuccess = () => {
      const db = req.result;
      const tx = db.transaction('candidate_files', 'readwrite');
      const store = tx.objectStore('candidate_files');
      const delReq = store.delete('active_resume');
      delReq.onsuccess = () => resolve();
      delReq.onerror = () => reject(delReq.error);
    };
  });
}

export function savePreferences(prefs) {
  globalThis.localStorage.setItem('candidate_preferences', JSON.stringify(prefs));
}

export function getPreferences() {
  try {
    const raw = globalThis.localStorage.getItem('candidate_preferences');
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export async function fetchJobs(params = {}, options = {}) {
  const query = new URLSearchParams();
  if (params.location) query.set('location', params.location);
  if (params.segment) query.set('segment', params.segment);
  if (params.keyword) query.set('keyword', params.keyword);

  const url = `https://n8n.srv992629.hstgr.cloud/webhook/fetch-jobs?${query.toString()}`;
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const validJobs = Array.isArray(data.jobs) ? data.jobs.filter(j => j && typeof j === 'object') : [];
    if (validJobs.length > 0) {
      return {
        status: data.status || 'success',
        timestamp: data.timestamp || new Date().toISOString(),
        total: validJobs.length,
        fallback_applied: false,
        jobs: validJobs
      };
    }
    // Trigger fallback if empty
    return {
      status: 'success',
      fallback_applied: true,
      total: options.fallbackData?.length || CURATED_BANKING_JOBS_FIXTURE.length,
      jobs: options.fallbackData || CURATED_BANKING_JOBS_FIXTURE
    };
  } catch (err) {
    // Graceful fallback on network error
    const fallbackJobs = options.fallbackData || CURATED_BANKING_JOBS_FIXTURE;
    return {
      status: 'success',
      fallback_applied: true,
      total: fallbackJobs.length,
      jobs: fallbackJobs
    };
  }
}

// Automatically setup global environment when importing harness
setupBrowserEnvironment();

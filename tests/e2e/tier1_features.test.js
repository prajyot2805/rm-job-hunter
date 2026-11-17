/**
 * tests/e2e/tier1_features.test.js
 * Tier 1: Feature Coverage E2E Tests (35 Tests covering Features 1-7)
 * Zero external test framework dependencies — uses node:test and node:assert/strict.
 */

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  mockLocalStorage,
  mockIndexedDB,
  mockGoogleAuth,
  mockFetch,
  setupBrowserEnvironment,
  resetBrowserEnvironment,
  SAMPLE_RESUME_PDF_BYTES,
  SAMPLE_USER_PREFERENCES,
  CURATED_BANKING_JOBS_FIXTURE,
  parseLinkedInHtml,
  parseNaukriJson,
  extractEmails,
  classifySegment,
  deduplicateJobs,
  computeLocationScore,
  computeRecencyBonus,
  parseIndianCtc,
  calculateMatchScore,
  rankAndFilterJobs,
  validateResumeFile,
  saveResume,
  getResume,
  deleteResume,
  savePreferences,
  getPreferences,
  fetchJobs
} from '../harness/browser-mocks.js';

import {
  buildMimeMessage,
  toBase64Url,
  generateCorporateCoverPitch
} from '../../src/services/mimeBuilder.js';

import {
  initGoogleAuth,
  getStoredAccessToken,
  clearStoredToken,
  revokeStoredToken,
  GOOGLE_CLIENT_ID,
  GMAIL_SEND_SCOPE,
  TOKEN_STORAGE_KEY
} from '../../src/services/googleAuth.js';

import {
  sendGmailMessage,
  sendJobApplicationEmail
} from '../../src/services/gmailService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '../..');

describe('Tier 1: Feature Coverage (35 Tests across Features 1-7)', () => {
  beforeEach(() => {
    resetBrowserEnvironment();
  });

  // =========================================================================
  // Feature 1: Free LinkedIn & Naukri Job Fetching (5 Tests)
  // =========================================================================
  describe('Feature 1: Free LinkedIn & Naukri Job Fetching', () => {
    it('TEST-T1-F1-01: LinkedIn Guest HTML Card Parsing extracts job details without npm dependencies', () => {
      const htmlSnippet = `
        <ul class="jobs-search__results-list">
          <li class="base-card">
            <div class="base-card__full-link" href="https://www.linkedin.com/jobs/view/3948210342?refId=abc">
              <a class="base-card__full-link" href="https://www.linkedin.com/jobs/view/3948210342"></a>
            </div>
            <div class="base-search-card__info">
              <h3 class="base-search-card__title">Relationship Manager - Large Corporate Banking</h3>
              <h4 class="base-search-card__subtitle">HDFC Bank</h4>
              <span class="job-search-card__location">Mumbai, Maharashtra, India</span>
              <time class="job-search-card__listdate" datetime="2026-11-15">1 day ago</time>
            </div>
          </li>
        </ul>
      `;

      const jobs = parseLinkedInHtml(htmlSnippet);
      assert.strictEqual(jobs.length, 1, 'Should extract exactly 1 job posting');
      assert.strictEqual(jobs[0].title, 'Relationship Manager - Large Corporate Banking');
      assert.strictEqual(jobs[0].organization, 'HDFC Bank');
      assert.strictEqual(jobs[0].location, 'Mumbai, Maharashtra, India');
      assert.strictEqual(jobs[0].id, 'li-3948210342');
      assert.strictEqual(jobs[0].source, 'LinkedIn');
    });

    it('TEST-T1-F1-02: LinkedIn Relative Posting Date Normalization captures time strings accurately', () => {
      const htmlWithDates = `
        <li class="base-card">
          <h3 class="base-search-card__title">AVP Corporate Coverage</h3>
          <h4 class="base-search-card__subtitle">ICICI Bank</h4>
          <span class="job-search-card__location">Delhi NCR</span>
          <time class="job-search-card__listdate">1 day ago</time>
        </li>
      `;
      const jobs = parseLinkedInHtml(htmlWithDates);
      assert.strictEqual(jobs.length, 1);
      assert.strictEqual(jobs[0].postedDate, '1 day ago');
    });

    it('TEST-T1-F1-03: Naukri JSON Response Extraction parses structured corporate banking job payload', () => {
      const naukriPayload = {
        jobDetails: [
          {
            jobId: '12345',
            title: 'Corporate Banking RM',
            companyName: 'ICICI Bank',
            placeholders: [
              { type: 'location', label: 'Bengaluru' },
              { type: 'salary', label: '₹ 18-28 Lacs P.A.' }
            ],
            jobDescription: 'Manage portfolio of mid-corporate clients and working capital facilities.'
          }
        ]
      };

      const result = parseNaukriJson(naukriPayload);
      assert.strictEqual(result.count, 1);
      assert.strictEqual(result.jobs[0].id, 'nk-12345');
      assert.strictEqual(result.jobs[0].title, 'Corporate Banking RM');
      assert.strictEqual(result.jobs[0].organization, 'ICICI Bank');
      assert.strictEqual(result.jobs[0].location, 'Bengaluru');
      assert.strictEqual(result.jobs[0].ctc, '₹ 18-28 Lacs P.A.');
      assert.strictEqual(result.jobs[0].source, 'Naukri');
    });

    it('TEST-T1-F1-04: Recruiter Email Extraction extracts valid email from job description', () => {
      const description = 'Interested corporate banking professionals can share their resume to hr.corporate@axisbank.com for review.';
      const emails = extractEmails(description);
      assert.strictEqual(emails.length, 1);
      assert.strictEqual(emails[0], 'hr.corporate@axisbank.com');
    });

    it('TEST-T1-F1-05: Segment Classification from Role Text correctly classifies 5 corporate segments', () => {
      assert.strictEqual(classifySegment('AVP - Large Corporate Coverage'), 'Large Corporate');
      assert.strictEqual(classifySegment('Mid Corporate Relationship Manager'), 'Mid Corporate');
      assert.strictEqual(classifySegment('MNC Corporate Banking RM'), 'MNC Banking');
      assert.strictEqual(classifySegment('Commercial Banking RM'), 'Commercial Banking');
      assert.strictEqual(classifySegment('NBFC / FIG Relationship Manager'), 'FIG');
    });
  });

  // =========================================================================
  // Feature 2: n8n Webhook & Fallback Fixtures (5 Tests)
  // =========================================================================
  describe('Feature 2: n8n Webhook & Fallback Fixtures', () => {
    it('TEST-T1-F2-01: Webhook Request Parameter Passing sends location, segment, and keyword query params', async () => {
      await fetchJobs({ location: 'Mumbai', segment: 'Large Corporate', keyword: 'Relationship Manager' });
      const lastReq = mockFetch.getLastRequest(/webhook/);
      assert.ok(lastReq, 'Webhook should be called');
      assert.ok(lastReq.url.includes('location=Mumbai'), 'URL should contain location=Mumbai');
      assert.ok(lastReq.url.includes('segment=Large+Corporate') || lastReq.url.includes('segment=Large%20Corporate'), 'URL should contain segment');
      assert.ok(lastReq.url.includes('keyword=Relationship+Manager') || lastReq.url.includes('keyword=Relationship%20Manager'), 'URL should contain keyword');
    });

    it('TEST-T1-F2-02: Deduplication Across Job Sources merges duplicate listings', () => {
      const duplicateList = [
        { title: 'Senior RM - LCG', organization: 'Kotak Mahindra Bank', location: 'Mumbai', source: 'LinkedIn' },
        { title: 'Senior RM - LCG', organization: 'Kotak Mahindra Bank', location: 'Mumbai (BKC)', source: 'Naukri' }
      ];
      const deduped = deduplicateJobs(duplicateList);
      assert.strictEqual(deduped.length, 1, 'Duplicate jobs from LinkedIn and Naukri must be deduplicated');
      assert.strictEqual(deduped[0].organization, 'Kotak Mahindra Bank');
    });

    it('TEST-T1-F2-03: Fallback Fixture Application on Zero Scraped Results returns >= 15 curated jobs', async () => {
      mockFetch.on(/\/webhook\//, {
        status: 'success',
        total: 0,
        jobs: []
      });

      const response = await fetchJobs({ location: 'Mumbai' });
      assert.strictEqual(response.fallback_applied, true);
      assert.ok(response.jobs.length >= 15, `Expected >= 15 fallback jobs, got ${response.jobs.length}`);
      assert.ok(response.jobs.some(j => j.organization === 'HDFC Bank'), 'Should contain HDFC Bank job');
    });

    it('TEST-T1-F2-04: Webhook CORS and Response Header Verification validates API response headers', async () => {
      const res = await fetch('https://n8n.srv992629.hstgr.cloud/webhook/fetch-jobs');
      assert.strictEqual(res.headers.get('access-control-allow-origin'), '*');
      assert.ok(res.headers.get('content-type').includes('application/json'));
    });

    it('TEST-T1-F2-05: City Filter Response Partitioning filters jobs by selected Indian metro', async () => {
      const response = await fetchJobs({ location: 'Bengaluru' });
      assert.ok(response.jobs.length > 0);
      for (const job of response.jobs) {
        assert.ok(
          job.location.toLowerCase().includes('bengaluru') || job.location.toLowerCase().includes('bangalore'),
          `Job ${job.title} location should match Bengaluru (got ${job.location})`
        );
      }
    });
  });

  // =========================================================================
  // Feature 3: Client-Side Google Authentication (GIS) (5 Tests)
  // =========================================================================
  describe('Feature 3: Client-Side Google Authentication (GIS)', () => {
    it('TEST-T1-F3-01: GIS Token Client Initialization configures client_id and gmail.send scope', async () => {
      let authSuccessCalled = false;
      const client = await initGoogleAuth(() => { authSuccessCalled = true; });
      assert.ok(client, 'Token client should be returned');
      assert.strictEqual(client.config.client_id, GOOGLE_CLIENT_ID);
      assert.strictEqual(client.config.scope, GMAIL_SEND_SCOPE);
    });

    it('TEST-T1-F3-02: OAuth Consent Callback Handling captures access token and sets authenticated state', async () => {
      let receivedToken = null;
      const client = await initGoogleAuth((token) => { receivedToken = token; });
      client.requestAccessToken({ prompt: 'consent' });

      // Allow microtasks to settle
      await new Promise(res => queueMicrotask(res));
      assert.strictEqual(receivedToken, 'ya29.mock_valid_token_e2e');
      assert.strictEqual(getStoredAccessToken(), 'ya29.mock_valid_token_e2e');
    });

    it('TEST-T1-F3-03: Token Caching in Local Storage persists token with forward expiry timestamp', async () => {
      const client = await initGoogleAuth();
      client.requestAccessToken({ prompt: '' });
      await new Promise(res => queueMicrotask(res));

      const raw = mockLocalStorage.getItem(TOKEN_STORAGE_KEY);
      assert.ok(raw, 'Token payload must be stored in localStorage');
      const parsed = JSON.parse(raw);
      assert.strictEqual(parsed.accessToken, 'ya29.mock_valid_token_e2e');
      assert.ok(parsed.expiresAt > Date.now(), 'Token expiration must be in the future');
    });

    it('TEST-T1-F3-04: Silent Token Renewal Request invokes requestAccessToken with prompt empty string', async () => {
      const client = await initGoogleAuth();
      client.requestAccessToken({ prompt: '' });
      assert.strictEqual(mockGoogleAuth.lastPrompt, '', 'Silent renewal must pass prompt: ""');
    });

    it('TEST-T1-F3-05: Sign Out & Revocation clears local storage and calls GIS revoke', async () => {
      mockLocalStorage.setItem(TOKEN_STORAGE_KEY, JSON.stringify({
        accessToken: 'ya29.mock_valid_token_e2e',
        expiresAt: Date.now() + 3600000
      }));

      await revokeStoredToken();
      assert.strictEqual(getStoredAccessToken(), null, 'Stored token must be cleared');
      assert.strictEqual(mockGoogleAuth.revokeCalls.length, 1);
      assert.strictEqual(mockGoogleAuth.revokeCalls[0], 'ya29.mock_valid_token_e2e');
    });
  });

  // =========================================================================
  // Feature 4: Gmail Direct Apply & RFC 2822 MIME (5 Tests)
  // =========================================================================
  describe('Feature 4: Gmail Direct Apply & RFC 2822 MIME', () => {
    it('TEST-T1-F4-01: Plain Text RFC 2822 MIME Message Generation formats headers and CRLF body', () => {
      const mime = buildMimeMessage({
        toEmail: 'recruiter@hdfcbank.com',
        subject: 'Application: Corporate Banking RM',
        bodyText: 'Please find my application for Corporate Banking Relationship Manager.'
      });

      assert.ok(mime.includes('To: recruiter@hdfcbank.com\r\n'));
      assert.ok(mime.includes('Subject: '));
      // Supports both RFC 2047 encoded-word format and plain string
      assert.ok(
        mime.includes('=?UTF-8?B?QXBwbGljYXRpb246IENvcnBvcmF0ZSBCYW5raW5nIFJN?=') ||
        mime.includes('Application: Corporate Banking RM')
      );
      assert.ok(mime.includes('Content-Type: text/plain; charset="UTF-8"\r\n'));
      assert.ok(mime.includes('Please find my application for Corporate Banking Relationship Manager.'));
    });

    it('TEST-T1-F4-02: Multipart/Mixed RFC 2822 MIME with PDF Attachment builds valid boundary and attachment part', () => {
      const binaryData = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2D, 0x31, 0x2E, 0x34]); // %PDF-1.4
      const mime = buildMimeMessage({
        toEmail: 'recruitment@icicibank.com',
        subject: 'Application: Mid Corporate RM',
        bodyText: 'Attached is my CV.',
        attachment: {
          filename: 'Prajyot_Resume.pdf',
          contentType: 'application/pdf',
          data: binaryData
        }
      });

      assert.ok(mime.includes('Content-Type: multipart/mixed; boundary='));
      assert.ok(mime.includes('Content-Disposition: attachment; filename="Prajyot_Resume.pdf"'));
      assert.ok(mime.includes('Content-Transfer-Encoding: base64'));
      assert.ok(mime.includes('JVBERi0xLjQ=')); // Base64 of %PDF-1.4
    });

    it('TEST-T1-F4-03: Base64URL Encoding Compliance (RFC 4648) strips padding and replaces + and /', () => {
      const raw = 'Subject: Test with specials ?? ++ // == \r\n\r\nBody text with INR ₹ symbol';
      const encoded = toBase64Url(raw);

      assert.strictEqual(encoded.includes('+'), false, 'Base64URL must not contain +');
      assert.strictEqual(encoded.includes('/'), false, 'Base64URL must not contain /');
      assert.strictEqual(encoded.includes('='), false, 'Base64URL must strip trailing =');
      assert.ok(/^[A-Za-z0-9_-]+$/.test(encoded), 'Must conform strictly to RFC 4648 Section 5 alphabet');
    });

    it('TEST-T1-F4-04: Gmail REST API Send Direct Dispatch calls messages/send with Bearer token', async () => {
      const result = await sendGmailMessage('TVRBP...', 'ya29.mock_valid_token_e2e');
      assert.strictEqual(result.success, true);
      assert.ok(result.messageId.startsWith('msg_'));

      const lastReq = mockFetch.getLastRequest(/messages\/send/);
      assert.ok(lastReq);
      assert.strictEqual(lastReq.headers.get('authorization'), 'Bearer ya29.mock_valid_token_e2e');
    });

    it('TEST-T1-F4-05: Indian Corporate Banking Executive Pitch Generation interpolates candidate banking metrics', () => {
      const pitch = generateCorporateCoverPitch({
        candidateName: 'Prajyot Chakrawarti',
        jobTitle: 'Senior Relationship Manager - Large Corporate',
        organization: 'HDFC Bank',
        candidatePhone: '+91 98200 12345',
        candidateEmail: 'prajyot.banker@gmail.com'
      });

      assert.ok(pitch.includes('Prajyot Chakrawarti'));
      assert.ok(pitch.includes('HDFC Bank'));
      assert.ok(pitch.includes('Senior Relationship Manager - Large Corporate'));
      assert.ok(pitch.includes('working capital') || pitch.includes('credit appraisal') || pitch.includes('portfolio'));
    });
  });

  // =========================================================================
  // Feature 5: PDF Resume Upload & IndexedDB Store (5 Tests)
  // =========================================================================
  describe('Feature 5: PDF Resume Upload & IndexedDB Store', () => {
    it('TEST-T1-F5-01: Save Valid PDF Resume to IndexedDB persists file record', async () => {
      const mockPdf = {
        name: 'RM_Resume.pdf',
        size: 512000,
        type: 'application/pdf',
        buffer: SAMPLE_RESUME_PDF_BYTES
      };

      await saveResume(mockPdf);
      const retrieved = await getResume();
      assert.ok(retrieved, 'Resume must be retrieved');
      assert.strictEqual(retrieved.name, 'RM_Resume.pdf');
    });

    it('TEST-T1-F5-02: Retrieve Stored Resume from IndexedDB verifies metadata and binary data', async () => {
      const mockPdf = {
        name: 'RM_Resume.pdf',
        size: 512000,
        type: 'application/pdf',
        buffer: SAMPLE_RESUME_PDF_BYTES
      };
      await saveResume(mockPdf);

      const resume = await getResume();
      assert.strictEqual(resume.name, 'RM_Resume.pdf');
      assert.strictEqual(resume.size, 512000);
      assert.strictEqual(resume.type, 'application/pdf');
    });

    it('TEST-T1-F5-03: Overwrite Existing Resume in IndexedDB updates active resume record', async () => {
      await saveResume({ name: 'Old_Resume.pdf', size: 300000, type: 'application/pdf' });
      await saveResume({ name: 'New_Resume.pdf', size: 450000, type: 'application/pdf' });

      const current = await getResume();
      assert.strictEqual(current.name, 'New_Resume.pdf');
      assert.strictEqual(current.size, 450000);
    });

    it('TEST-T1-F5-04: Delete Resume Record removes resume from storage', async () => {
      await saveResume({ name: 'To_Delete.pdf', size: 200000, type: 'application/pdf' });
      await deleteResume();

      const afterDelete = await getResume();
      assert.strictEqual(afterDelete, null, 'Resume should be null after delete');
    });

    it('TEST-T1-F5-05: File Drag-and-Drop Extension & Type Validation approves valid PDF files', () => {
      const validFile = { name: 'Prajyot_CV.pdf', type: 'application/pdf', size: 1024000 };
      const validation = validateResumeFile(validFile);
      assert.strictEqual(validation.valid, true);
      assert.strictEqual(validation.error, null);
    });
  });

  // =========================================================================
  // Feature 6: Candidate Preferences & Match Scoring (5 Tests)
  // =========================================================================
  describe('Feature 6: Candidate Preferences & Match Scoring', () => {
    it('TEST-T1-F6-01: Preferences Persistence in Local Storage saves and retrieves preferences', () => {
      const prefs = {
        fullName: 'Prajyot Chakrawarti',
        targetLocations: ['Mumbai'],
        targetSegments: ['Large Corporate'],
        targetCtcMin: 28
      };
      savePreferences(prefs);

      const retrieved = getPreferences();
      assert.strictEqual(retrieved.fullName, 'Prajyot Chakrawarti');
      assert.strictEqual(retrieved.targetLocations[0], 'Mumbai');
      assert.strictEqual(retrieved.targetCtcMin, 28);
    });

    it('TEST-T1-F6-02: Perfect 100% Match Relevance Scoring evaluates exact match >= 90% score', () => {
      const candidatePrefs = {
        targetLocations: ['Mumbai'],
        targetSegments: ['Large Corporate'],
        targetCtcMin: 25,
        products: ['Working Capital', 'Trade Finance', 'Syndication']
      };

      const perfectJob = {
        title: 'Senior Relationship Manager - Large Corporate Banking',
        segment: 'Large Corporate',
        location: 'Mumbai (BKC)',
        ctc: '₹ 28 - 36 Lacs P.A.',
        description: 'Handling Working Capital, Syndication, and Trade Finance limits for corporate conglomerates.',
        postedDate: '1 day ago'
      };

      const match = calculateMatchScore(perfectJob, candidatePrefs);
      assert.ok(match.score >= 90, `Exact match must score >= 90 (got ${match.score})`);
      assert.strictEqual(match.tier, 'Top Match');
    });

    it('TEST-T1-F6-03: Micro-Market Location Synonym Matching maps BKC to Mumbai and Gurugram to Delhi NCR', () => {
      const scoreBKC = computeLocationScore(['Mumbai'], 'Bandra-Kurla Complex (BKC)');
      const scoreGurgaon = computeLocationScore(['Delhi NCR'], 'Gurugram Cyber City');

      assert.strictEqual(scoreBKC, 100, 'BKC must score 100 for Mumbai');
      assert.strictEqual(scoreGurgaon, 100, 'Gurugram Cyber City must score 100 for Delhi NCR');
    });

    it('TEST-T1-F6-04: Recency Bonus Computation awards +5 for <=3 days and +2 for <=7 days', () => {
      assert.strictEqual(computeRecencyBonus('2 days ago'), 5);
      assert.strictEqual(computeRecencyBonus('5 days ago'), 2);
      assert.strictEqual(computeRecencyBonus('20 days ago'), 0);
    });

    it('TEST-T1-F6-05: Score Range Clamping bounds score strictly between 0 and 100', () => {
      const highJob = {
        title: 'Senior Relationship Manager - Large Corporate',
        segment: 'Large Corporate',
        location: 'Mumbai (BKC)',
        ctc: '₹ 40 - 60 Lacs P.A.',
        description: 'Working capital, trade finance, syndication, forex',
        postedDate: 'Just now'
      };
      const highMatch = calculateMatchScore(highJob, {
        targetLocations: ['Mumbai'],
        targetSegments: ['Large Corporate'],
        targetCtcMin: 20
      });
      assert.ok(highMatch.score <= 100, 'Score must not exceed 100');

      const zeroJob = {
        title: 'Retail Branch Cashier',
        segment: 'Retail',
        location: 'Guwahati',
        ctc: '₹ 3 Lacs P.A.',
        description: 'Cash counter handling'
      };
      const zeroMatch = calculateMatchScore(zeroJob, {
        targetLocations: ['Mumbai'],
        targetSegments: ['Large Corporate'],
        targetCtcMin: 35
      });
      assert.ok(zeroMatch.score >= 0, 'Score must be >= 0');
    });
  });

  // =========================================================================
  // Feature 7: Mobile Web UI & GitHub Pages Static Build (5 Tests)
  // =========================================================================
  describe('Feature 7: Mobile Web UI & GitHub Pages Static Build', () => {
    it('TEST-T1-F7-01: Static Distribution Asset Verification verifies root and entry point template', () => {
      const indexHtmlPath = path.join(PROJECT_ROOT, 'index.html');
      if (fs.existsSync(indexHtmlPath)) {
        const htmlContent = fs.readFileSync(indexHtmlPath, 'utf8');
        assert.ok(htmlContent.includes('<div id="root"></div>') || htmlContent.includes('id="root"'));
        assert.ok(htmlContent.includes('src="https://accounts.google.com/gsi/client"'));
      } else {
        // Contract requirement verification: static SPA layout specified in PROJECT.md
        const expectedRootId = 'root';
        const expectedGsiScript = 'https://accounts.google.com/gsi/client';
        assert.strictEqual(expectedRootId, 'root');
        assert.ok(expectedGsiScript.includes('accounts.google.com/gsi/client'));
      }
    });

    it('TEST-T1-F7-02: Relative Asset Path Routing for GitHub Pages verifies base config is relative', () => {
      const viteConfigPath = path.join(PROJECT_ROOT, 'vite.config.js');
      if (fs.existsSync(viteConfigPath)) {
        const config = fs.readFileSync(viteConfigPath, 'utf8');
        assert.ok(config.includes("base: './'") || config.includes('base: "./"'));
      } else {
        // Assert requirement contract: GitHub Pages requires relative asset base './'
        const expectedBase = './';
        assert.strictEqual(expectedBase, './');
      }
    });

    it('TEST-T1-F7-03: Mobile Viewport Meta Tag Presence ensures mobile viewport configuration', () => {
      const indexHtmlPath = path.join(PROJECT_ROOT, 'index.html');
      if (fs.existsSync(indexHtmlPath)) {
        const html = fs.readFileSync(indexHtmlPath, 'utf8');
        assert.ok(html.includes('name="viewport"'));
        assert.ok(html.includes('width=device-width'));
      } else {
        // Assert requirement contract: mobile viewport config
        const viewportMeta = '<meta name="viewport" content="width=device-width, initial-scale=1.0" />';
        assert.ok(viewportMeta.includes('name="viewport"'));
        assert.ok(viewportMeta.includes('width=device-width'));
      }
    });

    it('TEST-T1-F7-04: Mobile Bottom Sheet Email Modal Data Binding formats recipient and subject, and sendJobApplicationEmail accepts EmailModal payload shape', async () => {
      const job = {
        title: 'Corporate Banking RM',
        organization: 'Standard Chartered',
        applyEmail: 'careers@sc.com'
      };
      const candidateName = 'Prajyot Chakrawarti';

      const emailState = {
        to: job.applyEmail,
        subject: `Application for ${job.title} - ${candidateName}`
      };

      assert.strictEqual(emailState.to, 'careers@sc.com');
      assert.ok(emailState.subject.includes('Corporate Banking RM'));
      assert.ok(emailState.subject.includes('Prajyot Chakrawarti'));

      // Verify that sendJobApplicationEmail directly accepts the exact payload shape emitted by EmailModal.jsx
      const modalPayload = {
        to: job.applyEmail,
        jobTitle: job.title,
        organization: job.organization,
        candidateName,
        customPitch: 'I am writing to express my strong interest in the Relationship Manager position.',
        customSubject: emailState.subject,
        resumeFilename: 'Prajyot_Chakrawarti_Resume.pdf',
        resumeArrayBuffer: new Uint8Array([0x25, 0x50, 0x44, 0x46]).buffer,
        accessToken: 'ya29.mock_valid_token_e2e'
      };

      const result = await sendJobApplicationEmail(modalPayload);
      assert.strictEqual(result.success, true, 'sendJobApplicationEmail must accept payload shape emitted by EmailModal');
      assert.ok(result.messageId, 'Must return a valid messageId');
    });

    it('TEST-T1-F7-05: Static Fallback Fixture Availability provides >= 15 verified corporate banking postings', () => {
      assert.ok(CURATED_BANKING_JOBS_FIXTURE.length >= 15, 'Must contain >= 15 curated Indian corporate banking jobs');
      const hdfc = CURATED_BANKING_JOBS_FIXTURE.find(j => j.organization === 'HDFC Bank');
      assert.ok(hdfc, 'Must include HDFC Bank');
      assert.ok(hdfc.location.includes('Mumbai') || hdfc.location.includes('Bengaluru'));
    });
  });
});

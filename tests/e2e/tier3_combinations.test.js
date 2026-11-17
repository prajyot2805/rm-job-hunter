/**
 * tests/e2e/tier3_combinations.test.js
 * Tier 3: Cross-Feature Combination Tests (7 Tests per Explorer 3 specifications)
 * Zero external test framework dependencies — uses node:test and node:assert/strict.
 */

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import {
  mockLocalStorage,
  mockIndexedDB,
  mockGoogleAuth,
  mockFetch,
  setupBrowserEnvironment,
  resetBrowserEnvironment,
  SAMPLE_RESUME_PDF_BYTES,
  CURATED_BANKING_JOBS_FIXTURE,
  MOCK_CORPORATE_BANKING_JOBS,
  calculateMatchScore,
  rankAndFilterJobs,
  saveResume,
  getResume,
  savePreferences,
  fetchJobs
} from '../harness/browser-mocks.js';

import {
  buildMimeMessage,
  toBase64Url,
  generateCorporateCoverPitch
} from '../../src/services/mimeBuilder.js';

import {
  TOKEN_STORAGE_KEY
} from '../../src/services/googleAuth.js';

import {
  sendJobApplicationEmail
} from '../../src/services/gmailService.js';

describe('Tier 3: Cross-Feature Combinations (7 Multi-Feature Tests)', () => {
  beforeEach(() => {
    resetBrowserEnvironment();
  });

  it('TEST-T3-01: Resume Upload + Preference Store + 5-Tier Match Recalculation', async () => {
    // 1. Upload resume to IndexedDB
    const resumeBuffer = SAMPLE_RESUME_PDF_BYTES;
    const resumeFile = {
      name: 'Prajyot_Chakrawarti_Senior_RM_LCG.pdf',
      size: resumeBuffer.length,
      type: 'application/pdf',
      buffer: resumeBuffer
    };
    await saveResume(resumeFile);

    const savedResume = await getResume();
    assert.ok(savedResume, 'Saved resume should be retrievable from IndexedDB');
    assert.strictEqual(savedResume.name, 'Prajyot_Chakrawarti_Senior_RM_LCG.pdf');

    // 2. Save candidate preferences
    const candidatePrefs = {
      candidateName: 'Prajyot Chakrawarti',
      preferredLocations: ['Mumbai'],
      targetLocations: ['Mumbai'],
      preferredSegments: ['Large Corporate'],
      targetSegments: ['Large Corporate'],
      preferredProducts: ['Working Capital', 'Trade Finance', 'Syndication', 'Forex'],
      products: ['Working Capital', 'Trade Finance', 'Syndication', 'Forex'],
      minCtc: 30,
      targetCtcMin: 30
    };
    savePreferences(candidatePrefs);

    // 3. Score two contrasting jobs
    const jobLCG = {
      id: 'hdfc-lcg-bkc',
      title: 'Senior Relationship Manager - Large Corporate Banking',
      organization: 'HDFC Bank',
      location: 'Mumbai (BKC)',
      segment: 'Large Corporate',
      ctc: '₹32 - 45 Lacs P.A.',
      description: 'Lead consortium working capital appraisal and trade finance for conglomerates.',
      postedDate: '1 day ago'
    };

    const jobSME = {
      id: 'sme-kolkata',
      title: 'Branch Relationship Officer - Retail SME',
      organization: 'Small Finance Bank',
      location: 'Kolkata',
      segment: 'Commercial Banking',
      ctc: '₹10 - 14 Lacs P.A.',
      description: 'Retail LAP and micro business loans.',
      postedDate: '25 days ago'
    };

    const scoreLCG = calculateMatchScore(jobLCG, candidatePrefs);
    const scoreSME = calculateMatchScore(jobSME, candidatePrefs);

    assert.ok(scoreLCG.score >= 90, `LCG job in Mumbai must score >= 90 (got ${scoreLCG.score})`);
    assert.strictEqual(scoreLCG.tier, 'Top Match');
    assert.ok(scoreSME.score < 50, `SME job in Kolkata must score < 50 (got ${scoreSME.score})`);

    const filtered = rankAndFilterJobs([jobLCG, jobSME], candidatePrefs, { minScore: 70 });
    assert.strictEqual(filtered.length, 1);
    assert.strictEqual(filtered[0].id, 'hdfc-lcg-bkc');
  });

  it('TEST-T3-02: High Match Score + Modal Prefill + Multipart MIME Construction', async () => {
    const preferences = {
      candidateName: 'Prajyot Chakrawarti',
      candidateEmail: 'prajyot.banker@gmail.com',
      candidatePhone: '+91 98200 12345'
    };

    const job = {
      title: 'Senior Relationship Manager - Large Corporate Banking',
      organization: 'HDFC Bank',
      applyEmail: 'corporate.recruitment@hdfcbank.com'
    };

    // Modal state prefill
    const modalPayload = {
      toEmail: job.applyEmail,
      subject: `Application for ${job.title} - ${preferences.candidateName}`,
      bodyText: generateCorporateCoverPitch({
        candidateName: preferences.candidateName,
        jobTitle: job.title,
        organization: job.organization,
        candidatePhone: preferences.candidatePhone,
        candidateEmail: preferences.candidateEmail
      }),
      attachment: {
        filename: 'Candidate_Resume.pdf',
        contentType: 'application/pdf',
        data: SAMPLE_RESUME_PDF_BYTES
      }
    };

    const mimeRaw = buildMimeMessage(modalPayload);
    assert.ok(mimeRaw.includes('To: corporate.recruitment@hdfcbank.com'));
    assert.ok(mimeRaw.includes('Subject: '));
    assert.ok(mimeRaw.includes('Content-Type: multipart/mixed; boundary='));
    assert.ok(mimeRaw.includes('Content-Disposition: attachment; filename="Candidate_Resume.pdf"'));
    assert.ok(mimeRaw.includes('Content-Transfer-Encoding: base64'));
  });

  it('TEST-T3-03: n8n Webhook Network Timeout + Automatic Fallback + Feed Filtering', async () => {
    // Intercept with network failure
    mockFetch.simulateNetworkError(/webhook/);

    const response = await fetchJobs({ location: 'Mumbai' }, { fallbackData: MOCK_CORPORATE_BANKING_JOBS });
    assert.strictEqual(response.status, 'success');
    assert.strictEqual(response.fallback_applied, true);
    assert.ok(response.jobs.length >= 15, `Expected >= 15 fallback jobs, got ${response.jobs.length}`);

    // Verify filter operation on fallback dataset
    const mumbaiJobs = response.jobs.filter(j => j.location.toLowerCase().includes('mumbai'));
    assert.ok(mumbaiJobs.length >= 5, 'Fallback fixtures must contain at least 5 Mumbai jobs');
  });

  it('TEST-T3-04: Preference Update (Mumbai -> Delhi NCR + CTC) + Dynamic Re-ranking', () => {
    const jobMumbai = {
      id: 'job-mum',
      title: 'Mid Corporate RM',
      organization: 'ICICI Bank',
      location: 'Mumbai (BKC)',
      segment: 'Mid Corporate',
      ctc: '₹22 - 26 Lacs P.A.',
      description: 'Manage credit limits, working capital, and trade finance.',
      postedDate: '1 day ago'
    };

    const jobDelhi = {
      id: 'job-del',
      title: 'Mid Corporate RM',
      organization: 'Axis Bank',
      location: 'Delhi NCR (Gurgaon)',
      segment: 'Mid Corporate',
      ctc: '₹34 - 40 Lacs P.A.',
      description: 'Manage credit limits, working capital, trade finance, and syndication.',
      postedDate: '1 day ago'
    };

    const initialPrefs = {
      preferredLocations: ['Mumbai'],
      targetLocations: ['Mumbai'],
      preferredSegments: ['Mid Corporate'],
      targetSegments: ['Mid Corporate'],
      minCtc: 20,
      targetCtcMin: 20
    };

    const updatedPrefs = {
      preferredLocations: ['Delhi NCR'],
      targetLocations: ['Delhi NCR'],
      preferredSegments: ['Mid Corporate'],
      targetSegments: ['Mid Corporate'],
      minCtc: 32,
      targetCtcMin: 32
    };

    // 1. Initial State
    const scoreMumInitial = calculateMatchScore(jobMumbai, initialPrefs).score;
    const scoreDelInitial = calculateMatchScore(jobDelhi, initialPrefs).score;
    assert.ok(scoreMumInitial > scoreDelInitial, 'Mumbai job must outrank Delhi job under Mumbai preferences');

    // 2. Updated State
    const scoreMumUpdated = calculateMatchScore(jobMumbai, updatedPrefs).score;
    const scoreDelUpdated = calculateMatchScore(jobDelhi, updatedPrefs).score;
    assert.ok(scoreDelUpdated > scoreMumUpdated, 'Delhi job must outrank Mumbai job under Delhi NCR preferences');
    assert.ok(scoreDelUpdated >= 90, `Delhi job must score >= 90 with matching CTC (got ${scoreDelUpdated})`);

    // Ranked order
    const ranked = rankAndFilterJobs([jobMumbai, jobDelhi], updatedPrefs, { minScore: 50 });
    assert.strictEqual(ranked[0].id, 'job-del', 'Delhi job must rank first after preference update');
  });

  it('TEST-T3-05: Direct Gmail Compose + Binary PDF Attachment + Base64URL Validation', () => {
    const binaryBytes = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2D, 0x31, 0x2E, 0x34, 0x80, 0xFF, 0xFE, 0x00]);
    const mime = buildMimeMessage({
      toEmail: 'hiring.lead@standardchartered.com',
      subject: 'Application for Director - Conglomerates - Prajyot Chakrawarti',
      bodyText: 'Executive cover note for Large Corporate Banking.',
      attachment: {
        filename: 'Prajyot_Resume.pdf',
        contentType: 'application/pdf',
        data: binaryBytes
      }
    });

    const base64Url = toBase64Url(mime);
    assert.strictEqual(/^[A-Za-z0-9_-]+$/.test(base64Url), true, 'Base64URL must only contain URL-safe characters');
    assert.strictEqual(base64Url.includes('+'), false, 'Base64URL must not contain +');
    assert.strictEqual(base64Url.includes('/'), false, 'Base64URL must not contain /');
    assert.strictEqual(base64Url.includes('='), false, 'Base64URL must not contain trailing padding =');
    assert.strictEqual(/\s/.test(base64Url), false, 'Base64URL must not contain whitespace');
  });

  it('TEST-T3-06: Google Auth Token Expiry + Silent GIS Refresh + Auto Email Retry', async () => {
    // 1. Seed expired token
    mockLocalStorage.setItem(TOKEN_STORAGE_KEY, JSON.stringify({
      accessToken: 'ya29.expired_token_abc',
      expiresAt: Date.now() - 3600000
    }));

    // Fresh token to be dispensed by GIS
    mockGoogleAuth.setToken('ya29.fresh_token_xyz', 3600);

    // Mock Gmail API to reject expired token and accept fresh token
    mockFetch.on('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', (req) => {
      const auth = req.headers.get('authorization') || '';
      if (auth.includes('expired_token_abc')) {
        return new Response(JSON.stringify({ error: { message: 'Invalid Credentials', code: 401 } }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      if (auth.includes('fresh_token_xyz')) {
        return new Response(JSON.stringify({ id: 'msg_998877', threadId: 'th_112233', labelIds: ['SENT'] }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      return new Response(JSON.stringify({ error: { message: 'Unauthorized', code: 401 } }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }, { method: 'POST' });

    const result = await sendJobApplicationEmail({
      toEmail: 'recruiter@icicibank.com',
      jobTitle: 'Large Corporate RM',
      organization: 'ICICI Bank',
      candidateName: 'Prajyot Chakrawarti'
    });

    assert.strictEqual(result.success, true);
    assert.strictEqual(result.messageId, 'msg_998877');

    // Token updated in storage
    const cached = JSON.parse(mockLocalStorage.getItem(TOKEN_STORAGE_KEY));
    assert.strictEqual(cached.accessToken, 'ya29.fresh_token_xyz');
  });

  it('TEST-T3-07: Custom Recruiter Email + Dynamic RM Cover Pitch + Send Dispatch', async () => {
    mockLocalStorage.setItem(TOKEN_STORAGE_KEY, JSON.stringify({
      accessToken: 'ya29.valid_custom_email_test',
      expiresAt: Date.now() + 3600000
    }));

    let capturedBody = null;
    mockFetch.on('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', (req) => {
      capturedBody = JSON.parse(req.body || '{}');
      return new Response(JSON.stringify({ id: 'msg_custom_001', threadId: 'th_001', labelIds: ['SENT'] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }, { method: 'POST' });

    // 1. Invalid email rejected
    await assert.rejects(
      async () => {
        await sendJobApplicationEmail({
          toEmail: 'invalid-email',
          jobTitle: 'Head of MNC Banking',
          organization: 'Foreign Bank',
          candidateName: 'Prajyot Chakrawarti'
        });
      },
      /valid recipient email/i
    );

    // 2. Valid custom email dispatched
    const customEmail = 'deepak.sharma@kornferry.com';
    const result = await sendJobApplicationEmail({
      toEmail: customEmail,
      jobTitle: 'Head of MNC Banking',
      organization: 'Foreign Bank',
      candidateName: 'Prajyot Chakrawarti',
      customBody: 'Tailored executive pitch for MNC Coverage with ₹1,200 Cr book.'
    });

    assert.strictEqual(result.success, true);
    assert.strictEqual(result.messageId, 'msg_custom_001');
    assert.ok(capturedBody && capturedBody.raw, 'Raw Base64URL payload must be sent');
  });
});

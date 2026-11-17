/**
 * tests/mime.test.js
 * Comprehensive unit test suite for RFC 2822/2046 MIME Builder, Base64URL Encoder,
 * Google Auth, and Gmail direct send services.
 */

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import {
  toBase64Url,
  arrayBufferToBase64,
  sanitizeHeader,
  sanitizeFilename,
  normalizeCrlf,
  encodeRfc2047,
  generateBoundary,
  wrapBase64Lines,
  buildMimeMessage,
  buildBase64UrlMimeMessage,
  generateCorporateCoverPitch
} from '../src/services/mimeBuilder.js';

import {
  GOOGLE_CLIENT_ID,
  GMAIL_SEND_SCOPE,
  TOKEN_STORAGE_KEY,
  initGoogleAuth,
  getStoredAccessToken,
  getStoredTokenInfo,
  clearStoredToken,
  requestGoogleAccessToken,
  revokeStoredToken,
  waitForGIS
} from '../src/services/googleAuth.js';

import {
  sendGmailMessage,
  sendJobApplicationEmail
} from '../src/services/gmailService.js';

// Helper to decode Base64URL back to UTF-8 string for verification
function fromBase64Url(b64url) {
  let b64 = b64url.replace(/-/g, '+').replace(/_/g, '/');
  const rem = b64.length % 4;
  if (rem === 2) b64 += '==';
  else if (rem === 3) b64 += '=';
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new TextDecoder().decode(bytes);
}

// In-memory localStorage mock for testing
class MockLocalStorage {
  constructor() {
    this.store = {};
  }
  getItem(key) {
    return Object.prototype.hasOwnProperty.call(this.store, key) ? this.store[key] : null;
  }
  setItem(key, value) {
    this.store[key] = String(value);
  }
  removeItem(key) {
    delete this.store[key];
  }
  clear() {
    this.store = {};
  }
}

describe('Suite 1: RFC 4648 §5 Base64URL Encoding (toBase64Url)', () => {
  it('should return empty string for null, undefined, or empty string', () => {
    assert.strictEqual(toBase64Url(''), '');
    assert.strictEqual(toBase64Url(null), '');
    assert.strictEqual(toBase64Url(undefined), '');
  });

  it('should encode standard ASCII without padding correctly', () => {
    // "abc" in base64 is "YWJj" (no padding)
    assert.strictEqual(toBase64Url('abc'), 'YWJj');
  });

  it('should strip trailing padding characters (=)', () => {
    // "a" standard base64 is "YQ==", base64url must be "YQ"
    assert.strictEqual(toBase64Url('a'), 'YQ');
    // "ab" standard base64 is "YWI=", base64url must be "YWI"
    assert.strictEqual(toBase64Url('ab'), 'YWI');
    assert.strictEqual(toBase64Url('a').includes('='), false);
    assert.strictEqual(toBase64Url('ab').includes('='), false);
  });

  it('should replace + with - and / with _', () => {
    // Byte values 0xFB, 0xF0 produce "+/A=" in standard Base64
    const testBinary = String.fromCharCode(0xfb, 0xf0);
    const encoded = toBase64Url(testBinary);
    assert.strictEqual(encoded.includes('+'), false, 'Must not contain +');
    assert.strictEqual(encoded.includes('/'), false, 'Must not contain /');
    assert.strictEqual(encoded.includes('='), false, 'Must not contain =');
  });

  it('should safely handle multi-byte Unicode characters (Rupee ₹, emojis, accents, Hindi)', () => {
    const samples = [
      'Application for Relationship Manager (₹35 Lacs CTC)',
      'Large Corporate RM 🚀💼',
      'Candidate from मुंबई (BKC)',
      'Résumé - Credit Assessment & CAM'
    ];

    for (const sample of samples) {
      assert.doesNotThrow(() => {
        const encoded = toBase64Url(sample);
        assert.strictEqual(/^[A-Za-z0-9_-]*$/.test(encoded), true, `Must only contain URL-safe chars for: ${sample}`);
        // Lossless roundtrip verification
        const decoded = fromBase64Url(encoded);
        assert.strictEqual(decoded, sample, `Roundtrip mismatch for: ${sample}`);
      });
    }
  });

  it('should handle large strings without stack overflow', () => {
    const largeStr = 'Corporate Banking Relationship Manager '.repeat(2000); // ~78KB
    const encoded = toBase64Url(largeStr);
    assert.strictEqual(typeof encoded, 'string');
    assert.strictEqual(encoded.length > 0, true);
    assert.strictEqual(fromBase64Url(encoded), largeStr);
  });
});

describe('Suite 2: ArrayBuffer to Base64 Conversion (arrayBufferToBase64)', () => {
  it('should return empty string for null, undefined, or empty buffer', () => {
    assert.strictEqual(arrayBufferToBase64(null), '');
    assert.strictEqual(arrayBufferToBase64(undefined), '');
    assert.strictEqual(arrayBufferToBase64(new ArrayBuffer(0)), '');
    assert.strictEqual(arrayBufferToBase64(new Uint8Array(0)), '');
  });

  it('should encode small binary Uint8Array correctly', () => {
    // "Hello" = [72, 101, 108, 108, 111] -> "SGVsbG8="
    const helloBytes = new Uint8Array([72, 101, 108, 108, 111]);
    assert.strictEqual(arrayBufferToBase64(helloBytes), 'SGVsbG8=');
    assert.strictEqual(arrayBufferToBase64(helloBytes.buffer), 'SGVsbG8=');
  });

  it('should handle arbitrary binary values (0x00 through 0xFF)', () => {
    const allBytes = new Uint8Array(256);
    for (let i = 0; i < 256; i++) {
      allBytes[i] = i;
    }
    const b64 = arrayBufferToBase64(allBytes);
    assert.strictEqual(typeof b64, 'string');
    assert.strictEqual(b64.length > 0, true);
    const decoded = atob(b64);
    assert.strictEqual(decoded.length, 256);
    for (let i = 0; i < 256; i++) {
      assert.strictEqual(decoded.charCodeAt(i), i);
    }
  });

  it('should handle 1MB and 2MB buffer stress test without call stack overflow', () => {
    // 1MB = 1048576 bytes
    const oneMb = new Uint8Array(1024 * 1024);
    for (let i = 0; i < oneMb.length; i += 4096) {
      oneMb[i] = i % 256;
    }

    assert.doesNotThrow(() => {
      const b64 = arrayBufferToBase64(oneMb);
      assert.strictEqual(b64.length, Math.ceil((1024 * 1024) / 3) * 4);
    });

    // 2MB buffer
    const twoMb = new Uint8Array(2 * 1024 * 1024);
    assert.doesNotThrow(() => {
      const b64 = arrayBufferToBase64(twoMb);
      assert.strictEqual(b64.length, Math.ceil((2 * 1024 * 1024) / 3) * 4);
    });
  });
});

describe('Suite 3: RFC 2045 76-Character Line Wrapping (wrapBase64Lines)', () => {
  it('should return empty string for null, undefined, or empty string without throwing', () => {
    assert.strictEqual(wrapBase64Lines(''), '');
    assert.strictEqual(wrapBase64Lines(null), '');
    assert.strictEqual(wrapBase64Lines(undefined), '');
  });

  it('should not wrap strings of 76 characters or fewer', () => {
    const exact76 = 'A'.repeat(76);
    assert.strictEqual(wrapBase64Lines(exact76), exact76);
    const short = 'A'.repeat(50);
    assert.strictEqual(wrapBase64Lines(short), short);
  });

  it('should wrap 77 characters into 76 chars + CRLF + 1 char', () => {
    const str77 = 'A'.repeat(76) + 'B';
    const wrapped = wrapBase64Lines(str77);
    assert.strictEqual(wrapped, 'A'.repeat(76) + '\r\nB');
  });

  it('should wrap exactly 152 characters into two 76-character lines separated by CRLF', () => {
    const line1 = 'A'.repeat(76);
    const line2 = 'B'.repeat(76);
    const wrapped = wrapBase64Lines(line1 + line2);
    assert.strictEqual(wrapped, `${line1}\r\n${line2}`);
  });

  it('should ensure all non-final lines in arbitrary long strings are strictly 76 chars', () => {
    const longB64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'.repeat(30); // 1920 chars
    const wrapped = wrapBase64Lines(longB64);
    const lines = wrapped.split('\r\n');
    assert.strictEqual(lines.length, Math.ceil(1920 / 76));
    for (let i = 0; i < lines.length - 1; i++) {
      assert.strictEqual(lines[i].length, 76, `Line ${i} must have length 76`);
    }
    assert.strictEqual(lines[lines.length - 1].length <= 76, true);
  });

  it('should return raw base64 string if lineLength is zero or negative', () => {
    const raw = 'SGVsbG8gV29ybGQ';
    assert.strictEqual(wrapBase64Lines(raw, 0), raw);
    assert.strictEqual(wrapBase64Lines(raw, -10), raw);
  });
});

describe('Suite 4: RFC 2822 Sanitization & Formatting Helpers', () => {
  it('sanitizeHeader should remove newlines and trim whitespace (CWE-93 defense)', () => {
    assert.strictEqual(sanitizeHeader(''), '');
    assert.strictEqual(sanitizeHeader(null), '');
    const injection = 'recruiter@hdfcbank.com\r\nBcc: evil@attacker.com\nSubject: Injected';
    const sanitized = sanitizeHeader(injection);
    assert.strictEqual(sanitized.includes('\r'), false);
    assert.strictEqual(sanitized.includes('\n'), false);
    assert.strictEqual(sanitized, 'recruiter@hdfcbank.com  Bcc: evil@attacker.com Subject: Injected');
  });

  it('sanitizeFilename should clean quotes, backslashes, and control characters', () => {
    assert.strictEqual(sanitizeFilename(''), 'Resume.pdf');
    assert.strictEqual(sanitizeFilename(null), 'Resume.pdf');
    assert.strictEqual(sanitizeFilename('My "Senior RM" Resume.pdf'), 'My Senior RM Resume.pdf');
  });

  it('sanitizeFilename should extract basename and neutralize path traversal (CWE-22)', () => {
    assert.strictEqual(sanitizeFilename('../../../../etc/passwd'), 'passwd');
    assert.strictEqual(sanitizeFilename('..\\..\\etc\\passwd'), 'passwd');
    assert.strictEqual(sanitizeFilename('/tmp/evil.pdf'), 'evil.pdf');
    assert.strictEqual(sanitizeFilename('normal.pdf\0.exe'), 'normal.pdf.exe');
    assert.strictEqual(sanitizeFilename('..'), 'Resume.pdf');
    assert.strictEqual(sanitizeFilename('.'), 'Resume.pdf');
    assert.strictEqual(sanitizeFilename('   '), 'Resume.pdf');
  });

  it('normalizeCrlf should normalize mixed newlines to strict RFC 2822 CRLF', () => {
    assert.strictEqual(normalizeCrlf(''), '');
    const mixed = 'Line1\nLine2\r\nLine3\rLine4';
    const normalized = normalizeCrlf(mixed);
    assert.strictEqual(normalized, 'Line1\r\nLine2\r\nLine3\r\nLine4');
    // Calling normalizeCrlf on already normalized text should not create \r\r\n
    assert.strictEqual(normalizeCrlf(normalized), 'Line1\r\nLine2\r\nLine3\r\nLine4');
  });

  it('encodeRfc2047 should format subject with =?UTF-8?B?...?= only when non-ASCII characters exist', () => {
    assert.strictEqual(encodeRfc2047(''), '');
    const subject = 'Application for Senior RM (₹35L) - Prajyot';
    const encoded = encodeRfc2047(subject);
    assert.strictEqual(encoded.startsWith('=?UTF-8?B?'), true);
    assert.strictEqual(encoded.endsWith('?='), true);

    // Extract Base64 token and decode back
    const b64 = encoded.substring(10, encoded.length - 2);
    const decoded = fromBase64Url(b64);
    assert.strictEqual(decoded, subject);

    // Should not re-encode if already encoded
    assert.strictEqual(encodeRfc2047(encoded), encoded);
  });

  it('encodeRfc2047 should NOT encode pure printable ASCII strings per RFC 2047 §5', () => {
    assert.strictEqual(encodeRfc2047('Application for RM Large Corporate'), 'Application for RM Large Corporate');
    assert.strictEqual(encodeRfc2047('Simple Subject Line 123!'), 'Simple Subject Line 123!');
  });

  it('generateBoundary should generate compliant boundary strings within 70 characters', () => {
    const b1 = generateBoundary();
    const b2 = generateBoundary();
    assert.notStrictEqual(b1, b2);
    assert.strictEqual(b1.length >= 1 && b1.length <= 70, true);
    assert.strictEqual(/^[A-Za-z0-9_-]+$/.test(b1), true);
  });
});

describe('Suite 5: RFC 2822 & RFC 2046 MIME Builder (buildMimeMessage)', () => {
  it('should build a valid single-part plain text email when no attachment is provided', () => {
    const mime = buildMimeMessage({
      toEmail: 'careers.corporate@icicibank.com',
      subject: 'Application for RM Large Corporate',
      bodyText: 'Dear Hiring Team,\r\nPlease find my application attached.\r\nRegards,\r\nPrajyot'
    });

    assert.strictEqual(mime.includes('MIME-Version: 1.0\r\n'), true);
    assert.strictEqual(mime.includes('To: careers.corporate@icicibank.com\r\n'), true);
    // Pure ASCII subject must not use RFC 2047 encoded-word per RFC 2047 §5
    assert.strictEqual(mime.includes('Subject: Application for RM Large Corporate\r\n'), true);
    assert.strictEqual(mime.includes('=?UTF-8?B?'), false);
    assert.strictEqual(mime.includes('Content-Type: text/plain; charset="UTF-8"\r\n'), true);
    assert.strictEqual(mime.includes('Content-Transfer-Encoding: 8bit\r\n'), true);
    assert.strictEqual(mime.includes('\r\n\r\nDear Hiring Team,'), true);
    assert.strictEqual(mime.includes('multipart/mixed'), false);
  });

  it('should build a valid multipart/mixed email with PDF attachment and RFC 2047 encoded non-ASCII subject', () => {
    const mockPdfBytes = new TextEncoder().encode('%PDF-1.4 Mock resume content for Relationship Manager');
    const mime = buildMimeMessage({
      toEmail: 'recruitment.corporate@hdfcbank.com',
      subject: 'Application for Senior RM - Large Corporate Banking (₹35L)',
      bodyText: 'Dear Hiring Manager,\r\nPlease evaluate my profile for the Senior RM opening.\r\nRegards.',
      attachment: {
        filename: 'Prajyot_Resume.pdf',
        contentType: 'application/pdf',
        data: mockPdfBytes
      }
    });

    // Check RFC 2822 headers
    assert.strictEqual(mime.includes('MIME-Version: 1.0\r\n'), true);
    assert.strictEqual(mime.includes('To: recruitment.corporate@hdfcbank.com\r\n'), true);
    assert.strictEqual(mime.includes('Subject: =?UTF-8?B?'), true);
    assert.strictEqual(mime.includes('Content-Type: multipart/mixed; boundary="'), true);

    // Extract boundary
    const boundaryMatch = mime.match(/boundary="([^"]+)"/);
    assert.strictEqual(Boolean(boundaryMatch), true);
    const boundary = boundaryMatch[1];

    // Check boundary markers
    assert.strictEqual(mime.includes(`--${boundary}\r\nContent-Type: text/plain; charset="UTF-8"`), true);
    assert.strictEqual(mime.includes(`--${boundary}\r\nContent-Type: application/pdf; name="Prajyot_Resume.pdf"`), true);
    assert.strictEqual(mime.includes('Content-Disposition: attachment; filename="Prajyot_Resume.pdf"'), true);
    assert.strictEqual(mime.includes('Content-Transfer-Encoding: base64'), true);
    assert.strictEqual(mime.endsWith(`--${boundary}--`), true);
  });

  it('buildBase64UrlMimeMessage should return valid URL-safe string without +, /, =', () => {
    const rawBase64Url = buildBase64UrlMimeMessage({
      toEmail: 'lead.corporate@kotak.com',
      subject: 'RM Mid-Corporate Group (₹30L)',
      bodyText: 'Application note'
    });

    assert.strictEqual(typeof rawBase64Url, 'string');
    assert.strictEqual(rawBase64Url.length > 0, true);
    assert.strictEqual(rawBase64Url.includes('+'), false);
    assert.strictEqual(rawBase64Url.includes('/'), false);
    assert.strictEqual(rawBase64Url.includes('='), false);

    const decoded = fromBase64Url(rawBase64Url);
    assert.strictEqual(decoded.includes('lead.corporate@kotak.com'), true);
    assert.strictEqual(decoded.includes('Application note'), true);
  });
});

describe('Suite 6: Corporate Banking Cover Pitch Generator', () => {
  it('should generate professional corporate banking RM cover pitch with expected keywords', () => {
    const pitch = generateCorporateCoverPitch({
      candidateName: 'Prajyot Chakrawarti',
      jobTitle: 'Senior Relationship Manager - Large Corporate Banking',
      organization: 'HDFC Bank',
      candidatePhone: '+91 98765 43210',
      candidateEmail: 'prajyot@example.com'
    });

    assert.strictEqual(pitch.includes('Dear Hiring Team at HDFC Bank,'), true);
    assert.strictEqual(pitch.includes('Senior Relationship Manager - Large Corporate Banking'), true);
    assert.strictEqual(pitch.includes('Credit Assessment Memorandums (CAM)'), true);
    assert.strictEqual(pitch.includes('Cash Credit, WCDL'), true);
    assert.strictEqual(pitch.includes('Working Capital (CC/WCDL), Trade Finance (LC/BG), CMS, and FX hedging'), true);
    assert.strictEqual(pitch.includes('Prajyot Chakrawarti'), true);
    assert.strictEqual(pitch.includes('Phone: +91 98765 43210'), true);
    assert.strictEqual(pitch.includes('Email: prajyot@example.com'), true);
  });

  it('should cleanly append custom note when provided', () => {
    const pitch = generateCorporateCoverPitch({
      candidateName: 'Aditya Mehta',
      jobTitle: 'Mid-Corporate RM',
      organization: 'Axis Bank',
      customNote: 'Ranked top corporate originator in Western Zone with ₹450 Cr incremental asset booking in FY25.'
    });

    assert.strictEqual(pitch.includes('Ranked top corporate originator in Western Zone'), true);
    assert.strictEqual(pitch.includes('Additional Note:'), true);
  });

  it('should fall back to domain defaults when parameters are omitted', () => {
    const defaultPitch = generateCorporateCoverPitch();
    assert.strictEqual(defaultPitch.includes('Corporate Banking Professional'), true);
    assert.strictEqual(defaultPitch.includes('Relationship Manager - Corporate Banking'), true);
    assert.strictEqual(defaultPitch.includes('the Bank'), true);
  });
});

describe('Suite 7: Google Authentication & Gmail Service Operations', () => {
  let mockStorage;

  beforeEach(() => {
    mockStorage = new MockLocalStorage();
    globalThis.localStorage = mockStorage;
  });

  it('should cache and retrieve unexpired Google access token with 60-second safety margin', () => {
    clearStoredToken();
    assert.strictEqual(getStoredAccessToken(), null);

    // Pre-seed token expiring in 1 hour
    const tokenData = {
      accessToken: 'ya29.mock-test-access-token-12345',
      expiresAt: Date.now() + 3540000, // 3600s - 60s
      scope: GMAIL_SEND_SCOPE,
      tokenType: 'Bearer'
    };
    mockStorage.setItem(TOKEN_STORAGE_KEY, JSON.stringify(tokenData));

    assert.strictEqual(getStoredAccessToken(), 'ya29.mock-test-access-token-12345');
    const info = getStoredTokenInfo();
    assert.strictEqual(info?.accessToken, 'ya29.mock-test-access-token-12345');
  });

  it('should treat expired tokens as null and purge from localStorage', () => {
    const expiredTokenData = {
      accessToken: 'ya29.expired-token',
      expiresAt: Date.now() - 5000, // Expired 5 seconds ago
      scope: GMAIL_SEND_SCOPE
    };
    mockStorage.setItem(TOKEN_STORAGE_KEY, JSON.stringify(expiredTokenData));

    assert.strictEqual(getStoredAccessToken(), null);
    assert.strictEqual(mockStorage.getItem(TOKEN_STORAGE_KEY), null);
  });

  it('should handle corrupted JSON in localStorage gracefully without throwing', () => {
    mockStorage.setItem(TOKEN_STORAGE_KEY, '{ invalid_json :::');
    assert.strictEqual(getStoredAccessToken(), null);
  });

  it('waitForGIS should resolve when window.google.accounts.oauth2 is present', async () => {
    globalThis.window = globalThis.window || {};
    globalThis.window.google = {
      accounts: {
        oauth2: {
          initTokenClient: () => ({})
        }
      }
    };

    const oauth2 = await waitForGIS(100);
    assert.strictEqual(Boolean(oauth2), true);
  });

  it('sendGmailMessage should dispatch message with Bearer token', async () => {
    let capturedUrl = '';
    let capturedOptions = null;

    globalThis.fetch = async (url, options) => {
      capturedUrl = url;
      capturedOptions = options;
      return {
        ok: true,
        status: 200,
        json: async () => ({ id: 'msg_987654321', threadId: 'th_12345' })
      };
    };

    const result = await sendGmailMessage('dGVzdA', 'mock-bearer-token');
    assert.strictEqual(result.success, true);
    assert.strictEqual(result.messageId, 'msg_987654321');
    assert.strictEqual(capturedUrl, 'https://gmail.googleapis.com/gmail/v1/users/me/messages/send');
    assert.strictEqual(capturedOptions.headers['Authorization'], 'Bearer mock-bearer-token');
    assert.strictEqual(capturedOptions.headers['Content-Type'], 'application/json');
    assert.strictEqual(JSON.parse(capturedOptions.body).raw, 'dGVzdA');
  });

  it('sendGmailMessage should handle HTTP 400 Bad Request', async () => {
    globalThis.fetch = async () => ({
      ok: false,
      status: 400,
      json: async () => ({ error: { message: 'Invalid To header' } })
    });

    await assert.rejects(
      async () => {
        await sendGmailMessage('dGVzdA', 'mock-token');
      },
      (err) => {
        assert.strictEqual(err.code, 400);
        assert.strictEqual(err.status, 'BAD_REQUEST');
        return true;
      }
    );
  });

  it('sendGmailMessage should handle HTTP 403 Forbidden', async () => {
    globalThis.fetch = async () => ({
      ok: false,
      status: 403,
      json: async () => ({ error: { message: 'Insufficient Permission' } })
    });

    await assert.rejects(
      async () => {
        await sendGmailMessage('dGVzdA', 'mock-token');
      },
      (err) => {
        assert.strictEqual(err.code, 403);
        assert.strictEqual(err.status, 'PERMISSION_DENIED');
        return true;
      }
    );
  });

  it('sendGmailMessage should handle HTTP 401 and clear token from storage', async () => {
    mockStorage.setItem(TOKEN_STORAGE_KEY, JSON.stringify({
      accessToken: 'stale-token',
      expiresAt: Date.now() + 100000
    }));

    globalThis.fetch = async () => ({
      ok: false,
      status: 401,
      json: async () => ({ error: { message: 'Invalid Credentials' } })
    });

    await assert.rejects(
      async () => {
        await sendGmailMessage('dGVzdA', 'stale-token');
      },
      (err) => {
        assert.strictEqual(err.code, 401);
        assert.strictEqual(err.status, 'UNAUTHENTICATED');
        return true;
      }
    );

    assert.strictEqual(mockStorage.getItem(TOKEN_STORAGE_KEY), null);
  });

  it('sendJobApplicationEmail should coordinate pitch, MIME creation, and API dispatch', async () => {
    let capturedBody = null;

    globalThis.fetch = async (url, options) => {
      capturedBody = JSON.parse(options.body);
      return {
        ok: true,
        status: 200,
        json: async () => ({ id: 'msg_app_123', threadId: 'th_app_123' })
      };
    };

    // Pre-seed access token
    mockStorage.setItem(TOKEN_STORAGE_KEY, JSON.stringify({
      accessToken: 'valid-test-token',
      expiresAt: Date.now() + 300000
    }));

    const mockResume = new TextEncoder().encode('%PDF-1.4 Resume Data');

    const result = await sendJobApplicationEmail({
      toEmail: 'careers.corporate@standardchartered.com',
      jobTitle: 'Relationship Manager - MNC Banking',
      organization: 'Standard Chartered',
      candidateName: 'Prajyot Chakrawarti',
      candidateEmail: 'prajyot@example.com',
      candidatePhone: '+91 99999 88888',
      resumeFileName: 'Prajyot_SCB_Resume.pdf',
      resumeArrayBuffer: mockResume.buffer
    });

    assert.strictEqual(result.success, true);
    assert.strictEqual(result.messageId, 'msg_app_123');
    assert.strictEqual(Boolean(capturedBody?.raw), true);

    const decodedMime = fromBase64Url(capturedBody.raw);
    assert.strictEqual(decodedMime.includes('To: careers.corporate@standardchartered.com'), true);
    assert.strictEqual(decodedMime.includes('Content-Type: multipart/mixed'), true);
    assert.strictEqual(decodedMime.includes('filename="Prajyot_SCB_Resume.pdf"'), true);
  });

  it('sendJobApplicationEmail should reject invalid recipient email', async () => {
    const invalidEmails = [
      'invalid-email-address',
      'foo@',
      '@bar',
      'foo@bar',
      'user @ domain.com',
      'user@domain..com',
      '<script>alert(1)</script>@bank.com',
      'user@domain.com\r\nBcc: evil@attacker.com',
      '',
      null,
      undefined
    ];

    for (const email of invalidEmails) {
      await assert.rejects(
        async () => {
          await sendJobApplicationEmail({
            toEmail: email,
            jobTitle: 'RM',
            organization: 'Bank',
            candidateName: 'Candidate'
          });
        },
        /valid recipient email address is required/
      );
    }
  });

  it('revokeStoredToken should invoke GIS revoke even if token has reached local expiration', async () => {
    // Pre-seed an expired token (passed local 60-second safety margin)
    const expiredPayload = {
      accessToken: 'ya29.expired-locally-token',
      expiresAt: Date.now() - 5000,
      scope: GMAIL_SEND_SCOPE
    };
    mockStorage.setItem(TOKEN_STORAGE_KEY, JSON.stringify(expiredPayload));

    let revokedToken = null;
    globalThis.window = globalThis.window || {};
    globalThis.window.google = {
      accounts: {
        oauth2: {
          revoke: (tok, callback) => {
            revokedToken = tok;
            if (callback) callback();
          }
        }
      }
    };

    const res = await revokeStoredToken();
    assert.strictEqual(res, true);
    assert.strictEqual(revokedToken, 'ya29.expired-locally-token');
    assert.strictEqual(mockStorage.getItem(TOKEN_STORAGE_KEY), null);
  });

  it('initGoogleAuth config.error_callback should forward to tokenClient.error_callback', async () => {
    let forwardedError = null;
    let registeredConfig = null;
    globalThis.window = globalThis.window || {};
    globalThis.window.google = {
      accounts: {
        oauth2: {
          initTokenClient: (config) => {
            registeredConfig = config;
            return {
              requestAccessToken: () => {}
            };
          }
        }
      }
    };

    const client = await initGoogleAuth();
    client.error_callback = (err) => {
      forwardedError = err;
    };

    registeredConfig.error_callback({ type: 'popup_closed' });
    assert.deepStrictEqual(forwardedError, { type: 'popup_closed' });
  });
});

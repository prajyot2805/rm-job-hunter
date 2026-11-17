/**
 * src/services/mimeBuilder.js
 * 
 * Standards-compliant MIME message constructor and RFC 4648 Base64URL encoder
 * for the Corporate Banking Relationship Manager Job Hunt Application.
 * 
 * Complies with:
 * - RFC 2822: Internet Message Format (CRLF line endings, header syntax)
 * - RFC 2045: MIME Part One (76-character Base64 line wrapping)
 * - RFC 2046: MIME Part Two (multipart/mixed boundaries and media types)
 * - RFC 2047: MIME Part Three (UTF-8 encoded-word subject encoding)
 * - RFC 4648 §5: Base64URL encoding for Gmail REST API
 */

/**
 * Encodes a UTF-8 string to RFC 4648 Section 5 Base64URL format (URL-safe, no padding).
 * Safely handles multi-byte characters (Unicode, emojis, Rupee sign ₹) without throwing InvalidCharacterError.
 * 
 * @param {string} str - Raw string to encode
 * @returns {string} Base64URL encoded string
 */
export function toBase64Url(str) {
  if (str === null || str === undefined) return '';
  const stringVal = typeof str === 'string' ? str : String(str);
  if (stringVal.length === 0) return '';
  const bytes = new TextEncoder().encode(stringVal);
  let binary = '';
  const chunkSize = 0x8000; // 32KB chunking
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

/**
 * Converts a binary ArrayBuffer or Uint8Array into a standard Base64 string.
 * Uses 32KB chunking (0x8000) to prevent 'RangeError: Maximum call stack size exceeded'
 * on large files (e.g. 1MB - 10MB PDF resumes).
 * 
 * @param {ArrayBuffer | Uint8Array} buffer - Binary data buffer
 * @returns {string} Standard Base64 string
 */
export function arrayBufferToBase64(buffer) {
  if (!buffer) return '';
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  const len = bytes.byteLength;
  if (len === 0) return '';
  let binary = '';
  const chunkSize = 0x8000; // 32,768 bytes per chunk to stay well within call stack limits
  for (let i = 0; i < len; i += chunkSize) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

/**
 * Sanitizes header fields to prevent CRLF Header Injection vulnerabilities (CWE-93).
 * 
 * @param {string} val - Raw header value
 * @returns {string} Sanitized single-line header
 */
export function sanitizeHeader(val) {
  if (!val) return '';
  return String(val).replace(/[\r\n]/g, ' ').trim();
}

/**
 * Sanitizes an attachment filename to prevent header breakout and quote injection.
 * 
 * @param {string} name - Raw filename
 * @returns {string} Sanitized filename
 */
export function sanitizeFilename(name) {
  if (!name) return 'Resume.pdf';
  const basename = String(name).split(/[/\\]/).pop() || '';
  const cleaned = basename.replace(/[\r\n\0"\\]/g, '').trim();
  if (!cleaned || cleaned === '.' || cleaned === '..') return 'Resume.pdf';
  return cleaned;
}

/**
 * Normalizes all newline variants (\r\n, \n, \r) to strict RFC 2822 CRLF (\r\n).
 * 
 * @param {string} str - Input text
 * @returns {string} CRLF normalized text
 */
export function normalizeCrlf(str) {
  if (!str) return '';
  return String(str)
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/\n/g, '\r\n');
}

/**
 * Encodes header text (such as Subject) using RFC 2047 encoded-word format if non-ASCII is present.
 * Format: =?UTF-8?B?<base64>?=
 * 
 * @param {string} text - Header text
 * @returns {string} RFC 2047 encoded-word or clean ASCII
 */
export function encodeRfc2047(text) {
  if (!text) return '';
  const cleanText = sanitizeHeader(text);
  if (!cleanText) return '';
  if (/^=\?UTF-8\?B\?.*\?=$/i.test(cleanText)) {
    return cleanText;
  }
  // Only encode if non-ASCII characters (outside 0x20-0x7E) are present per RFC 2047 §5
  if (/^[\x20-\x7E]*$/.test(cleanText)) {
    return cleanText;
  }
  const bytes = new TextEncoder().encode(cleanText);
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunkSize));
  }
  const b64 = btoa(binary);
  return `=?UTF-8?B?${b64}?=`;
}

export const encodeHeaderValue = encodeRfc2047;

/**
 * Generates a unique, RFC 2046 compliant multipart boundary delimiter.
 * Length is ~38 characters (within the 1-70 character limit).
 * 
 * @returns {string} Unique boundary string
 */
export function generateBoundary() {
  const rand = Math.random().toString(36).substring(2, 10);
  const time = Date.now().toString(16);
  return `jobhunt_boundary_${time}_${rand}`;
}

/**
 * Wraps Base64 string to a maximum line length (76 characters) per RFC 2045 §6.8.
 * 
 * @param {string} b64 - Continuous Base64 string
 * @param {number} lineLength - Max characters per line (default 76)
 * @returns {string} CRLF-separated chunked Base64 string
 */
export function wrapBase64Lines(b64, lineLength = 76) {
  if (!b64) return '';
  if (!lineLength || lineLength <= 0) return b64;
  const regex = new RegExp(`.{1,${lineLength}}`, 'g');
  const chunks = b64.match(regex);
  return chunks ? chunks.join('\r\n') : '';
}

/**
 * Builds an RFC 2822 / RFC 2046 compliant MIME email message string.
 * Supports both single-part plain text and multipart/mixed with PDF attachments.
 * 
 * @param {Object} options
 * @param {string} options.toEmail - Recipient email address
 * @param {string} options.subject - Email subject line
 * @param {string} options.bodyText - Email body text
 * @param {Object} [options.attachment] - Optional attachment configuration
 * @param {string} options.attachment.filename - Attachment filename (e.g. "Resume.pdf")
 * @param {string} [options.attachment.contentType] - MIME type (defaults to "application/pdf")
 * @param {ArrayBuffer | Uint8Array | string} options.attachment.data - Binary data or base64 string
 * @returns {string} Complete RFC 2822 MIME message formatted with CRLF
 */
export function buildMimeMessage({ toEmail, subject, bodyText, attachment }) {
  const sanitizedTo = sanitizeHeader(toEmail);
  const encodedSubject = encodeRfc2047(subject);
  const normalizedBody = normalizeCrlf(bodyText || '');

  // Case 1: Simple text email without attachment
  if (!attachment || !attachment.data) {
    const headers = [
      'MIME-Version: 1.0',
      `To: ${sanitizedTo}`,
      `Subject: ${encodedSubject}`,
      'Content-Type: text/plain; charset="UTF-8"',
      'Content-Transfer-Encoding: 8bit'
    ];
    return headers.join('\r\n') + '\r\n\r\n' + normalizedBody;
  }

  // Case 2: Multipart/mixed email with PDF attachment
  const boundary = generateBoundary();
  const filename = sanitizeFilename(attachment.filename);
  const contentType = attachment.contentType || 'application/pdf';

  let b64Data = '';
  if (typeof attachment.data === 'string') {
    b64Data = attachment.data.replace(/\s+/g, '');
  } else if (attachment.data instanceof ArrayBuffer || attachment.data instanceof Uint8Array) {
    b64Data = arrayBufferToBase64(attachment.data);
  }

  const wrappedAttachment = wrapBase64Lines(b64Data, 76);

  const parts = [
    'MIME-Version: 1.0',
    `To: ${sanitizedTo}`,
    `Subject: ${encodedSubject}`,
    `Content-Type: multipart/mixed; boundary="${boundary}"`,
    '',
    `--${boundary}`,
    'Content-Type: text/plain; charset="UTF-8"',
    'Content-Transfer-Encoding: 8bit',
    '',
    normalizedBody,
    '',
    `--${boundary}`,
    `Content-Type: ${contentType}; name="${filename}"`,
    `Content-Disposition: attachment; filename="${filename}"`,
    'Content-Transfer-Encoding: base64',
    '',
    wrappedAttachment,
    '',
    `--${boundary}--`
  ];

  return parts.join('\r\n');
}

/**
 * Builds a ready-to-send Base64URL-encoded MIME message for the Gmail REST API.
 * Combines buildMimeMessage and toBase64Url.
 * 
 * @param {Object} options - Parameters passed to buildMimeMessage
 * @returns {string} Base64URL encoded payload ready for { raw: payload } in Gmail API
 */
export function buildBase64UrlMimeMessage(options) {
  const mime = buildMimeMessage(options);
  return toBase64Url(mime);
}

/**
 * Generates an executive, domain-tailored Corporate Banking Relationship Manager
 * application pitch note with customizable candidate parameters.
 * 
 * @param {Object} params
 * @param {string} [params.candidateName] - Candidate's full name
 * @param {string} [params.jobTitle] - Target job designation
 * @param {string} [params.organization] - Target bank or financial institution
 * @param {string} [params.currentPortfolio] - Current book size & accounts (e.g. "₹1,200 Cr across 20 corporate accounts")
 * @param {string} [params.segment] - Banking segment (e.g. "Large Corporate Group (LCG)", "Mid Corporate")
 * @param {string} [params.productHighlights] - Key product drivers (e.g. "Working Capital, LC/BG, CMS, and FX hedging")
 * @param {string} [params.experienceYears] - Relevant years of corporate banking experience (e.g. "7+ years")
 * @param {string} [params.candidatePhone] - Phone contact
 * @param {string} [params.candidateEmail] - Email address
 * @param {string} [params.customNote] - Optional personalized note or achievement
 * @returns {string} Tailored cover pitch letter
 */
export function generateCorporateCoverPitch(params = {}) {
  const candidateName = params.candidateName || 'Corporate Banking Professional';
  const jobTitle = params.jobTitle || 'Relationship Manager - Corporate Banking';
  const organization = params.organization || 'the Bank';
  const currentPortfolio = params.currentPortfolio || '₹800 Cr+ corporate asset book';
  const segment = params.segment || 'Large & Mid-Corporate Banking';
  const productHighlights = params.productHighlights || 'Working Capital (CC/WCDL), Trade Finance (LC/BG), CMS, and FX hedging';
  const experienceYears = params.experienceYears || '6+ years';
  const candidatePhone = params.candidatePhone || '';
  const candidateEmail = params.candidateEmail || '';
  const customNote = params.customNote || '';

  const paragraphs = [
    `Dear Hiring Team at ${organization},`,
    '',
    `I am writing to express my strong interest in the ${jobTitle} position at ${organization}.`,
    '',
    `With ${experienceYears} of corporate banking experience covering ${segment}, I currently oversee a portfolio of ${currentPortfolio}. My background combines asset origination, credit appraisal, and multi-product client coverage.`,
    '',
    'Key Profile Highlights:',
    '• Asset Origination & Structuring: Structuring funded working capital limits (Cash Credit, WCDL), capex term debt, and consortium facilities.',
    `• Fee & Transaction Banking Alpha: Driving non-funded revenue via ${productHighlights}.`,
    '• Credit Rigor & Underwriting: End-to-end preparation of Credit Assessment Memorandums (CAM), financial statement spreading (CMA), covenant tracking, and zero NPA slippage.',
    '• Promoter & CFO Engagement: Direct coverage of corporate decision-makers (CFOs, Group Treasurers, Promoters) to grow transaction banking wallet share.'
  ];

  if (customNote && customNote.trim()) {
    paragraphs.push('', 'Additional Note:', customNote.trim());
  }

  paragraphs.push(
    '',
    `Please find my resume attached for your review. I would welcome the opportunity to discuss how my client network and credit origination experience can support ${organization}'s growth.`,
    '',
    'Sincerely,',
    candidateName
  );

  if (candidatePhone) paragraphs.push(`Phone: ${candidatePhone}`);
  if (candidateEmail) paragraphs.push(`Email: ${candidateEmail}`);

  return paragraphs.join('\n');
}

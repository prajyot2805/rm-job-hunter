# Corporate Banking RM Job Hunter & Direct Apply Tool (India)

> A specialized, privacy-first web application and automated scraping pipeline engineered for Indian Corporate Banking Relationship Managers (RMs) looking to advance their wholesale banking careers.

[![CI/CD Pipeline](https://github.com/prajyot-chakrawarti/corporate-banking-rm-job-hunt/actions/workflows/deploy.yml/badge.svg)](https://github.com/prajyot-chakrawarti/corporate-banking-rm-job-hunt/actions/workflows/deploy.yml)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D20.0.0-brightgreen.svg)](https://nodejs.org/)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Tests Passing](https://img.shields.io/badge/tests-158%20passed-success.svg)](tests/)

---

## 1. Executive Summary & Purpose

Corporate Banking Relationship Management in India is a high-conviction, relationship-driven domain. Wholesale bankers manage credit books ranging from ₹50 Cr to upwards of ₹15,000 Cr across leading private sector banks (HDFC Bank, ICICI Bank, Kotak Mahindra Bank, Axis Bank), public sector institutions (State Bank of India, Bank of Baroda), and foreign multinationals (Citi, Standard Chartered, HSBC, Barclays, Deutsche Bank).

Generic job portals (LinkedIn, Naukri) conflate wholesale corporate coverage with retail branch banking, wealth management, and retail loan sales. Furthermore, active RMs require **strict confidentiality**, **precise credit segment filtering**, and **direct hiring manager outreach** without exposing their profiles to intermediate recruitment agencies.

**Corporate Banking RM Job Hunter** solves these challenges with a 100% free, zero-server-overhead architecture:
- **Zero Data Harvesting**: Your resume (PDF) and salary expectations never touch an application server. All data stays strictly inside your browser sandbox (`IndexedDB` & `localStorage`).
- **Tailored Corporate Segments**: Filter precisely by credit exposure—Large Corporate (LCG), Mid Corporate (MCG), Multinational Banking (MNC), Commercial Banking, and Financial Institutions Group (FIG).
- **Indian Banking Micro-Markets**: Built-in synonym matching for premier financial districts (Mumbai BKC/Nariman Point/Lower Parel, Delhi NCR Gurugram Cyber City/Noida, Bengaluru MG Road/Whitefield).
- **Mathematical 5-Tier Relevance Scoring**: Automatically ranks opportunities based on role seniority, banking segment, geography, credit products (Working Capital, LC/BG, Syndication, FX), and CTC.
- **One-Click Direct Gmail Apply**: Authenticates client-side with Google Identity Services (GIS) to dispatch RFC 2822-compliant applications with attached resumes directly from your personal Gmail address via the official Gmail REST API.
- **Free Scraping Pipeline**: Background job harvesting powered by a self-hosted n8n workflow with zero paid API dependencies and resilient fallback fixtures.

---

## 2. Architecture Overview & System Diagram

The platform operates as a static Single Page Application (SPA) deployed to GitHub Pages, communicating directly with a self-hosted n8n scraper and Google's Gmail API from the client's browser.

```
+---------------------------------------------------------------------------------------------------------+
|                                    CLIENT-SIDE BROWSER RUNTIME                                          |
|                               (GitHub Pages / Static SPA - React 18 + Vite)                             |
|                                                                                                         |
|  +--------------------------------+   +---------------------------------+   +-------------------------+ |
|  |     CANDIDATE PREFERENCES      |   |        RESUME REPOSITORY        |   |    5-TIER RELEVANCE     | |
|  |  - Locations (BKC, Cyber City) |   |  - Zero-dependency IndexedDB    |   |     MATCHING ENGINE     | |
|  |  - Segments (LCG, MCG, MNC)    |   |  - Binary PDF Blob Storage      |   |  - Role Seniority (25%) | |
|  |  - Min CTC & Credit Products   |   |  - 5MB Client-side Cap          |   |  - Bank Segment (25%)   | |
|  |  -> Saved to localStorage      |   |  -> Saved to JobHuntDB          |   |  - Metro Location (25%) | |
|  +--------------------------------+   +---------------------------------+   |  - Products (15%)       | |
|                                                                             |  - CTC (10%) + Recency  | |
|                                                                             +-------------------------+ |
|                                                                                          |              |
|  +---------------------------------------------------------------------------------------+              |
|  |                                                                                                      |
|  v                                                                                                      |
|  +--------------------------------+   +---------------------------------+   +-------------------------+ |
|  |       MOBILE-FIRST UI          |   |       GOOGLE IDENTITY (GIS)     |   |     RFC 2822 MIME &     | |
|  |  - Filter Chips & Search       |   |  - One-time OAuth Token Client  |   |    BASE64URL BUILDER    | |
|  |  - Match Badges & Details      |   |  - Silent Token Renewal         |   |  - CRLF CWE-93 Defense  | |
|  |  - Mobile Bottom Sheet Modal   |   |  - Cached in localStorage       |   |  - Multipart PDF Attach | |
|  +---------------+----------------+   +----------------+----------------+   +------------+------------+ |
+------------------|-------------------------------------|---------------------------------|--------------+
                   |                                     |                                 |
                   | 1. GET /webhook/fetch-jobs          | 2. Google OAuth                 | 3. Direct POST /send
                   v                                     v                                 v
+------------------------------------+   +-------------------------------+   +----------------------------+
|      SELF-HOSTED n8n ENGINE        |   |      GOOGLE ACCOUNTS API      |   |       GMAIL REST API       |
|  - CORS-enabled Webhook (/webhook) |   |  - Google Identity Services   |   |  - Direct RFC 2822 Send    |
|  - LinkedIn Guest Jobs Scraper     |   |  - Scope: gmail.send          |   |  - Bearer Token Auth       |
|  - Pure JS Regex HTML Parser       |   |  - Zero server secrets        |   |  - Zero intermediate proxy |
|  - Curated Banking RM Fallbacks    |   +-------------------------------+   +----------------------------+
+------------------------------------+
```

---

## 3. Feature Highlights

### 3.1 Targeted Corporate Banking Segments
Tailored specifically for wholesale credit classifications:
- **Large Corporate Group (LCG)**: Conglomerates & corporate houses with annual revenues $> ₹1,000 \text{ Cr} - ₹1,500 \text{ Cr}$. Coverage encompasses consortium lending, syndicated term debt, Cash Management Services (CMS), and complex treasury FX hedging.
- **Mid Corporate Group (MCG)**: Mid-market manufacturing, pharma, and IT enterprises with revenues between $₹200 \text{ Cr}$ and $₹1,000 \text{ Cr}$. Emphasizes working capital origination (CC/OD), bank guarantees, and letters of credit.
- **MNC Banking**: Indian subsidiaries of global corporations requiring cross-border structuring, automated liquidity cash pooling, and External Commercial Borrowings (ECB).
- **Commercial Banking / Emerging Corporates**: High-growth entities ($₹50 \text{ Cr} - ₹200 \text{ Cr}$) under multiple-banking or sole-banking arrangements.
- **Financial Institutions Group (FIG)**: Coverage of NBFCs, private debt funds, insurance companies, and fintech balance sheets.

### 3.2 Indian Banking Hubs & Micro-Markets
Wholesale banking in India is geographically concentrated. The platform includes an intelligent synonym expansion engine that recognizes primary financial districts:
- **Mumbai**: Bandra-Kurla Complex (BKC), Nariman Point, Lower Parel, Fort, Andheri East, Navi Mumbai.
- **Delhi NCR**: Gurugram Cyber City / Golf Course Road, Noida Sector 62/16, Connaught Place, Barakhamba Road, Nehru Place.
- **Bengaluru**: MG Road, Whitefield, Koramangala, Electronic City.
- **Other Hubs**: Pune (Hinjewadi, Magarpatta), Hyderabad (HITEC City, Gachibowli), Chennai (OMR, Anna Salai), Kolkata, and Ahmedabad (GIFT City).

### 3.3 5-Tier Weighted Relevance Matching Engine
Every opportunity is evaluated in real time against candidate profile preferences using the following scoring formula:

$$\text{Relevance Score} = \min\left(100, \max\left(0, \text{round}\left(w_{role} S_{role} + w_{seg} S_{seg} + w_{loc} S_{loc} + w_{prod} S_{prod} + w_{ctc} S_{ctc} + B_{recency}\right)\right)\right)$$

| Component | Weight | Criteria | Scoring Rubric |
|---|:---:|---|---|
| **Role Seniority** | **25%** | RM, Director, Coverage vs Operations/Branch | 100 pts for Corporate RM/Coverage titles; 75 pts for Credit Analyst; 20 pts for retail |
| **Banking Segment** | **25%** | LCG, MCG, MNC, Commercial, FIG | 100 pts for exact preference segment match; 20 pts for non-matching segment |
| **Metro Location** | **25%** | Micro-market synonym resolution | 100 pts for metro/district match; 50 pts for general India match; 0 pts mismatch |
| **Credit Products** | **15%** | Working Capital, LC/BG, Syndication, FX, CMS | Up to 100 pts based on keyword density in job requirements |
| **Target CTC** | **10%** | Lacs / Cr bracket matching | 100 pts if max CTC $\ge$ target; 70 pts if $\ge 80\%$ of target; 25 pts otherwise |
| **Recency Bonus** | **Bonus** | Posting timestamp | $+5$ points for $\le 3$ days; $+2$ points for $\le 7$ days |

**Match Tiers**:
- **Top Match** ($\ge 85\%$): Exceptional alignment across segment, location, and seniority.
- **Good Match** ($70\% - 84\%$): Solid corporate banking opportunity meeting core requirements.
- **Moderate Fit** ($50\% - 69\%$): Adjacent segment or location.
- **Low Fit** ($< 50\%$): Low alignment.

### 3.4 Zero-Dependency Client-Side IndexedDB Resume Storage
- Candidate resumes (PDF) are saved directly into the browser's native `IndexedDB` (`JobHuntDB`) as binary `Blob` objects.
- Zero main-thread UI freezing during file handling.
- Maximum file size cap: **5MB**.
- Resumes are loaded on-demand only when composing an application email. No cloud server or third-party database ever stores or sees your document.

### 3.5 One-Time Google Identity Services & Direct RFC 2822 Gmail Dispatch
- Integrated with Google Identity Services (GIS) Web SDK (`https://accounts.google.com/gsi/client`).
- Requests the minimal required OAuth 2.0 scope: `https://www.googleapis.com/auth/gmail.send`.
- Access tokens are cached in browser storage with an automated 60-second early expiry safety buffer and silent token refresh.
- Constructs fully compliant RFC 2822 MIME messages:
  - RFC 2045: 76-character line wrapping for Base64 streams.
  - RFC 2046: Multipart/mixed boundaries isolating message body from binary PDF attachments.
  - RFC 2047: UTF-8 encoded-word subject headers for non-ASCII characters (e.g. Rupee symbol ₹).
  - RFC 4648 §5: 32KB chunked URL-safe Base64URL encoding (without `=` padding) to prevent stack overflow on multi-megabyte PDFs.
  - Built-in defense against CRLF header injection (CWE-93) and path traversal (CWE-22).
- Direct browser dispatch via `POST https://gmail.googleapis.com/gmail/v1/users/me/messages/send`.

### 3.6 Free Self-Hosted n8n Job Scraping Pipeline
- Operates on any standard self-hosted n8n instance (Docker, VPS, or npm).
- 100% free solution: Scrapes live corporate banking listings directly from LinkedIn guest endpoints and Naukri API without requiring paid SerpAPI subscriptions.
- Pure JavaScript regular expression parsing within n8n Code nodes (zero npm package overhead).
- Automated Fallback: If external sites throttle requests or return 0 listings, the webhook seamlessly returns 15+ rich, pre-curated Indian Corporate Banking fixtures (HDFC, ICICI, Kotak, Standard Chartered, Axis, SBI).

---

## 4. Quick Start & Prerequisites

### Prerequisites
- **Node.js**: `v20.0.0` or higher (verified on Node v20 LTS and Node v26).
- **npm**: `v10.0.0` or higher.
- **Python**: `3.8+` (optional, only required if executing the automated n8n deployment script).

### Installation & Local Run
```bash
# 1. Clone the repository
git clone https://github.com/prajyot-chakrawarti/corporate-banking-rm-job-hunt.git
cd corporate-banking-rm-job-hunt

# 2. Install dependencies cleanly
npm ci

# 3. Copy environment configuration
cp .env.example .env

# 4. Start local development server
npm run dev
```

Visit `http://localhost:5173` in your browser.

---

## 5. Configuration & Environment Variables

Environment variables can be configured via a `.env` file in the project root:

| Variable | Required | Description | Example / Default |
|---|:---:|---|---|
| `VITE_N8N_URL` / `N8N_URL` | **Yes** | Base URL of your self-hosted n8n instance exposing the webhook endpoint. | `https://n8n.srv992629.hstgr.cloud` |
| `VITE_GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_ID` | **Yes** | Google OAuth 2.0 Web Client ID authorized for your frontend domain. | `681991983557-*.apps.googleusercontent.com` |
| `N8N_API_KEY` | Optional | n8n Public API key. Only required when deploying workflows programmatically via `n8n/deploy_workflow.py`. | `eyJhbGciOiJIUzI1Ni...` |
| `SERPAPI_KEY` | Optional | Optional fallback search key (the primary workflow uses free scrapers). | `your_serpapi_key_here` |

### `.env` vs `.env.example`
- `.env`: Contains your live local credentials. **Never commit `.env` to version control.**
- `.env.example`: Safe, audited template file checked into Git:

```bash
# .env.example - Corporate Banking RM Job Hunter Configuration Template

# Self-Hosted n8n Instance Base URL
N8N_URL=https://n8n.srv992629.hstgr.cloud/
VITE_N8N_URL=https://n8n.srv992629.hstgr.cloud/

# n8n Public API Key (Required only for python3 n8n/deploy_workflow.py)
N8N_API_KEY=your_n8n_api_key_here

# Google OAuth 2.0 Web Client ID (Google Cloud Console -> Credentials)
GOOGLE_CLIENT_ID=your_google_client_id.apps.googleusercontent.com
VITE_GOOGLE_CLIENT_ID=your_google_client_id.apps.googleusercontent.com

# Optional SerpAPI Key (Free LinkedIn/Naukri scraping does not require this)
SERPAPI_KEY=your_serpapi_key_here
```

---

## 6. Local Development & Testing Instructions

### NPM Scripts
```bash
# Start Vite development server with HMR at http://localhost:5173
npm run dev

# Compile and bundle static production assets into ./dist
npm run build

# Preview production build locally
npm run preview

# Execute standalone opaque-box test runner
npm test
```

### Standalone Test Runner (`tests/runner.js`)
The project includes a standalone test suite with zero test-framework dependencies:
```bash
# Run all test suites (Tiers 1-5 + RFC 2822 MIME verification)
node tests/runner.js

# Run specific test tiers or suites
node tests/runner.js tier1      # Tier 1: Feature Coverage (35 tests)
node tests/runner.js tier2      # Tier 2: Boundary Tests (28 tests)
node tests/runner.js tier3      # Tier 3: Combinations & Stress (14 tests)
node tests/runner.js tier4      # Tier 4: Real-World Scenarios (5 tests)
node tests/runner.js tier5      # Tier 5: Adversarial Coverage Hardening (35 tests)
node tests/runner.js mime       # RFC 2822, 2045, 2046, 4648 MIME Suites (41 tests)

# Test runner flags
node tests/runner.js --spec     # Human-readable format (default)
node tests/runner.js --tap      # TAP version 13 machine-readable output
node tests/runner.js --bail     # Abort immediately on first failure
node tests/runner.js --timeout 5000  # Custom timeout in milliseconds
```

### Running Native Node.js Test Runner
You can also run tests directly using Node's native test runner:
```bash
node --test tests/e2e/*.test.js tests/mime.test.js
```

---

## 7. n8n Self-Hosted Workflow Deployment Guide

The job scraping pipeline is contained in `n8n/rm_job_hunter_workflow.json` and exposes a CORS-enabled webhook endpoint: `GET /webhook/fetch-jobs`.

### Method A: Automated Deployment via Python CLI
The repository includes a zero-dependency Python deployment utility (`n8n/deploy_workflow.py`) that synchronizes, activates, and verifies the workflow:

```bash
# 1. Ensure N8N_URL and N8N_API_KEY are configured in .env
cat .env

# 2. Execute the deployment script
python3 n8n/deploy_workflow.py
```

**Script Actions**:
1. Connects to `N8N_URL` using `N8N_API_KEY`.
2. Searches for an existing workflow named `Corporate Banking RM Job Hunter`.
3. Creates or updates the workflow schema (sanitizing parameters for n8n API compliance).
4. Activates the workflow.
5. Sends a test request to `/webhook/fetch-jobs?location=Mumbai&segment=Large%20Corporate`.
6. Validates HTTP 200 status, CORS header (`Access-Control-Allow-Origin: *`), and structured job schema.

**CLI Options**:
```bash
python3 n8n/deploy_workflow.py --help
python3 n8n/deploy_workflow.py --test-only       # Skip deploy, verify live webhook only
python3 n8n/deploy_workflow.py --env .env.custom # Use custom credentials file
```

### Method B: Manual Import via n8n Web Console
1. Open your self-hosted n8n Web GUI (e.g., `https://your-n8n-instance.com`).
2. Click **Workflows** in the left sidebar $\rightarrow$ Click the **Add Workflow** button (or **...** menu in top right).
3. Select **Import from File** $\rightarrow$ Choose `n8n/rm_job_hunter_workflow.json`.
4. Click **Save** in the top-right corner.
5. Toggle the **Active** switch in the top toolbar to **On**.
6. Note the Production Webhook URL from the Webhook node: `https://your-n8n-instance.com/webhook/fetch-jobs`.

### Testing the Live Webhook
Verify endpoint connectivity using `curl`:
```bash
curl -s "https://your-n8n-instance.com/webhook/fetch-jobs?location=Mumbai&segment=Large%20Corporate" | jq .
```

Expected response structure:
```json
{
  "status": "success",
  "timestamp": "2026-11-16T23:30:00.000Z",
  "total": 18,
  "fallback_applied": false,
  "jobs": [
    {
      "id": "li-3948210342",
      "title": "Senior Relationship Manager - Large Corporate Banking",
      "organization": "HDFC Bank",
      "location": "Mumbai (BKC)",
      "segment": "Large Corporate",
      "ctc": "₹28 - 42 Lacs P.A.",
      "description": "Lead coverage for tier-1 Indian conglomerates...",
      "directUrl": "https://www.linkedin.com/jobs/view/...",
      "applyEmail": "corporate.recruitment@hdfcbank.com",
      "source": "LinkedIn",
      "postedDate": "1 day ago"
    }
  ]
}
```

---

## 8. Google Cloud Console & OAuth GIS Setup Guide

To enable client-side Google Sign-In and direct Gmail application sending, configure an OAuth 2.0 Web Client ID in the Google Cloud Console:

### Step 1: Create a Google Cloud Project
1. Navigate to the [Google Cloud Console](https://console.cloud.google.com/).
2. Click the project dropdown in the top header $\rightarrow$ Click **New Project**.
3. Name your project (e.g. `corporate-banking-job-hunter`) and click **Create**.

### Step 2: Enable the Gmail API
1. In the left navigation menu, go to **APIs & Services** $\rightarrow$ **Library**.
2. Search for `Gmail API`.
3. Click **Gmail API** $\rightarrow$ Click **Enable**.

### Step 3: Configure the OAuth Consent Screen
1. Go to **APIs & Services** $\rightarrow$ **OAuth consent screen**.
2. Choose **External** user type (or **Internal** if using a Google Workspace organization) $\rightarrow$ Click **Create**.
3. Fill in the required application details:
   - **App name**: `Corporate Banking RM Job Hunter`
   - **User support email**: Your email address
   - **Developer contact information**: Your email address
4. Click **Save and Continue**.
5. Under **Scopes**, click **Add or Remove Scopes**:
   - Manually add or filter for: `https://www.googleapis.com/auth/gmail.send`
   - Description: *Send email on your behalf*
   - Click **Update** $\rightarrow$ Click **Save and Continue**.
6. Under **Test users** (if in Testing mode):
   - Click **Add Users** $\rightarrow$ Enter your Gmail address (and any team members' emails who will use the app).
   - Click **Save and Continue**.

### Step 4: Create OAuth 2.0 Client Credentials
1. Go to **APIs & Services** $\rightarrow$ **Credentials**.
2. Click **+ Create Credentials** $\rightarrow$ Select **OAuth client ID**.
3. Under **Application type**, select **Web application**.
4. Set **Name** to: `Job Hunter Web Client`.
5. Under **Authorized JavaScript origins**, click **+ Add URI** and register:
   - For local development: `http://localhost:5173` and `http://127.0.0.1:5173`
   - For GitHub Pages production: `https://<your-username>.github.io`
6. Under **Authorized redirect URIs**: Leave empty (the Google Identity Services token flow does not require redirect URIs).
7. Click **Create**.
8. Copy the generated **Client ID** (e.g., `681991983557-xxxxxxxxxxxxxxxx.apps.googleusercontent.com`).

### Step 5: Save to Configuration
Add the Client ID to your `.env` file:
```bash
GOOGLE_CLIENT_ID=your_client_id_here.apps.googleusercontent.com
VITE_GOOGLE_CLIENT_ID=your_client_id_here.apps.googleusercontent.com
```

---

## 9. GitHub Pages Deployment via GitHub Actions

The application includes an automated CI/CD deployment pipeline in `.github/workflows/deploy.yml`.

### Deployment Pipeline Workflow (`deploy.yml`)
```yaml
name: Deploy to GitHub Pages

on:
  push:
    branches:
      - main
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: pages
  cancel-in-progress: false

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout repository
        uses: actions/checkout@v4

      - name: Set up Node.js 20
        uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Execute quality gate test suite
        run: node tests/runner.js

      - name: Build static production distribution
        run: npm run build

      - name: Configure GitHub Pages
        uses: actions/configure-pages@v5

      - name: Upload GitHub Pages artifact
        uses: actions/upload-pages-artifact@v3
        with:
          path: './dist'

  deploy:
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    runs-on: ubuntu-latest
    needs: build
    steps:
      - name: Deploy to GitHub Pages
        id: deployment
        uses: actions/deploy-pages@v4
```

### GitHub Repository Setup Steps
1. Push your repository to GitHub:
   ```bash
   git add .
   git commit -m "feat: complete corporate banking RM job hunter application"
   git branch -M main
   git remote add origin https://github.com/<your-username>/corporate-banking-rm-job-hunt.git
   git push -u origin main
   ```
2. Navigate to your repository on GitHub.
3. Click **Settings** $\rightarrow$ In the left sidebar, click **Pages** (under *Code and automation*).
4. Under **Build and deployment** $\rightarrow$ **Source**, change the dropdown from *Deploy from a branch* to **GitHub Actions**.
5. Once selected, pushing to `main` will automatically trigger the workflow under the **Actions** tab.
6. When the workflow completes, your site is live at:
   ```
   https://<your-username>.github.io/corporate-banking-rm-job-hunt/
   ```

### Verifying GitHub Pages Deployment
- Check that the application loads without 404 errors on script/CSS assets.
- Ensure `vite.config.js` uses `base: './'`.
- Verify that Google Sign-In initializes cleanly (confirming `https://<your-username>.github.io` is listed in your Google Cloud Console Authorized JavaScript Origins).

---

## 10. Security & Privacy Model

- **No Intermediate Servers**: Application emails are sent directly from your browser to Google's API (`gmail.googleapis.com`) using TLS encryption.
- **Client-Side Resume Sandbox**: PDF resumes stored in `IndexedDB` never leave your device unless you explicitly hit "Send Application Email" to a recruiter.
- **CWE-93 & CWE-22 Defenses**: RFC 2822 email generation enforces strict CRLF stripping to neutralize header injection vectors, and attachment names are sanitized against path traversal attacks.
- **Audited Dependencies**: Core logic (matching engine, storage adapters, MIME builder, test runner) utilizes zero third-party npm packages, eliminating supply-chain vulnerabilities.

---

## 11. License

Distributed under the MIT License. See `LICENSE` for details.

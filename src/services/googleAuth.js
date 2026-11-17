/**
 * src/services/googleAuth.js
 * Google Identity Services (GIS) Client-Side Token Client Manager
 */

// Fallback constant from workspace .env
const DEFAULT_CLIENT_ID = '681991983557-3cicgaeq90na5q9c8eg7l0f2g5f2711h.apps.googleusercontent.com';

export const GOOGLE_CLIENT_ID =
  (typeof import.meta !== 'undefined' &&
    import.meta.env &&
    (import.meta.env.VITE_GOOGLE_CLIENT_ID || import.meta.env.GOOGLE_CLIENT_ID)) ||
  DEFAULT_CLIENT_ID;

export const GMAIL_SEND_SCOPE = 'https://www.googleapis.com/auth/gmail.send';
export const TOKEN_STORAGE_KEY = 'jobhunt_gmail_token';

let tokenClient = null;

const getWindow = () => {
  if (typeof window !== 'undefined') return window;
  if (typeof globalThis !== 'undefined' && globalThis.window) return globalThis.window;
  return null;
};

const getLocalStorage = () => {
  if (typeof localStorage !== 'undefined') return localStorage;
  if (typeof globalThis !== 'undefined' && globalThis.localStorage) return globalThis.localStorage;
  return null;
};

/**
 * Polls for Google Identity Services script availability
 */
export function waitForGIS(timeoutMs = 5000) {
  return new Promise((resolve, reject) => {
    const win = getWindow();
    if (win?.google?.accounts?.oauth2) {
      return resolve(win.google.accounts.oauth2);
    }
    if (!win) {
      return reject(new Error('Google Identity Services (GIS) requires a browser environment.'));
    }
    const start = Date.now();
    const interval = setInterval(() => {
      const w = getWindow();
      if (w?.google?.accounts?.oauth2) {
        clearInterval(interval);
        resolve(w.google.accounts.oauth2);
      } else if (Date.now() - start > timeoutMs) {
        clearInterval(interval);
        reject(new Error('Google Identity Services (GIS) script failed to load within timeout.'));
      }
    }, 50);
  });
}

/**
 * Initializes Google OAuth2 Token Client
 */
export async function initGoogleAuth(onAuthSuccess, onAuthError) {
  await waitForGIS();
  const win = getWindow();

  const errorCallback = (err) => {
    if (tokenClient?.error_callback && tokenClient.error_callback !== errorCallback) {
      tokenClient.error_callback(err);
    }
    if (onAuthError) {
      onAuthError(err);
    }
  };

  tokenClient = win.google.accounts.oauth2.initTokenClient({
    client_id: GOOGLE_CLIENT_ID,
    scope: GMAIL_SEND_SCOPE,
    callback: (response) => {
      if (response.error) {
        if (onAuthError) onAuthError(response);
        return;
      }
      const expiresInSeconds = parseInt(response.expires_in, 10) || 3600;
      const tokenPayload = {
        accessToken: response.access_token,
        // 60-second safety margin
        expiresAt: Date.now() + (expiresInSeconds * 1000) - 60000,
        scope: response.scope,
        tokenType: response.token_type || 'Bearer'
      };
      const storage = getLocalStorage();
      if (storage) {
        storage.setItem(TOKEN_STORAGE_KEY, JSON.stringify(tokenPayload));
      }
      if (onAuthSuccess) onAuthSuccess(tokenPayload.accessToken);
    },
    error_callback: errorCallback
  });

  return tokenClient;
}

/**
 * Retrieves valid unexpired access token from localStorage, or null
 */
export function getStoredAccessToken() {
  try {
    const storage = getLocalStorage();
    if (!storage) return null;
    const raw = storage.getItem(TOKEN_STORAGE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (data?.accessToken && data?.expiresAt && Date.now() < data.expiresAt) {
      return data.accessToken;
    }
    // Purge expired token
    clearStoredToken();
  } catch (err) {
    clearStoredToken();
  }
  return null;
}

/**
 * Retrieves detailed token payload from localStorage
 */
export function getStoredTokenInfo() {
  try {
    const storage = getLocalStorage();
    if (!storage) return null;
    const raw = storage.getItem(TOKEN_STORAGE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (data?.accessToken && data?.expiresAt && Date.now() < data.expiresAt) {
      return data;
    }
  } catch (err) {
    clearStoredToken();
  }
  return null;
}

/**
 * Clears cached token from localStorage
 */
export function clearStoredToken() {
  try {
    const storage = getLocalStorage();
    if (storage) {
      storage.removeItem(TOKEN_STORAGE_KEY);
    }
  } catch (err) {
    console.error('Failed to clear token from localStorage:', err);
  }
}

/**
 * Requests an access token via GIS Token Client
 * @param {'' | 'consent' | 'select_account'} promptMode
 * @returns {Promise<string>} Access token
 */
export async function requestGoogleAccessToken(promptMode = '') {
  await waitForGIS();

  if (!tokenClient) {
    await initGoogleAuth();
  }

  return new Promise((resolve, reject) => {
    tokenClient.callback = (response) => {
      if (response.error) {
        reject(new Error(response.error_description || response.error || 'Google authorization rejected'));
        return;
      }
      const expiresInSeconds = parseInt(response.expires_in, 10) || 3600;
      const tokenPayload = {
        accessToken: response.access_token,
        expiresAt: Date.now() + (expiresInSeconds * 1000) - 60000,
        scope: response.scope,
        tokenType: response.token_type || 'Bearer'
      };
      const storage = getLocalStorage();
      if (storage) {
        storage.setItem(TOKEN_STORAGE_KEY, JSON.stringify(tokenPayload));
      }
      resolve(tokenPayload.accessToken);
    };

    tokenClient.error_callback = (err) => {
      if (err?.type === 'popup_failed_to_open') {
        reject(new Error('Browser popup blocked. Please allow popups for Google sign-in.'));
      } else if (err?.type === 'popup_closed') {
        reject(new Error('Google authentication window was closed before completion.'));
      } else {
        reject(new Error(err?.message || 'Unknown error occurred during Google authentication.'));
      }
    };

    tokenClient.requestAccessToken({ prompt: promptMode });
  });
}

/**
 * Revokes Google access token and clears local storage
 */
export function revokeStoredToken() {
  return new Promise((resolve) => {
    let token = null;
    try {
      const storage = getLocalStorage();
      const raw = storage?.getItem(TOKEN_STORAGE_KEY);
      if (raw) token = JSON.parse(raw)?.accessToken;
    } catch {}
    clearStoredToken();
    const win = getWindow();
    if (token && win?.google?.accounts?.oauth2?.revoke) {
      win.google.accounts.oauth2.revoke(token, () => resolve(true));
    } else {
      resolve(true);
    }
  });
}

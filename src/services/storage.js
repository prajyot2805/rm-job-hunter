/**
 * src/services/storage.js
 * Browser persistence for PDF Resume in IndexedDB and Preferences in LocalStorage.
 * Pure Vanilla JS — Zero external npm dependencies.
 */

export const DB_NAME = 'JobHuntDB';
export const DB_VERSION = 1;
export const RESUME_STORE_NAME = 'candidate_files';
export const RESUME_KEY = 'active_resume';
export const PREFERENCES_KEY = 'candidate_preferences';
export const MAX_RESUME_SIZE = 5 * 1024 * 1024; // 5MB

export const DEFAULT_PREFERENCES = {
  candidateName: '',
  candidateEmail: '',
  candidatePhone: '',
  targetLocations: ['Mumbai', 'Delhi NCR', 'Bengaluru'],
  preferredLocations: ['Mumbai', 'Delhi NCR', 'Bengaluru'],
  targetSegments: ['Large Corporate', 'Mid Corporate', 'MNC Banking'],
  preferredSegments: ['Large Corporate', 'Mid Corporate', 'MNC Banking'],
  targetCtcMin: 20,
  minCtc: 20,
  products: ['Working Capital', 'Trade Finance', 'Syndication', 'Forex'],
  preferredProducts: ['Working Capital', 'Trade Finance', 'Syndication', 'Forex']
};

/**
 * Validates PDF resume file extension, MIME type, and size
 * @param {File | Object} file
 * @returns {{ valid: boolean, error: string | null }}
 */
export function validateResumeFile(file) {
  if (!file) return { valid: false, error: 'No file provided' };
  if (file.size === 0) return { valid: false, error: 'Resume attachment is empty (0 bytes)' };
  if (file.size > MAX_RESUME_SIZE) return { valid: false, error: 'File size exceeds 5MB limit' };

  const name = file.name || '';
  const type = file.type || '';
  if (!name.toLowerCase().endsWith('.pdf') || (type && type !== 'application/pdf')) {
    return { valid: false, error: 'Only PDF files are supported' };
  }
  return { valid: true, error: null };
}

/**
 * Opens or upgrades the IndexedDB database
 * @returns {Promise<IDBDatabase>}
 */
export function openDatabase() {
  return new Promise((resolve, reject) => {
    const idb = typeof globalThis !== 'undefined' ? (globalThis.indexedDB || (typeof window !== 'undefined' ? window.indexedDB : null)) : null;
    if (!idb) return reject(new Error('IndexedDB is not supported in this environment'));

    const req = idb.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(RESUME_STORE_NAME)) {
        db.createObjectStore(RESUME_STORE_NAME);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/**
 * Saves candidate resume to IndexedDB
 * @param {File | Object} file
 * @returns {Promise<void>}
 */
export async function saveResume(file) {
  const validation = validateResumeFile(file);
  if (!validation.valid) throw new Error(validation.error);

  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    try {
      const tx = db.transaction(RESUME_STORE_NAME, 'readwrite');
      const store = tx.objectStore(RESUME_STORE_NAME);

      const record = {
        id: RESUME_KEY,
        name: file.name,
        size: file.size,
        type: file.type || 'application/pdf',
        blob: file.blob || file,
        buffer: file.buffer,
        updatedAt: Date.now()
      };

      const putReq = store.put(record, RESUME_KEY);
      putReq.onsuccess = () => resolve();
      putReq.onerror = () => reject(putReq.error);
      tx.onerror = () => reject(tx.error);
    } catch (err) {
      reject(err);
    }
  });
}

/**
 * Retrieves active resume record from IndexedDB
 * @returns {Promise<Object | null>}
 */
export async function getResume() {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    try {
      const tx = db.transaction(RESUME_STORE_NAME, 'readonly');
      const store = tx.objectStore(RESUME_STORE_NAME);
      const getReq = store.get(RESUME_KEY);
      getReq.onsuccess = () => resolve(getReq.result || null);
      getReq.onerror = () => reject(getReq.error);
      tx.onerror = () => reject(tx.error);
    } catch (err) {
      reject(err);
    }
  });
}

/**
 * Deletes active resume from IndexedDB
 * @returns {Promise<void>}
 */
export async function deleteResume() {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    try {
      const tx = db.transaction(RESUME_STORE_NAME, 'readwrite');
      const store = tx.objectStore(RESUME_STORE_NAME);
      const delReq = store.delete(RESUME_KEY);
      delReq.onsuccess = () => resolve();
      delReq.onerror = () => reject(delReq.error);
      tx.onerror = () => reject(tx.error);
    } catch (err) {
      reject(err);
    }
  });
}

/**
 * Saves candidate preference filters to LocalStorage
 * @param {Object} prefs
 */
export function savePreferences(prefs) {
  try {
    const storage = typeof globalThis !== 'undefined' ? (globalThis.localStorage || (typeof window !== 'undefined' ? window.localStorage : null)) : null;
    if (storage) {
      storage.setItem(PREFERENCES_KEY, JSON.stringify(prefs));
    }
  } catch (err) {
    console.error('Failed to save preferences to localStorage:', err);
  }
}

/**
 * Retrieves candidate preferences from LocalStorage, or null
 * @returns {Object | null}
 */
export function getPreferences() {
  try {
    const storage = typeof globalThis !== 'undefined' ? (globalThis.localStorage || (typeof window !== 'undefined' ? window.localStorage : null)) : null;
    if (!storage) return null;
    const raw = storage.getItem(PREFERENCES_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (err) {
    return null;
  }
}

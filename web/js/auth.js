/**
 * Authentication Module
 * HWK QIP Incentive Dashboard V10
 *
 * Depends on: firebase-config.js (must be loaded first)
 * Uses Firebase v10.7.1 compat SDK (firebase.auth() style)
 *
 * Session storage key: 'qip_firebase_session'
 * Session format: { uid, email, displayName, isAdmin, loginTime }
 */

const SESSION_KEY = 'qip_firebase_session';

// Admin emails loaded from Firestore system/config doc.
// Checked asynchronously; hardcoded fallback removed for security.
// Cache TTL: re-fetch admin emails every 30 seconds (was 5 min — too long, caused silent fails after admin list updates).
let _adminEmails = null; // populated by _loadAdminEmails()
let _adminEmailsLoadedAt = 0; // timestamp of last successful load
const _ADMIN_CACHE_TTL_MS = 30 * 1000; // 30 seconds (T16: shortened from 5min to fix silent admin-check failures)

// Store onAuthStateChanged unsubscribe function for cleanup
let _authUnsubscribe = null;

/**
 * Check if user is authenticated.
 * If not authenticated, redirects to auth.html.
 *
 * @returns {Promise<firebase.User>} Resolves with the Firebase user object
 */
function checkAuth() {
    return new Promise(function(resolve, reject) {
        let settled = false;

        // Safety timeout: if auth check takes >10s, redirect to login
        const timeoutId = setTimeout(function() {
            if (settled) return;
            settled = true;
            console.warn('[Auth] checkAuth timed out after 10s');
            window.location.href = 'auth.html';
            reject(new Error('Auth timeout'));
        }, 10000);

        _authUnsubscribe = firebase.auth().onAuthStateChanged(function(user) {
            if (settled) return;

            if (user) {
                // Load admin emails, then update session
                _loadAdminEmails().then(function() {
                    if (settled) return;
                    settled = true;
                    clearTimeout(timeoutId);
                    const sessionData = {
                        uid: user.uid,
                        email: user.email,
                        displayName: user.displayName || user.email,
                        isAdmin: isAdmin(user),
                        loginTime: sessionStorage.getItem(SESSION_KEY)
                            ? JSON.parse(sessionStorage.getItem(SESSION_KEY)).loginTime
                            : new Date().toISOString()
                    };
                    sessionStorage.setItem(SESSION_KEY, JSON.stringify(sessionData));
                    resolve(user);
                }).catch(function(err) {
                    // Admin email load failed — still resolve with user (non-admin)
                    if (settled) return;
                    settled = true;
                    clearTimeout(timeoutId);
                    console.warn('[Auth] _loadAdminEmails failed, continuing as non-admin:', err);
                    resolve(user);
                });
            } else {
                settled = true;
                clearTimeout(timeoutId);
                sessionStorage.removeItem(SESSION_KEY);
                window.location.href = 'auth.html';
                reject(new Error('Not authenticated'));
            }
        });
    });
}

/**
 * Sign in with email and password.
 * On success, stores session info in sessionStorage.
 *
 * @param {string} email - User email address
 * @param {string} password - User password
 * @returns {Promise<firebase.auth.UserCredential>} Resolves with UserCredential
 */
function signIn(email, password) {
    return firebase.auth().signInWithEmailAndPassword(email, password)
        .then(function(userCredential) {
            const user = userCredential.user;
            return _loadAdminEmails().then(function() {
                const sessionData = {
                    uid: user.uid,
                    email: user.email,
                    displayName: user.displayName || user.email,
                    isAdmin: isAdmin(user),
                    loginTime: new Date().toISOString()
                };
                sessionStorage.setItem(SESSION_KEY, JSON.stringify(sessionData));
                return userCredential;
            });
        });
}

/**
 * Sign out the current user.
 * Clears sessionStorage and redirects to auth.html.
 *
 * @returns {Promise<void>}
 */
function signOut() {
    // Clear admin email cache on logout
    _adminEmails = null;
    _adminEmailsLoadedAt = 0;

    return firebase.auth().signOut()
        .then(function() {
            sessionStorage.removeItem(SESSION_KEY);
            window.location.href = 'auth.html';
        })
        .catch(function(error) {
            // Clear session even if Firebase signOut fails
            sessionStorage.removeItem(SESSION_KEY);
            window.location.href = 'auth.html';
        });
}

/**
 * Load admin email list from Firestore system/config document.
 * Caches result in _adminEmails variable for subsequent calls.
 *
 * Firestore path: system/config → { admin_emails: ["email1", "email2"] }
 *
 * @returns {Promise<string[]>} Array of admin email addresses
 */
function _loadAdminEmails() {
    // Return cached if still valid (within TTL)
    if (_adminEmails !== null && (Date.now() - _adminEmailsLoadedAt) < _ADMIN_CACHE_TTL_MS) {
        return Promise.resolve(_adminEmails);
    }

    // Use REST API to read system/config — avoids Firestore SDK WebChannel issues
    const user = firebase.auth().currentUser;
    if (!user) {
        _adminEmails = [];
        return Promise.resolve(_adminEmails);
    }

    return user.getIdToken().then(function(token) {
        const url = (window.FIRESTORE_REST_BASE || 'https://firestore.googleapis.com/v1/projects/hwk-qip-incentive-dashboard/databases/(default)/documents') +
            '/system/config';
        // AbortController timeout: abort fetch after 8 seconds
        const controller = new AbortController();
        const fetchTimeout = setTimeout(function() { controller.abort(); }, 8000);
        return fetch(url, {
            headers: { 'Authorization': 'Bearer ' + token },
            signal: controller.signal
        }).finally(function() { clearTimeout(fetchTimeout); });
    }).then(function(resp) {
        if (!resp.ok) {
            _adminEmails = [];
            return _adminEmails;
        }
        return resp.json();
    }).then(function(json) {
        if (json && json.fields && json.fields.admin_emails && json.fields.admin_emails.arrayValue) {
            _adminEmails = (json.fields.admin_emails.arrayValue.values || []).map(function(v) {
                return v.stringValue || '';
            }).filter(Boolean);
        } else {
            _adminEmails = [];
        }
        _adminEmailsLoadedAt = Date.now();
        return _adminEmails;
    }).catch(function(err) {
        console.warn('[Auth] _loadAdminEmails REST failed:', err);
        // On failure: keep previous cache if available, otherwise empty
        if (_adminEmails === null) _adminEmails = [];
        return _adminEmails;
    });
}

/**
 * Check if a user is admin.
 * Uses cached _adminEmails list (loaded from Firestore).
 * Synchronous check — requires _loadAdminEmails() to have been called first.
 *
 * @param {firebase.User} user - Firebase user object
 * @returns {boolean} True if user email is in admin list
 */
function isAdmin(user) {
    if (!user || !user.email) return false;
    if (!_adminEmails) return false;
    return _adminEmails.indexOf(user.email) !== -1;
}

/**
 * Check auth + admin status. Redirects if not authenticated or not admin.
 * Loads admin emails from Firestore before checking admin status.
 * Used on admin-only pages (e.g., admin.html).
 *
 * @returns {Promise<firebase.User>} Resolves with the Firebase user object if admin
 */
function requireAdmin() {
    return checkAuth().then(function(user) {
        return _loadAdminEmails().then(function() {
            if (!isAdmin(user)) {
                sessionStorage.removeItem(SESSION_KEY);
                window.location.href = 'auth.html';
                return Promise.reject(new Error('Not authorized: admin access required'));
            }
            return user;
        });
    });
}

/**
 * Force-refresh admin cache and verify admin privileges.
 * Use BEFORE any write/mutate operation to prevent silent fails when cache TTL expires
 * or when admin_emails list was updated after this session loaded.
 *
 * @returns {Promise<{ok: boolean, user: firebase.User|null, reason?: string}>}
 *   ok=true → caller proceeds. ok=false → caller MUST abort and surface `reason` to user.
 */
function assertAdminFresh() {
    var user = firebase.auth().currentUser;
    if (!user || !user.email) {
        return Promise.resolve({ ok: false, user: null, reason: 'not_authenticated' });
    }
    // Force cache invalidation so the next _loadAdminEmails() refetches.
    _adminEmailsLoadedAt = 0;
    return _loadAdminEmails().then(function (emails) {
        var ok = Array.isArray(emails) && emails.indexOf(user.email) !== -1;
        return { ok: ok, user: user, reason: ok ? undefined : 'not_admin' };
    }).catch(function (err) {
        console.warn('[Auth] assertAdminFresh failed:', err);
        return { ok: false, user: user, reason: 'check_failed' };
    });
}

// Expose to non-module scripts (auth.js loads before admin-aql-allowances.js).
window.assertAdminFresh = assertAdminFresh;
window.isAdmin = isAdmin;

// Cleanup: unsubscribe onAuthStateChanged listener on page unload
window.addEventListener('beforeunload', function() {
    if (typeof _authUnsubscribe === 'function') _authUnsubscribe();
});

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
var _adminEmails = null; // populated by _loadAdminEmails()

/**
 * Check if user is authenticated.
 * If not authenticated, redirects to auth.html.
 *
 * @returns {Promise<firebase.User>} Resolves with the Firebase user object
 */
function checkAuth() {
    return new Promise(function(resolve, reject) {
        var settled = false;

        // Safety timeout: if auth check takes >10s, use cached session or redirect
        var timeoutId = setTimeout(function() {
            if (settled) return;
            settled = true;
            console.warn('[Auth] checkAuth timed out after 10s');
            var cached = sessionStorage.getItem(SESSION_KEY);
            if (cached) {
                try {
                    var s = JSON.parse(cached);
                    // Return a minimal user-like object from cache
                    resolve({ uid: s.uid, email: s.email, displayName: s.displayName });
                } catch (e) {
                    window.location.href = 'auth.html';
                    reject(new Error('Auth timeout'));
                }
            } else {
                window.location.href = 'auth.html';
                reject(new Error('Auth timeout'));
            }
        }, 10000);

        firebase.auth().onAuthStateChanged(function(user) {
            if (settled) return;

            if (user) {
                // Load admin emails, then update session
                _loadAdminEmails().then(function() {
                    if (settled) return;
                    settled = true;
                    clearTimeout(timeoutId);
                    var sessionData = {
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
            var user = userCredential.user;
            return _loadAdminEmails().then(function() {
                var sessionData = {
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
    if (_adminEmails !== null) return Promise.resolve(_adminEmails);

    // Use REST API to read system/config — avoids Firestore SDK WebChannel issues
    var user = firebase.auth().currentUser;
    if (!user) {
        _adminEmails = [];
        return Promise.resolve(_adminEmails);
    }

    return user.getIdToken().then(function(token) {
        var url = 'https://firestore.googleapis.com/v1/projects/hwk-qip-incentive-dashboard' +
            '/databases/(default)/documents/system/config';
        // AbortController timeout: abort fetch after 8 seconds
        var controller = new AbortController();
        var fetchTimeout = setTimeout(function() { controller.abort(); }, 8000);
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
        return _adminEmails;
    }).catch(function(err) {
        console.warn('[Auth] _loadAdminEmails REST failed:', err);
        _adminEmails = [];
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

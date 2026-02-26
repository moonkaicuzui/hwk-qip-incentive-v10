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
        firebase.auth().onAuthStateChanged(function(user) {
            if (user) {
                // Load admin emails from Firestore, then update session
                _loadAdminEmails().then(function() {
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
                });
            } else {
                // No authenticated user - clear session and redirect
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

    return db.collection('system').doc('config').get()
        .then(function(doc) {
            if (doc.exists && doc.data().admin_emails) {
                _adminEmails = doc.data().admin_emails;
            } else {
                // No Firestore config yet — empty list (no hardcoded fallback)
                _adminEmails = [];
            }
            return _adminEmails;
        })
        .catch(function() {
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

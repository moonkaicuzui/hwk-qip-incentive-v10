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
const ADMIN_EMAIL = 'ksmoon@hsvina.com';

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
                // Update session storage with current user info
                var sessionData = {
                    uid: user.uid,
                    email: user.email,
                    displayName: user.displayName || user.email,
                    isAdmin: user.email === ADMIN_EMAIL,
                    loginTime: sessionStorage.getItem(SESSION_KEY)
                        ? JSON.parse(sessionStorage.getItem(SESSION_KEY)).loginTime
                        : new Date().toISOString()
                };
                sessionStorage.setItem(SESSION_KEY, JSON.stringify(sessionData));
                resolve(user);
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
            var sessionData = {
                uid: user.uid,
                email: user.email,
                displayName: user.displayName || user.email,
                isAdmin: user.email === ADMIN_EMAIL,
                loginTime: new Date().toISOString()
            };
            sessionStorage.setItem(SESSION_KEY, JSON.stringify(sessionData));
            return userCredential;
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
 * Check if a user is admin.
 *
 * @param {firebase.User} user - Firebase user object
 * @returns {boolean} True if user email matches admin email
 */
function isAdmin(user) {
    return user && user.email === ADMIN_EMAIL;
}

/**
 * Check auth + admin status. Redirects if not authenticated or not admin.
 * Used on admin-only pages (e.g., admin.html).
 *
 * @returns {Promise<firebase.User>} Resolves with the Firebase user object if admin
 */
function requireAdmin() {
    return checkAuth().then(function(user) {
        if (!isAdmin(user)) {
            // Authenticated but not admin - redirect to auth page
            sessionStorage.removeItem(SESSION_KEY);
            window.location.href = 'auth.html';
            return Promise.reject(new Error('Not authorized: admin access required'));
        }
        return user;
    });
}

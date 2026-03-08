/**
 * Firebase Configuration Module
 * HWK QIP Incentive Dashboard V10
 *
 * Uses Firebase v10.7.1 compat SDK (loaded via CDN in HTML)
 * Required CDN scripts in HTML (before this file):
 *   - firebase-app-compat.js
 *   - firebase-auth-compat.js
 *   - firebase-firestore-compat.js (optional — only needed for admin/feedback pages)
 */

// Firebase configuration
var firebaseConfig = {
    apiKey: "AIzaSyDzdmX9kBbeSIX1ROvvNcfu2CzFvnnz3oY",
    authDomain: "hwk-qip-incentive-dashboard.firebaseapp.com",
    projectId: "hwk-qip-incentive-dashboard",
    storageBucket: "hwk-qip-incentive-dashboard.firebasestorage.app"
};

// Initialize Firebase (guard against double-init)
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}

// Auth is always available
var auth = firebase.auth();

// Firestore REST API base URL (centralized - used by auth.js, dashboard-data.js, etc.)
var FIRESTORE_REST_BASE = 'https://firestore.googleapis.com/v1/projects/' + firebaseConfig.projectId + '/databases/(default)/documents';
window.FIRESTORE_REST_BASE = FIRESTORE_REST_BASE;

// Firestore SDK is optional — dashboard.html uses REST API instead.
// Only admin.html and feedback.html need the SDK.
var db = null;
try {
    if (typeof firebase.firestore === 'function') {
        db = firebase.firestore();
        db.settings({ experimentalForceLongPolling: true });
    }
} catch (e) {
    console.warn('[Config] Firestore SDK init skipped:', e.message);
}

/**
 * Firebase Configuration Module
 * HWK QIP Incentive Dashboard V10
 *
 * Uses Firebase v10.7.1 compat SDK (loaded via CDN in HTML)
 * Required CDN scripts in HTML (before this file):
 *   - firebase-app-compat.js
 *   - firebase-auth-compat.js
 *   - firebase-firestore-compat.js
 */

// Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyDzdmX9kBbeSIX1ROvvNcfu2CzFvnnz3oY",
    authDomain: "hwk-qip-incentive-dashboard.firebaseapp.com",
    projectId: "hwk-qip-incentive-dashboard",
    storageBucket: "hwk-qip-incentive-dashboard.firebasestorage.app"
};

// Initialize Firebase (guard against double-init)
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}

// Export instances
const auth = firebase.auth();
const db = firebase.firestore();

// Force HTTP long polling instead of WebChannel (gRPC-Web).
// WebChannel fails on certain networks/proxies/firewalls causing infinite loading.
// Long polling is slower but universally compatible.
db.settings({
    experimentalForceLongPolling: true,
    merge: true
});

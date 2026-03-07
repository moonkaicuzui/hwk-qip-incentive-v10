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

// Initialize Firebase
firebase.initializeApp(firebaseConfig);

// Export instances
const auth = firebase.auth();
const db = firebase.firestore();

// Fix WebChannel connection failures — auto-detect and fallback to long polling
// when gRPC-Web (WebChannel) transport is blocked by network/proxy/firewall
db.settings({
    experimentalAutoDetectLongPolling: true,
    cacheSizeBytes: firebase.firestore.CACHE_SIZE_UNLIMITED
});

// Enable offline persistence for resilience
db.enablePersistence({ synchronizeTabs: true }).catch(function(err) {
    if (err.code === 'failed-precondition') {
        // Multiple tabs open — persistence can only be enabled in one tab
        console.warn('[Firebase] Persistence failed: multiple tabs open');
    } else if (err.code === 'unimplemented') {
        // Browser doesn't support persistence
        console.warn('[Firebase] Persistence not supported in this browser');
    }
});

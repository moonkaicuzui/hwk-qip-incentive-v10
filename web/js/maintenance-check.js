/**
 * Maintenance Mode Checker
 * HWK QIP Incentive Dashboard V10
 *
 * Firestore `config/system` 문서의 `maintenanceMode` 필드를 감시하여
 * 점검 모드 시 전체 화면 오버레이를 표시합니다.
 *
 * Admin (Firestore admin_emails 목록)은 bypass되며, 상단 배너만 표시됩니다.
 * Fallback: ksmoon@hsvina.com은 항상 admin bypass.
 *
 * Firestore SDK가 없는 페이지(dashboard.html)에서는 REST API 폴링으로 동작합니다.
 *
 * Depends on: firebase-config.js, auth.js (must be loaded first)
 */

(function() {
    'use strict';

    var FALLBACK_ADMIN_EMAIL = 'ksmoon@hsvina.com';
    var REST_POLL_INTERVAL_MS = 30000; // REST API 폴링 간격 (30초)
    var _overlayEl = null;
    var _bannerEl = null;
    var _pollTimer = null;

    // =========================================================================
    // CSS 스타일 삽입
    // =========================================================================
    function injectStyles() {
        if (document.getElementById('maintenance-styles')) return;
        var style = document.createElement('style');
        style.id = 'maintenance-styles';
        style.textContent = [
            /* 전체 화면 차단 오버레이 */
            '#maintenance-overlay {',
            '  position: fixed;',
            '  inset: 0;',
            '  z-index: 99999;',
            '  background: linear-gradient(135deg, #1e3a5f 0%, #2d5a87 50%, #3a7cb8 100%);',
            '  display: flex;',
            '  flex-direction: column;',
            '  align-items: center;',
            '  justify-content: center;',
            '  color: #fff;',
            '  font-family: "Segoe UI", -apple-system, BlinkMacSystemFont, sans-serif;',
            '  padding: 2rem;',
            '  text-align: center;',
            '}',
            '#maintenance-overlay .maint-icon {',
            '  font-size: 4rem;',
            '  margin-bottom: 1.5rem;',
            '  animation: maint-pulse 2s ease-in-out infinite;',
            '}',
            '#maintenance-overlay h1 {',
            '  font-size: 1.75rem;',
            '  font-weight: 700;',
            '  margin-bottom: 0.75rem;',
            '}',
            '#maintenance-overlay p {',
            '  font-size: 1rem;',
            '  opacity: 0.85;',
            '  max-width: 480px;',
            '  line-height: 1.6;',
            '  margin-bottom: 2rem;',
            '}',
            '#maintenance-overlay .maint-logout-btn {',
            '  padding: 0.6rem 1.5rem;',
            '  border: 2px solid rgba(255,255,255,0.5);',
            '  border-radius: 10px;',
            '  background: rgba(255,255,255,0.1);',
            '  color: #fff;',
            '  font-size: 0.95rem;',
            '  font-weight: 600;',
            '  cursor: pointer;',
            '  transition: all 0.2s ease;',
            '}',
            '#maintenance-overlay .maint-logout-btn:hover {',
            '  background: rgba(255,255,255,0.2);',
            '  border-color: rgba(255,255,255,0.8);',
            '}',
            '@keyframes maint-pulse {',
            '  0%, 100% { transform: scale(1); }',
            '  50% { transform: scale(1.1); }',
            '}',
            /* Admin 배너 */
            '#maintenance-admin-banner {',
            '  position: fixed;',
            '  top: 0;',
            '  left: 0;',
            '  right: 0;',
            '  z-index: 99998;',
            '  background: linear-gradient(90deg, #f59e0b, #d97706);',
            '  color: #fff;',
            '  text-align: center;',
            '  padding: 0.5rem 1rem;',
            '  font-size: 0.85rem;',
            '  font-weight: 600;',
            '  font-family: "Segoe UI", sans-serif;',
            '  box-shadow: 0 2px 8px rgba(0,0,0,0.15);',
            '}'
        ].join('\n');
        document.head.appendChild(style);
    }

    // =========================================================================
    // 오버레이 DOM 생성 (일반 사용자용)
    // =========================================================================
    function showOverlay(message) {
        if (_overlayEl) return;
        injectStyles();

        _overlayEl = document.createElement('div');
        _overlayEl.id = 'maintenance-overlay';
        _overlayEl.innerHTML = [
            '<div class="maint-icon">&#x1F6E0;&#xFE0F;</div>',
            '<h1>System Maintenance</h1>',
            '<p>' + escapeHtml(message || 'The system is currently undergoing scheduled maintenance. Please try again later.') + '</p>',
            '<button class="maint-logout-btn" id="maint-logout-btn">&#x23FB; Logout</button>'
        ].join('');

        document.body.appendChild(_overlayEl);

        document.getElementById('maint-logout-btn').addEventListener('click', function() {
            if (typeof signOut === 'function') {
                signOut();
            } else {
                firebase.auth().signOut().then(function() {
                    window.location.href = 'auth.html';
                });
            }
        });
    }

    function removeOverlay() {
        if (_overlayEl) {
            _overlayEl.remove();
            _overlayEl = null;
        }
    }

    // =========================================================================
    // Admin 배너
    // =========================================================================
    function showAdminBanner() {
        if (_bannerEl) return;
        injectStyles();

        _bannerEl = document.createElement('div');
        _bannerEl.id = 'maintenance-admin-banner';
        _bannerEl.textContent = '*** MAINTENANCE MODE ACTIVE — You have admin bypass ***';
        document.body.appendChild(_bannerEl);
    }

    function removeAdminBanner() {
        if (_bannerEl) {
            _bannerEl.remove();
            _bannerEl = null;
        }
    }

    // =========================================================================
    // HTML 이스케이프
    // =========================================================================
    function escapeHtml(str) {
        if (!str) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    // =========================================================================
    // Admin 여부 판단
    // =========================================================================
    function isCurrentUserAdmin() {
        var user = firebase.auth().currentUser;
        if (!user || !user.email) return false;
        // auth.js의 isAdmin 함수가 있으면 사용 (Firestore admin_emails 기반)
        if (typeof isAdmin === 'function') {
            return isAdmin(user);
        }
        // Fallback: 하드코딩된 admin 이메일
        return user.email === FALLBACK_ADMIN_EMAIL;
    }

    // =========================================================================
    // 점검 모드 상태 처리
    // =========================================================================
    function handleMaintenanceState(isMaintenanceMode, message) {
        if (!isMaintenanceMode) {
            removeOverlay();
            removeAdminBanner();
            return;
        }

        if (isCurrentUserAdmin()) {
            removeOverlay();
            showAdminBanner();
        } else {
            removeAdminBanner();
            showOverlay(message);
        }
    }

    // =========================================================================
    // 방법 1: Firestore SDK onSnapshot (실시간)
    // =========================================================================
    function startFirestoreWatch() {
        db.doc('config/system').onSnapshot(function(doc) {
            if (!doc.exists) {
                handleMaintenanceState(false, '');
                return;
            }
            var data = doc.data();
            handleMaintenanceState(
                data && data.maintenanceMode === true,
                data && data.maintenanceMessage || ''
            );
        }, function(error) {
            console.warn('[Maintenance] Snapshot error, falling back to REST polling:', error);
            startRestPolling();
        });
    }

    // =========================================================================
    // 방법 2: REST API 폴링 (Firestore SDK 없는 페이지용)
    // =========================================================================
    function checkMaintenanceViaRest() {
        var user = firebase.auth().currentUser;
        if (!user) return;

        user.getIdToken().then(function(token) {
            var baseUrl = window.FIRESTORE_REST_BASE ||
                'https://firestore.googleapis.com/v1/projects/' +
                (window.firebaseConfig ? window.firebaseConfig.projectId : 'hwk-qip-incentive-dashboard') +
                '/databases/(default)/documents';
            var url = baseUrl + '/config/system';

            var controller = new AbortController();
            var timeout = setTimeout(function() { controller.abort(); }, 8000);

            return fetch(url, {
                headers: { 'Authorization': 'Bearer ' + token },
                signal: controller.signal
            }).finally(function() { clearTimeout(timeout); });
        }).then(function(resp) {
            if (!resp || !resp.ok) {
                handleMaintenanceState(false, '');
                return;
            }
            return resp.json();
        }).then(function(json) {
            if (!json || !json.fields) {
                handleMaintenanceState(false, '');
                return;
            }
            var fields = json.fields;
            var isMaintenanceMode = fields.maintenanceMode &&
                fields.maintenanceMode.booleanValue === true;
            var message = (fields.maintenanceMessage &&
                fields.maintenanceMessage.stringValue) || '';
            handleMaintenanceState(isMaintenanceMode, message);
        }).catch(function(err) {
            console.warn('[Maintenance] REST check failed:', err);
        });
    }

    function startRestPolling() {
        if (_pollTimer) return;
        // 즉시 1회 체크
        checkMaintenanceViaRest();
        // 30초마다 반복
        _pollTimer = setInterval(checkMaintenanceViaRest, REST_POLL_INTERVAL_MS);
    }

    // =========================================================================
    // 초기화
    // =========================================================================
    if (window.location.pathname.indexOf('auth.html') === -1) {
        firebase.auth().onAuthStateChanged(function(user) {
            if (user) {
                // db가 있으면 실시간 감시, 없으면 REST 폴링
                if (typeof db !== 'undefined' && db !== null) {
                    startFirestoreWatch();
                } else {
                    startRestPolling();
                }
            }
        });
    }

    // 페이지 언로드 시 폴링 정리
    window.addEventListener('beforeunload', function() {
        if (_pollTimer) {
            clearInterval(_pollTimer);
            _pollTimer = null;
        }
    });
})();

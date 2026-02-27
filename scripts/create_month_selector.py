#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
월 선택 페이지 생성 스크립트
Modern Card Grid - Dark Theme (2026-01-14)
모든 월의 대시보드를 선택할 수 있는 메인 페이지 생성
"""

import os
import glob
from datetime import datetime

def create_month_selector_page():
    """월 선택 페이지 HTML 생성 - Modern Card Grid Dark Theme"""

    # docs 디렉토리의 HTML 파일 찾기
    html_files = glob.glob("docs/Incentive_Dashboard_*.html")

    # 파일 정보 추출
    dashboards = []
    for file in html_files:
        try:
            filename = os.path.basename(file)
            # Incentive_Dashboard_2025_11_Version_9.0.html 형식 파싱
            parts = filename.replace('.html', '').split('_')
            year = int(parts[2])
            month = int(parts[3])

            # Version 파싱 (예: Version_9.0 → 9.0)
            version_str = '0.0'
            if len(parts) >= 5 and parts[4] == 'Version':
                version_str = parts[5] if len(parts) > 5 else '0.0'

            month_names = ['', 'January', 'February', 'March', 'April', 'May', 'June',
                          'July', 'August', 'September', 'October', 'November', 'December']
            month_name = month_names[month] if 1 <= month <= 12 else str(month)

            # V10.0 데이터만 표시: 2025년 12월부터 (Approved Leave Days 버그 수정 버전) - 2026-01-02
            # 2025년 11월 이하 및 2025년 이전 숨김 (V9.0 데이터) - Issue #52 (2026-01-15)
            if (year < 2025) or (year == 2025 and month < 12):
                continue
            # 8월(August) 제외 (다른 해도 적용)
            if month == 8:
                continue

            dashboards.append({
                'filename': filename,
                'year': year,
                'month': month,
                'month_name': month_name,
                'version': version_str,
                'sort_key': year * 100 + month
            })
        except Exception as e:
            print(f"⚠️ 파일 파싱 실패 {file}: {e}")
            continue

    # 중복 제거: 동일한 year/month에서 가장 높은 버전만 선택
    unique_dashboards = {}
    for dashboard in dashboards:
        key = (dashboard['year'], dashboard['month'])
        if key not in unique_dashboards:
            unique_dashboards[key] = dashboard
        else:
            # 버전 비교 (9.0 > 8.02 > 8.01)
            current_version = tuple(map(float, dashboard['version'].split('.')))
            existing_version = tuple(map(float, unique_dashboards[key]['version'].split('.')))
            if current_version > existing_version:
                unique_dashboards[key] = dashboard

    # 리스트로 변환 및 정렬 (최신 순)
    dashboards = list(unique_dashboards.values())
    dashboards.sort(key=lambda x: x['sort_key'], reverse=True)

    # HTML 생성 - Modern Card Grid Dark Theme
    html_content = """<!DOCTYPE html>
<html lang="ko">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="apple-mobile-web-app-capable" content="yes">
    <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
    <!-- 검색엔진 차단 -->
    <meta name="robots" content="noindex, nofollow, noarchive, nosnippet">
    <meta name="googlebot" content="noindex, nofollow">
    <meta name="bingbot" content="noindex, nofollow">
    <title data-i18n="page-title">QIP 인센티브 대시보드 - 월 선택</title>
    <link rel="icon" type="image/svg+xml" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect width='32' height='32' rx='6' fill='%231e3a5f'/%3E%3Ctext x='16' y='23' text-anchor='middle' fill='white' font-size='20' font-family='Arial'%3EQ%3C/text%3E%3C/svg%3E">

    <!-- Bootstrap 5 CSS -->
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.1.3/dist/css/bootstrap.min.css" rel="stylesheet">
    <!-- Font Awesome for icons -->
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">

    <style>
        /* ==========================================
           Modern Card Grid - Dark Theme (2026-01-14)
           ========================================== */

        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            background: #0f172a;
            min-height: 100vh;
            font-family: 'Segoe UI', -apple-system, BlinkMacSystemFont, 'Roboto', sans-serif;
            color: #e2e8f0;
        }

        /* 언어 선택 버튼 */
        .lang-selector {
            position: fixed;
            top: 20px;
            right: 20px;
            display: flex;
            gap: 5px;
            background: rgba(30, 41, 59, 0.8);
            padding: 6px;
            border-radius: 30px;
            backdrop-filter: blur(10px);
            z-index: 1000;
            border: 1px solid rgba(99, 102, 241, 0.3);
        }

        .lang-btn {
            padding: 8px 16px;
            border: none;
            background: transparent;
            color: #94a3b8;
            font-size: 0.85rem;
            font-weight: 600;
            border-radius: 20px;
            cursor: pointer;
            transition: all 0.3s ease;
        }

        .lang-btn:hover {
            color: #e2e8f0;
            background: rgba(99, 102, 241, 0.2);
        }

        .lang-btn.active {
            background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
            color: white;
        }

        .container {
            max-width: 1200px;
            padding: 20px;
            margin: 0 auto;
        }

        /* 헤더 섹션 */
        .header {
            text-align: center;
            color: #e2e8f0;
            margin-bottom: 50px;
            padding-top: 60px;
            animation: fadeInDown 0.6s ease-out;
        }

        .header h1 {
            font-size: 2.8rem;
            font-weight: 700;
            margin-bottom: 12px;
            background: linear-gradient(135deg, #60a5fa 0%, #a78bfa 50%, #f472b6 100%);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
        }

        .header p {
            font-size: 1.1rem;
            color: #94a3b8;
        }

        /* 동기화 정보 - 미니멀 인라인 */
        .sync-info {
            display: flex;
            justify-content: center;
            align-items: center;
            gap: 20px;
            color: #64748b;
            font-size: 0.9rem;
            margin-bottom: 40px;
            flex-wrap: wrap;
        }

        .sync-info .sync-text {
            display: flex;
            align-items: center;
            gap: 8px;
        }

        .sync-info .sync-icon {
            color: #22c55e;
        }

        .sync-info .sync-divider {
            color: #334155;
        }

        .sync-info .update-btn {
            background: rgba(99, 102, 241, 0.15);
            border: 1px solid rgba(99, 102, 241, 0.4);
            color: #a5b4fc;
            padding: 6px 16px;
            border-radius: 20px;
            font-size: 0.85rem;
            font-weight: 500;
            cursor: pointer;
            transition: all 0.3s ease;
        }

        .sync-info .update-btn:hover {
            background: rgba(99, 102, 241, 0.3);
            border-color: #6366f1;
            color: white;
            transform: translateY(-2px);
        }

        /* 카드 그리드 레이아웃 */
        .month-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
            gap: 24px;
            margin-bottom: 60px;
        }

        /* 모던 다크 카드 */
        .month-card {
            background: linear-gradient(145deg, #1e293b 0%, #334155 100%);
            border-radius: 20px;
            padding: 28px;
            border-top: 3px solid;
            border-image: linear-gradient(90deg, #6366f1 0%, #8b5cf6 50%, #a855f7 100%) 1;
            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
            transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1);
            cursor: pointer;
            text-decoration: none;
            color: inherit;
            display: block;
            position: relative;
            overflow: hidden;
        }

        .month-card::before {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: radial-gradient(circle at top right, rgba(99, 102, 241, 0.1) 0%, transparent 50%);
            pointer-events: none;
        }

        .month-card:hover {
            transform: translateY(-8px);
            box-shadow: 0 20px 40px rgba(99, 102, 241, 0.2), 0 8px 16px rgba(0, 0, 0, 0.4);
            text-decoration: none;
            color: inherit;
        }

        .month-card:hover .view-arrow {
            transform: translateX(5px);
        }

        /* 카드 상단 영역 */
        .card-header-row {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            margin-bottom: 20px;
        }

        /* 큰 월 숫자 */
        .month-number {
            font-size: 56px;
            font-weight: 800;
            line-height: 1;
            background: linear-gradient(135deg, #60a5fa 0%, #a78bfa 100%);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
        }

        .month-suffix {
            font-size: 20px;
            font-weight: 600;
            color: #64748b;
            margin-left: 4px;
            vertical-align: top;
        }

        /* NEW 배지 */
        .status-badge {
            display: inline-flex;
            align-items: center;
            gap: 4px;
            padding: 6px 14px;
            border-radius: 20px;
            font-size: 0.75rem;
            font-weight: 700;
            letter-spacing: 0.5px;
            text-transform: uppercase;
        }

        .status-new {
            background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%);
            color: white;
            box-shadow: 0 4px 12px rgba(34, 197, 94, 0.3);
        }

        .status-updated {
            background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
            color: white;
            box-shadow: 0 4px 12px rgba(245, 158, 11, 0.3);
        }

        /* 기준 업데이트 배지 (Issue #58) */
        .criteria-badge {
            display: inline-flex;
            align-items: center;
            gap: 5px;
            padding: 5px 12px;
            border-radius: 20px;
            font-size: 0.72rem;
            font-weight: 600;
            letter-spacing: 0.3px;
            margin-top: 8px;
        }

        .criteria-before {
            background: rgba(100, 116, 139, 0.2);
            color: #94a3b8;
            border: 1px solid rgba(100, 116, 139, 0.3);
        }

        .criteria-after {
            background: rgba(34, 197, 94, 0.15);
            color: #4ade80;
            border: 1px solid rgba(34, 197, 94, 0.3);
            animation: pulseGreen 2s ease-in-out infinite;
        }

        @keyframes pulseGreen {
            0%, 100% { box-shadow: 0 0 0 0 rgba(34, 197, 94, 0); }
            50% { box-shadow: 0 0 8px 2px rgba(34, 197, 94, 0.2); }
        }

        /* 카드 정보 */
        .card-info {
            margin-bottom: 20px;
        }

        .month-year-text {
            font-size: 1.4rem;
            font-weight: 600;
            color: #f1f5f9;
            margin-bottom: 6px;
        }

        .month-subtitle {
            font-size: 0.9rem;
            color: #64748b;
            display: flex;
            align-items: center;
            gap: 8px;
        }

        .month-subtitle i {
            color: #22c55e;
            font-size: 0.8rem;
        }

        /* View 버튼 */
        .view-btn-container {
            display: flex;
            justify-content: flex-end;
            align-items: center;
        }

        .view-btn {
            background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
            color: white;
            border: none;
            padding: 12px 28px;
            border-radius: 12px;
            font-weight: 600;
            font-size: 0.95rem;
            display: inline-flex;
            align-items: center;
            gap: 8px;
            box-shadow: 0 4px 15px rgba(99, 102, 241, 0.4);
            transition: all 0.3s ease;
        }

        .view-btn:hover {
            box-shadow: 0 6px 20px rgba(99, 102, 241, 0.5);
        }

        .view-arrow {
            transition: transform 0.3s ease;
        }

        /* 푸터 */
        .footer-section {
            text-align: center;
            padding: 40px 20px;
            color: #64748b;
            font-size: 0.9rem;
        }

        .footer-section p {
            margin-bottom: 12px;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
        }

        .footer-section i {
            font-size: 1rem;
        }

        /* 애니메이션 */
        @keyframes fadeInDown {
            from {
                opacity: 0;
                transform: translateY(-20px);
            }
            to {
                opacity: 1;
                transform: translateY(0);
            }
        }

        @keyframes fadeInUp {
            from {
                opacity: 0;
                transform: translateY(20px);
            }
            to {
                opacity: 1;
                transform: translateY(0);
            }
        }

        .month-card {
            animation: fadeInUp 0.5s ease-out forwards;
            opacity: 0;
        }

        /* 반응형 디자인 */
        @media (max-width: 768px) {
            .lang-selector {
                top: 10px;
                right: 10px;
                padding: 4px;
            }

            .lang-btn {
                padding: 6px 12px;
                font-size: 0.75rem;
            }

            .header {
                padding-top: 70px;
                margin-bottom: 30px;
            }

            .header h1 {
                font-size: 2rem;
            }

            .header p {
                font-size: 1rem;
            }

            .month-grid {
                grid-template-columns: 1fr;
                gap: 16px;
            }

            .month-card {
                padding: 24px;
            }

            .month-number {
                font-size: 48px;
            }

            .container {
                padding: 15px;
            }

            .sync-info {
                flex-direction: column;
                gap: 12px;
                font-size: 0.85rem;
            }

            .sync-info .sync-divider {
                display: none;
            }
        }

        @media (max-width: 480px) {
            .view-btn {
                width: 100%;
                justify-content: center;
                padding: 14px;
            }

            .month-number {
                font-size: 42px;
            }
        }

        /* 태블릿 (2열 그리드) */
        @media (min-width: 769px) and (max-width: 1024px) {
            .month-grid {
                grid-template-columns: repeat(2, 1fr);
            }
        }
    </style>
</head>
<body style="visibility: hidden;">
    <!-- 언어 선택 버튼 -->
    <div class="lang-selector">
        <button class="lang-btn active" data-lang="ko" onclick="switchLanguage('ko')">한국어</button>
        <button class="lang-btn" data-lang="en" onclick="switchLanguage('en')">English</button>
        <button class="lang-btn" data-lang="vi" onclick="switchLanguage('vi')">Tiếng Việt</button>
    </div>

    <div class="container">
        <!-- 헤더 -->
        <div class="header">
            <h1 data-i18n="header-title">QIP 인센티브 대시보드</h1>
            <p data-i18n="header-subtitle">원하시는 월을 선택하세요</p>
        </div>

        <!-- 동기화 정보 -->
        <div class="sync-info">
            <span class="sync-text">
                <i class="fas fa-sync-alt sync-icon"></i>
                <span data-i18n="sync-auto">매시간 자동 동기화</span>
            </span>
            <span class="sync-divider">•</span>
            <span class="sync-text">
                <span data-i18n="sync-last">최근:</span>
                <span>""" + datetime.now().strftime('%Y-%m-%d %H:%M') + """</span>
            </span>
            <button class="update-btn" onclick="triggerManualUpdate()">
                <i class="fas fa-refresh"></i>
                <span data-i18n="sync-update">업데이트</span>
            </button>
        </div>

        <!-- 월 선택 그리드 -->
        <div class="month-grid">
"""

    # 각 월별 카드 추가
    for i, dashboard in enumerate(dashboards):
        # 최신 2개월은 NEW 배지
        badge_html = '''<span class="status-badge status-new">
                        <i class="fas fa-star"></i>
                        <span data-i18n="badge-new">NEW</span>
                    </span>''' if i < 2 else ''

        # [Issue #58] 기준 업데이트 전/후 배지
        y, m = dashboard['year'], dashboard['month']
        criteria_badge = ''
        if (y == 2025 and m == 12) or (y == 2026 and m == 1):
            criteria_badge = '<div class="criteria-badge criteria-before"><i class="fas fa-history"></i> <span data-i18n="criteria-before">기준 업데이트 전</span></div>'
        elif y > 2026 or (y == 2026 and m >= 2):
            criteria_badge = '<div class="criteria-badge criteria-after"><i class="fas fa-arrow-up"></i> <span data-i18n="criteria-after">기준 업데이트 후</span></div>'

        # 애니메이션 지연
        animation_delay = i * 0.1

        # Month-specific translation key
        month_i18n_key = f"month-{dashboard['month']}"

        html_content += f"""
            <!-- {dashboard['month_name']} {dashboard['year']} Card -->
            <a href="{dashboard['filename']}" class="month-card" style="animation-delay: {animation_delay}s;" data-year="{dashboard['year']}" data-month="{dashboard['month']}">
                <div class="card-header-row">
                    <div>
                        <span class="month-number">{dashboard['month']}</span><span class="month-suffix" data-i18n="month-suffix">월</span>
                    </div>
                    {badge_html}
                </div>
                <div class="card-info">
                    <div class="month-year-text">
                        <span data-lang-show="ko"><span class="year-text">{dashboard['year']}</span><span data-i18n="year-suffix">년</span> <span>{dashboard['month']}</span><span data-i18n="month-suffix">월</span></span>
                        <span data-i18n="{month_i18n_key}" data-lang-hide="ko">{dashboard['month_name']} {dashboard['year']}</span>
                    </div>
                    {criteria_badge}
                    <div class="month-subtitle">
                        <i class="fas fa-check-circle"></i>
                        <span data-i18n="month-subtitle">최신 평가 데이터 • 업데이트됨</span>
                    </div>
                </div>
                <div class="view-btn-container">
                    <span class="view-btn">
                        <span data-i18n="view-btn">보기</span>
                        <i class="fas fa-arrow-right view-arrow"></i>
                    </span>
                </div>
            </a>
"""

    html_content += """
        </div>

        <!-- 푸터 -->
        <div class="footer-section">
            <p>
                <i class="fas fa-shield-alt"></i>
                <span data-i18n="footer-security">모든 데이터는 안전하게 보호됩니다</span>
            </p>
        </div>
    </div>

    <!-- Bootstrap JS -->
    <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.1.3/dist/js/bootstrap.bundle.min.js"></script>

    <!-- Firebase SDK for real-time auth verification (Issue #59) -->
    <script src="https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js"></script>
    <script src="https://www.gstatic.com/firebasejs/10.7.1/firebase-auth-compat.js"></script>

    <script>
        // ==================== 강화된 Firebase 보안: 세션 검증 v2.0 ====================
        // Issue #59: 보안 강화 (2026-02-03)
        (function() {
            const SESSION_KEY = 'qip_firebase_session';
            const SESSION_TIMEOUT = 30 * 60 * 1000; // 30분 (보안 강화)
            const INACTIVITY_TIMEOUT = 15 * 60 * 1000; // 15분 비활동 시 로그아웃
            let lastActivityTime = Date.now();
            let inactivityTimer = null;

            // Firebase Configuration
            const firebaseConfig = {
                apiKey: "AIzaSyDzdmX9kBbeSIX1ROvvNcfu2CzFvnnz3oY",
                authDomain: "hwk-qip-incentive-dashboard.firebaseapp.com",
                projectId: "hwk-qip-incentive-dashboard",
                storageBucket: "hwk-qip-incentive-dashboard.firebasestorage.app",
                messagingSenderId: "435191241966",
                appId: "1:435191241966:web:fc8d3382d8189dc11d67ff"
            };

            // Initialize Firebase
            if (!firebase.apps.length) {
                firebase.initializeApp(firebaseConfig);
            }

            // 브라우저 핑거프린트 생성 (세션 서명용)
            function generateFingerprint() {
                const data = [
                    navigator.userAgent,
                    navigator.language,
                    screen.width + 'x' + screen.height,
                    new Date().getTimezoneOffset()
                ].join('|');
                let hash = 0;
                for (let i = 0; i < data.length; i++) {
                    const char = data.charCodeAt(i);
                    hash = ((hash << 5) - hash) + char;
                    hash = hash & hash;
                }
                return hash.toString(36);
            }

            // 세션 서명 검증
            function verifySessionSignature(sessionData) {
                if (!sessionData.signature) return false;
                return sessionData.signature === generateFingerprint();
            }

            // 세션 검증 함수
            function validateSession() {
                const session = sessionStorage.getItem(SESSION_KEY);

                if (!session) {
                    redirectToLogin('NO_SESSION');
                    return false;
                }

                try {
                    const sessionData = JSON.parse(session);
                    const now = Date.now();

                    if (!sessionData.authenticated || !sessionData.uid || !sessionData.email) {
                        redirectToLogin('INVALID_SESSION_DATA');
                        return false;
                    }

                    if (!verifySessionSignature(sessionData)) {
                        redirectToLogin('SIGNATURE_MISMATCH');
                        return false;
                    }

                    if (now - sessionData.loginTime > SESSION_TIMEOUT) {
                        redirectToLogin('SESSION_EXPIRED', true);
                        return false;
                    }

                    return true;
                } catch (e) {
                    redirectToLogin('PARSE_ERROR');
                    return false;
                }
            }

            function redirectToLogin(reason, showAlert = false) {
                sessionStorage.removeItem(SESSION_KEY);
                if (showAlert) {
                    alert('Session expired. Please login again.\\n세션이 만료되었습니다. 다시 로그인하세요.');
                }
                console.warn('[Security] Redirect reason:', reason);
                window.location.href = 'auth.html';
            }

            // 비활동 감지 시스템
            function resetInactivityTimer() {
                lastActivityTime = Date.now();
                if (inactivityTimer) clearTimeout(inactivityTimer);
                inactivityTimer = setTimeout(() => {
                    if (Date.now() - lastActivityTime >= INACTIVITY_TIMEOUT) {
                        alert('Logged out due to inactivity.\\n비활동으로 인해 로그아웃되었습니다.');
                        redirectToLogin('INACTIVITY');
                    }
                }, INACTIVITY_TIMEOUT);
            }

            // 사용자 활동 감지
            ['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart', 'click'].forEach(event => {
                document.addEventListener(event, resetInactivityTimer, { passive: true });
            });

            // 콘텐츠 표시 함수
            function showContent() {
                document.body.style.visibility = 'visible';
                document.body.style.opacity = '1';
            }

            // Firebase 실시간 인증 상태 감시
            firebase.auth().onAuthStateChanged((user) => {
                if (!user) {
                    const session = sessionStorage.getItem(SESSION_KEY);
                    if (session) {
                        console.warn('[Security] Firebase auth state lost');
                        redirectToLogin('FIREBASE_AUTH_LOST');
                    }
                }
            });

            // 페이지 로드 시 세션 검증
            if (!validateSession()) {
                return;
            }

            // 검증 성공 시 콘텐츠 표시
            showContent();
            resetInactivityTimer();

            // 주기적 세션 검증 (30초마다)
            setInterval(() => {
                if (!validateSession()) return;
            }, 30000);

            // 탭/창 활성화 시 즉시 검증
            document.addEventListener('visibilitychange', () => {
                if (document.visibilityState === 'visible') {
                    if (!validateSession()) return;
                    resetInactivityTimer();
                }
            });

            // 우클릭 방지
            document.addEventListener('contextmenu', function(e) {
                e.preventDefault();
                return false;
            });

            // 복사 방지
            document.addEventListener('copy', function(e) {
                console.warn('⚠️ 데이터 복사가 감지되었습니다.');
            });

            // 개발자 도구 경고
            const devtoolsWarning = () => {
                console.clear();
                console.log('%c⛔ SECURITY WARNING / 보안 경고', 'font-size: 30px; color: red; font-weight: bold;');
                console.log('%cThis dashboard contains confidential employee information.', 'font-size: 16px; color: orange;');
                console.log('%c이 대시보드는 기밀 직원 정보를 포함하고 있습니다.', 'font-size: 16px; color: orange;');
                console.log('%cSession: 30min timeout | Inactivity: 15min logout', 'font-size: 12px; color: gray;');
            };

            devtoolsWarning();
            setInterval(devtoolsWarning, 5000);
        })();
        // ==================== 강화된 Firebase 보안 코드 종료 ====================

        // 다국어 번역 데이터
        const translations = {
            ko: {
                'page-title': 'QIP 인센티브 대시보드 - 월 선택',
                'header-title': 'QIP 인센티브 대시보드',
                'header-subtitle': '원하시는 월을 선택하세요',
                'sync-auto': '매시간 자동 동기화',
                'sync-last': '최근:',
                'sync-update': '업데이트',
                'view-btn': '보기',
                'badge-new': 'NEW',
                'footer-security': '모든 데이터는 안전하게 보호됩니다',
                'month-subtitle': '최신 평가 데이터 • 업데이트됨',
                'year-suffix': '년',
                'month-suffix': '월',
                'month-1': '1월',
                'month-2': '2월',
                'month-3': '3월',
                'month-4': '4월',
                'month-5': '5월',
                'month-6': '6월',
                'month-7': '7월',
                'month-8': '8월',
                'month-9': '9월',
                'month-10': '10월',
                'month-11': '11월',
                'month-12': '12월',
                'criteria-before': '기준 업데이트 전',
                'criteria-after': '기준 업데이트 후',
                'months': ['', 'January', 'February', 'March', 'April', 'May', 'June',
                          'July', 'August', 'September', 'October', 'November', 'December']
            },
            en: {
                'page-title': 'QIP Incentive Dashboard - Select Month',
                'header-title': 'QIP Incentive Dashboard',
                'header-subtitle': 'Please select the month you want to view',
                'sync-auto': 'Auto-sync hourly',
                'sync-last': 'Last:',
                'sync-update': 'Update',
                'view-btn': 'View',
                'badge-new': 'NEW',
                'footer-security': 'All data is securely protected',
                'month-subtitle': 'Latest evaluation data • Updated',
                'year-suffix': '',
                'month-suffix': '',
                'month-1': 'January 2026',
                'month-2': 'February 2026',
                'month-3': 'March 2026',
                'month-4': 'April 2026',
                'month-5': 'May 2026',
                'month-6': 'June 2026',
                'month-7': 'July 2025',
                'month-8': 'August 2025',
                'month-9': 'September 2025',
                'month-10': 'October 2025',
                'month-11': 'November 2025',
                'month-12': 'December 2025',
                'criteria-before': 'Before Criteria Update',
                'criteria-after': 'After Criteria Update',
                'months': ['', 'January', 'February', 'March', 'April', 'May', 'June',
                          'July', 'August', 'September', 'October', 'November', 'December']
            },
            vi: {
                'page-title': 'Bảng điều khiển Khuyến khích QIP - Chọn Tháng',
                'header-title': 'Bảng điều khiển Khuyến khích QIP',
                'header-subtitle': 'Vui lòng chọn tháng bạn muốn xem',
                'sync-auto': 'Tự động đồng bộ mỗi giờ',
                'sync-last': 'Gần nhất:',
                'sync-update': 'Cập nhật',
                'view-btn': 'Xem',
                'badge-new': 'MỚI',
                'footer-security': 'Tất cả dữ liệu được bảo vệ an toàn',
                'month-subtitle': 'Dữ liệu đánh giá mới nhất • Đã cập nhật',
                'year-suffix': '',
                'month-suffix': '',
                'month-1': 'Tháng 1 năm 2026',
                'month-2': 'Tháng 2 năm 2026',
                'month-3': 'Tháng 3 năm 2026',
                'month-4': 'Tháng 4 năm 2026',
                'month-5': 'Tháng 5 năm 2026',
                'month-6': 'Tháng 6 năm 2026',
                'month-7': 'Tháng 7 năm 2025',
                'month-8': 'Tháng 8 năm 2025',
                'month-9': 'Tháng 9 năm 2025',
                'month-10': 'Tháng 10 năm 2025',
                'month-11': 'Tháng 11 năm 2025',
                'month-12': 'Tháng 12 năm 2025',
                'criteria-before': 'Trước cập nhật tiêu chí',
                'criteria-after': 'Sau cập nhật tiêu chí',
                'months': ['', 'Tháng 1', 'Tháng 2', 'Tháng 3', 'Tháng 4', 'Tháng 5', 'Tháng 6',
                          'Tháng 7', 'Tháng 8', 'Tháng 9', 'Tháng 10', 'Tháng 11', 'Tháng 12']
            }
        };

        // 언어 전환 함수
        function switchLanguage(lang) {
            // localStorage에 저장
            localStorage.setItem('preferredLanguage', lang);

            // HTML lang 속성 변경
            document.documentElement.lang = lang;

            // 모든 번역 요소 업데이트 (2026-01-11: 빈 문자열도 적용되도록 수정)
            document.querySelectorAll('[data-i18n]').forEach(element => {
                const key = element.getAttribute('data-i18n');
                if (translations[lang] && translations[lang][key] !== undefined) {
                    element.innerHTML = translations[lang][key];
                }
            });

            // 월 카드의 월 이름 업데이트 (data-i18n이 없는 경우만)
            document.querySelectorAll('.month-card').forEach(card => {
                const monthNameElement = card.querySelector('.month-name');
                // data-i18n 속성이 있으면 이미 Lines 434-439에서 처리되었으므로 skip
                if (monthNameElement && !monthNameElement.hasAttribute('data-i18n')) {
                    const month = parseInt(card.getAttribute('data-month'));
                    if (translations[lang] && translations[lang]['months']) {
                        monthNameElement.textContent = translations[lang]['months'][month];
                    }
                }
            });

            // 페이지 타이틀 업데이트
            const titleElement = document.querySelector('title[data-i18n]');
            if (titleElement && translations[lang]) {
                document.title = translations[lang]['page-title'];
            }

            // 언어별 요소 표시/숨김 (data-lang-show 속성)
            document.querySelectorAll('[data-lang-show]').forEach(element => {
                const showLang = element.getAttribute('data-lang-show');
                if (showLang === lang) {
                    element.style.display = ''; // 표시
                } else {
                    element.style.display = 'none'; // 숨김
                }
            });

            // 언어별 요소 숨김 (data-lang-hide 속성)
            document.querySelectorAll('[data-lang-hide]').forEach(element => {
                const hideLang = element.getAttribute('data-lang-hide');
                if (hideLang === lang) {
                    element.style.display = 'none'; // 숨김
                } else {
                    element.style.display = ''; // 표시
                }
            });

            // 활성 버튼 스타일 변경
            document.querySelectorAll('.lang-btn').forEach(btn => {
                btn.classList.remove('active');
            });
            document.querySelector(`.lang-btn[data-lang="${lang}"]`).classList.add('active');

            // 진동 피드백
            if ('vibrate' in navigator) {
                navigator.vibrate(30);
            }
        }

        // 페이지 로드 시 저장된 언어 적용
        document.addEventListener('DOMContentLoaded', function() {
            // 언어 설정 로드
            const savedLang = localStorage.getItem('preferredLanguage') || 'ko';
            switchLanguage(savedLang);
        });

        // 카드 클릭 애니메이션
        document.querySelectorAll('.month-card').forEach(card => {
            card.addEventListener('click', function(e) {
                e.preventDefault();
                this.style.transform = 'scale(0.98)';
                setTimeout(() => {
                    window.location.href = this.href;
                }, 150);
            });
        });

        // 수동 업데이트 트리거 함수
        function triggerManualUpdate() {
            const lang = localStorage.getItem('preferredLanguage') || 'ko';
            const messages = {
                ko: {
                    confirm: 'GitHub Actions 페이지로 이동합니다.\\n\\n1. "Run workflow" 버튼 클릭\\n2. "Run workflow" 녹색 버튼 클릭\\n3. 5-10분 후 대시보드 새로고침\\n\\n계속하시겠습니까?',
                    opened: 'GitHub Actions 페이지가 열렸습니다.\\n\\n"Run workflow" 버튼을 클릭하여 최신 데이터를 가져오세요.'
                },
                en: {
                    confirm: 'Opening GitHub Actions page.\\n\\n1. Click "Run workflow" button\\n2. Click green "Run workflow" button\\n3. Refresh dashboard after 5-10 minutes\\n\\nContinue?',
                    opened: 'GitHub Actions page opened.\\n\\nClick "Run workflow" button to fetch latest data.'
                },
                vi: {
                    confirm: 'Mở trang GitHub Actions.\\n\\n1. Nhấp nút "Run workflow"\\n2. Nhấp nút xanh "Run workflow"\\n3. Làm mới bảng điều khiển sau 5-10 phút\\n\\nTiếp tục?',
                    opened: 'Đã mở trang GitHub Actions.\\n\\nNhấp nút "Run workflow" để lấy dữ liệu mới nhất.'
                }
            };

            if (confirm(messages[lang].confirm)) {
                window.open('https://github.com/moonkaicuzui/qip-dashboard/actions/workflows/auto-update-enhanced.yml', '_blank');
                setTimeout(() => {
                    alert(messages[lang].opened);
                }, 500);
            }
        }
    </script>
</body>
</html>"""

    # 파일 저장
    os.makedirs('docs', exist_ok=True)
    with open('docs/selector.html', 'w', encoding='utf-8') as f:
        f.write(html_content)

    print(f"✅ 월 선택 페이지 생성 완료: docs/selector.html")
    print(f"   {len(dashboards)}개월 대시보드 링크 포함")
    print(f"   🎨 Modern Card Grid - Dark Theme (2026-01-14)")

if __name__ == "__main__":
    create_month_selector_page()

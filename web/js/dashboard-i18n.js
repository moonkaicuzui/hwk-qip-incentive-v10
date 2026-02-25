/**
 * DashboardI18n - Multi-language support module for QIP Incentive Dashboard
 *
 * Supports Korean (ko), English (en), Vietnamese (vi)
 *
 * Usage:
 *   DashboardI18n.init();                    // Initialize with saved language
 *   DashboardI18n.t('tabs.summary');         // Get translation
 *   DashboardI18n.tWithThresholds('key');    // Get translation with threshold replacement
 *   DashboardI18n.switchLanguage('en');      // Switch language
 *   DashboardI18n.getMonthName('january');   // Get month name in current language
 *
 * HTML: <span data-i18n="tabs.summary">요약</span>
 *       <input data-i18n="filter.search" placeholder="사번 또는 이름 검색">
 */
const DashboardI18n = {
    currentLang: 'ko',
    translations: {},

    // Core translations (embedded for offline/fast access)
    _core: {
        // Tab names
        'tabs.summary': { ko: '요약', en: 'Summary', vi: 'Tổng quan' },
        'tabs.position': { ko: '직급별 상세', en: 'Position Details', vi: 'Chi tiết chức vụ' },
        'tabs.individual': { ko: '개인별 상세', en: 'Individual Details', vi: 'Chi tiết cá nhân' },
        'tabs.criteria': { ko: '인센티브 기준', en: 'Incentive Criteria', vi: 'Tiêu chí khuyến khích' },
        'tabs.orgchart': { ko: '조직도', en: 'Org Chart', vi: 'Sơ đồ tổ chức' },
        'nav.team': { ko: '팀 관리', en: 'Team Management', vi: 'Quản lý nhóm' },
        'tabs.validation': { ko: '요약 및 시스템 검증', en: 'Summary & Validation', vi: 'Tổng hợp & Xác nhận' },
        'tabs.attendanceLookup': { ko: '🔍 개인 출결 조회', en: '🔍 Attendance Lookup', vi: '🔍 Tra cứu chấm công' },

        // KPI labels
        'kpi.recipients': { ko: '수령 직원', en: 'Recipients', vi: 'Nhân viên nhận' },
        'kpi.paymentRate': { ko: '지급률', en: 'Payment Rate', vi: 'Tỷ lệ chi trả' },
        'kpi.totalAmount': { ko: '총 지급액', en: 'Total Amount', vi: 'Tổng số tiền' },
        'kpi.people': { ko: '명', en: ' people', vi: ' người' },

        // Table headers
        'table.no': { ko: '번호', en: 'No', vi: 'STT' },
        'table.empNo': { ko: '사번', en: 'Emp No', vi: 'Mã NV' },
        'table.name': { ko: '이름', en: 'Name', vi: 'Họ tên' },
        'table.position': { ko: '직급', en: 'Position', vi: 'Chức vụ' },
        'table.building': { ko: 'Building', en: 'Building', vi: 'Xưởng' },
        'table.type': { ko: 'TYPE', en: 'TYPE', vi: 'Loại' },
        'table.attendance': { ko: '출근율', en: 'Attendance', vi: 'Tỷ lệ đi làm' },
        'table.aql': { ko: 'AQL', en: 'AQL', vi: 'AQL' },
        'table.5prs': { ko: '5PRS', en: '5PRS', vi: '5PRS' },
        'table.incentive': { ko: '인센티브', en: 'Incentive', vi: 'Khuyến khích' },
        'table.detail': { ko: '상세', en: 'Detail', vi: 'Chi tiết' },

        // Filter labels
        'filter.search': { ko: '사번 또는 이름 검색', en: 'Search by ID or name', vi: 'Tìm theo mã hoặc tên' },
        'filter.allPositions': { ko: '전체 직급', en: 'All Positions', vi: 'Tất cả chức vụ' },
        'filter.allBuildings': { ko: '전체 Building', en: 'All Buildings', vi: 'Tất cả xưởng' },
        'filter.all': { ko: '전체', en: 'All', vi: 'Tất cả' },
        'filter.received': { ko: '수령', en: 'Received', vi: 'Đã nhận' },
        'filter.notReceived': { ko: '미수령', en: 'Not Received', vi: 'Chưa nhận' },

        // Validation KPI labels
        'validation.totalWorkingDays': { ko: '총 근무일수', en: 'Total Working Days', vi: 'Tổng ngày làm việc' },
        'validation.absentWithoutInform': { ko: '무단결근 초과', en: 'Unapproved Absence', vi: 'Vắng không phép' },
        'validation.zeroWorkingDays': { ko: '실제 근무일 0일', en: 'Zero Working Days', vi: '0 ngày làm việc' },
        'validation.minimumDaysNotMet': { ko: '최소 근무일 미충족', en: 'Minimum Days Not Met', vi: 'Không đủ ngày tối thiểu' },
        'validation.attendanceBelow': { ko: '출근율 미만', en: 'Attendance Below', vi: 'Tỷ lệ đi làm dưới' },
        'validation.aqlFail': { ko: 'AQL FAIL 보유자', en: 'AQL Failures', vi: 'Lỗi AQL' },
        'validation.consecutiveAqlFail': { ko: '3개월 연속 AQL FAIL', en: '3-Month Consecutive AQL Fail', vi: 'AQL lỗi liên tiếp 3 tháng' },
        'validation.areaRejectRate': { ko: '구역 Reject Rate 초과', en: 'Area Reject Rate Exceeded', vi: 'Tỷ lệ từ chối khu vực vượt' },
        'validation.lowPassRate': { ko: '5PRS Pass Rate 미만', en: '5PRS Pass Rate Below', vi: 'Tỷ lệ đạt 5PRS dưới' },
        'validation.lowInspectionQty': { ko: '5PRS 검사량 미만', en: '5PRS Inspection Qty Below', vi: 'SL kiểm tra 5PRS dưới' },
        'validation.buildingReview': { ko: 'Building 검토 목록', en: 'Building Review List', vi: 'Danh sách xem xét xưởng' },
        'validation.lineLeaderNotAssigned': { ko: '라인리더 미배정', en: 'LINE LEADER Not Assigned', vi: 'Chưa phân công Line Leader' },

        // Common
        'common.pass': { ko: 'PASS', en: 'PASS', vi: 'ĐẠT' },
        'common.fail': { ko: 'FAIL', en: 'FAIL', vi: 'KHÔNG ĐẠT' },
        'common.na': { ko: 'N/A', en: 'N/A', vi: 'N/A' },
        'common.noData': { ko: '데이터 없음', en: 'No data', vi: 'Không có dữ liệu' },
        'common.loading': { ko: '로딩 중...', en: 'Loading...', vi: 'Đang tải...' },
        'common.logout': { ko: '로그아웃', en: 'Logout', vi: 'Đăng xuất' },
        'common.back': { ko: '← 월 선택', en: '← Select Month', vi: '← Chọn tháng' },
        'common.days': { ko: '일', en: ' days', vi: ' ngày' },
        'common.people_count': { ko: '명', en: '', vi: '' },
        'common.employee': { ko: '직원', en: 'employee', vi: 'nhân viên' },
        'common.employees': { ko: '직원', en: 'employees', vi: 'nhân viên' },

        // Months
        'month.january': { ko: '1월', en: 'January', vi: 'Tháng 1' },
        'month.february': { ko: '2월', en: 'February', vi: 'Tháng 2' },
        'month.march': { ko: '3월', en: 'March', vi: 'Tháng 3' },
        'month.april': { ko: '4월', en: 'April', vi: 'Tháng 4' },
        'month.may': { ko: '5월', en: 'May', vi: 'Tháng 5' },
        'month.june': { ko: '6월', en: 'June', vi: 'Tháng 6' },
        'month.july': { ko: '7월', en: 'July', vi: 'Tháng 7' },
        'month.august': { ko: '8월', en: 'August', vi: 'Tháng 8' },
        'month.september': { ko: '9월', en: 'September', vi: 'Tháng 9' },
        'month.october': { ko: '10월', en: 'October', vi: 'Tháng 10' },
        'month.november': { ko: '11월', en: 'November', vi: 'Tháng 11' },
        'month.december': { ko: '12월', en: 'December', vi: 'Tháng 12' },

        // Org chart
        'orgchart.title': { ko: '조직 구조도 (TYPE-1)', en: 'Organization Chart (TYPE-1)', vi: 'Sơ đồ tổ chức (TYPE-1)' },
        'orgchart.expandAll': { ko: '모두 펴기', en: 'Expand All', vi: 'Mở tất cả' },
        'orgchart.collapseAll': { ko: '모두 접기', en: 'Collapse All', vi: 'Thu gọn' },
        'orgchart.findMe': { ko: '내 위치 찾기', en: 'Find Me', vi: 'Tìm vị trí' },
        'orgchart.allIncentive': { ko: '전체', en: 'All', vi: 'Tất cả' },
        'orgchart.paidOnly': { ko: '수령자만', en: 'Paid Only', vi: 'Chỉ người nhận' },
        'orgchart.unpaidOnly': { ko: '미수령자만', en: 'Unpaid Only', vi: 'Chỉ chưa nhận' },

        // Conditions 1-10
        'condition.1': { ko: '출근율', en: 'Attendance Rate', vi: 'Tỷ lệ đi làm' },
        'condition.2': { ko: '무단결근', en: 'Unapproved Absence', vi: 'Vắng không phép' },
        'condition.3': { ko: '실제 근무일', en: 'Actual Working Days', vi: 'Ngày làm thực tế' },
        'condition.4': { ko: '최소 근무일', en: 'Minimum Working Days', vi: 'Ngày làm tối thiểu' },
        'condition.5': { ko: '개인 AQL 실패', en: 'Personal AQL Failure', vi: 'Lỗi AQL cá nhân' },
        'condition.6': { ko: 'AQL 연속 실패', en: 'AQL Consecutive Failure', vi: 'Lỗi AQL liên tiếp' },
        'condition.7': { ko: '팀/구역 AQL', en: 'Team/Area AQL', vi: 'AQL nhóm/khu vực' },
        'condition.8': { ko: '구역 Reject Rate', en: 'Area Reject Rate', vi: 'Tỷ lệ từ chối khu vực' },
        'condition.9': { ko: '5PRS 통과율', en: '5PRS Pass Rate', vi: 'Tỷ lệ đạt 5PRS' },
        'condition.10': { ko: '5PRS 검사량', en: '5PRS Inspection Qty', vi: 'SL kiểm tra 5PRS' },

        // Type table
        'typeTable.total': { ko: '전체 인원', en: 'Total', vi: 'Tổng số' },
        'typeTable.receiving': { ko: '수령 인원', en: 'Receiving', vi: 'Người nhận' },
        'typeTable.rate': { ko: '지급률', en: 'Rate', vi: 'Tỷ lệ' },
        'typeTable.totalAmount': { ko: '총 지급액', en: 'Total Amount', vi: 'Tổng tiền' },
        'typeTable.avgReceiving': { ko: '평균(수령자)', en: 'Avg(Receiving)', vi: 'TB(Người nhận)' },
        'typeTable.avgAll': { ko: '평균(전체)', en: 'Avg(All)', vi: 'TB(Tất cả)' },

        // Employee modal
        'modal.employeeDetail': { ko: '직원 상세 정보', en: 'Employee Details', vi: 'Chi tiết nhân viên' },
        'modal.close': { ko: '닫기', en: 'Close', vi: 'Đóng' },
        'modal.conditionStatus': { ko: '조건 충족 현황', en: 'Condition Status', vi: 'Tình trạng điều kiện' },
        'modal.attendanceInfo': { ko: '출근 정보', en: 'Attendance Info', vi: 'Thông tin chấm công' },
        'modal.incentiveInfo': { ko: '인센티브 정보', en: 'Incentive Info', vi: 'Thông tin khuyến khích' },

        // Admin
        'admin.title': { ko: '관리자 설정', en: 'Admin Settings', vi: 'Cài đặt quản trị' },
        'admin.thresholds': { ko: '목표 설정', en: 'Threshold Settings', vi: 'Cài đặt ngưỡng' },
        'admin.history': { ko: '변경 이력', en: 'Change History', vi: 'Lịch sử thay đổi' },
        'admin.save': { ko: '저장', en: 'Save', vi: 'Lưu' },
        'admin.runPipeline': { ko: '파이프라인 실행', en: 'Run Pipeline', vi: 'Chạy pipeline' }
    },

    /**
     * Initialize the i18n module.
     * Reads saved language from localStorage, falls back to 'ko'.
     * Updates all [data-i18n] elements and language toggle buttons.
     */
    init() {
        this.currentLang = localStorage.getItem('qip_lang') || 'ko';
        this.translations = this._core;
        this.updateAllTexts();
        this.updateLanguageButtons();
    },

    /**
     * Get translation for a given key in the current language.
     * Falls back to Korean, then returns the key itself if not found.
     * @param {string} key - Dot-notation translation key (e.g. 'tabs.summary')
     * @returns {string} Translated text
     */
    t(key) {
        const entry = this.translations[key];
        if (!entry) return key;
        return entry[this.currentLang] || entry['ko'] || key;
    },

    /**
     * Get translation with {threshold_*} placeholder replacement.
     * Uses window.thresholds object for values (set by dashboard config).
     * Pattern matches Issue #60 convention from V9 dashboard.
     * @param {string} key - Dot-notation translation key
     * @returns {string} Translated text with thresholds replaced
     */
    tWithThresholds(key) {
        let text = this.t(key);
        if (window.thresholds) {
            text = text.replace('{threshold_attendance_rate}', window.thresholds.attendance_rate || 88);
            text = text.replace('{threshold_unapproved_absence}', window.thresholds.unapproved_absence || 2);
            text = text.replace('{threshold_minimum_working_days}', window.thresholds.minimum_working_days || 12);
            text = text.replace('{threshold_area_reject_rate}', window.thresholds.area_reject_rate || 3.0);
            text = text.replace('{threshold_5prs_pass_rate}', window.thresholds['5prs_pass_rate'] || 95);
            text = text.replace('{threshold_5prs_min_qty}', window.thresholds['5prs_min_qty'] || 100);
        }
        return text;
    },

    /**
     * Switch the active language and persist to localStorage.
     * Re-renders all [data-i18n] elements and triggers table re-render
     * if DashboardFilters is loaded.
     * @param {string} lang - Language code ('ko', 'en', 'vi')
     */
    switchLanguage(lang) {
        this.currentLang = lang;
        localStorage.setItem('qip_lang', lang);
        this.updateAllTexts();
        this.updateLanguageButtons();
        // Re-render table if filters module is loaded
        if (typeof DashboardFilters !== 'undefined') {
            DashboardFilters.renderTable();
        }
    },

    /**
     * Scan all DOM elements with [data-i18n] attribute and update their text.
     * For INPUT elements, updates the placeholder attribute instead of textContent.
     */
    updateAllTexts() {
        document.querySelectorAll('[data-i18n]').forEach(el => {
            const key = el.getAttribute('data-i18n');
            const text = this.t(key);
            if (text !== key) {
                if (el.tagName === 'INPUT') {
                    el.placeholder = text;
                } else {
                    el.textContent = text;
                }
            }
        });
    },

    /**
     * Update language toggle button active states.
     * Buttons must have class 'lang-btn' and data-lang attribute.
     */
    updateLanguageButtons() {
        document.querySelectorAll('.lang-btn').forEach(btn => {
            btn.classList.toggle('active', btn.getAttribute('data-lang') === this.currentLang);
        });
    },

    /**
     * Get localized month name.
     * @param {string} month - English month name (e.g. 'january', 'February')
     * @returns {string} Localized month name
     */
    getMonthName(month) {
        return this.t('month.' + month.toLowerCase());
    }
};

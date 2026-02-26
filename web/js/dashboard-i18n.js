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

        // Header & Navigation
        'lastUpdated': { ko: '최종 업데이트:', en: 'Last Updated:', vi: 'Cập nhật:' },
        'loading': { ko: '데이터를 불러오는 중...', en: 'Loading data...', vi: 'Đang tải dữ liệu...' },
        'errorTitle': { ko: '오류 발생', en: 'Error', vi: 'Lỗi' },

        // Summary section
        'summary.typeOverview': { ko: 'TYPE별 현황', en: 'TYPE Overview', vi: 'Tổng quan TYPE' },
        'summary.conditionCharts': { ko: '조건별 충족 현황', en: 'Condition Fulfillment', vi: 'Tình trạng điều kiện' },

        // Validation extras
        'validation.crossBuilding': { ko: '교차 Building 검토', en: 'Cross-Building Review', vi: 'Xem xét liên xưởng' },
        'validation.attendanceCalendar': { ko: '출근 캘린더', en: 'Attendance Calendar', vi: 'Lịch chấm công' },

        // Calendar
        'calendar.totalWorkingDays': { ko: '총 근무일', en: 'Working Days', vi: 'Ngày làm việc' },
        'calendar.totalDays': { ko: '총 일수', en: 'Total Days', vi: 'Tổng số ngày' },
        'calendar.noDataDays': { ko: '데이터 없음', en: 'No Data', vi: 'Không có dữ liệu' },
        'calendar.legendWorkDay': { ko: '근무일', en: 'Work Day', vi: 'Ngày làm' },
        'calendar.legendNoData': { ko: '휴무일/데이터 없음', en: 'Holiday/No Data', vi: 'Nghỉ/Không dữ liệu' },
        'calendar.employeeCount': { ko: '명', en: ' emp', vi: ' NV' },
        'calendar.day': { ko: '일', en: 'day', vi: 'ngày' },
        'calendar.weekdays.mon': { ko: '월', en: 'Mon', vi: 'T2' },
        'calendar.weekdays.tue': { ko: '화', en: 'Tue', vi: 'T3' },
        'calendar.weekdays.wed': { ko: '수', en: 'Wed', vi: 'T4' },
        'calendar.weekdays.thu': { ko: '목', en: 'Thu', vi: 'T5' },
        'calendar.weekdays.fri': { ko: '금', en: 'Fri', vi: 'T6' },
        'calendar.weekdays.sat': { ko: '토', en: 'Sat', vi: 'T7' },
        'calendar.weekdays.sun': { ko: '일', en: 'Sun', vi: 'CN' },

        // Attendance lookup
        'attendanceLookup.title': { ko: '개인 출결 조회', en: 'Personal Attendance Lookup', vi: 'Tra cứu chấm công cá nhân' },
        'attendanceLookup.placeholder': { ko: '사번 입력', en: 'Enter Employee No', vi: 'Nhập mã NV' },
        'attendanceLookup.search': { ko: '조회', en: 'Search', vi: 'Tìm kiếm' },
        'attendanceLookup.enterEmpNo': { ko: '사번을 입력해주세요.', en: 'Please enter an employee number.', vi: 'Vui lòng nhập mã nhân viên.' },
        'attendanceLookup.notFound': { ko: '에 해당하는 직원을 찾을 수 없습니다.', en: ' not found.', vi: ' không tìm thấy.' },
        'attendanceLookup.empNoLabel': { ko: '사번 ', en: 'Employee No ', vi: 'Mã NV ' },
        'attendanceLookup.totalWorkDays': { ko: '총 근무일', en: 'Total Work Days', vi: 'Tổng ngày làm' },
        'attendanceLookup.actualWorkDays': { ko: '실제 근무일', en: 'Actual Work Days', vi: 'Ngày làm thực tế' },
        'attendanceLookup.approvedLeave': { ko: '승인휴가', en: 'Approved Leave', vi: 'Nghỉ phép' },
        'attendanceLookup.unapprovedAbsence': { ko: '무단결근', en: 'Unapproved Absence', vi: 'Vắng không phép' },
        'attendanceLookup.attendanceRate': { ko: '출근율', en: 'Attendance Rate', vi: 'Tỷ lệ chấm công' },
        'attendanceLookup.day': { ko: '일', en: ' days', vi: ' ngày' },

        // Footer
        'footer.dataSource': { ko: 'Data source: Firestore', en: 'Data source: Firestore', vi: 'Nguồn dữ liệu: Firestore' },

        // KPI labels
        'kpi.totalEmployees': { ko: '전체 직원', en: 'Total Employees', vi: 'Tổng nhân viên' },
        'kpi.recipients': { ko: '수령 직원', en: 'Recipients', vi: 'Nhân viên nhận' },
        'kpi.paymentRate': { ko: '지급률', en: 'Payment Rate', vi: 'Tỷ lệ chi trả' },
        'kpi.totalAmount': { ko: '총 지급액', en: 'Total Amount', vi: 'Tổng số tiền' },
        'kpi.people': { ko: '명', en: ' people', vi: ' người' },
        'kpi.employeeRatio': { ko: '수령/전체', en: 'Recv/Total', vi: 'Nhận/Tổng' },

        // Trend Chart
        'chart.trendTitle': { ko: '전월 대비 인센티브 분석', en: 'Monthly Incentive Trend Analysis', vi: 'Phân tích xu hướng khuyến khích' },
        'chart.previousMonth': { ko: '전월', en: 'Previous', vi: 'Tháng trước' },
        'chart.currentMonth': { ko: '당월', en: 'Current', vi: 'Tháng này' },
        'chart.totalIncentive': { ko: '총 인센티브', en: 'Total Incentive', vi: 'Tổng khuyến khích' },
        'chart.recipientCount': { ko: '수령자 수', en: 'Recipients', vi: 'Số người nhận' },
        'chart.avgIncentive': { ko: '평균 인센티브', en: 'Avg Incentive', vi: 'TB khuyến khích' },
        'chart.change': { ko: '변동', en: 'Change', vi: 'Thay đổi' },
        'chart.noTrendData': { ko: '전월 데이터 없음', en: 'No previous month data', vi: 'Không có dữ liệu tháng trước' },

        // Quick Summary
        'quickSummary.title': { ko: '빠른 요약', en: 'Quick Summary', vi: 'Tóm tắt nhanh' },
        'quickSummary.close': { ko: '닫기', en: 'Close', vi: 'Đóng' },
        'quickSummary.recipients': { ko: '수령 직원', en: 'Recipients', vi: 'Nhân viên nhận' },
        'quickSummary.paymentRate': { ko: '지급률', en: 'Payment Rate', vi: 'Tỷ lệ chi trả' },
        'quickSummary.totalAmount': { ko: '총 지급액', en: 'Total Amount', vi: 'Tổng số tiền' },

        // My Incentive
        'myIncentive.btnLabel': { ko: '내 인센티브', en: 'My Incentive', vi: 'KK của tôi' },
        'myIncentive.title': { ko: '내 인센티브 조회', en: 'My Incentive Lookup', vi: 'Tra cứu KK của tôi' },
        'myIncentive.placeholder': { ko: '사번을 입력하세요', en: 'Enter your employee number', vi: 'Nhập mã nhân viên' },
        'myIncentive.notFound': { ko: '해당 사번의 직원을 찾을 수 없습니다.', en: 'Employee not found with that number.', vi: 'Không tìm thấy nhân viên.' },

        // Excel Download
        'common.excelDownload': { ko: 'Excel 다운로드', en: 'Excel Download', vi: 'Tải Excel' },

        // Talent Pool
        'talentPool.title': { ko: '🏆 Talent Pool', en: '🏆 Talent Pool', vi: '🏆 Talent Pool' },
        'talentPool.memberCount': { ko: '명', en: ' members', vi: ' thành viên' },
        'talentPool.consecutiveMonths': { ko: '개월 연속', en: ' consecutive months', vi: ' tháng liên tục' },
        'talentPool.noMembers': { ko: 'Talent Pool 해당자 없음', en: 'No Talent Pool members', vi: 'Không có thành viên Talent Pool' },

        // Dark Mode
        'common.darkMode': { ko: '다크 모드', en: 'Dark Mode', vi: 'Chế độ tối' },
        'common.lightMode': { ko: '라이트 모드', en: 'Light Mode', vi: 'Chế độ sáng' },

        // Data Period
        'dataPeriod.interim': { ko: '📋 중간 보고서', en: '📋 Interim Report', vi: '📋 Báo cáo giữa kỳ' },
        'dataPeriod.final': { ko: '📋 최종 보고서', en: '📋 Final Report', vi: '📋 Báo cáo cuối kỳ' },
        'dataPeriod.badge': { ko: '중간 데이터', en: 'Interim Data', vi: 'Dữ liệu giữa kỳ' },

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
        'common.total': { ko: '총', en: 'Total', vi: 'Tổng' },
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
        'modal.workingDayCount': { ko: '근무일수', en: 'Working Days', vi: 'Số ngày làm' },
        'modal.employeeCount': { ko: '직원 수', en: 'Employees', vi: 'Số nhân viên' },

        // Criteria tab
        'criteria.conditionsTitle': { ko: '10가지 조건 개요', en: '10 Conditions Overview', vi: 'Tổng quan 10 điều kiện' },
        'criteria.typeCalcTitle': { ko: 'TYPE별 인센티브 계산 방법', en: 'TYPE-based Incentive Calculation Methods', vi: 'Phương pháp tính khuyến khích theo TYPE' },
        'criteria.faqTitle': { ko: '자주 묻는 질문 (FAQ)', en: 'Frequently Asked Questions (FAQ)', vi: 'Câu hỏi thường gặp (FAQ)' },

        // TYPE-2 Calculation
        'criteria.type2Principle': {
            ko: 'TYPE-2 직급은 해당하는 TYPE-1 직급의 수령자 평균 인센티브를 기준으로 계산됩니다.',
            en: 'TYPE-2 positions are calculated based on the average incentive of receiving TYPE-1 employees in the reference position.',
            vi: 'Chức vụ TYPE-2 được tính dựa trên trung bình khuyến khích của nhân viên TYPE-1 đang nhận trong chức vụ tham chiếu.'
        },
        'criteria.type2AvgBasis': {
            ko: '모든 평균 계산은 수령자만 대상으로 합니다. (0 VND 제외)',
            en: 'All averages are calculated only from receiving employees (excluding 0 VND).',
            vi: 'Tất cả trung bình chỉ tính từ nhân viên đang nhận (không tính 0 VND).'
        },
        'criteria.type2AvgExample': {
            ko: '예: LINE LEADER 10명 중 7명만 인센티브 수령 시, 7명의 평균으로 계산 (10명 전체 평균 아님)',
            en: 'Ex: If 7 of 10 LINE LEADERs receive incentive, average is from 7 only (not all 10)',
            vi: 'VD: Nếu 7/10 LINE LEADER nhận khuyến khích, trung bình tính từ 7 người (không phải 10)'
        },
        'criteria.type2ColPosition': { ko: 'TYPE-2 직급', en: 'TYPE-2 Position', vi: 'Chức vụ TYPE-2' },
        'criteria.type2ColReference': { ko: '참조 TYPE-1 직급', en: 'Reference TYPE-1', vi: 'Tham chiếu TYPE-1' },
        'criteria.type2ColMethod': { ko: '계산 방법', en: 'Calculation Method', vi: 'Phương pháp tính' },
        'criteria.type2ColAverage': { ko: '현재 평균', en: 'Current Avg', vi: 'TB hiện tại' },
        'criteria.receivingAvg': { ko: '수령자 평균', en: 'Receiving Avg', vi: 'TB người nhận' },
        'criteria.type2GroupLeaderRule': {
            ko: 'TYPE-2 GROUP LEADER: 기본 = TYPE-1 LINE LEADER 수령자 평균 × 2. Fallback = TYPE-2 LINE LEADER 수령자 평균 × 2.',
            en: 'TYPE-2 GROUP LEADER: Base = TYPE-1 LINE LEADER receiving avg × 2. Fallback = TYPE-2 LINE LEADER receiving avg × 2.',
            vi: 'TYPE-2 GROUP LEADER: Cơ bản = TB TYPE-1 LINE LEADER nhận × 2. Dự phòng = TB TYPE-2 LINE LEADER nhận × 2.'
        },
        'criteria.type2QaTeamRule': {
            ko: 'QA TEAM: QA3B = ASSEMBLY INSPECTOR 수령자 평균, QA3A = TYPE-1 LINE LEADER 수령자 평균 × 2 (GROUP LEADER와 동일)',
            en: 'QA TEAM: QA3B = ASSEMBLY INSPECTOR receiving avg, QA3A = TYPE-1 LINE LEADER receiving avg × 2 (same as GROUP LEADER)',
            vi: 'QA TEAM: QA3B = TB ASSEMBLY INSPECTOR nhận, QA3A = TB TYPE-1 LINE LEADER nhận × 2 (giống GROUP LEADER)'
        },
        'criteria.type2Conditions': {
            ko: 'TYPE-2는 출근 조건(1-4번)만 충족하면 인센티브 지급',
            en: 'TYPE-2 only needs to meet attendance conditions (C1-C4) to receive incentive',
            vi: 'TYPE-2 chỉ cần đáp ứng điều kiện chấm công (C1-C4) để nhận khuyến khích'
        },

        // FAQ
        'faq.q1': {
            ko: '왜 나는 인센티브를 못 받았나요?',
            en: 'Why didn\'t I receive an incentive?',
            vi: 'Tại sao tôi không nhận được khuyến khích?'
        },
        'faq.a1': {
            ko: '인센티브를 받으려면 해당 TYPE에 적용되는 모든 조건을 100% 충족해야 합니다. 다음과 같은 이유로 미수령될 수 있습니다:\n• 최소 근무일 {threshold_minimum_working_days}일 미충족\n• 출근율 {threshold_attendance_rate}% 미만\n• 무단결근 {threshold_unapproved_absence}일 초과\n• 당월 AQL 실패 발생\n• 5PRS 통과율 {threshold_5prs_pass_rate}% 미만',
            en: 'You must meet 100% of all applicable conditions for your TYPE. Possible reasons:\n• Working days below {threshold_minimum_working_days} days\n• Attendance rate below {threshold_attendance_rate}%\n• Unapproved absences exceed {threshold_unapproved_absence} days\n• AQL failure this month\n• 5PRS pass rate below {threshold_5prs_pass_rate}%',
            vi: 'Bạn phải đáp ứng 100% tất cả điều kiện áp dụng cho TYPE. Lý do có thể:\n• Ngày làm dưới {threshold_minimum_working_days} ngày\n• Tỷ lệ đi làm dưới {threshold_attendance_rate}%\n• Vắng không phép vượt {threshold_unapproved_absence} ngày\n• Lỗi AQL trong tháng\n• Tỷ lệ đạt 5PRS dưới {threshold_5prs_pass_rate}%'
        },
        'faq.q2': {
            ko: '무단결근이 며칠까지 허용되나요?',
            en: 'How many unapproved absences are allowed?',
            vi: 'Được phép vắng không phép bao nhiêu ngày?'
        },
        'faq.a2': {
            ko: '무단결근은 월 {threshold_unapproved_absence}일 이하여야 합니다. {threshold_unapproved_absence}일을 초과하면 인센티브 지급 대상에서 제외됩니다.',
            en: 'Unapproved absences must be {threshold_unapproved_absence} days or less per month. Exceeding {threshold_unapproved_absence} days disqualifies you from incentive.',
            vi: 'Vắng không phép phải không quá {threshold_unapproved_absence} ngày/tháng. Vượt {threshold_unapproved_absence} ngày sẽ mất khuyến khích.'
        },
        'faq.q3': {
            ko: 'TYPE-2 직급의 인센티브는 어떻게 계산되나요?',
            en: 'How is the TYPE-2 position incentive calculated?',
            vi: 'Khuyến khích chức vụ TYPE-2 được tính như thế nào?'
        },
        'faq.a3': {
            ko: 'TYPE-2 직급은 해당하는 TYPE-1 직급의 수령자 평균 인센티브를 기준으로 합니다. 예: LINE LEADER(TYPE-2) = TYPE-1 LINE LEADER 수령자 평균, GROUP LEADER(TYPE-2) = TYPE-1 LINE LEADER 수령자 평균 × 2',
            en: 'TYPE-2 is based on the receiving average of the corresponding TYPE-1 position. Ex: LINE LEADER(TYPE-2) = TYPE-1 LINE LEADER receiving avg, GROUP LEADER(TYPE-2) = TYPE-1 LINE LEADER receiving avg × 2',
            vi: 'TYPE-2 dựa trên trung bình nhận của chức vụ TYPE-1 tương ứng. VD: LINE LEADER(TYPE-2) = TB nhận TYPE-1 LINE LEADER, GROUP LEADER(TYPE-2) = TB nhận TYPE-1 LINE LEADER × 2'
        },
        'faq.q4': {
            ko: 'ASSEMBLY INSPECTOR의 연속 근무 개월은 어떻게 계산되나요?',
            en: 'How are consecutive working months calculated for ASSEMBLY INSPECTOR?',
            vi: 'Số tháng làm việc liên tục của ASSEMBLY INSPECTOR được tính như thế nào?'
        },
        'faq.a4': {
            ko: '매월 모든 조건을 100% 충족하면 연속 개월이 1씩 증가합니다 (최대 15개월). 한 달이라도 조건 미충족 시 0으로 리셋됩니다. 연속 개월에 따라 Progressive Table의 인센티브 금액이 적용됩니다.',
            en: 'Consecutive months increase by 1 each month if all conditions are met 100% (max 15). If any condition fails in a month, it resets to 0. The Progressive Table amount applies based on consecutive months.',
            vi: 'Số tháng liên tục tăng 1 mỗi tháng nếu đáp ứng 100% điều kiện (tối đa 15). Nếu bất kỳ điều kiện nào không đạt, reset về 0. Số tiền theo Bảng lũy tiến áp dụng theo tháng liên tục.'
        },
        'faq.q5': {
            ko: 'AQL 실패가 무엇이고 어떤 영향을 미치나요?',
            en: 'What is an AQL failure and how does it affect incentives?',
            vi: 'Lỗi AQL là gì và ảnh hưởng đến khuyến khích như thế nào?'
        },
        'faq.a5': {
            ko: 'AQL(Acceptable Quality Level) 실패는 품질 검사에서 기준 미달을 의미합니다. 당월 AQL 실패가 1건이라도 있으면 조건 5번 미충족으로 인센티브를 받을 수 없습니다. 또한 {threshold_consecutive_aql_months}개월 연속 AQL 실패 시 조건 6번도 미충족됩니다.',
            en: 'AQL (Acceptable Quality Level) failure means failing quality inspection standards. Even 1 AQL failure this month fails Condition 5 and disqualifies incentive. Additionally, {threshold_consecutive_aql_months} consecutive months of AQL failure also fails Condition 6.',
            vi: 'Lỗi AQL nghĩa là không đạt tiêu chuẩn kiểm tra chất lượng. Chỉ 1 lỗi AQL trong tháng là không đạt Điều kiện 5. Ngoài ra, {threshold_consecutive_aql_months} tháng liên tục lỗi AQL cũng không đạt Điều kiện 6.'
        },
        'faq.q6': {
            ko: '5PRS 검사량이 부족하면 어떻게 되나요?',
            en: 'What happens if 5PRS inspection quantity is insufficient?',
            vi: 'Điều gì xảy ra nếu số lượng kiểm tra 5PRS không đủ?'
        },
        'faq.a6': {
            ko: '5PRS 검사량이 {threshold_5prs_min_qty}족 미만이면 조건 10번 미충족으로 인센티브를 받을 수 없습니다. 또한 5PRS 통과율이 {threshold_5prs_pass_rate}% 미만이면 조건 9번도 미충족됩니다.',
            en: 'If 5PRS inspection quantity is below {threshold_5prs_min_qty} pairs, Condition 10 is not met and incentive is disqualified. Also, if 5PRS pass rate is below {threshold_5prs_pass_rate}%, Condition 9 is also not met.',
            vi: 'Nếu số lượng kiểm tra 5PRS dưới {threshold_5prs_min_qty} đôi, Điều kiện 10 không đạt. Ngoài ra, nếu tỷ lệ đạt 5PRS dưới {threshold_5prs_pass_rate}%, Điều kiện 9 cũng không đạt.'
        },
        'faq.q7': {
            ko: '출산휴가나 병가 중에도 인센티브를 받을 수 있나요?',
            en: 'Can I receive incentive during maternity or sick leave?',
            vi: 'Tôi có thể nhận khuyến khích khi nghỉ thai sản hoặc ốm không?'
        },
        'faq.a7': {
            ko: '승인된 휴가(출산휴가, 병가 등)는 출근으로 인정됩니다. 다만 실제 근무일이 {threshold_minimum_working_days}일 미만이면 조건 4번 미충족으로 인센티브를 받을 수 없습니다.',
            en: 'Approved leaves (maternity, sick) count as attendance. However, if actual working days are below {threshold_minimum_working_days}, Condition 4 is not met and incentive is disqualified.',
            vi: 'Nghỉ phép được duyệt (thai sản, ốm) được tính là đi làm. Tuy nhiên, nếu ngày làm thực tế dưới {threshold_minimum_working_days}, Điều kiện 4 không đạt.'
        },
        'faq.q8': {
            ko: '전월 인센티브와 차이가 나는 이유는 무엇인가요?',
            en: 'Why is my incentive different from last month?',
            vi: 'Tại sao khuyến khích tháng này khác tháng trước?'
        },
        'faq.a8': {
            ko: '여러 이유가 있을 수 있습니다:\n• TYPE-1: 연속 개월 증가/리셋으로 인센티브 금액 변동\n• TYPE-2: 참조하는 TYPE-1 평균값 변동\n• 임계값 변경 (관리자 정책 업데이트)\n• 출근율, AQL, 5PRS 결과 변동',
            en: 'Several reasons:\n• TYPE-1: Consecutive months increase/reset changes amount\n• TYPE-2: Reference TYPE-1 average value changes\n• Threshold changes (admin policy update)\n• Changes in attendance, AQL, or 5PRS results',
            vi: 'Nhiều lý do:\n• TYPE-1: Tháng liên tục tăng/reset thay đổi số tiền\n• TYPE-2: Giá trị TB TYPE-1 tham chiếu thay đổi\n• Thay đổi ngưỡng (cập nhật chính sách)\n• Thay đổi kết quả chấm công, AQL, hoặc 5PRS'
        },
        'faq.q9': {
            ko: 'TYPE-3에서 TYPE-2로 승진하면 인센티브가 어떻게 변하나요?',
            en: 'How does incentive change when promoted from TYPE-3 to TYPE-2?',
            vi: 'Khuyến khích thay đổi thế nào khi thăng từ TYPE-3 lên TYPE-2?'
        },
        'faq.a9': {
            ko: 'TYPE-3 (정책 제외)에서 TYPE-2로 승진하면 출근 조건(1-4번)만 충족하면 인센티브를 받을 수 있습니다. TYPE-2 인센티브 금액은 해당하는 TYPE-1 직급의 수령자 평균으로 결정됩니다.',
            en: 'When promoted from TYPE-3 (excluded) to TYPE-2, you only need to meet attendance conditions (C1-C4) to receive incentive. TYPE-2 amount is the receiving average of the corresponding TYPE-1 position.',
            vi: 'Khi thăng từ TYPE-3 (loại trừ) lên TYPE-2, chỉ cần đáp ứng điều kiện chấm công (C1-C4). Số tiền TYPE-2 là trung bình nhận của chức vụ TYPE-1 tương ứng.'
        },
        'faq.q10': {
            ko: '조건을 모두 충족했는데도 인센티브가 0인 이유는 무엇인가요?',
            en: 'Why is my incentive 0 even though I met all conditions?',
            vi: 'Tại sao khuyến khích bằng 0 dù tôi đáp ứng tất cả điều kiện?'
        },
        'faq.a10': {
            ko: '가능한 이유:\n• TYPE-3 직급 (정책 제외 대상)\n• 해당 월 중도 입사/퇴사\n• TYPE-2인데 참조 TYPE-1 수령자가 없어 평균 0\n• 시스템 데이터 반영 지연 (관리자에게 문의)',
            en: 'Possible reasons:\n• TYPE-3 position (policy excluded)\n• Mid-month hire/resignation\n• TYPE-2 but no receiving TYPE-1 employees (average = 0)\n• System data delay (contact admin)',
            vi: 'Lý do có thể:\n• Chức vụ TYPE-3 (loại trừ)\n• Nhập/nghỉ việc giữa tháng\n• TYPE-2 nhưng không có TYPE-1 nhận (TB = 0)\n• Chậm cập nhật dữ liệu (liên hệ quản trị)'
        },
        'faq.q11': {
            ko: 'TYPE-2 GROUP LEADER가 인센티브를 못 받는 경우가 있나요?',
            en: 'Can a TYPE-2 GROUP LEADER not receive incentive?',
            vi: 'TYPE-2 GROUP LEADER có thể không nhận khuyến khích không?'
        },
        'faq.a11': {
            ko: '네, 가능합니다. 출근 조건(1-4번) 미충족 시 인센티브를 받을 수 없습니다. 또한 참조하는 TYPE-1 LINE LEADER 수령자가 없으면 평균이 0이 되어 인센티브가 0 VND가 됩니다.',
            en: 'Yes. If attendance conditions (C1-C4) are not met, incentive is disqualified. Also, if no TYPE-1 LINE LEADER receives incentive, the average is 0, making GROUP LEADER incentive 0 VND.',
            vi: 'Có. Nếu điều kiện chấm công (C1-C4) không đạt, không nhận khuyến khích. Ngoài ra, nếu không có TYPE-1 LINE LEADER nhận, trung bình = 0, khuyến khích GROUP LEADER = 0 VND.'
        },

        // Type table headers (summary tab)
        'typeTable.type': { ko: 'TYPE', en: 'TYPE', vi: 'TYPE' },

        // Condition chart
        'chart.employeeCount': { ko: '직원 수', en: 'Employee Count', vi: 'Số nhân viên' },
        'chart.conditionLabel.1': { ko: 'C1: 출근율', en: 'C1: Attendance Rate', vi: 'C1: Tỷ lệ đi làm' },
        'chart.conditionLabel.2': { ko: 'C2: 무단결근', en: 'C2: Unapproved Absence', vi: 'C2: Vắng không phép' },
        'chart.conditionLabel.3': { ko: 'C3: 실제 근무일', en: 'C3: Actual Working Days', vi: 'C3: Ngày làm thực tế' },
        'chart.conditionLabel.4': { ko: 'C4: 최소 근무일', en: 'C4: Minimum Working Days', vi: 'C4: Ngày làm tối thiểu' },
        'chart.conditionLabel.5': { ko: 'C5: AQL 실패 (당월)', en: 'C5: AQL Failure (Monthly)', vi: 'C5: Lỗi AQL (Tháng)' },
        'chart.conditionLabel.6': { ko: 'C6: AQL 연속 실패', en: 'C6: AQL 3-Month Consecutive', vi: 'C6: AQL liên tục 3 tháng' },
        'chart.conditionLabel.7': { ko: 'C7: 팀 AQL 연속', en: 'C7: Team AQL Consecutive', vi: 'C7: AQL nhóm liên tục' },
        'chart.conditionLabel.8': { ko: 'C8: 구역 Reject Rate', en: 'C8: Area Reject Rate', vi: 'C8: Tỷ lệ từ chối khu vực' },
        'chart.conditionLabel.9': { ko: 'C9: 5PRS 통과율', en: 'C9: 5PRS Pass Rate', vi: 'C9: Tỷ lệ đạt 5PRS' },
        'chart.conditionLabel.10': { ko: 'C10: 5PRS 검사량', en: 'C10: 5PRS Inspection Qty', vi: 'C10: SL kiểm tra 5PRS' },

        // Position table
        'position.summary': { ko: '직급별 요약', en: 'Position Summary', vi: 'Tóm tắt chức vụ' },
        'position.positions': { ko: '개 직급', en: ' positions', vi: ' chức vụ' },
        'position.totalAmount': { ko: '총 지급액 (VND)', en: 'Total Amount (VND)', vi: 'Tổng tiền (VND)' },
        'position.avgReceiving': { ko: '평균(수령자)', en: 'Avg (Receiving)', vi: 'TB (Người nhận)' },

        // Criteria tab
        'criteria.category': { ko: '분류', en: 'Category', vi: 'Phân loại' },
        'criteria.condition': { ko: '조건', en: 'Condition', vi: 'Điều kiện' },
        'criteria.threshold': { ko: '기준값', en: 'Threshold', vi: 'Ngưỡng' },
        'criteria.description': { ko: '설명', en: 'Description', vi: 'Mô tả' },
        'criteria.pass': { ko: 'Pass', en: 'Pass', vi: 'Đạt' },
        'criteria.fail': { ko: 'Fail', en: 'Fail', vi: 'K.đạt' },
        'criteria.progressiveTitle': { ko: 'TYPE-1 누진 인센티브 표 (VND)', en: 'TYPE-1 Progressive Incentive Table (VND)', vi: 'Bảng khuyến khích lũy tiến TYPE-1 (VND)' },
        'criteria.progressiveNote': {
            ko: '* 개월 = 조건 100% 충족 연속 개월수. 1회라도 미충족 시 0으로 리셋.',
            en: '* Months = consecutive months of 100% condition fulfillment. Resets to 0 on any failure.',
            vi: '* Tháng = số tháng liên tục đáp ứng 100% điều kiện. Reset về 0 khi bất kỳ lỗi nào.'
        },
        'criteria.typeAppTitle': { ko: 'TYPE별 조건 적용', en: 'TYPE-based Condition Application', vi: 'Áp dụng điều kiện theo TYPE' },
        'criteria.appliedConditions': { ko: '적용 조건', en: 'Applied Conditions', vi: 'Điều kiện áp dụng' },
        'criteria.incentiveMethod': { ko: '인센티브 방식', en: 'Incentive Method', vi: 'Phương pháp KK' },
        'criteria.type1Conditions': { ko: 'C1~C10 (10개 조건 전체)', en: 'C1~C10 (All 10 conditions)', vi: 'C1~C10 (Tất cả 10 điều kiện)' },
        'criteria.type1Method': { ko: '누진표 (1~15개월)', en: 'Progressive table (1~15 months)', vi: 'Bảng lũy tiến (1~15 tháng)' },
        'criteria.type2Conds': { ko: 'C1~C4 (출근 조건만)', en: 'C1~C4 (Attendance only)', vi: 'C1~C4 (Chỉ chấm công)' },
        'criteria.type2Method': { ko: 'TYPE-1 직급 평균 기준', en: 'Based on TYPE-1 position average', vi: 'Dựa trên TB chức vụ TYPE-1' },
        'criteria.type3Conditions': { ko: '없음 (정책 제외)', en: 'None (Policy excluded)', vi: 'Không (Loại trừ)' },
        'criteria.type3Method': { ko: '0 VND (미대상)', en: '0 VND (Not eligible)', vi: '0 VND (Không đủ điều kiện)' },
        // Criteria - condition details (with threshold placeholders)
        'criteria.cond.cat.attendance': { ko: '출근', en: 'Attendance', vi: 'Chấm công' },
        'criteria.cond.cat.aql': { ko: 'AQL', en: 'AQL', vi: 'AQL' },
        'criteria.cond.cat.5prs': { ko: '5PRS', en: '5PRS', vi: '5PRS' },
        'criteria.cond.name.1': { ko: '출근율', en: 'Attendance Rate', vi: 'Tỷ lệ đi làm' },
        'criteria.cond.name.2': { ko: '무단결근', en: 'Unapproved Absence', vi: 'Vắng không phép' },
        'criteria.cond.name.3': { ko: '실제 근무일', en: 'Actual Working Days', vi: 'Ngày làm thực tế' },
        'criteria.cond.name.4': { ko: '최소 근무일', en: 'Minimum Working Days', vi: 'Ngày làm tối thiểu' },
        'criteria.cond.name.5': { ko: 'AQL 실패 (당월)', en: 'AQL Failure (Monthly)', vi: 'Lỗi AQL (Tháng)' },
        'criteria.cond.name.6': { ko: 'AQL 연속 실패', en: 'AQL Consecutive Failure', vi: 'Lỗi AQL liên tiếp' },
        'criteria.cond.name.7': { ko: '팀 AQL 연속', en: 'Team AQL Consecutive', vi: 'AQL nhóm liên tục' },
        'criteria.cond.name.8': { ko: '구역 Reject Rate', en: 'Area Reject Rate', vi: 'Tỷ lệ từ chối KV' },
        'criteria.cond.name.9': { ko: '5PRS 통과율', en: '5PRS Pass Rate', vi: 'Tỷ lệ đạt 5PRS' },
        'criteria.cond.name.10': { ko: '5PRS 검사량', en: '5PRS Inspection Qty', vi: 'SL kiểm tra 5PRS' },
        'criteria.cond.desc.1': { ko: '월 출근율 기준 충족', en: 'Monthly attendance rate must meet minimum', vi: 'Tỷ lệ đi làm tháng phải đạt tối thiểu' },
        'criteria.cond.desc.2': { ko: '무단결근 허용 한도', en: 'Maximum unexcused absences allowed', vi: 'Số ngày vắng không phép tối đa' },
        'criteria.cond.desc.3': { ko: '최소 1일 이상 근무', en: 'Employee must have worked at least 1 day', vi: 'NV phải làm ít nhất 1 ngày' },
        'criteria.cond.desc.4': { ko: '자격 요건 최소 근무일', en: 'Minimum working days required for eligibility', vi: 'Ngày làm tối thiểu để đủ điều kiện' },
        'criteria.cond.desc.5': { ko: '당월 개인 AQL 실패 없음', en: 'No personal AQL failures this month', vi: 'Không có lỗi AQL cá nhân tháng này' },
        'criteria.cond.desc.6': { ko: '연속 월 AQL 실패 없음', en: 'No consecutive month AQL failures', vi: 'Không lỗi AQL liên tiếp tháng' },
        'criteria.cond.desc.7': { ko: '팀/구역 연속 실패 없음', en: 'Team/area has no consecutive failures', vi: 'Nhóm/KV không lỗi liên tiếp' },
        'criteria.cond.desc.8': { ko: '구역 불량률 기준 이하', en: 'Building area reject rate below threshold', vi: 'Tỷ lệ từ chối KV dưới ngưỡng' },
        'criteria.cond.desc.9': { ko: '검사 통과율 기준 충족', en: 'Inspection pass rate meets minimum', vi: 'Tỷ lệ đạt kiểm tra đạt tối thiểu' },
        'criteria.cond.desc.10': { ko: '최소 검사량 필수', en: 'Minimum inspection quantity required', vi: 'Số lượng kiểm tra tối thiểu bắt buộc' },
        'criteria.streakNo': { ko: '개월 연속 = NO', en: 'M streak = NO', vi: ' tháng liên tục = NO' },
        'criteria.unitPairs': { ko: '족', en: 'pairs', vi: 'đôi' },

        // Team tab
        'team.building': { ko: 'Building', en: 'Building', vi: 'Xưởng' },
        'team.total': { ko: '전체:', en: 'Total:', vi: 'Tổng:' },
        'team.receiving': { ko: '수령:', en: 'Receiving:', vi: 'Nhận:' },
        'team.rate': { ko: '지급률:', en: 'Rate:', vi: 'Tỷ lệ:' },
        'team.amount': { ko: '금액:', en: 'Amount:', vi: 'Số tiền:' },
        'team.totalAmount': { ko: '총 지급액 (VND)', en: 'Total Amount (VND)', vi: 'Tổng tiền (VND)' },
        'team.buildings': { ko: '개 Building', en: ' buildings', vi: ' xưởng' },

        // Org chart extras
        'orgchart.totalManagers': { ko: '관리자 합계', en: 'Total Managers', vi: 'Tổng quản lý' },
        'orgchart.bldg': { ko: 'Bldg', en: 'Bldg', vi: 'Xưởng' },
        'orgchart.id': { ko: 'ID', en: 'ID', vi: 'ID' },
        'orgchart.receiving': { ko: '수령', en: 'receiving', vi: 'nhận' },
        'orgchart.bossChain': { ko: '상사 체인', en: 'Boss chain', vi: 'Chuỗi quản lý' },
        'orgchart.promptEmpNo': { ko: '사번을 입력하세요:', en: 'Employee No:', vi: 'Nhập mã NV:' },
        'orgchart.notFound': { ko: '직원 {id}을(를) 조직도에서 찾을 수 없습니다.', en: 'Employee {id} not found in org chart.', vi: 'Không tìm thấy nhân viên {id} trong sơ đồ tổ chức.' },
        'orgchart.noManagerData': { ko: '관리자 데이터가 없습니다.', en: 'No manager data available.', vi: 'Không có dữ liệu quản lý.' },

        // Modal extras
        'modal.entranceDate': { ko: '입사일', en: 'Entrance Date', vi: 'Ngày vào' },
        'modal.boss': { ko: '상사', en: 'Boss', vi: 'Quản lý' },
        'modal.bossName': { ko: '상사 이름', en: 'Boss Name', vi: 'Tên quản lý' },
        'modal.approvedLeave': { ko: '승인 휴가', en: 'Approved Leave', vi: 'Nghỉ phép được duyệt' },
        'modal.conditionHeader': { ko: '조건', en: 'Condition', vi: 'Điều kiện' },
        'modal.valueHeader': { ko: '값', en: 'Value', vi: 'Giá trị' },
        'modal.thresholdHeader': { ko: '기준값', en: 'Threshold', vi: 'Ngưỡng' },
        'modal.resultHeader': { ko: '결과', en: 'Result', vi: 'Kết quả' },
        'modal.conditionsPassed': { ko: '개 조건 충족', en: ' conditions passed', vi: ' điều kiện đạt' },
        'modal.progressiveTitle': { ko: '누진 인센티브 (1~15개월)', en: 'Progressive Incentive (1-15 months)', vi: 'KK lũy tiến (1-15 tháng)' },
        'modal.aqlNotApplicable': { ko: '이 TYPE에는 AQL 조건 미적용', en: 'AQL conditions not applicable for this TYPE', vi: 'Điều kiện AQL không áp dụng cho TYPE này' },
        'modal.totalTests': { ko: '총 검사수', en: 'Total Tests', vi: 'Tổng kiểm tra' },
        'modal.passCount': { ko: '통과 수', en: 'Pass Count', vi: 'Số đạt' },
        'modal.failPercent': { ko: '실패율 %', en: 'Fail %', vi: '% Lỗi' },
        'modal.5prsNotApplicable': { ko: '이 TYPE에는 5PRS 조건 미적용', en: '5PRS conditions not applicable for this TYPE', vi: 'Điều kiện 5PRS không áp dụng cho TYPE này' },
        'modal.totalQty': { ko: '총 검사량', en: 'Total Qty', vi: 'Tổng SL' },
        'modal.bossBuilding': { ko: '상사 Building', en: 'Boss Building', vi: 'Xưởng quản lý' },

        // Status badges (language-aware)
        'status.pass': { ko: '통과', en: 'PASS', vi: 'Đạt' },
        'status.fail': { ko: '실패', en: 'FAIL', vi: 'Không đạt' },
        'status.na': { ko: '해당없음', en: 'N/A', vi: 'N/A' },
        // Units
        'unit.pairs': { ko: '족', en: 'prs', vi: 'đôi' },
        'unit.currency': { ko: 'VND', en: 'VND', vi: 'VND' },
        // KPI extras
        'kpi.maxMin': { ko: '최대 / 최소', en: 'MAX / MIN', vi: 'Tối đa / Tối thiểu' },
        'modal.workingDays': { ko: '근무일', en: 'Working Days', vi: 'Ngày làm' },
        'modal.employeesCount': { ko: '직원', en: 'Employees', vi: 'Nhân viên' },
        'modal.currentIncentive': { ko: '당월 인센티브', en: 'Current Incentive', vi: 'KK tháng này' },
        'modal.previousIncentive': { ko: '전월 인센티브', en: 'Previous Incentive', vi: 'KK tháng trước' },
        'modal.continuousMonths': { ko: '연속 개월 수', en: 'Continuous Months', vi: 'Số tháng liên tục' },
        'modal.progressionBar': { ko: '누진 인센티브 (1~15개월)', en: 'Progressive Incentive (1-15 months)', vi: 'KK lũy tiến (1-15 tháng)' },
        'modal.errorLoading': { ko: '데이터 로드 오류. 모달을 닫고 다시 시도하세요.', en: 'Error loading data. Please close and try again.', vi: 'Lỗi tải dữ liệu. Vui lòng đóng và thử lại.' },

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
        // Fallback to _core if translations not yet initialized (init() not called)
        const entry = this.translations[key] || this._core[key];
        if (!entry) return key;
        var val = entry[this.currentLang];
        if (val !== undefined && val !== null) return val;
        var koVal = entry['ko'];
        if (koVal !== undefined && koVal !== null) return koVal;
        return key;
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
            // replaceAll: same placeholder can appear multiple times in one text (e.g. faq.a2)
            var d = (typeof THRESHOLD_DEFAULTS !== 'undefined') ? THRESHOLD_DEFAULTS : {};
            text = text.replaceAll('{threshold_attendance_rate}', window.thresholds.attendance_rate || d.attendance_rate || 88);
            text = text.replaceAll('{threshold_unapproved_absence}', window.thresholds.unapproved_absence || d.unapproved_absence || 2);
            text = text.replaceAll('{threshold_minimum_working_days}', window.thresholds.minimum_working_days || d.minimum_working_days || 12);
            text = text.replaceAll('{threshold_area_reject_rate}', window.thresholds.area_reject_rate || d.area_reject_rate || 3.0);
            text = text.replaceAll('{threshold_5prs_pass_rate}', window.thresholds['5prs_pass_rate'] || d['5prs_pass_rate'] || 95);
            text = text.replaceAll('{threshold_5prs_min_qty}', window.thresholds['5prs_min_qty'] || d['5prs_min_qty'] || 100);
            text = text.replaceAll('{threshold_consecutive_aql_months}', window.thresholds.consecutive_aql_months || d.consecutive_aql_months || 3);
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
        // Re-render all dynamically-built sections with new language
        if (typeof DashboardCharts !== 'undefined') {
            var d = DashboardCharts._criteriaData;
            if (d) {
                DashboardCharts.renderTypeTable(d);
                DashboardCharts.renderConditionCharts(d);
                DashboardCharts.renderPositionTables(d);
                DashboardCharts.renderCriteriaTab(d);
                DashboardCharts.renderTeamTab(d);
                DashboardCharts._renderBuildingSummaryCards(d.employees || []);
                DashboardCharts._renderTypeCalculationMethods(d);
                DashboardCharts._renderFAQSection();
                // Re-render Phase A features on language switch
                if (DashboardCharts.renderTrendChart) {
                    DashboardCharts.renderTrendChart(d);
                }
                if (DashboardCharts.renderTalentPool) {
                    DashboardCharts.renderTalentPool(d);
                }
                if (DashboardCharts.renderSummaryKPIs) {
                    DashboardCharts.renderSummaryKPIs(d);
                }
            }
        }
        // Update Quick Summary overlay if visible
        var qsPanel = document.getElementById('quickSummaryOverlay');
        if (qsPanel && qsPanel.style.display !== 'none') {
            toggleQuickSummary(); // Close and reopen to re-render with new language
            toggleQuickSummary();
        }
        // Update Data Period toggle button text
        var dpBtn = document.getElementById('dataPeriodToggle');
        if (dpBtn) {
            var dpSpan = dpBtn.querySelector('[data-i18n]');
            if (dpSpan) {
                var dpKey = window._isInterimReport ? 'dataPeriod.interim' : 'dataPeriod.final';
                dpSpan.setAttribute('data-i18n', dpKey);
                dpSpan.textContent = DashboardI18n.t(dpKey);
            }
        }
        // Update dark mode toggle tooltip
        var dmBtn = document.getElementById('darkModeToggle');
        if (dmBtn) {
            var isDark = document.documentElement.classList.contains('dark-mode');
            dmBtn.title = DashboardI18n.t(isDark ? 'common.lightMode' : 'common.darkMode');
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

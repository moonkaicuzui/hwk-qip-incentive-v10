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
        'attendanceLookup.times': { ko: '회', en: ' times', vi: ' lần' },
        'attendanceLookup.summaryStats': { ko: '요약 통계', en: 'Summary Statistics', vi: 'Thống kê tóm tắt' },
        'attendanceLookup.realData': { ko: '실제 출결 데이터', en: 'Actual Attendance Data', vi: 'Dữ liệu chấm công thực tế' },
        'attendanceLookup.noDetailData': { ko: '일별 상세 출결 데이터가 없습니다. 요약 통계만 사용할 수 있습니다.', en: 'No daily attendance details available. Only summary statistics are shown.', vi: 'Không có dữ liệu chấm công chi tiết. Chỉ hiển thị thống kê tóm tắt.' },
        'attendanceLookup.noAbsence': { ko: '결근 사유 없음 (전원 출근)', en: 'No absences (perfect attendance)', vi: 'Không vắng mặt (chấm công hoàn hảo)' },
        // Daily table headers
        'attendanceLookup.table.title': { ko: '일별 출결 현황', en: 'Daily Attendance Status', vi: 'Tình trạng chấm công hàng ngày' },
        'attendanceLookup.table.date': { ko: '날짜', en: 'Date', vi: 'Ngày' },
        'attendanceLookup.table.weekday': { ko: '요일', en: 'Weekday', vi: 'Thứ' },
        'attendanceLookup.table.status': { ko: '출결 상태', en: 'Status', vi: 'Trạng thái' },
        'attendanceLookup.table.reason': { ko: '상세 사유', en: 'Reason', vi: 'Lý do' },
        'attendanceLookup.table.absenceCount': { ko: '결근 횟수', en: 'Absence Count', vi: 'Số lần vắng' },
        'attendanceLookup.table.ratio': { ko: '비율', en: 'Ratio', vi: 'Tỷ lệ' },
        'attendanceLookup.table.count': { ko: '횟수', en: 'Count', vi: 'Số lần' },
        // Weekday names
        'attendanceLookup.weekdays.sun': { ko: '일', en: 'Sun', vi: 'CN' },
        'attendanceLookup.weekdays.mon': { ko: '월', en: 'Mon', vi: 'T2' },
        'attendanceLookup.weekdays.tue': { ko: '화', en: 'Tue', vi: 'T3' },
        'attendanceLookup.weekdays.wed': { ko: '수', en: 'Wed', vi: 'T4' },
        'attendanceLookup.weekdays.thu': { ko: '목', en: 'Thu', vi: 'T5' },
        'attendanceLookup.weekdays.fri': { ko: '금', en: 'Fri', vi: 'T6' },
        'attendanceLookup.weekdays.sat': { ko: '토', en: 'Sat', vi: 'T7' },
        // Status labels
        'attendanceLookup.status.present': { ko: '출근', en: 'Present', vi: 'Có mặt' },
        'attendanceLookup.status.approvedLeave': { ko: '승인휴가', en: 'Approved Leave', vi: 'Nghỉ phép' },
        'attendanceLookup.status.unapproved': { ko: '무단결근', en: 'Unapproved', vi: 'Vắng không phép' },
        'attendanceLookup.status.normalAttendance': { ko: '정상 출근', en: 'Normal', vi: 'Bình thường' },
        'attendanceLookup.status.late': { ko: '지각', en: 'Late', vi: 'Đi muộn' },
        'attendanceLookup.status.earlyLeave': { ko: '조퇴', en: 'Early Leave', vi: 'Về sớm' },
        // Badges
        'attendanceLookup.badge.approved': { ko: '승인', en: 'Approved', vi: 'Phê duyệt' },
        'attendanceLookup.badge.unapproved': { ko: '무단', en: 'Unapproved', vi: 'Không phép' },
        // Analysis section titles
        'attendanceLookup.analysis.absence': { ko: '결근 사유 분석', en: 'Absence Analysis', vi: 'Phân tích vắng mặt' },
        'attendanceLookup.analysis.weekdayPattern': { ko: '요일별 결근 패턴', en: 'Weekday Absence Pattern', vi: 'Mẫu vắng theo thứ' },
        'attendanceLookup.analysis.reasonCategory': { ko: '결근 사유별 분류', en: 'Absence Reason Classification', vi: 'Phân loại lý do vắng' },
        'attendanceLookup.analysis.summary': { ko: '출결 분석 요약', en: 'Attendance Analysis Summary', vi: 'Tóm tắt phân tích chấm công' },
        'attendanceLookup.analysis.summaryTitle': { ko: '출결 현황 요약', en: 'Attendance Summary', vi: 'Tóm tắt chấm công' },
        'attendanceLookup.analysis.conditionTitle': { ko: '인센티브 조건 충족 현황', en: 'Incentive Condition Status', vi: 'Trạng thái điều kiện' },
        'attendanceLookup.analysis.met': { ko: '충족', en: 'Met', vi: 'Đạt' },
        'attendanceLookup.analysis.notMet': { ko: '미충족', en: 'Not Met', vi: 'Chưa đạt' },
        'attendanceLookup.analysis.cond1': { ko: '조건 1', en: 'Cond. 1', vi: 'ĐK 1' },
        'attendanceLookup.analysis.cond2': { ko: '조건 2', en: 'Cond. 2', vi: 'ĐK 2' },
        'attendanceLookup.analysis.cond3': { ko: '조건 3', en: 'Cond. 3', vi: 'ĐK 3' },
        'attendanceLookup.analysis.cond4': { ko: '조건 4', en: 'Cond. 4', vi: 'ĐK 4' },
        'attendanceLookup.analysis.cond1Desc': { ko: '출근율 ≥ 기준%', en: 'Attendance Rate ≥ threshold', vi: 'Tỷ lệ ≥ ngưỡng' },
        'attendanceLookup.analysis.cond2Desc': { ko: '무단결근 ≤ 기준일', en: 'Unapproved ≤ threshold', vi: 'Vắng KP ≤ ngưỡng' },
        'attendanceLookup.analysis.cond3Desc': { ko: '실제 근무일 > 0', en: 'Actual Days > 0', vi: 'Ngày thực > 0' },
        'attendanceLookup.analysis.cond4Desc': { ko: '최소 근무일 ≥ 기준일', en: 'Min Days ≥ threshold', vi: 'Ngày tối thiểu ≥ ngưỡng' },
        'attendanceLookup.analysis.excellent': { ko: '우수한 출결 상태', en: 'Excellent Attendance', vi: 'Chấm công xuất sắc' },
        'attendanceLookup.analysis.caution': { ko: '주의 필요', en: 'Caution Needed', vi: 'Cần chú ý' },
        'attendanceLookup.analysis.improvement': { ko: '개선 필요', en: 'Improvement Needed', vi: 'Cần cải thiện' },
        'attendanceLookup.analysis.allCondMet': { ko: '4개 출근 조건 모두 충족 - 인센티브 수령 가능', en: 'All 4 attendance conditions met - eligible for incentive', vi: 'Đạt đủ 4 điều kiện - đủ điều kiện nhận thưởng' },
        'attendanceLookup.analysis.notMetSuffix': { ko: '미충족 - 개선 필요', en: 'not met - improvement needed', vi: 'chưa đạt - cần cải thiện' },
        // Pattern analysis
        'attendanceLookup.pattern.mondayFriday': { ko: '월요일/금요일 결근 비율이 높습니다 (주말 연장 패턴 의심)', en: 'High Mon/Fri absence rate (weekend extension pattern suspected)', vi: 'Tỷ lệ vắng T2/T6 cao (nghi nghỉ kéo dài cuối tuần)' },
        'attendanceLookup.pattern.unapprovedHigh': { ko: '무단결근이 승인휴가보다 많습니다 - 관리 필요', en: 'Unapproved absences exceed approved leave - attention needed', vi: 'Vắng không phép nhiều hơn nghỉ phép - cần quản lý' },
        'attendanceLookup.pattern.noUnapproved': { ko: '무단결근이 없습니다 - 우수', en: 'No unapproved absences - excellent', vi: 'Không vắng không phép - xuất sắc' },
        'attendanceLookup.pattern.noSpecial': { ko: '특이 패턴이 발견되지 않았습니다', en: 'No unusual patterns detected', vi: 'Không phát hiện mẫu bất thường' },

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
        'talentPool.monthlyBonus': { ko: '월 보너스 합계', en: 'Monthly Bonus Total', vi: 'Tổng thưởng tháng' },
        'talentPool.avgMonths': { ko: '평균 연속 개월', en: 'Avg Consecutive Months', vi: 'TB tháng liên tục' },
        'talentPool.maxMonths': { ko: '최장 연속 개월', en: 'Max Consecutive Months', vi: 'Tháng LT cao nhất' },
        'talentPool.incentiveAmount': { ko: '인센티브', en: 'Incentive', vi: 'Khuyến khích' },
        'talentPool.bonusIncluded': { ko: '보너스 포함', en: 'Bonus Included', vi: 'Đã bao gồm thưởng' },
        'talentPool.base': { ko: '기본', en: 'Base', vi: 'Cơ bản' },
        'talentPool.bonus': { ko: '보너스', en: 'Bonus', vi: 'Thưởng' },
        'talentPool.badge': { ko: 'TALENT', en: 'TALENT', vi: 'TALENT' },
        'talentPool.special': { ko: 'QIP Talent Pool', en: 'QIP Talent Pool', vi: 'QIP Talent Pool' },
        'talentPool.period': { ko: '지급 기간', en: 'Payment Period', vi: 'Kỳ thanh toán' },

        // LINE LEADER Not Assigned - Building Detail (Task #24)
        'lineLeader.buildingSummary': { ko: 'Building별 미배정 현황', en: 'Unassigned by Building', vi: 'Chưa phân công theo xưởng' },
        'lineLeader.unassignedCount': { ko: '미배정', en: 'Unassigned', vi: 'Chưa phân công' },
        'lineLeader.directBoss': { ko: '직속상관', en: 'Direct Boss', vi: 'Sếp trực tiếp' },
        'lineLeader.noBoss': { ko: '미배정', en: 'Not Assigned', vi: 'Chưa phân công' },
        'lineLeader.unknownBuilding': { ko: 'Building 미확인', en: 'Unknown Building', vi: 'Xưởng chưa xác định' },

        // (Dark Mode removed)

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
        'filter.allTypes': { ko: '전체 TYPE', en: 'All Types', vi: 'Tất cả loại' },

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
        'common.people_count': { ko: '명', en: ' ppl', vi: ' NV' },
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
        'modal.clickToViewBoss': { ko: '클릭하여 상사 정보 보기', en: 'Click to view supervisor details', vi: 'Nhấp để xem chi tiết quản lý' },

        // Task #18: Continuous Months Reset Notice
        'reset.title': { ko: '연속 개월 초기화', en: 'Continuous Months Reset', vi: 'Đặt lại tháng liên tục' },
        'reset.subtitle': { ko: '이전 달 대비 연속 개월이 초기화되었습니다', en: 'Continuous months have been reset compared to previous month', vi: 'Tháng liên tục đã được đặt lại so với tháng trước' },
        'reset.previous': { ko: '이전', en: 'Previous', vi: 'Trước' },
        'reset.current': { ko: '현재', en: 'Current', vi: 'Hiện tại' },
        'reset.reasonTitle': { ko: '초기화 사유', en: 'Reset Reasons', vi: 'Lý do đặt lại' },
        'reset.reason1': { ko: '출근율 미달 또는 무단결근 초과', en: 'Low attendance rate or excessive unapproved absences', vi: 'Tỷ lệ đi làm thấp hoặc vắng không phép vượt' },
        'reset.reason2': { ko: '당월 AQL 개인 실패 발생', en: 'Personal AQL failure this month', vi: 'Lỗi AQL cá nhân trong tháng' },
        'reset.reason3': { ko: '5PRS 통과율 또는 검사량 미달', en: '5PRS pass rate or inspection quantity below threshold', vi: 'Tỷ lệ đạt hoặc số lượng kiểm tra 5PRS dưới ngưỡng' },
        'reset.reason4': { ko: '최소 근무일수 미충족', en: 'Minimum working days not met', vi: 'Không đủ ngày làm tối thiểu' },
        'reset.restartTitle': { ko: '다시 시작하기', en: 'How to Restart', vi: 'Cách bắt đầu lại' },
        'reset.tip1': { ko: '다음 달부터 모든 조건을 충족하면 1개월부터 다시 시작', en: 'Meet all conditions next month to restart from month 1', vi: 'Đáp ứng tất cả điều kiện tháng sau để bắt đầu lại từ tháng 1' },
        'reset.tip2': { ko: '12개월 연속 달성 시 최대 인센티브 수령 가능', en: 'Achieve 12 consecutive months for maximum incentive', vi: 'Đạt 12 tháng liên tiếp để nhận khuyến khích tối đa' },
        'reset.encouragement': { ko: '다음 달부터 새로 시작할 수 있습니다!', en: 'You can start fresh next month!', vi: 'Bạn có thể bắt đầu lại từ tháng sau!' },

        // Task #19: TYPE-3 New Employee Roadmap
        'type3.title': { ko: '신입사원 인센티브 로드맵', en: 'New Employee Incentive Roadmap', vi: 'Lộ trình khuyến khích nhân viên mới' },
        'type3.subtitle': { ko: 'TYPE-3 정책 제외 대상', en: 'TYPE-3 Policy Excluded', vi: 'TYPE-3 Loại trừ theo chính sách' },
        'type3.step1': { ko: '입사 완료', en: 'Hired', vi: 'Đã tuyển' },
        'type3.step2': { ko: '교육 진행', en: 'Training', vi: 'Đào tạo' },
        'type3.step3': { ko: '현장 배치', en: 'Field Work', vi: 'Làm việc' },
        'type3.step4': { ko: '인센티브 시작', en: 'Incentive Start', vi: 'Bắt đầu KK' },
        'type3.hireDate': { ko: '입사일', en: 'Hire Date', vi: 'Ngày tuyển' },
        'type3.expectedStart': { ko: '인센티브 시작 예정', en: 'Expected Incentive Start', vi: 'Dự kiến bắt đầu KK' },
        'type3.nextMonth': { ko: '다음 달부터', en: 'From next month', vi: 'Từ tháng sau' },
        'type3.tip': { ko: '다음 달 모든 조건 충족 시 첫 인센티브 150,000 VND 수령 가능!', en: 'Meet all conditions next month for your first incentive of 150,000 VND!', vi: 'Đáp ứng tất cả điều kiện tháng sau để nhận khuyến khích đầu tiên 150.000 VND!' },

        // Task #20: Condition Improvement Guides (10 conditions)
        'guide.condition1': {
            ko: '출근율을 높이려면: 지각/조퇴를 줄이고, 승인된 휴가를 사전에 신청하세요',
            en: 'To improve attendance: Reduce tardiness/early leaves, request approved leave in advance',
            vi: 'Để cải thiện chuyên cần: Giảm đi muộn/về sớm, xin nghỉ phép trước'
        },
        'guide.condition2': {
            ko: '무단결근은 사전에 휴가 승인을 받으면 방지할 수 있습니다. 긴급 시 당일 보고 필수',
            en: 'Prevent unapproved absences by getting leave approved in advance. Report emergencies same day',
            vi: 'Tránh vắng không phép bằng cách xin phép trước. Báo cáo khẩn cấp ngay trong ngày'
        },
        'guide.condition3': {
            ko: '실제 근무일이 0일이면 인센티브를 받을 수 없습니다. 출근 기록을 확인하세요',
            en: 'Zero actual working days means no incentive. Please verify your attendance records',
            vi: 'Không có ngày làm thực tế nghĩa là không có khuyến khích. Vui lòng kiểm tra bảng chấm công'
        },
        'guide.condition4': {
            ko: '최소 근무일 미충족: 매월 충분한 근무일을 확보하세요. 장기 휴가 시 사전 조율 필요',
            en: 'Minimum working days not met: Ensure sufficient working days each month. Coordinate long leaves in advance',
            vi: 'Không đủ ngày làm tối thiểu: Đảm bảo đủ ngày làm mỗi tháng. Phối hợp nghỉ dài trước'
        },
        'guide.condition5': {
            ko: '개인 AQL 실패: 품질 검사를 더욱 꼼꼼히 수행하고, 불량 원인을 분석하여 재발을 방지하세요',
            en: 'Personal AQL failure: Perform quality checks more carefully, analyze defect causes to prevent recurrence',
            vi: 'Lỗi AQL cá nhân: Kiểm tra chất lượng cẩn thận hơn, phân tích nguyên nhân lỗi để ngăn tái phát'
        },
        'guide.condition6': {
            ko: 'AQL 연속 실패: 3개월 연속 실패는 인센티브 제외 사유입니다. 품질 교육에 참여하세요',
            en: 'AQL consecutive failure: 3 months of consecutive failures disqualifies you. Attend quality training',
            vi: 'Lỗi AQL liên tiếp: 3 tháng lỗi liên tiếp mất quyền nhận khuyến khích. Tham gia đào tạo chất lượng'
        },
        'guide.condition7': {
            ko: '팀/구역 AQL: 팀 전체의 품질 수준 개선이 필요합니다. 동료와 협력하여 품질을 높이세요',
            en: 'Team/Area AQL: Team-wide quality improvement needed. Collaborate with colleagues to raise quality',
            vi: 'AQL nhóm/khu vực: Cần cải thiện chất lượng toàn nhóm. Hợp tác với đồng nghiệp nâng cao chất lượng'
        },
        'guide.condition8': {
            ko: '구역 Reject Rate 초과: 구역 전체 불량률을 줄여야 합니다. 공정 개선을 확인하세요',
            en: 'Area Reject Rate exceeded: Reduce area-wide defect rate. Check process improvements',
            vi: 'Tỷ lệ từ chối khu vực vượt: Giảm tỷ lệ lỗi toàn khu vực. Kiểm tra cải tiến quy trình'
        },
        'guide.condition9': {
            ko: '5PRS 통과율 미달: 검사 정확도를 높이고, 불량 판정 기준을 재확인하세요',
            en: '5PRS pass rate below threshold: Improve inspection accuracy, verify defect criteria',
            vi: 'Tỷ lệ đạt 5PRS dưới ngưỡng: Nâng cao độ chính xác kiểm tra, xác minh tiêu chí lỗi'
        },
        'guide.condition10': {
            ko: '5PRS 검사량 부족: 목표 검사 수량을 달성하도록 작업 속도를 조절하세요',
            en: '5PRS inspection quantity below minimum: Adjust work pace to meet target inspection count',
            vi: 'SL kiểm tra 5PRS dưới tối thiểu: Điều chỉnh tốc độ làm việc để đạt số lượng kiểm tra mục tiêu'
        },

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
        'criteria.lineLeaderFormula': {
            ko: '부하 INSPECTOR 인센티브 합계 × 12% × 수급비율',
            en: 'Sub INSPECTOR incentive sum × 12% × receiving ratio',
            vi: 'Tổng KK INSPECTOR × 12% × tỷ lệ nhận'
        },
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
        'chart.condition': { ko: '조건', en: 'Condition', vi: 'Điều kiện' },
        'chart.passRate': { ko: '충족률', en: 'Pass Rate', vi: 'Tỷ lệ đạt' },
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
        'criteria.type1RqcNote': {
            ko: '* RQC Assembly Inspector (A1B): C10 면제 — 공정 점검 및 보고 업무 특성상 검사량 조건 적용 제외',
            en: '* RQC Assembly Inspector (A1B): C10 exempt — Inspection qty condition excluded due to process checking & reporting duties',
            vi: '* RQC Assembly Inspector (A1B): Miễn C10 — Không áp dụng điều kiện số lượng kiểm tra do nhiệm vụ kiểm tra quy trình & báo cáo'
        },
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

        // Attendance Formula Detail Section
        'attendance.classificationTitle': {
            ko: '결근 사유 분류',
            en: 'Absence Classification',
            vi: 'Phân loại lý do vắng'
        },
        'attendance.approvedTitle': {
            ko: '✅ 결근율에 포함 안됨 (승인된 휴가)',
            en: '✅ Not counted in absence rate (Approved Leave)',
            vi: '✅ Không tính vào tỷ lệ vắng (Nghỉ phép được duyệt)'
        },
        'attendance.unapprovedTitle': {
            ko: '❌ 결근율에 포함됨 (무단결근)',
            en: '❌ Counted in absence rate (Unapproved)',
            vi: '❌ Tính vào tỷ lệ vắng (Không phép)'
        },
        'attendance.leave.maternity': { ko: '출산휴가', en: 'Maternity Leave', vi: 'Nghỉ thai sản' },
        'attendance.leave.annual': { ko: '연차휴가', en: 'Annual Leave', vi: 'Nghỉ phép năm' },
        'attendance.leave.approved': { ko: '승인된 휴가', en: 'Approved Absence', vi: 'Vắng có phép' },
        'attendance.leave.postpartum': { ko: '출산 후 요양', en: 'Postpartum Rest', vi: 'Dưỡng sức sau sinh' },
        'attendance.leave.prenatal': { ko: '산전검진', en: 'Prenatal Checkup', vi: 'Khám thai' },
        'attendance.leave.childcare': { ko: '육아휴가', en: 'Childcare Leave', vi: 'Nghỉ con ốm' },
        'attendance.leave.sickShort': { ko: '병가', en: 'Short Sick Leave', vi: 'Ốm ngắn ngày' },
        'attendance.leave.businessTrip': { ko: '출장', en: 'Business Trip', vi: 'Công tác' },
        'attendance.leave.military': { ko: '군복무', en: 'Military Service', vi: 'Nghĩa vụ quân sự' },
        'attendance.leave.cardNotSwiped': { ko: '출퇴근 체크 누락', en: 'Card Not Swiped', vi: 'Không quẹt thẻ' },
        'attendance.leave.newEmployee': { ko: '신규입사 특례', en: 'New Employee Exception', vi: 'Nhân viên mới' },
        'attendance.leave.compensatory': { ko: '대체휴무', en: 'Compensatory Leave', vi: 'Nghỉ bù' },
        'attendance.absence.unauthorized': { ko: '무단결근', en: 'Unauthorized Absence', vi: 'Vắng không phép' },
        'attendance.absence.writtenNotice': { ko: '서면통지 결근', en: 'Written Notice Absence', vi: 'Vắng gửi thư' },
        'attendance.countingRulesTitle': {
            ko: '📢 무단결근 카운팅 규칙',
            en: '📢 Unapproved Absence Counting Rules',
            vi: '📢 Quy tắc tính vắng không phép'
        },
        'attendance.countingRule1': {
            ko: 'AR1 카테고리만 무단결근으로 카운트',
            en: 'Only AR1 category counts as unapproved absence',
            vi: 'Chỉ danh mục AR1 tính là vắng không phép'
        },
        'attendance.countingRule2': {
            ko: '{threshold_unapproved_absence}일까지는 인센티브 지급 가능',
            en: 'Up to {threshold_unapproved_absence} days: incentive eligible',
            vi: 'Đến {threshold_unapproved_absence} ngày: đủ điều kiện nhận KK'
        },
        'attendance.countingRule3': {
            ko: '{threshold_unapproved_absence}일 초과 시 인센티브 0원',
            en: 'Exceeding {threshold_unapproved_absence} days: incentive = 0',
            vi: 'Vượt {threshold_unapproved_absence} ngày: KK = 0'
        },
        'attendance.conditionCriteriaTitle': {
            ko: '조건 충족 기준',
            en: 'Condition Fulfillment Criteria',
            vi: 'Tiêu chí đáp ứng điều kiện'
        },
        'attendance.criteria1': {
            ko: '출근율: ≥ {threshold_attendance_rate}%',
            en: 'Attendance Rate: ≥ {threshold_attendance_rate}%',
            vi: 'Tỷ lệ đi làm: ≥ {threshold_attendance_rate}%'
        },
        'attendance.criteria2': {
            ko: '무단결근: ≤ {threshold_unapproved_absence}일 (AR1 카테고리만 해당)',
            en: 'Unapproved Absence: ≤ {threshold_unapproved_absence} days (AR1 category only)',
            vi: 'Vắng không phép: ≤ {threshold_unapproved_absence} ngày (chỉ AR1)'
        },
        'attendance.criteria3': {
            ko: '실제 근무일: > 0일',
            en: 'Actual Working Days: > 0 days',
            vi: 'Ngày làm thực tế: > 0 ngày'
        },
        'attendance.criteria4': {
            ko: '최소 근무일: ≥ {threshold_minimum_working_days}일',
            en: 'Minimum Working Days: ≥ {threshold_minimum_working_days} days',
            vi: 'Ngày làm tối thiểu: ≥ {threshold_minimum_working_days} ngày'
        },
        'attendance.formulaTitle': {
            ko: '📊 출근율 계산 공식',
            en: '📊 Attendance Rate Formula',
            vi: '📊 Công thức tính tỷ lệ đi làm'
        },
        'attendance.formulaDesc1': {
            ko: '결근일 = 총 근무일 - 실제 근무일 - 승인휴가일',
            en: 'Absence Days = Total Working Days - Actual Working Days - Approved Leave Days',
            vi: 'Ngày vắng = Tổng ngày làm - Ngày làm thực - Ngày nghỉ phép'
        },
        'attendance.formulaDesc2': {
            ko: '결근율 = 결근일 / 총 근무일 × 100',
            en: 'Absence Rate = Absence Days / Total Working Days × 100',
            vi: 'Tỷ lệ vắng = Ngày vắng / Tổng ngày làm × 100'
        },
        'attendance.formulaDesc3': {
            ko: '출근율 = 100 - 결근율 (승인휴가는 출근으로 인정)',
            en: 'Attendance Rate = 100 - Absence Rate (Approved leave counts as attendance)',
            vi: 'Tỷ lệ đi làm = 100 - Tỷ lệ vắng (Nghỉ phép được tính là đi làm)'
        },

        // All-Zero Explanation Banner
        'banner.allZero': {
            ko: '이번 달은 인센티브 수령자가 0명입니다. "인센티브 기준" 탭에서 조건별 충족 현황을 확인하세요.',
            en: 'No employees received incentives this month. Check the "Incentive Criteria" tab for condition fulfillment details.',
            vi: 'Không có nhân viên nào nhận khuyến khích tháng này. Kiểm tra tab "Tiêu chí khuyến khích" để xem chi tiết điều kiện.'
        },
        // Stale Data Warning Banner
        'banner.staleData': {
            ko: '데이터가 24시간 이상 업데이트되지 않았습니다. 마지막 업데이트: {timestamp}',
            en: 'Data has not been updated for over 24 hours. Last update: {timestamp}',
            vi: 'Dữ liệu chưa được cập nhật hơn 24 giờ. Lần cập nhật cuối: {timestamp}'
        },
        // Trend Chart Overlay
        'chart.trendOverlay': {
            ko: '이번 달 데이터가 아직 확정되지 않았습니다',
            en: 'This month\'s data is not yet finalized',
            vi: 'Dữ liệu tháng này chưa được hoàn tất'
        },
        // Loading Progress Steps
        'loading.step1': { ko: '직원 데이터 로딩...', en: 'Loading employee data...', vi: 'Đang tải dữ liệu nhân viên...' },
        'loading.step2': { ko: '요약 데이터 로딩...', en: 'Loading summary data...', vi: 'Đang tải dữ liệu tổng hợp...' },
        'loading.step3': { ko: '임계값 로딩...', en: 'Loading thresholds...', vi: 'Đang tải ngưỡng...' },
        'loading.step4': { ko: '차트 렌더링...', en: 'Rendering charts...', vi: 'Đang vẽ biểu đồ...' },

        // Data Freshness Badge
        'freshness.fresh': { ko: '🟢 최신 데이터', en: '🟢 Fresh Data', vi: '🟢 Dữ liệu mới' },
        'freshness.moderate': { ko: '🟡 업데이트 권장', en: '🟡 Update Recommended', vi: '🟡 Nên cập nhật' },
        'freshness.stale': { ko: '🔴 데이터 오래됨', en: '🔴 Data Outdated', vi: '🔴 Dữ liệu cũ' },
        'freshness.lastSync': { ko: '데이터 동기화', en: 'Data Sync', vi: 'Đồng bộ dữ liệu' },
        'freshness.minutesAgo': { ko: '분 전', en: 'min ago', vi: 'phút trước' },
        'freshness.hoursAgo': { ko: '시간 전', en: 'hr ago', vi: 'giờ trước' },
        'freshness.nextSync': { ko: '다음 자동 동기화', en: 'Next Auto Sync', vi: 'Tự động đồng bộ' },
        'freshness.minutes': { ko: '분 후', en: 'min', vi: 'phút' },

        // Team tab
        'team.building': { ko: 'Building', en: 'Building', vi: 'Xưởng' },
        'team.total': { ko: '전체:', en: 'Total:', vi: 'Tổng:' },
        'team.receiving': { ko: '수령:', en: 'Receiving:', vi: 'Nhận:' },
        'team.rate': { ko: '지급률:', en: 'Rate:', vi: 'Tỷ lệ:' },
        'team.amount': { ko: '금액:', en: 'Amount:', vi: 'Số tiền:' },
        'team.totalAmount': { ko: '총 지급액 (VND)', en: 'Total Amount (VND)', vi: 'Tổng tiền (VND)' },
        'team.buildings': { ko: '개 Building', en: ' buildings', vi: ' xưởng' },
        // Task #22: Team Position/Manager filter
        'team.filterByPosition': { ko: '직급별 필터', en: 'Filter by Position', vi: 'Lọc theo chức vụ' },
        'team.filterByManager': { ko: '관리자별 필터', en: 'Filter by Manager', vi: 'Lọc theo quản lý' },
        'team.allPositions': { ko: '전체 직급', en: 'All Positions', vi: 'Tất cả chức vụ' },
        'team.allManagers': { ko: '전체 관리자', en: 'All Managers', vi: 'Tất cả quản lý' },
        'team.resetFilter': { ko: '필터 초기화', en: 'Reset Filter', vi: 'Đặt lại bộ lọc' },
        'team.subordinatesOf': { ko: '소속 직원', en: 'Subordinates', vi: 'Nhân viên trực thuộc' },

        // Org chart extras
        'orgchart.totalManagers': { ko: '관리자 합계', en: 'Total Managers', vi: 'Tổng quản lý' },
        'orgchart.bldg': { ko: 'Bldg', en: 'Bldg', vi: 'Xưởng' },
        'orgchart.id': { ko: 'ID', en: 'ID', vi: 'ID' },
        'orgchart.receiving': { ko: '수령', en: 'receiving', vi: 'nhận' },
        'orgchart.bossChain': { ko: '상사 체인', en: 'Boss chain', vi: 'Chuỗi quản lý' },
        'orgchart.promptEmpNo': { ko: '사번을 입력하세요:', en: 'Employee No:', vi: 'Nhập mã NV:' },
        'orgchart.notFound': { ko: '직원 {id}을(를) 조직도에서 찾을 수 없습니다.', en: 'Employee {id} not found in org chart.', vi: 'Không tìm thấy nhân viên {id} trong sơ đồ tổ chức.' },
        'orgchart.noManagerData': { ko: '관리자 데이터가 없습니다.', en: 'No manager data available.', vi: 'Không có dữ liệu quản lý.' },
        'orgchart.expected': { ko: '기대', en: 'Expected', vi: 'Dự kiến' },

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
        'modal.bossName': { ko: '상사명', en: 'Supervisor', vi: 'Quản lý' },
        'modal.inspectionQty': { ko: '검사량', en: 'Inspection Qty', vi: 'SL kiểm tra' },
        'modal.failPattern': { ko: '실패 패턴', en: 'Fail Pattern', vi: 'Mẫu lỗi' },

        // Task #22: AQL Building 3-Table Modal
        'modal.aqlInspectors': { ko: 'AQL 검사원', en: 'AQL Inspectors', vi: 'Kiểm tra viên AQL' },
        'modal.buildingsAboveThreshold': { ko: '기준 초과 Building', en: 'Buildings Above Threshold', vi: 'Xưởng vượt ngưỡng' },
        'modal.aqlBuildingSummary': { ko: 'Building별 AQL 종합', en: 'AQL Summary by Building', vi: 'Tổng hợp AQL theo xưởng' },
        'modal.aqlFailCount': { ko: 'AQL 불합격 수', en: 'AQL Fail Count', vi: 'Số lỗi AQL' },
        'modal.aqlRejectRate': { ko: '불량률', en: 'Reject Rate', vi: 'Tỷ lệ lỗi' },
        'modal.aqlGrade': { ko: '등급', en: 'Grade', vi: 'Hạng' },
        'modal.aqlInspectorStats': { ko: '검사원 통계', en: 'Inspector Stats', vi: 'TK kiểm tra viên' },
        'modal.aqlTotalInspectors': { ko: '전체 검사원', en: 'Total Inspectors', vi: 'Tổng KTV' },
        'modal.aqlFailInspectors': { ko: '실패 검사원', en: 'Fail Inspectors', vi: 'KTV lỗi' },
        'modal.aqlPassOnlyInspectors': { ko: '합격만 검사원', en: 'Pass-Only Inspectors', vi: 'KTV chỉ đạt' },
        'modal.aqlIndividualDetail': { ko: '개인별 AQL 상세', en: 'Individual AQL Detail', vi: 'Chi tiết AQL cá nhân' },

        // V9 Feature: 5PRS 2-Table
        'modal.lowPassRateTable1': { ko: '기준 미달자 목록', en: 'Below Threshold', vi: 'Dưới ngưỡng' },
        'modal.top10LowestPassRate': { ko: 'Top 10 최저 통과율', en: 'Top 10 Lowest Pass Rates', vi: 'Top 10 tỷ lệ đạt thấp nhất' },

        // V9 Feature: AQL Consecutive Fail
        'modal.threeMonthAqlFail': { ko: '3개월 연속 AQL 실패', en: '3-Month Consecutive AQL Fail', vi: 'Lỗi AQL liên tục 3 tháng' },
        'modal.twoMonthAqlFail': { ko: '2개월 연속 AQL 실패', en: '2-Month Consecutive AQL Fail', vi: 'Lỗi AQL liên tục 2 tháng' },
        'modal.lineLeaderAggregation': { ko: 'Line Leader별 실패자 집계', en: 'Failures by Line Leader', vi: 'Thống kê lỗi theo Line Leader' },
        'modal.supervisorName': { ko: '관리자명', en: 'Supervisor Name', vi: 'Tên quản lý' },
        'modal.totalCount': { ko: '합계', en: 'Total', vi: 'Tổng' },
        'modal.subordinateNames': { ko: '소속 직원', en: 'Subordinates', vi: 'Nhân viên' },

        // V9 Feature: Cross-Building
        'modal.totalCases': { ko: '전체 건수', en: 'Total Cases', vi: 'Tổng số' },
        'modal.caseMismatch': { ko: 'Building 불일치', en: 'Building Mismatch', vi: 'Khác tòa nhà' },
        'modal.caseNoInfo': { ko: '상사 Building 정보없음', en: 'Boss Building Unknown', vi: 'Không có TT xưởng quản lý' },

        // V9 Feature: AQL Inspector 3-Part
        'modal.aqlInspector3Part': { ko: 'AQL Inspector 인센티브 상세 (3-Part)', en: 'AQL Inspector Incentive Details (3-Part)', vi: 'Chi tiết KK AQL Inspector (3 phần)' },
        'modal.aqlPart1': { ko: 'AQL 검사 평가', en: 'AQL Inspection', vi: 'Đánh giá AQL' },
        'modal.aqlPart2': { ko: 'CFA 자격증', en: 'CFA Certificate', vi: 'Chứng chỉ CFA' },
        'modal.aqlPart3': { ko: 'HWK 클레임 방지', en: 'HWK Claim Prevention', vi: 'Phòng ngừa khiếu nại HWK' },
        'modal.category': { ko: '구분', en: 'Category', vi: 'Hạng mục' },
        'modal.conditionDetail': { ko: '조건', en: 'Condition', vi: 'Điều kiện' },
        'modal.amount': { ko: '금액', en: 'Amount', vi: 'Số tiền' },
        'modal.total': { ko: '합계', en: 'Total', vi: 'Tổng' },
        'modal.conditionNotMet': { ko: '조건 미충족으로 지급 보류', en: 'Payment suspended (conditions not met)', vi: 'Tạm giữ (chưa đáp ứng điều kiện)' },
        'unit.months': { ko: '개월', en: 'months', vi: 'tháng' },

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

        // Admin page
        'admin.headerTitle': { ko: 'HWK QIP Incentive - 관리자 패널', en: 'HWK QIP Incentive - Admin Panel', vi: 'HWK QIP Incentive - Quản trị' },
        'admin.headerSubtitle': { ko: '시스템 설정 및 관리', en: 'System Configuration & Management', vi: 'Cấu hình & Quản lý hệ thống' },
        'admin.dashboard': { ko: '대시보드', en: 'Dashboard', vi: 'Bảng điều khiển' },
        'admin.logout': { ko: '로그아웃', en: 'Logout', vi: 'Đăng xuất' },
        'admin.verifyingAccess': { ko: '관리자 접근 권한 확인 중...', en: 'Verifying admin access...', vi: 'Đang xác minh quyền quản trị...' },

        // Admin - Threshold Settings
        'admin.thresholds': { ko: '임계값 설정', en: 'Threshold Settings', vi: 'Cài đặt ngưỡng' },
        'admin.month': { ko: '월', en: 'Month', vi: 'Tháng' },
        'admin.year': { ko: '년', en: 'Year', vi: 'Năm' },
        'admin.load': { ko: '불러오기', en: 'Load', vi: 'Tải' },
        'admin.attendanceRate': { ko: '출근율 (%)', en: 'Attendance Rate (%)', vi: 'Tỷ lệ chấm công (%)' },
        'admin.unapprovedAbsence': { ko: '무단결근 (일)', en: 'Unapproved Absence (days)', vi: 'Vắng không phép (ngày)' },
        'admin.minimumWorkingDays': { ko: '최소 근무일', en: 'Minimum Working Days', vi: 'Ngày làm tối thiểu' },
        'admin.areaRejectRate': { ko: 'AQL 불량률 (%)', en: 'Area Reject Rate (%)', vi: 'Tỷ lệ lỗi khu vực (%)' },
        'admin.5prsPassRate': { ko: '5PRS 통과율 (%)', en: '5PRS Pass Rate (%)', vi: 'Tỷ lệ đạt 5PRS (%)' },
        'admin.5prsMinQty': { ko: '5PRS 최소 검사량', en: '5PRS Inspection Qty', vi: 'SL kiểm tra 5PRS tối thiểu' },
        'admin.consecutiveAqlMonths': { ko: 'AQL 연속 실패 기준 (월)', en: 'Consecutive AQL Fail Months', vi: 'Tháng lỗi AQL liên tục' },
        'admin.saveThresholds': { ko: '임계값 저장', en: 'Save Thresholds', vi: 'Lưu ngưỡng' },

        // Admin - Change History
        'admin.history': { ko: '변경 이력', en: 'Change History', vi: 'Lịch sử thay đổi' },
        'admin.historyDateTime': { ko: '일시', en: 'Date/Time', vi: 'Ngày/Giờ' },
        'admin.historyChangedBy': { ko: '변경자', en: 'Changed By', vi: 'Người thay đổi' },
        'admin.historyMonth': { ko: '월', en: 'Month', vi: 'Tháng' },
        'admin.historyField': { ko: '항목', en: 'Field', vi: 'Trường' },
        'admin.historyOld': { ko: '이전값', en: 'Old', vi: 'Cũ' },
        'admin.historyNew': { ko: '새값', en: 'New', vi: 'Mới' },
        'admin.noHistory': { ko: '변경 이력 없음', en: 'No change history yet', vi: 'Chưa có lịch sử thay đổi' },

        // Admin - System Status
        'admin.systemStatus': { ko: '시스템 상태', en: 'System Status', vi: 'Trạng thái hệ thống' },
        'admin.lastPipelineRun': { ko: '마지막 파이프라인 실행', en: 'Last Pipeline Run', vi: 'Chạy pipeline cuối' },
        'admin.status': { ko: '상태', en: 'Status', vi: 'Trạng thái' },
        'admin.lastDataUpdate': { ko: '마지막 데이터 업데이트', en: 'Last Data Update', vi: 'Cập nhật dữ liệu cuối' },
        'admin.currentMonth': { ko: '현재 월', en: 'Current Month', vi: 'Tháng hiện tại' },
        'admin.runPipeline': { ko: '파이프라인 실행', en: 'Run Pipeline Now', vi: 'Chạy Pipeline' },
        'admin.targetMonth': { ko: '대상 월:', en: 'Target Month:', vi: 'Tháng mục tiêu:' },
        'admin.autoDetect': { ko: '자동 감지 (최신)', en: 'Auto-detect (latest)', vi: 'Tự động (mới nhất)' },

        // Admin - Working Days Override
        'admin.workingDays': { ko: '근무일 수 재정의', en: 'Working Days Override', vi: 'Ghi đè ngày làm việc' },
        'admin.workingDaysDesc': { ko: '특정 월의 자동 계산된 근무일 수를 재정의합니다. 임계값 설정에서 선택한 월/년을 사용합니다.', en: 'Override the automatically calculated working days for a specific month. Uses the same month/year selected in Threshold Settings.', vi: 'Ghi đè ngày làm việc tự động cho tháng cụ thể. Sử dụng tháng/năm đã chọn trong Cài đặt ngưỡng.' },
        'admin.selectedPeriod': { ko: '선택 기간', en: 'Selected Period', vi: 'Kỳ đã chọn' },
        'admin.currentWorkingDays': { ko: '현재 근무일', en: 'Current Working Days', vi: 'Ngày làm hiện tại' },
        'admin.overrideValue': { ko: '재정의 값', en: 'Override Value', vi: 'Giá trị ghi đè' },
        'admin.updateWorkingDays': { ko: '근무일 업데이트', en: 'Update Working Days', vi: 'Cập nhật ngày làm' },

        // Admin - Email Report Settings
        'admin.emailSettings': { ko: '이메일 보고서 설정', en: 'Email Report Settings', vi: 'Cài đặt báo cáo email' },
        'admin.emailName': { ko: '이름', en: 'Name', vi: 'Tên' },
        'admin.emailAddress': { ko: '이메일', en: 'Email', vi: 'Email' },
        'admin.emailLang': { ko: '언어', en: 'Lang', vi: 'Ngôn ngữ' },
        'admin.emailAdd': { ko: '추가', en: 'Add', vi: 'Thêm' },
        'admin.noRecipients': { ko: '등록된 수신자 없음', en: 'No recipients configured', vi: 'Chưa có người nhận' },

        // Admin - Tab Labels
        'admin.tabThresholds': { ko: '임계값 설정', en: 'Thresholds', vi: 'Ngưỡng' },
        'admin.tabConfigs': { ko: '설정 관리', en: 'Config Management', vi: 'Quản lý cấu hình' },
        'admin.tabSystem': { ko: '시스템', en: 'System', vi: 'Hệ thống' },
        'admin.tabData': { ko: '데이터 조회', en: 'Data Lookup', vi: 'Tra cứu dữ liệu' },

        // Admin - History Type column
        'admin.historyType': { ko: '유형', en: 'Type', vi: 'Loại' },

        // Admin - TYPE-2 Position Mapping Panel
        'admin.positionMapping': { ko: 'TYPE-2 직급 매핑', en: 'TYPE-2 Position Mapping', vi: 'Ánh xạ chức vụ TYPE-2' },
        'admin.cfgPositionName': { ko: '직급명', en: 'Position Name', vi: 'Tên chức vụ' },
        'admin.cfgMappedTo': { ko: '매핑 대상 (TYPE-1)', en: 'Mapped To (TYPE-1)', vi: 'Ánh xạ đến (TYPE-1)' },
        'admin.cfgDescription': { ko: '설명', en: 'Description', vi: 'Mô tả' },

        // Admin - Talent Pool Panel
        'admin.talentPool': { ko: 'QIP Talent Pool', en: 'QIP Talent Pool', vi: 'QIP Talent Pool' },
        'admin.tpAutoApply': { ko: '자동 적용', en: 'Auto Apply', vi: 'Áp dụng tự động' },
        'admin.tpStackRegular': { ko: '기존 인센티브에 추가', en: 'Stack with Regular Incentive', vi: 'Cộng thêm vào thưởng thường' },
        'admin.tpRequireConditions': { ko: '조건 충족 필요', en: 'Require Conditions', vi: 'Yêu cầu đủ điều kiện' },
        'admin.tpEmpNo': { ko: '사번', en: 'Emp No', vi: 'Mã NV' },
        'admin.tpName': { ko: '이름', en: 'Name', vi: 'Tên' },
        'admin.tpStartDate': { ko: '시작일', en: 'Start Date', vi: 'Ngày bắt đầu' },
        'admin.tpEndDate': { ko: '종료일', en: 'End Date', vi: 'Ngày kết thúc' },
        'admin.tpBonus': { ko: '월 보너스', en: 'Monthly Bonus', vi: 'Thưởng hàng tháng' },
        'admin.tpStatus': { ko: '상태', en: 'Status', vi: 'Trạng thái' },

        // Admin - Auditor/Trainer Area Mapping Panel
        'admin.auditorMapping': { ko: 'Auditor/Trainer 구역 매핑', en: 'Auditor/Trainer Area Mapping', vi: 'Ánh xạ khu vực Auditor/Trainer' },
        'admin.audModelMaster': { ko: 'Model Master (전체 구역)', en: 'Model Masters (ALL areas)', vi: 'Model Master (TẤT CẢ khu vực)' },
        'admin.audAuditors': { ko: 'Auditor 구역 배정', en: 'Auditor Area Assignments', vi: 'Phân công khu vực Auditor' },
        'admin.audDefaultRejectRate': { ko: '기본 불량률 임계값 (%)', en: 'Default Reject Rate Threshold (%)', vi: 'Ngưỡng tỷ lệ lỗi mặc định (%)' },
        'admin.audEditConditions': { ko: '조건 편집', en: 'Edit Area Conditions', vi: 'Sửa điều kiện khu vực' },

        // Admin - Continuous Months Panel (read-only)
        'admin.continuousMonths': { ko: '연속 근무월 추적', en: 'Consecutive Working Months', vi: 'Theo dõi tháng làm liên tục' },
        'admin.cmReadOnlyInfo': { ko: '이 데이터는 계산 파이프라인에서 자동 생성됩니다. 여기서 편집할 수 없습니다.', en: 'This data is auto-generated by the calculation pipeline. It cannot be edited here.', vi: 'Dữ liệu này được tạo tự động bởi pipeline tính toán. Không thể chỉnh sửa tại đây.' },
        'admin.cmSearch': { ko: '이름 또는 사번 검색...', en: 'Search by name or ID...', vi: 'Tìm theo tên hoặc mã NV...' },
        'admin.cmPosition': { ko: '직급', en: 'Position', vi: 'Chức vụ' },
        'admin.cmPrevMonths': { ko: '이전 연속월', en: 'Prev Months', vi: 'Tháng trước' },
        'admin.cmCurrentMonths': { ko: '현재 연속월', en: 'Current Months', vi: 'Tháng hiện tại' },
        'admin.cmIncentive': { ko: '인센티브', en: 'Incentive', vi: 'Thưởng' },
        'admin.cmTotal': { ko: '표시', en: 'Showing', vi: 'Hiển thị' },
        'admin.cmLastUpdated': { ko: '최종 업데이트', en: 'Last Updated', vi: 'Cập nhật lần cuối' },

        // Admin - Common Actions
        'admin.cfgSave': { ko: '저장', en: 'Save', vi: 'Lưu' },
        'admin.cfgCancel': { ko: '취소', en: 'Cancel', vi: 'Hủy' },
        'admin.cfgApply': { ko: '적용', en: 'Apply', vi: 'Áp dụng' },
        'admin.cfgAdd': { ko: '추가', en: 'Add', vi: 'Thêm' },
        'admin.cfgEdit': { ko: '수정', en: 'Edit', vi: 'Sửa' },
        'admin.cfgDelete': { ko: '삭제', en: 'Delete', vi: 'Xóa' },
        'admin.cfgNoData': { ko: '데이터 없음', en: 'No data', vi: 'Không có dữ liệu' },

        // Admin - Status Messages
        'admin.cfgSaveSuccess': { ko: '저장 완료', en: 'Saved successfully', vi: 'Đã lưu thành công' },
        'admin.cfgSaveFailed': { ko: '저장 실패', en: 'Save failed', vi: 'Lưu thất bại' },
        'admin.cfgLoadFailed': { ko: '불러오기 실패', en: 'Load failed', vi: 'Tải thất bại' },
        'admin.cfgConfirmDelete': { ko: '삭제하시겠습니까?', en: 'Are you sure you want to delete?', vi: 'Bạn có chắc muốn xóa?' },
        'admin.cfgUnsavedChanges': { ko: '저장하지 않은 변경 사항이 있습니다.', en: 'You have unsaved changes.', vi: 'Bạn có thay đổi chưa lưu.' },

        // Admin - Position Condition Matrix Panel
        'admin.cfgCondMatrix': { ko: '직급별 조건 매트릭스', en: 'Position Condition Matrix', vi: 'Ma trận điều kiện theo chức vụ' },
        'admin.cfgProgTable': { ko: '누진 인센티브 테이블', en: 'Progressive Incentive Table', vi: 'Bảng khuyến khích lũy tiến' },
        'admin.cfgType2Mult': { ko: 'TYPE-2 계산 배수', en: 'TYPE-2 Multipliers', vi: 'Hệ số nhân TYPE-2' },
        'admin.cfgConditions': { ko: '적용 조건', en: 'Applicable Conditions', vi: 'Điều kiện áp dụng' },
        'admin.cfgMonth': { ko: '개월', en: 'Month', vi: 'Tháng' },
        'admin.cfgAmount': { ko: '금액 (VND)', en: 'Amount (VND)', vi: 'Số tiền (VND)' },
        'admin.cfgMultiplier': { ko: '배수', en: 'Multiplier', vi: 'Hệ số' },
        'admin.cfgBase': { ko: '기준', en: 'Base', vi: 'Cơ sở' },
        'admin.cfgFormula': { ko: '산식', en: 'Formula', vi: 'Công thức' },
        'admin.cfgPatterns': { ko: '패턴', en: 'Patterns', vi: 'Mẫu' },
        'admin.cfgPosCode': { ko: '직급 코드', en: 'Position Code', vi: 'Mã chức vụ' },
        'admin.cfgExemptionReason': { ko: '면제 사유', en: 'Exemption Reason', vi: 'Lý do miễn' },
        'admin.cfgAddPosition': { ko: '직급 추가', en: 'Add Position', vi: 'Thêm chức vụ' },
        'admin.cfgDefaultNoDelete': { ko: 'default 항목은 삭제할 수 없습니다', en: 'Default entry cannot be deleted', vi: 'Không thể xóa mục mặc định' },
        'admin.cfgSaveMatrix': { ko: '매트릭스 저장', en: 'Save Matrix', vi: 'Lưu ma trận' },
        'admin.cfgSaveProgTable': { ko: '테이블 저장', en: 'Save Table', vi: 'Lưu bảng' },
        'admin.cfgSaveMultipliers': { ko: '배수 저장', en: 'Save Multipliers', vi: 'Lưu hệ số' },
        'admin.cfgGuideMatrix': { ko: '각 직급별로 적용되는 인센티브 조건(C1~C10)을 설정합니다. 체크된 조건을 모두 충족해야 인센티브가 지급됩니다.', en: 'Configure incentive conditions (C1~C10) for each position. All checked conditions must be met to receive incentives.', vi: 'Cấu hình điều kiện khuyến khích (C1~C10) cho từng chức vụ. Tất cả điều kiện đã chọn phải được đáp ứng.' },
        'admin.cfgGuideProgTable': { ko: '근속 개월 수에 따른 누진 인센티브 금액(VND)을 설정합니다. ASSEMBLY INSPECTOR, MODEL MASTER, AUDITOR/TRAINER에 적용됩니다.', en: 'Set progressive incentive amounts (VND) by service months. Applies to ASSEMBLY INSPECTOR, MODEL MASTER, AUDITOR/TRAINER.', vi: 'Đặt số tiền khuyến khích lũy tiến (VND) theo tháng. Áp dụng cho ASSEMBLY INSPECTOR, MODEL MASTER, AUDITOR/TRAINER.' },
        'admin.cfgGuideType2Mult': { ko: 'TYPE-2 직급(LINE LEADER 이상)의 인센티브 계산 배수를 설정합니다. 기준값에 배수를 곱하여 인센티브가 계산됩니다.', en: 'Configure incentive multipliers for TYPE-2 positions (LINE LEADER and above). Incentive = base value × multiplier.', vi: 'Cấu hình hệ số nhân cho chức vụ TYPE-2. Khuyến khích = giá trị cơ sở × hệ số.' },
        'admin.cfgNewPosPlaceholder': { ko: '직급 KEY (예: NEW_POSITION)', en: 'Position KEY (e.g. NEW_POSITION)', vi: 'KEY chức vụ (vd: NEW_POSITION)' },
        'admin.cfgBaseSubordinate': { ko: '부하직원 인센티브 합계', en: 'Subordinate Incentive Total', vi: 'Tổng KK cấp dưới' },
        'admin.cfgBaseLineLdrAvg': { ko: 'TYPE-1 LINE LEADER 평균', en: 'TYPE-1 LINE LEADER Average', vi: 'TB TYPE-1 LINE LEADER' },
        'admin.cfgEmptyType2': { ko: '아직 TYPE-2 배수 설정이 없습니다. 아래에서 직급을 추가한 후 저장하세요.', en: 'No TYPE-2 multiplier settings yet. Add positions below and save.', vi: 'Chưa có cài đặt hệ số TYPE-2. Thêm chức vụ bên dưới và lưu.' },

        // Admin - Footer
        'admin.footer': { ko: 'Version 10.0 - 관리자 패널 - Firestore 보안 아키텍처', en: 'Version 10.0 - Admin Panel - Firestore Secure Architecture', vi: 'Version 10.0 - Quản trị - Kiến trúc bảo mật Firestore' },

        // Admin - Dynamic Messages (showMessage, confirm, status badges)
        'admin.msg.saving': { ko: '저장 중...', en: 'Saving...', vi: 'Đang lưu...' },
        'admin.msg.updating': { ko: '업데이트 중...', en: 'Updating...', vi: 'Đang cập nhật...' },
        'admin.msg.processing': { ko: '처리 중...', en: 'Processing...', vi: 'Đang xử lý...' },
        'admin.msg.notSet': { ko: '미설정', en: 'Not set', vi: 'Chưa đặt' },
        'admin.msg.never': { ko: '없음', en: 'Never', vi: 'Chưa bao giờ' },
        'admin.msg.noData': { ko: '데이터 없음', en: 'No data', vi: 'Không có dữ liệu' },
        'admin.msg.errorLoading': { ko: '로딩 오류', en: 'Error loading', vi: 'Lỗi tải' },
        'admin.msg.loadError': { ko: '로드 실패', en: 'Load Error', vi: 'Lỗi tải' },
        'admin.msg.success': { ko: '성공', en: 'Success', vi: 'Thành công' },
        'admin.msg.failure': { ko: '실패', en: 'Failure', vi: 'Thất bại' },
        'admin.msg.dataUpdated': { ko: '데이터 업데이트됨', en: 'Data Updated', vi: 'Đã cập nhật dữ liệu' },
        'admin.msg.noChanges': { ko: '변경 없음', en: 'No Changes', vi: 'Không thay đổi' },
        'admin.msg.na': { ko: 'N/A', en: 'N/A', vi: 'N/A' },
        'admin.msg.daysOverride': { ko: '일 (재정의)', en: 'days (override)', vi: 'ngày (ghi đè)' },
        'admin.msg.days': { ko: '일', en: 'days', vi: 'ngày' },

        // Admin - Threshold messages
        'admin.msg.thresholdsLoaded': { ko: '임계값 불러옴: ', en: 'Thresholds loaded for ', vi: 'Đã tải ngưỡng cho ' },
        'admin.msg.noThresholdsSaved': { ko: '저장된 임계값 없음: ', en: 'No thresholds saved for ', vi: 'Chưa lưu ngưỡng cho ' },
        'admin.msg.showingDefaults': { ko: '. 기본값 표시 중.', en: '. Showing defaults.', vi: '. Hiển thị mặc định.' },
        'admin.msg.failedLoadThresholds': { ko: '임계값 불러오기 실패: ', en: 'Failed to load thresholds: ', vi: 'Tải ngưỡng thất bại: ' },
        'admin.msg.invalidNumbers': { ko: '모든 필드에 유효한 양수를 입력하세요.', en: 'Please enter valid positive numbers for all fields.', vi: 'Vui lòng nhập số dương hợp lệ cho tất cả trường.' },
        'admin.msg.thresholdsSaved': { ko: '임계값 저장됨: ', en: 'Thresholds saved for ', vi: 'Đã lưu ngưỡng cho ' },
        'admin.msg.fieldsChanged': { ko: '개 항목 변경)', en: ' field(s) changed)', vi: ' trường đã thay đổi)' },
        'admin.msg.noFieldChanges': { ko: ' (변경 없음)', en: ' (no changes)', vi: ' (không thay đổi)' },
        'admin.msg.failedSave': { ko: '저장 실패: ', en: 'Failed to save: ', vi: 'Lưu thất bại: ' },
        'admin.msg.failedLoadHistory': { ko: '이력 불러오기 실패: ', en: 'Failed to load history: ', vi: 'Tải lịch sử thất bại: ' },

        // Admin - Working days messages
        'admin.msg.invalidWorkingDays': { ko: '0에서 31 사이의 유효한 숫자를 입력하세요.', en: 'Please enter a valid number between 0 and 31.', vi: 'Vui lòng nhập số hợp lệ từ 0 đến 31.' },
        'admin.msg.workingDaysSet': { ko: '근무일 재정의 설정: ', en: 'Working days override set to ', vi: 'Đã đặt ghi đè ngày làm: ' },
        'admin.msg.for': { ko: ' (', en: ' for ', vi: ' cho ' },
        'admin.msg.failedUpdate': { ko: '업데이트 실패: ', en: 'Failed to update: ', vi: 'Cập nhật thất bại: ' },

        // Admin - Pipeline messages
        'admin.msg.pipelineConfirm': { ko: '파이프라인을 실행하시겠습니까?\n\n다음을 수행합니다:\n  1. 트리거 요청 기록 (감사 추적)\n  2. GitHub Actions 페이지 열기\n  3. GitHub에서 "Run workflow" 버튼 클릭\n\n계속하시겠습니까?', en: 'Run Pipeline Now?\n\nThis will:\n  1. Log a trigger request (audit trail)\n  2. Open GitHub Actions page\n  3. Click "Run workflow" button on GitHub\n\nContinue?', vi: 'Chạy Pipeline?\n\nThao tác này sẽ:\n  1. Ghi nhật ký yêu cầu\n  2. Mở trang GitHub Actions\n  3. Nhấn nút "Run workflow" trên GitHub\n\nTiếp tục?' },
        'admin.msg.pipelineOpened': { ko: 'GitHub Actions 페이지가 새 탭에서 열렸습니다. "Run workflow" 버튼을 클릭하여 파이프라인을 시작하세요.', en: 'GitHub Actions page opened in a new tab. Click the "Run workflow" button to start the pipeline.', vi: 'Đã mở trang GitHub Actions trong tab mới. Nhấn nút "Run workflow" để bắt đầu pipeline.' },
        'admin.msg.failedProcess': { ko: '처리 실패: ', en: 'Failed to process: ', vi: 'Xử lý thất bại: ' },

        // Admin - Email messages
        'admin.msg.failedLoad': { ko: '불러오기 실패: ', en: 'Failed to load: ', vi: 'Tải thất bại: ' },
        'admin.msg.invalidEmail': { ko: '유효한 이메일 주소를 입력하세요.', en: 'Please enter a valid email address.', vi: 'Vui lòng nhập địa chỉ email hợp lệ.' },
        'admin.msg.enterName': { ko: '이름을 입력하세요.', en: 'Please enter a name.', vi: 'Vui lòng nhập tên.' },
        'admin.msg.duplicateEmail': { ko: '이 이메일은 이미 수신자 목록에 있습니다.', en: 'This email is already in the recipient list.', vi: 'Email này đã có trong danh sách người nhận.' },
        'admin.msg.added': { ko: '추가됨: ', en: 'Added ', vi: 'Đã thêm ' },
        'admin.msg.failedAdd': { ko: '추가 실패: ', en: 'Failed to add: ', vi: 'Thêm thất bại: ' },
        'admin.msg.confirmRemove': { ko: '수신자 목록에서 제거하시겠습니까? ', en: 'Remove from the recipient list? ', vi: 'Xóa khỏi danh sách người nhận? ' },
        'admin.msg.removed': { ko: '제거됨: ', en: 'Removed ', vi: 'Đã xóa ' },
        'admin.msg.failedRemove': { ko: '제거 실패: ', en: 'Failed to remove: ', vi: 'Xóa thất bại: ' },

        // Admin Configs - Dynamic Messages
        'admin.cfg.enterPosition': { ko: '직급명을 입력하세요.', en: 'Please enter a position name.', vi: 'Vui lòng nhập tên chức vụ.' },
        'admin.cfg.added': { ko: '추가됨: "', en: 'Added "', vi: 'Đã thêm "' },
        'admin.cfg.clickSave': { ko: '". 저장을 클릭하세요.', en: '". Click Save to persist.', vi: '". Nhấn Lưu để áp dụng.' },
        'admin.cfg.removed': { ko: '제거됨: "', en: 'Removed "', vi: 'Đã xóa "' },
        'admin.cfg.removedClickSave': { ko: '". 저장을 클릭하세요.', en: '". Click Save to persist.', vi: '". Nhấn Lưu để áp dụng.' },
        'admin.cfg.savedSuccess': { ko: '저장 완료.', en: 'saved successfully.', vi: 'đã lưu thành công.' },
        'admin.cfg.saveFailed': { ko: '저장 실패: ', en: 'Save failed: ', vi: 'Lưu thất bại: ' },
        'admin.cfg.empNoNameRequired': { ko: '사번과 이름은 필수입니다.', en: 'Employee No and Name are required.', vi: 'Mã NV và Tên là bắt buộc.' },
        'admin.cfg.addedMember': { ko: '멤버 추가됨. 저장을 클릭하세요.', en: 'Added member. Click Save to persist.', vi: 'Đã thêm thành viên. Nhấn Lưu để áp dụng.' },
        'admin.cfg.memberRemoved': { ko: '멤버 제거됨. 저장을 클릭하세요.', en: 'Member removed. Click Save to persist.', vi: 'Đã xóa thành viên. Nhấn Lưu để áp dụng.' },
        'admin.cfg.removedSave': { ko: '제거됨. 저장을 클릭하세요.', en: 'Removed. Click Save to persist.', vi: 'Đã xóa. Nhấn Lưu để áp dụng.' },
        'admin.cfg.conditionsUpdated': { ko: '조건 업데이트됨: ', en: 'Conditions updated for ', vi: 'Đã cập nhật điều kiện cho ' },
        'admin.cfg.conditionsClickSave': { ko: '. 저장을 클릭하세요.', en: '. Click Save to persist.', vi: '. Nhấn Lưu để áp dụng.' },
        'admin.cfg.keyExists': { ko: '키 "', en: 'Key "', vi: 'Key "' },
        'admin.cfg.alreadyExists': { ko: '" 이미 존재합니다.', en: '" already exists.', vi: '" đã tồn tại.' },
        'admin.cfg.addedTo': { ko: '" 추가됨 (', en: '" to ', vi: '" vào ' },
        'admin.cfg.invalidNumbers': { ko: '유효한 양수를 입력하세요.', en: 'Please enter valid positive numbers.', vi: 'Vui lòng nhập số dương hợp lệ.' },
        'admin.cfg.positionMappingSaved': { ko: '직급 매핑 저장 완료.', en: 'Position mapping saved successfully.', vi: 'Đã lưu ánh xạ chức vụ.' },
        'admin.cfg.talentPoolSaved': { ko: 'Talent Pool 저장 완료.', en: 'Talent Pool saved successfully.', vi: 'Đã lưu Talent Pool.' },
        'admin.cfg.auditorMappingSaved': { ko: 'Auditor 매핑 저장 완료.', en: 'Auditor mapping saved successfully.', vi: 'Đã lưu ánh xạ Auditor.' },
        'admin.cfg.condMatrixSaved': { ko: '조건 매트릭스 저장 완료.', en: 'Position Condition Matrix saved successfully.', vi: 'Đã lưu ma trận điều kiện.' },
        'admin.cfg.progTableSaved': { ko: '누진 테이블 저장 완료.', en: 'Progressive Incentive Table saved successfully.', vi: 'Đã lưu bảng lũy tiến.' },
        'admin.cfg.type2MultSaved': { ko: 'TYPE-2 배수 저장 완료.', en: 'TYPE-2 Multipliers saved successfully.', vi: 'Đã lưu hệ số TYPE-2.' },
        'admin.cfg.confirmRemove': { ko: '제거하시겠습니까? ', en: 'Remove ', vi: 'Xóa ' },
        'admin.cfg.confirmQuestion': { ko: '?', en: '?', vi: '?' },

        // Allowance system
        'allowance.badge': { ko: 'Allowance', en: 'Allowance', vi: 'Cho phép' },
        'allowance.applied': { ko: 'Allowance 적용됨', en: 'Allowance Applied', vi: 'Đã áp dụng Allowance' },
        'allowance.reason': { ko: '사유', en: 'Reason', vi: 'Lý do' },
        'allowance.reason.MEDICAL': { ko: '의료/건강', en: 'Medical', vi: 'Y tế' },
        'allowance.reason.COMPANY_ORDER': { ko: '회사 지시', en: 'Company Order', vi: 'Lệnh công ty' },
        'allowance.reason.NATURAL_DISASTER': { ko: '천재지변', en: 'Natural Disaster', vi: 'Thiên tai' },
        'allowance.reason.OTHER': { ko: '기타', en: 'Other', vi: 'Khác' },
        'allowance.overriddenConditions': { ko: 'Override 조건', en: 'Overridden Conditions', vi: 'Điều kiện ghi đè' },

        // Admin - Allowances Tab
        'admin.tabAllowances': { ko: 'Allowances', en: 'Allowances', vi: 'Allowances' },
        'admin.allowances.title': { ko: 'Allowance 관리 (예외 승인)', en: 'Allowance Management (Exception Override)', vi: 'Quản lý Allowance (Ghi đè ngoại lệ)' },
        'admin.allowances.search': { ko: '직원 검색 (사번 또는 이름)', en: 'Search Employee (ID or Name)', vi: 'Tìm nhân viên (Mã NV hoặc Tên)' },
        'admin.allowances.selectConditions': { ko: 'Override할 조건 선택', en: 'Select Conditions to Override', vi: 'Chọn điều kiện ghi đè' },
        'admin.allowances.reasonCode': { ko: '사유 코드', en: 'Reason Code', vi: 'Mã lý do' },
        'admin.allowances.reasonDetail': { ko: '상세 사유 (필수)', en: 'Reason Detail (required)', vi: 'Chi tiết lý do (bắt buộc)' },
        'admin.allowances.preview': { ko: '미리보기', en: 'Preview', vi: 'Xem trước' },
        'admin.allowances.apply': { ko: 'Allowance 적용', en: 'Apply Allowance', vi: 'Áp dụng Allowance' },
        'admin.allowances.revoke': { ko: '철회', en: 'Revoke', vi: 'Thu hồi' },
        'admin.allowances.activeList': { ko: '활성 Allowance 목록', en: 'Active Allowances', vi: 'Danh sách Allowance đang hoạt động' },
        'admin.allowances.noActive': { ko: '이 월에 활성 Allowance가 없습니다.', en: 'No active allowances for this month.', vi: 'Không có Allowance nào cho tháng này.' },
        'admin.allowances.status.PENDING': { ko: '대기', en: 'Pending', vi: 'Chờ' },
        'admin.allowances.status.APPLIED': { ko: '적용됨', en: 'Applied', vi: 'Đã áp dụng' },
        'admin.allowances.status.REVOKED': { ko: '철회됨', en: 'Revoked', vi: 'Đã thu hồi' },
        'admin.allowances.confirmApply': { ko: 'Allowance를 적용하시겠습니까?', en: 'Apply this allowance?', vi: 'Áp dụng allowance này?' },
        'admin.allowances.confirmRevoke': { ko: 'Allowance를 철회하시겠습니까? 원본 값으로 복원됩니다.', en: 'Revoke this allowance? Original values will be restored.', vi: 'Thu hồi allowance? Giá trị gốc sẽ được khôi phục.' },
        'admin.allowances.applied': { ko: 'Allowance 적용 완료', en: 'Allowance applied successfully', vi: 'Đã áp dụng Allowance thành công' },
        'admin.allowances.revoked': { ko: 'Allowance 철회 완료', en: 'Allowance revoked successfully', vi: 'Đã thu hồi Allowance thành công' },
        'admin.allowances.revokeReason': { ko: '철회 사유', en: 'Revoke Reason', vi: 'Lý do thu hồi' },
        'admin.allowances.noFailConditions': { ko: '이 직원은 FAIL 조건이 없습니다.', en: 'No FAIL conditions for this employee.', vi: 'Nhân viên này không có điều kiện FAIL.' },
        'admin.allowances.employeeNotFound': { ko: '직원을 찾을 수 없습니다.', en: 'Employee not found.', vi: 'Không tìm thấy nhân viên.' },
        'admin.allowances.infoGuide': { ko: '인센티브 조건 중 FAIL인 조건을 관리자가 합리적 사유로 면제(override)할 수 있습니다. 원본 데이터는 보존됩니다.', en: 'Admin can override FAIL conditions with valid reasons. Original data is preserved.', vi: 'Quản trị viên có thể ghi đè điều kiện FAIL với lý do hợp lệ. Dữ liệu gốc được bảo toàn.' },

        // Error messages (data loading)
        'error.loadEmployees': { ko: '직원 데이터를 불러올 수 없습니다. 연결 상태를 확인하고 다시 시도해주세요.', en: 'Failed to load employee data. Please check your connection and try again.', vi: 'Không thể tải dữ liệu nhân viên. Vui lòng kiểm tra kết nối và thử lại.' },
        'error.loadSummary': { ko: '대시보드 요약을 불러올 수 없습니다. 다시 시도해주세요.', en: 'Failed to load dashboard summary. Please try again.', vi: 'Không thể tải tổng hợp bảng điều khiển. Vui lòng thử lại.' },
        'error.loadAll': { ko: '대시보드 데이터를 불러올 수 없습니다. 페이지를 새로고침하거나 나중에 다시 시도해주세요.', en: 'Failed to load dashboard data. Please refresh the page or try again later.', vi: 'Không thể tải dữ liệu bảng điều khiển. Vui lòng làm mới trang hoặc thử lại sau.' }
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
                // Re-render team subordinate view + manager dropdown on language switch
                if (typeof DashboardFilters !== 'undefined') {
                    var mgrSelect = document.getElementById('teamManagerFilter');
                    var posSelect = document.getElementById('teamPositionFilter');
                    var savedMgr = mgrSelect ? mgrSelect.value : '';
                    // Re-populate manager dropdown to update "(N명)" → "(N ppl)" text
                    if (posSelect && posSelect.value) {
                        DashboardFilters.onTeamPositionChange();
                        // Restore manager selection after dropdown re-population
                        if (savedMgr && mgrSelect) {
                            mgrSelect.value = savedMgr;
                        }
                    }
                    // Re-render subordinate table with new language (single render)
                    if (savedMgr && mgrSelect && mgrSelect.value === savedMgr) {
                        DashboardFilters._showTeamMembers(savedMgr);
                    }
                }
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
                // Re-render attendance calendar on language switch (Bug fix: calendar text stayed in original language)
                if (DashboardCharts.renderAttendanceCalendar) {
                    DashboardCharts.renderAttendanceCalendar(d);
                }
                // Re-render data freshness badge + banners on language switch
                if (DashboardCharts.updateDataFreshness) {
                    DashboardCharts.updateDataFreshness(d);
                }
                // Re-render all-zero banner text
                var zeroBanner = document.getElementById('all-zero-banner');
                if (zeroBanner && zeroBanner.style.display !== 'none') {
                    var zeroText = document.getElementById('all-zero-text');
                    if (zeroText) zeroText.textContent = DashboardI18n.t('banner.allZero');
                }
                // Re-render attendance lookup result on language switch (Bug fix: result labels stayed in original language)
                var lookupInput = document.getElementById('attendanceLookupInput');
                if (lookupInput && lookupInput.value && typeof DashboardFilters !== 'undefined') {
                    DashboardFilters.searchAttendance(lookupInput.value);
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
        // (Dark mode toggle removed)
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

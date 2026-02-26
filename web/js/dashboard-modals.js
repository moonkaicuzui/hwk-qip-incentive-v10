/**
 * Dashboard Modals Module
 * HWK QIP Incentive Dashboard V10
 *
 * Handles all modal popups: employee detail, position detail, and validation
 * detail (dynamic) modals. Uses Bootstrap 5 Modal API for pre-existing modals
 * and manual DOM management for dynamic modals.
 *
 * Pre-existing modal shells in dashboard.html:
 *   - #employeeModal  (modal-xl) - Employee detail
 *   - #positionModal  (modal-xl) - Position detail
 *
 * Dynamic modals are appended to document.body and removed on close.
 *
 * Depends on:
 *   - dashboard-data.js   (window.employeeData, window.employeeHelpers)
 *   - dashboard-charts.js (DashboardCharts.formatVND, DashboardCharts.formatPercent)
 *   - dashboard-i18n.js   (DashboardI18n.t, DashboardI18n.currentLang)
 *   - Bootstrap 5.3.2     (bootstrap.Modal)
 *
 * Known issue references (from V9 codebase):
 *   - Issue #28: All ID comparisons use String() conversion
 *   - Issue #37: Use window.employeeHelpers for incentive access
 *   - Issue #48: Continuous_FAIL uses includes('YES'), never === 'YES'
 *   - Issue #56: AQL/5PRS show N/A for TYPE-2 and TYPE-3
 *   - Issue #62: Define close function BEFORE populating table data
 */

// ---------------------------------------------------------------------------
// DashboardModals Namespace
// ---------------------------------------------------------------------------

var DashboardModals = {

    // Data references (set via init)
    employees: [],
    summary: {},
    thresholds: {},

    // TYPE-1 progressive incentive table - loaded from Firestore via window.progressiveTable
    // Fallback: PROGRESSIVE_TABLE_DEFAULT (defined in dashboard-data.js)
    _getProgressiveTable: function () {
        return window.progressiveTable || PROGRESSIVE_TABLE_DEFAULT;
    },

    // ------------------------------------------------------------------
    // Public API
    // ------------------------------------------------------------------

    /**
     * Initialize the modals module with dashboard data.
     * Called from dashboard.html DOMContentLoaded after data is loaded.
     *
     * @param {Object} data - { employees: Array, summary: Object, thresholds: Object }
     */
    init: function (data) {
        if (!data) {
            console.warn('[DashboardModals] init called with no data');
            return;
        }

        this.employees = data.employees || [];
        this.summary = data.summary || {};
        this.thresholds = data.thresholds || window.thresholds || {};


    },

    // ====================================================================
    // Employee Detail Modal (#employeeModal - Bootstrap 5)
    // ====================================================================

    /**
     * Show the employee detail modal for a given employee number.
     * Populates the pre-existing #employeeModal with employee data.
     *
     * @param {string|number} empNo - Employee number
     */
    showEmployeeDetail: function (empNo) {
        var empNoStr = String(empNo || '').trim();
        if (!empNoStr) return;

        // Issue #28: String comparison for ID matching
        var emp = this._findEmployee(empNoStr);
        if (!emp) {
            console.warn('[DashboardModals] Employee not found:', empNoStr);
            return;
        }

        var titleEl = document.getElementById('employeeModalTitle');
        var bodyEl = document.getElementById('employeeModalBody');
        if (!titleEl || !bodyEl) return;

        var empName = this._escapeHtml(emp.full_name || emp.name || emp.Name || emp['Employee Name'] || '--');
        var empPosition = this._escapeHtml(emp.position || emp.Position || emp['Position Name'] || '--');
        titleEl.textContent = empName + ' - ' + empPosition;

        var html = '';

        // 1. Basic Info Section
        html += this._renderBasicInfo(emp);

        // 2. Attendance Section
        html += this._renderAttendanceInfo(emp);

        // 3. Conditions Table (10 conditions)
        html += this._renderConditionsTable(emp);

        // 4. Incentive Section
        html += this._renderIncentiveInfo(emp);

        // 5. AQL Section
        html += this._renderAqlInfo(emp);

        // 6. 5PRS Section
        html += this._render5PrsInfo(emp);

        bodyEl.innerHTML = html;

        // Show using Bootstrap 5 Modal API
        var modalEl = document.getElementById('employeeModal');
        if (modalEl) {
            var bsModal = bootstrap.Modal.getOrCreateInstance(modalEl);
            bsModal.show();
        }
    },

    // ====================================================================
    // Position Detail Modal (#positionModal - Bootstrap 5)
    // ====================================================================

    /**
     * Show position detail modal filtered by position name.
     * Populates the pre-existing #positionModal.
     *
     * @param {string} positionName - Position name to filter by
     */
    showPositionDetail: function (positionName) {
        if (!positionName) return;

        var posUpper = positionName.toUpperCase();
        var filtered = this.employees.filter(function (emp) {
            var p = String(emp.position || emp.Position || emp['Position Name'] || '').toUpperCase();
            return p === posUpper;
        });

        var titleEl = document.getElementById('positionModalTitle');
        var bodyEl = document.getElementById('positionModalBody');
        if (!titleEl || !bodyEl) return;

        var t = this._t;
        titleEl.textContent = positionName + ' (' + filtered.length + t('common.people_count') + ')';

        // Calculate summary
        var receivingCount = 0;
        var totalIncentive = 0;
        var self = this;

        filtered.forEach(function (emp) {
            var amount = self._getIncentive(emp, 'current');
            if (amount > 0) {
                receivingCount++;
                totalIncentive += amount;
            }
        });

        var avgIncentive = receivingCount > 0 ? totalIncentive / receivingCount : 0;

        var html = '';

        // Summary cards
        html += '<div style="display: flex; gap: 16px; margin-bottom: 20px; flex-wrap: wrap;">';
        html += this._renderMiniKpi(t('kpi.recipients'), receivingCount + '/' + filtered.length + t('common.people_count'));
        html += this._renderMiniKpi(t('kpi.totalAmount'), this._formatVND(totalIncentive) + ' VND');
        html += this._renderMiniKpi(t('typeTable.avgReceiving'), this._formatVND(avgIncentive) + ' VND');
        html += '</div>';

        // Employee table
        var columns = [
            { key: 'emp_no', label: t('table.empNo') },
            { key: 'name', label: t('table.name') },
            { key: 'building', label: t('table.building') },
            { key: 'conditions', label: t('modal.conditionStatus') },
            { key: 'incentive', label: t('table.incentive') }
        ];
        html += this._createEmployeeTable(filtered, columns);

        bodyEl.innerHTML = html;

        // Show using Bootstrap 5 Modal API
        var modalEl = document.getElementById('positionModal');
        if (modalEl) {
            var bsModal = bootstrap.Modal.getOrCreateInstance(modalEl);
            bsModal.show();
        }
    },

    // ====================================================================
    // Validation Detail Modal (Dynamic - appended to body)
    // ====================================================================

    /**
     * Show a validation detail modal for a given KPI type.
     * Creates a dynamic modal, populates it, and appends to body.
     * Called from dashboard.html showValidationDetail() placeholder.
     *
     * IMPORTANT (Issue #62): Close function is defined BEFORE any data
     * population to ensure the modal can always be closed even if an
     * error occurs during table rendering.
     *
     * @param {string} type - Validation type identifier
     */
    showValidation: function (type) {
        if (!type) return;

        var self = this;
        var modalId = 'validationDetailModal';
        var th = this.thresholds;

        // Remove any existing dynamic modal
        this._removeDynamicModal(modalId);

        // Determine title and filter logic
        var config = this._getValidationConfig(type, th);
        if (!config) {
            console.warn('[DashboardModals] Unknown validation type:', type);
            return;
        }

        // Create the dynamic modal
        var result = this._createDynamicModal(modalId, config.title, 'modal-xl');
        var modalDiv = result.modal;
        var bodyDiv = result.body;

        // Append to body first
        document.body.appendChild(modalDiv);

        // Issue #62: Define close function BEFORE populating table data
        var closeFn = result.close;
        window.closeValidationModal = closeFn;

        // Backdrop click to close
        modalDiv.addEventListener('click', function (e) {
            if (e.target === modalDiv) closeFn();
        });

        // Prevent close on content click
        var contentEl = modalDiv.querySelector('.dm-modal-content');
        if (contentEl) {
            contentEl.addEventListener('click', function (e) {
                e.stopPropagation();
            });
        }

        // Show the modal
        modalDiv.style.display = 'flex';

        // Populate table data inside try-catch (Issue #62)
        try {
            var html = '';

            if (type === 'totalWorkingDays') {
                // Special case: summary info, not a filtered list
                html += this._renderWorkingDaysSummary();
            } else {
                // Filter employees based on type
                var filtered = this._filterEmployees(type, th);

                html += '<p style="margin: 0 0 12px; color: #616161;">';
                html += this._t('kpi.recipients') + ': <strong>' + filtered.length + '</strong>';
                html += this._t('common.people_count');
                html += '</p>';

                // Build table columns based on type
                var columns = this._getValidationColumns(type);
                html += this._createEmployeeTable(filtered, columns, type);
            }

            bodyDiv.innerHTML = html;

        } catch (e) {
            console.error('[DashboardModals][Issue #62] Error populating validation modal:', e);
            bodyDiv.innerHTML = '<p style="color: #c62828; padding: 20px;">' + this._t('modal.errorLoading') + '</p>';
        }
    },

    // ====================================================================
    // Private: Employee Detail Sections
    // ====================================================================

    /**
     * Render basic info section for employee detail modal.
     * @param {Object} emp
     * @returns {string} HTML
     * @private
     */
    _renderBasicInfo: function (emp) {
        var t = this._t;
        var empNo = String(emp.emp_no || emp['Employee No'] || '--');
        var building = this._escapeHtml(emp.building || emp.BUILDING || '--');
        var empType = this._escapeHtml(emp.type || emp.TYPE || emp['ROLE TYPE STD'] || '--');
        var entranceDate = this._escapeHtml(emp.entrance_date || emp['Entrance Date'] || '--');
        var bossName = this._escapeHtml(emp.boss_name || emp['Boss Name'] || '--');

        var typeBadgeClass = 'badge-type ';
        var typeUpper = String(empType).toUpperCase();
        if (typeUpper.indexOf('TYPE-1') !== -1) typeBadgeClass += 'badge-type1';
        else if (typeUpper.indexOf('TYPE-2') !== -1) typeBadgeClass += 'badge-type2';
        else typeBadgeClass += 'badge-type3';

        var html = '<div class="section-card" style="margin-bottom: 16px;">';
        html += '<h3 style="font-size: 1rem; margin: 0 0 12px;">' + t('modal.employeeDetail') + '</h3>';
        html += '<div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 10px;">';
        html += this._renderInfoItem(t('table.empNo'), empNo);
        html += this._renderInfoItem(t('table.building'), building);
        html += this._renderInfoItem(t('table.type'), '<span class="' + typeBadgeClass + '">' + this._escapeHtml(empType) + '</span>');
        html += this._renderInfoItem(t('modal.entranceDate'), entranceDate);
        html += this._renderInfoItem(t('modal.bossName'), bossName);
        html += '</div></div>';

        return html;
    },

    /**
     * Render attendance info section.
     * @param {Object} emp
     * @returns {string} HTML
     * @private
     */
    _renderAttendanceInfo: function (emp) {
        var t = this._t;
        var att = emp.attendance || {};
        var rate = att.rate || emp.attendance_rate || emp['Attendance Rate'] || 0;
        var actualDays = att.actual_days || emp.actual_working_days || emp['Actual Working Days'] || 0;
        var totalDays = att.total_days || emp.total_working_days || emp['Total Working Days'] || 0;
        var unapproved = att.unapproved_absence || emp.unapproved_absence || emp['Unapproved Absences'] || 0;
        var approvedLeave = att.approved_leave || emp.approved_leave_days || emp['Approved Leave Days'] || 0;

        var html = '<div class="section-card" style="margin-bottom: 16px;">';
        html += '<h3 style="font-size: 1rem; margin: 0 0 12px;">' + t('modal.attendanceInfo') + '</h3>';
        html += '<div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 10px;">';
        html += this._renderInfoItem(t('condition.1'), this._formatPercent(rate) + '%');
        html += this._renderInfoItem(t('condition.3'), actualDays + t('common.days'));
        html += this._renderInfoItem(t('validation.totalWorkingDays'), totalDays + t('common.days'));
        html += this._renderInfoItem(t('condition.2'), unapproved + t('common.days'));
        html += this._renderInfoItem(t('modal.approvedLeave'), approvedLeave + t('common.days'));
        html += '</div></div>';

        return html;
    },

    /**
     * Render 10-condition table with YES/NO/N/A badges.
     * @param {Object} emp
     * @returns {string} HTML
     * @private
     */
    _renderConditionsTable: function (emp) {
        var t = this._t;
        var helpers = window.employeeHelpers;
        var empType = String(emp.type || emp.TYPE || emp['ROLE TYPE STD'] || '').toUpperCase();
        var isType1 = empType.indexOf('TYPE-1') !== -1 || empType === '1';

        var conditionNames = [
            t('condition.1'),   // 1: Attendance Rate
            t('condition.2'),   // 2: Unapproved Absence
            t('condition.3'),   // 3: Actual Working Days
            t('condition.4'),   // 4: Minimum Working Days
            t('condition.5'),   // 5: Personal AQL Failure
            t('condition.6'),   // 6: AQL Consecutive Failure
            t('condition.7'),   // 7: Team/Area AQL
            t('condition.8'),   // 8: Area Reject Rate
            t('condition.9'),   // 9: 5PRS Pass Rate
            t('condition.10')   // 10: 5PRS Inspection Qty
        ];

        var passCount = 0;
        var totalApplicable = 0;

        var html = '<div class="section-card" style="margin-bottom: 16px;">';
        html += '<h3 style="font-size: 1rem; margin: 0 0 12px;">' + t('modal.conditionStatus') + '</h3>';
        html += '<div class="table-container"><table>';
        html += '<thead><tr>';
        html += '<th style="width: 40px;">#</th>';
        html += '<th>' + t('modal.conditionHeader') + '</th>';
        html += '<th style="text-align: right;">' + t('modal.valueHeader') + '</th>';
        html += '<th style="text-align: right;">' + t('modal.thresholdHeader') + '</th>';
        html += '<th style="text-align: center;">' + t('modal.resultHeader') + '</th>';
        html += '</tr></thead><tbody>';

        for (var i = 1; i <= 10; i++) {
            var result = helpers ? helpers.getCondition(emp, i) : 'N/A';
            var value = helpers ? helpers.getConditionValue(emp, i) : 0;
            var threshold = helpers ? helpers.getConditionThreshold(emp, i) : 0;

            // Issue #56: AQL/5PRS show N/A for TYPE-2 and TYPE-3
            if (!isType1 && i >= 5) {
                result = 'N/A';
            }

            var badge = this._formatBadge(result, 'condition');

            if (result !== 'N/A') {
                totalApplicable++;
                if (result === 'YES') passCount++;
            }

            // Format value display
            var valueStr = '--';
            if (result !== 'N/A') {
                if (i === 1 || i === 8 || i === 9) {
                    valueStr = this._formatPercent(value) + '%';
                } else {
                    valueStr = String(value);
                }
            }

            var thresholdStr = '--';
            if (result !== 'N/A' && threshold !== 0) {
                if (i === 1 || i === 8 || i === 9) {
                    thresholdStr = this._formatPercent(threshold) + '%';
                } else {
                    thresholdStr = String(threshold);
                }
            }

            html += '<tr>';
            html += '<td style="text-align: center; color: #9e9e9e;">' + i + '</td>';
            html += '<td>' + conditionNames[i - 1] + '</td>';
            html += '<td style="text-align: right;">' + valueStr + '</td>';
            html += '<td style="text-align: right;">' + thresholdStr + '</td>';
            html += '<td style="text-align: center;">' + badge + '</td>';
            html += '</tr>';
        }

        html += '</tbody></table></div>';

        // Summary line
        var summaryColor = (totalApplicable > 0 && passCount === totalApplicable) ? '#2e7d32' : '#c62828';
        html += '<p style="margin: 10px 0 0; font-weight: 600; color: ' + summaryColor + ';">';
        html += passCount + '/' + totalApplicable + ' ' + t('modal.conditionsPassed');
        if (totalApplicable > 0 && passCount === totalApplicable) {
            html += ' (100%)';
        } else if (totalApplicable > 0) {
            html += ' (' + Math.round(passCount / totalApplicable * 100) + '%)';
        }
        html += '</p>';
        html += '</div>';

        return html;
    },

    /**
     * Render incentive info section with progression bar for TYPE-1.
     * @param {Object} emp
     * @returns {string} HTML
     * @private
     */
    _renderIncentiveInfo: function (emp) {
        var t = this._t;
        var currentIncentive = this._getIncentive(emp, 'current');
        var previousIncentive = this._getIncentive(emp, 'previous');
        var continuousMonths = parseInt(emp.continuous_months || emp.Continuous_Months || 0, 10) || 0;
        var empType = String(emp.type || emp.TYPE || emp['ROLE TYPE STD'] || '').toUpperCase();
        var isType1 = empType.indexOf('TYPE-1') !== -1 || empType === '1';

        var html = '<div class="section-card" style="margin-bottom: 16px;">';
        html += '<h3 style="font-size: 1rem; margin: 0 0 12px;">' + t('modal.incentiveInfo') + '</h3>';
        html += '<div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 10px;">';
        html += this._renderInfoItem(
            t('modal.currentIncentive'),
            '<span style="font-weight: 700; color: ' + (currentIncentive > 0 ? '#2e7d32' : '#c62828') + ';">'
                + this._formatVND(currentIncentive) + ' VND</span>'
        );
        html += this._renderInfoItem(
            t('modal.previousIncentive'),
            this._formatVND(previousIncentive) + ' VND'
        );
        if (isType1) {
            html += this._renderInfoItem(
                t('modal.continuousMonths'),
                '<strong>' + continuousMonths + '</strong> / 15'
            );
        }
        html += '</div>';

        // Progression bar for TYPE-1
        if (isType1 && continuousMonths > 0) {
            html += '<div style="margin-top: 14px;">';
            html += '<div style="font-size: 0.82rem; color: #757575; margin-bottom: 6px;">'
                  + t('modal.progressionBar') + '</div>';

            var maxMonths = 15;
            var barWidth = Math.min(continuousMonths / maxMonths * 100, 100);
            var barColor = continuousMonths >= 12 ? '#2e7d32' : (continuousMonths >= 6 ? '#f9a825' : '#1565c0');

            html += '<div style="background: #e0e0e0; border-radius: 8px; height: 22px; position: relative; overflow: hidden;">';
            html += '<div style="background: ' + barColor + '; width: ' + barWidth + '%; height: 100%; border-radius: 8px; transition: width 0.5s;"></div>';
            html += '<span style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); font-size: 0.72rem; font-weight: 600; color: #fff; text-shadow: 0 1px 2px rgba(0,0,0,0.3);">';
            html += continuousMonths + ' / ' + maxMonths;
            html += '</span></div>';

            // Progression table preview
            html += '<div style="display: flex; gap: 4px; margin-top: 8px; overflow-x: auto;">';
            for (var m = 1; m <= maxMonths; m++) {
                var amount = this._getProgressiveTable()[m] || 0;
                var isCurrent = (m === continuousMonths);
                var bg = isCurrent ? barColor : '#f5f5f5';
                var fg = isCurrent ? '#fff' : '#9e9e9e';
                var border = isCurrent ? '2px solid ' + barColor : '1px solid #e0e0e0';
                html += '<div style="min-width: 44px; text-align: center; padding: 3px 2px; border-radius: 4px;';
                html += ' background: ' + bg + '; color: ' + fg + '; border: ' + border + '; font-size: 0.65rem;">';
                html += '<div style="font-weight: 600;">' + m + '</div>';
                html += '<div>' + (amount / 1000) + 'K</div>';
                html += '</div>';
            }
            html += '</div>';
            html += '</div>';
        }

        html += '</div>';
        return html;
    },

    /**
     * Render AQL info section.
     * @param {Object} emp
     * @returns {string} HTML
     * @private
     */
    _renderAqlInfo: function (emp) {
        var t = this._t;
        var empType = String(emp.type || emp.TYPE || emp['ROLE TYPE STD'] || '').toUpperCase();
        var isType1 = empType.indexOf('TYPE-1') !== -1 || empType === '1';

        // Issue #56: Show N/A for TYPE-2 and TYPE-3
        if (!isType1) {
            var html = '<div class="section-card" style="margin-bottom: 16px;">';
            html += '<h3 style="font-size: 1rem; margin: 0 0 12px;">AQL</h3>';
            html += '<p style="color: #9e9e9e;">' + this._formatBadge('N/A', 'condition');
            html += ' ' + t('modal.aqlNotApplicable') + '</p>';
            html += '</div>';
            return html;
        }

        var aql = emp.aql || {};
        var failures = aql.failures || emp.aql_failures || emp['AQL_Failures'] || 0;
        var continuousFail = aql.continuous_fail || emp.continuous_fail || emp['Continuous_FAIL'] || 'NO';
        var areaRejectRate = aql.area_reject_rate || emp.area_reject_rate || emp['Area_Reject_Rate'] || 0;
        var totalTests = aql.total_tests || emp.total_tests || emp['Total_Tests'] || 0;
        var passCount = aql.pass_count || emp.pass_count || emp['Pass_Count'] || 0;
        var failPercent = aql.fail_percent || emp.fail_percent || emp['AQL_Fail_Percent'] || 0;

        var html = '<div class="section-card" style="margin-bottom: 16px;">';
        html += '<h3 style="font-size: 1rem; margin: 0 0 12px;">AQL</h3>';
        html += '<div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 10px;">';
        html += this._renderInfoItem(t('condition.5'), failures + ' ' + (failures === 0 ? this._formatBadge('YES', 'condition') : this._formatBadge('NO', 'condition')));

        // Issue #48: Continuous_FAIL uses includes('YES')
        var contFailStr = String(continuousFail);
        var contFailBadge = contFailStr.indexOf('YES') !== -1 ? this._formatBadge('NO', 'condition') : this._formatBadge('YES', 'condition');
        html += this._renderInfoItem(t('condition.6'), contFailStr + ' ' + contFailBadge);

        html += this._renderInfoItem(t('condition.8'), this._formatPercent(areaRejectRate) + '%');
        html += this._renderInfoItem(t('modal.totalTests'), String(totalTests));
        html += this._renderInfoItem(t('modal.passCount'), String(passCount));
        html += this._renderInfoItem(t('modal.failPercent'), this._formatPercent(failPercent) + '%');
        html += '</div></div>';

        return html;
    },

    /**
     * Render 5PRS info section.
     * @param {Object} emp
     * @returns {string} HTML
     * @private
     */
    _render5PrsInfo: function (emp) {
        var t = this._t;
        var empType = String(emp.type || emp.TYPE || emp['ROLE TYPE STD'] || '').toUpperCase();
        var isType1 = empType.indexOf('TYPE-1') !== -1 || empType === '1';

        // Issue #56: Show N/A for TYPE-2 and TYPE-3
        if (!isType1) {
            var html = '<div class="section-card" style="margin-bottom: 16px;">';
            html += '<h3 style="font-size: 1rem; margin: 0 0 12px;">5PRS</h3>';
            html += '<p style="color: #9e9e9e;">' + this._formatBadge('N/A', 'condition');
            html += ' ' + t('modal.5prsNotApplicable') + '</p>';
            html += '</div>';
            return html;
        }

        var prs = emp.prs || emp['5prs'] || {};
        var passRate = prs.pass_rate || emp.prs_pass_rate || emp['5PRS_Pass_Rate'] || 0;
        var inspectionQty = prs.inspection_qty || emp.prs_inspection_qty || emp['5PRS_Inspection_Qty'] || 0;
        var totalQty = prs.total_qty || emp.prs_total_qty || emp['5PRS_Total_Qty'] || 0;

        var html = '<div class="section-card" style="margin-bottom: 16px;">';
        html += '<h3 style="font-size: 1rem; margin: 0 0 12px;">5PRS</h3>';
        html += '<div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 10px;">';
        html += this._renderInfoItem(t('condition.9'), this._formatPercent(passRate) + '%');
        html += this._renderInfoItem(t('condition.10'), String(inspectionQty) + ' prs');
        html += this._renderInfoItem(t('modal.totalQty'), String(totalQty) + ' prs');
        html += '</div></div>';

        return html;
    },

    // ====================================================================
    // Private: Validation Configuration
    // ====================================================================

    /**
     * Get configuration for a validation type.
     * Returns title and description, or null if type is unknown.
     *
     * @param {string} type
     * @param {Object} th - Thresholds
     * @returns {Object|null} { title: string }
     * @private
     */
    _getValidationConfig: function (type, th) {
        var t = this._t;
        var configs = {
            'totalWorkingDays':     { title: t('validation.totalWorkingDays') },
            'absentWithoutInform':  { title: t('validation.absentWithoutInform') },
            'zeroWorkingDays':      { title: t('validation.zeroWorkingDays') },
            'minimumDaysNotMet':    { title: t('validation.minimumDaysNotMet') },
            'attendanceBelow88':    { title: t('validation.attendanceBelow') + ' ' + (th.attendance_rate || 88) + '%' },
            'aqlFail':              { title: t('validation.aqlFail') },
            'consecutiveAqlFail':   { title: t('validation.consecutiveAqlFail') },
            'areaRejectRate':       { title: t('validation.areaRejectRate') + ' ' + (th.area_reject_rate || 3.0) + '%' },
            'lowPassRate':          { title: t('validation.lowPassRate') + ' ' + (th['5prs_pass_rate'] || 95) + '%' },
            'lowInspectionQty':     { title: t('validation.lowInspectionQty') + ' ' + (th['5prs_min_qty'] || 100) },
            'buildingReviewTotal':  { title: t('validation.buildingReview') },
            'lineLeaderNotAssigned': { title: t('validation.lineLeaderNotAssigned') }
        };

        return configs[type] || null;
    },

    /**
     * Filter employees based on validation type.
     *
     * @param {string} type
     * @param {Object} th - Thresholds
     * @returns {Array} Filtered employees
     * @private
     */
    _filterEmployees: function (type, th) {
        var employees = this.employees;
        var thAttRate = parseFloat(th.attendance_rate || 88);
        var thUnapproved = parseFloat(th.unapproved_absence || 2);
        var thMinDays = parseFloat(th.minimum_working_days || 12);
        var thAreaReject = parseFloat(th.area_reject_rate || 3.0);
        var thPassRate = parseFloat(th['5prs_pass_rate'] || 95);
        var thInspQty = parseFloat(th['5prs_min_qty'] || 100);

        switch (type) {
            case 'absentWithoutInform':
                return employees.filter(function (emp) {
                    var val = parseFloat(emp.attendance ? emp.attendance.unapproved_absence : (emp.unapproved_absence || emp['Unapproved Absences'] || 0)) || 0;
                    return val > thUnapproved;
                });

            case 'zeroWorkingDays':
                return employees.filter(function (emp) {
                    var val = parseFloat(emp.attendance ? emp.attendance.actual_days : (emp.actual_working_days || emp['Actual Working Days'] || 0)) || 0;
                    return val === 0;
                });

            case 'minimumDaysNotMet':
                return employees.filter(function (emp) {
                    var val = parseFloat(emp.attendance ? emp.attendance.actual_days : (emp.actual_working_days || emp['Actual Working Days'] || 0)) || 0;
                    return val > 0 && val < thMinDays;
                });

            case 'attendanceBelow88':
                return employees.filter(function (emp) {
                    var val = parseFloat(emp.attendance ? emp.attendance.rate : (emp.attendance_rate || emp['Attendance Rate'] || 0)) || 0;
                    return val < thAttRate && val > 0;
                });

            case 'aqlFail':
                return employees.filter(function (emp) {
                    var val = parseFloat(emp.aql ? emp.aql.failures : (emp.aql_failures || emp['AQL_Failures'] || 0)) || 0;
                    return val > 0;
                });

            case 'consecutiveAqlFail':
                // Issue #48: Use includes('YES'), never === 'YES'
                return employees.filter(function (emp) {
                    var val = String(emp.aql ? emp.aql.continuous_fail : (emp.continuous_fail || emp['Continuous_FAIL'] || 'NO'));
                    return val.indexOf('YES') !== -1;
                });

            case 'areaRejectRate':
                return employees.filter(function (emp) {
                    var val = parseFloat(emp.aql ? emp.aql.area_reject_rate : (emp.area_reject_rate || emp['Area_Reject_Rate'] || 0)) || 0;
                    return val > thAreaReject;
                });

            case 'lowPassRate':
                // TYPE-1 only (Issue #56)
                return employees.filter(function (emp) {
                    var empType = String(emp.type || emp.TYPE || emp['ROLE TYPE STD'] || '').toUpperCase();
                    var isType1 = empType.indexOf('TYPE-1') !== -1 || empType === '1';
                    if (!isType1) return false;
                    var val = parseFloat(emp.prs ? emp.prs.pass_rate : (emp.prs_pass_rate || emp['5PRS_Pass_Rate'] || 0)) || 0;
                    return val < thPassRate && val > 0;
                });

            case 'lowInspectionQty':
                // TYPE-1 only (Issue #56)
                return employees.filter(function (emp) {
                    var empType = String(emp.type || emp.TYPE || emp['ROLE TYPE STD'] || '').toUpperCase();
                    var isType1 = empType.indexOf('TYPE-1') !== -1 || empType === '1';
                    if (!isType1) return false;
                    var val = parseFloat(emp.prs ? emp.prs.inspection_qty : (emp.prs_inspection_qty || emp['5PRS_Inspection_Qty'] || 0)) || 0;
                    return val < thInspQty && val > 0;
                });

            case 'buildingReviewTotal':
                return employees.filter(function (emp) {
                    var building = String(emp.building || emp.BUILDING || '');
                    var bossBuilding = String(emp.boss_building || emp['Boss Building'] || '');
                    // Cross-building: different buildings between employee and boss, or missing info
                    return (building && bossBuilding && building !== bossBuilding) ||
                           (building && !bossBuilding);
                });

            case 'lineLeaderNotAssigned':
                return employees.filter(function (emp) {
                    var bossName = String(emp.boss_name || emp['Boss Name'] || '').trim();
                    var bossId = String(emp.boss_id || emp['Boss ID'] || '').trim();
                    return !bossName && !bossId;
                });

            default:
                return [];
        }
    },

    /**
     * Get table columns configuration for a validation type.
     *
     * @param {string} type
     * @returns {Array} Column definitions
     * @private
     */
    _getValidationColumns: function (type) {
        var t = this._t;

        // Common columns
        var base = [
            { key: 'emp_no', label: t('table.empNo') },
            { key: 'name', label: t('table.name') },
            { key: 'position', label: t('table.position') },
            { key: 'building', label: t('table.building') }
        ];

        // Type-specific value column
        var valueColumn;
        switch (type) {
            case 'absentWithoutInform':
                valueColumn = { key: 'unapproved_absence', label: t('condition.2'), formatter: 'days' };
                break;
            case 'zeroWorkingDays':
            case 'minimumDaysNotMet':
                valueColumn = { key: 'actual_days', label: t('condition.3'), formatter: 'days' };
                break;
            case 'attendanceBelow88':
                valueColumn = { key: 'attendance_rate', label: t('condition.1'), formatter: 'percent' };
                break;
            case 'aqlFail':
                valueColumn = { key: 'aql_failures', label: t('validation.aqlFail'), formatter: 'number' };
                break;
            case 'consecutiveAqlFail':
                valueColumn = { key: 'continuous_fail', label: t('condition.6'), formatter: 'text' };
                break;
            case 'areaRejectRate':
                valueColumn = { key: 'area_reject_rate', label: t('condition.8'), formatter: 'percent' };
                break;
            case 'lowPassRate':
                valueColumn = { key: 'pass_rate', label: t('condition.9'), formatter: 'percent' };
                break;
            case 'lowInspectionQty':
                valueColumn = { key: 'inspection_qty', label: t('condition.10'), formatter: 'number' };
                break;
            case 'buildingReviewTotal':
                valueColumn = { key: 'boss_building', label: t('modal.bossBuilding'), formatter: 'text' };
                break;
            case 'lineLeaderNotAssigned':
                valueColumn = { key: 'boss_name', label: t('modal.bossName'), formatter: 'text' };
                break;
            default:
                valueColumn = { key: 'incentive', label: t('table.incentive'), formatter: 'vnd' };
        }

        // Status column
        base.push(valueColumn);
        base.push({ key: 'incentive', label: t('table.incentive'), formatter: 'vnd' });

        return base;
    },

    /**
     * Render working days summary (special case for totalWorkingDays type).
     *
     * @returns {string} HTML
     * @private
     */
    _renderWorkingDaysSummary: function () {
        var t = this._t;
        var summary = this.summary;
        var workingDays = summary.total_working_days || summary.working_days || this.thresholds.working_days || '--';

        var html = '<div style="text-align: center; padding: 30px;">';
        html += '<div style="font-size: 3rem; font-weight: 700; color: #1a237e;">' + workingDays + '</div>';
        html += '<div style="font-size: 1.1rem; color: #757575; margin-top: 8px;">' + t('validation.totalWorkingDays') + '</div>';
        html += '</div>';

        // Employee count by working day
        var dayCounts = {};
        this.employees.forEach(function (emp) {
            var days = parseInt(emp.attendance ? emp.attendance.actual_days : (emp.actual_working_days || emp['Actual Working Days'] || 0), 10) || 0;
            dayCounts[days] = (dayCounts[days] || 0) + 1;
        });

        var sortedDays = Object.keys(dayCounts).map(Number).sort(function (a, b) { return a - b; });

        if (sortedDays.length > 0) {
            html += '<div class="table-container"><table>';
            html += '<thead><tr>';
            html += '<th>' + t('modal.workingDays') + '</th>';
            html += '<th style="text-align: right;">' + t('modal.employeesCount') + '</th>';
            html += '</tr></thead><tbody>';

            sortedDays.forEach(function (day) {
                var color = day === 0 ? '#c62828' : '';
                html += '<tr>';
                html += '<td style="' + (color ? 'color:' + color + ';font-weight:600;' : '') + '">' + day + t('common.days') + '</td>';
                html += '<td style="text-align: right; ' + (color ? 'color:' + color + ';' : '') + '">' + dayCounts[day] + t('common.people_count') + '</td>';
                html += '</tr>';
            });

            html += '</tbody></table></div>';
        }

        // --- Mini Calendar Grid (from Firestore calendar_data) ---
        var cal = summary.calendar_data;
        if (cal && cal.working_day_dates && cal.working_day_dates.length > 0) {
            var workingDates = cal.working_day_dates;
            var dailyCounts = cal.daily_counts || {};
            var daysInMonth = cal.days_in_month || 31;
            var weekdayIndices = cal.weekday_indices || [];

            // Weekday names from i18n
            var weekdayKeys = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
            var weekdayNames = weekdayKeys.map(function (key) {
                return t('calendar.weekdays.' + key) || key;
            });
            var empLabel = t('calendar.employeeCount') || ' emp';

            html += '<h4 style="margin:24px 0 8px;font-size:1rem;color:#1a237e;">' + (t('validation.attendanceCalendar') || '출근 캘린더') + '</h4>';
            html += '<div class="att-calendar-grid att-mini-calendar">';

            // Weekday headers
            for (var w = 0; w < 7; w++) {
                var isWeekend = (w >= 5);
                html += '<div class="att-cal-header' + (isWeekend ? ' weekend' : '') + '">' + weekdayNames[w] + '</div>';
            }

            // Leading empty cells
            var firstDayWeekday = weekdayIndices.length > 0 ? weekdayIndices[0] : 0;
            for (var e = 0; e < firstDayWeekday; e++) {
                html += '<div class="att-cal-cell empty"></div>';
            }

            // Day cells
            for (var day = 1; day <= daysInMonth; day++) {
                var isWorkDay = workingDates.indexOf(day) !== -1;
                var count = dailyCounts[String(day)] || 0;
                var cellClass = isWorkDay ? 'att-cal-cell work-day' : 'att-cal-cell no-data';
                var wdi = (day <= weekdayIndices.length) ? weekdayIndices[day - 1] : -1;
                if (wdi >= 5) cellClass += ' weekend-day';

                html += '<div class="' + cellClass + '">';
                html += '<div class="att-cal-daynum">' + day + '</div>';
                if (isWorkDay && count > 0) {
                    html += '<div class="att-cal-count">' + count + empLabel + '</div>';
                }
                html += '</div>';
            }

            html += '</div>';

            // Mini legend
            html += '<div style="margin-top:8px;display:flex;gap:8px;flex-wrap:wrap;justify-content:center;">';
            html += '<span style="display:inline-flex;align-items:center;gap:4px;padding:4px 10px;border-radius:16px;font-size:0.75rem;font-weight:600;background:linear-gradient(135deg,#ef4444,#dc2626);color:#fff;">💼 ' + t('calendar.legendWorkDay') + '</span>';
            html += '<span style="display:inline-flex;align-items:center;gap:4px;padding:4px 10px;border-radius:16px;font-size:0.75rem;font-weight:600;background:#f5f5f5;color:#757575;border:2px dashed #ccc;">❌ ' + t('calendar.legendNoData') + '</span>';
            html += '</div>';
        }

        return html;
    },

    // ====================================================================
    // Private: DOM Helpers
    // ====================================================================

    /**
     * Create a dynamic modal element (not Bootstrap-managed).
     * Append to body, display via CSS flex, remove on close.
     *
     * @param {string} id - Modal element id
     * @param {string} title - Modal header title
     * @param {string} size - 'modal-xl', 'modal-lg', 'modal-fullscreen'
     * @returns {{ modal: HTMLElement, body: HTMLElement, close: Function }}
     * @private
     */
    _createDynamicModal: function (id, title, size) {
        var safeTitle = this._escapeHtml(title);

        // Calculate max-width from size
        var maxWidth = '800px';
        if (size === 'modal-xl') maxWidth = '1140px';
        else if (size === 'modal-lg') maxWidth = '900px';
        else if (size === 'modal-fullscreen') maxWidth = '100%';

        // Overlay / backdrop
        var overlay = document.createElement('div');
        overlay.id = id;
        overlay.className = 'dm-modal-overlay';
        overlay.style.cssText = 'position:fixed; top:0; left:0; right:0; bottom:0; z-index:1060;'
            + 'background:rgba(0,0,0,0.5); display:none; align-items:center; justify-content:center;'
            + 'padding:20px;';

        // Content container
        var content = document.createElement('div');
        content.className = 'dm-modal-content';
        content.style.cssText = 'background:#fff; border-radius:12px; max-width:' + maxWidth + ';'
            + 'width:100%; max-height:90vh; display:flex; flex-direction:column;'
            + 'box-shadow:0 8px 32px rgba(0,0,0,0.2); overflow:hidden;';

        // Header
        var header = document.createElement('div');
        header.style.cssText = 'background:linear-gradient(135deg, #1a237e, #283593); color:#fff;'
            + 'padding:16px 20px; display:flex; align-items:center; justify-content:space-between; flex-shrink:0;';
        header.innerHTML = '<h5 style="margin:0; font-size:1.1rem;">' + safeTitle + '</h5>'
            + '<button type="button" style="background:none; border:none; color:#fff; font-size:1.4rem;'
            + 'cursor:pointer; padding:0 4px; line-height:1;" onclick="window.closeValidationModal()"'
            + ' aria-label="Close">&times;</button>';

        // Body (scrollable)
        var body = document.createElement('div');
        body.style.cssText = 'padding:20px; overflow-y:auto; flex:1;';

        // Footer
        var footer = document.createElement('div');
        footer.style.cssText = 'padding:12px 20px; border-top:1px solid #e0e0e0; text-align:right; flex-shrink:0;';
        footer.innerHTML = '<button type="button" style="padding:8px 24px; background:#1a237e; color:#fff;'
            + 'border:none; border-radius:6px; cursor:pointer; font-size:0.9rem;"'
            + ' onclick="window.closeValidationModal()">' + this._t('modal.close') + '</button>';

        content.appendChild(header);
        content.appendChild(body);
        content.appendChild(footer);
        overlay.appendChild(content);

        // Close function
        var removeFn = function () {
            var el = document.getElementById(id);
            if (el) {
                el.style.display = 'none';
                el.remove();
            }
            // Clean up ESC key listener
            document.removeEventListener('keydown', escHandler);
        };

        // ESC key handler
        var escHandler = function (e) {
            if (e.key === 'Escape') removeFn();
        };
        document.addEventListener('keydown', escHandler);

        return { modal: overlay, body: body, close: removeFn };
    },

    /**
     * Remove a dynamic modal from the DOM.
     *
     * @param {string} id - Modal element id
     * @private
     */
    _removeDynamicModal: function (id) {
        var el = document.getElementById(id);
        if (el) el.remove();
    },

    /**
     * Generate an HTML table from an array of employee objects.
     * Each row is clickable to open the employee detail modal.
     *
     * @param {Array} employees - Array of employee objects
     * @param {Array} columns - Array of { key, label, formatter } objects
     * @param {string} [validationType] - Optional validation type for value extraction
     * @returns {string} HTML table string
     * @private
     */
    _createEmployeeTable: function (employees, columns, validationType) {
        if (!employees || employees.length === 0) {
            return '<p style="text-align:center; color:#9e9e9e; padding:20px;">' + this._t('common.noData') + '</p>';
        }

        var self = this;
        var html = '<div class="table-container"><table>';

        // Header
        html += '<thead><tr>';
        html += '<th style="width: 40px;">#</th>';
        columns.forEach(function (col) {
            var align = (col.formatter === 'vnd' || col.formatter === 'percent' || col.formatter === 'number' || col.formatter === 'days') ? ' style="text-align:right;"' : '';
            html += '<th' + align + '>' + self._escapeHtml(col.label) + '</th>';
        });
        html += '</tr></thead><tbody>';

        // Rows
        employees.forEach(function (emp, idx) {
            // Issue #28: String() for ID comparison
            var empNo = String(emp.emp_no || emp['Employee No'] || '');
            var escapedEmpNo = self._escapeHtml(empNo);

            html += '<tr style="cursor:pointer;" onclick="DashboardModals.showEmployeeDetail(\'' + escapedEmpNo + '\')">';
            html += '<td style="color:#9e9e9e; text-align:center;">' + (idx + 1) + '</td>';

            columns.forEach(function (col) {
                var value = self._extractColumnValue(emp, col, validationType);
                var formatted = self._formatColumnValue(value, col.formatter);
                var align = (col.formatter === 'vnd' || col.formatter === 'percent' || col.formatter === 'number' || col.formatter === 'days') ? ' style="text-align:right;"' : '';
                html += '<td' + align + '>' + formatted + '</td>';
            });

            html += '</tr>';
        });

        html += '</tbody></table></div>';
        return html;
    },

    /**
     * Extract a value from an employee object based on column key.
     *
     * @param {Object} emp
     * @param {Object} col - Column definition { key, label, formatter }
     * @param {string} [validationType]
     * @returns {*}
     * @private
     */
    _extractColumnValue: function (emp, col, validationType) {
        switch (col.key) {
            case 'emp_no':
                return String(emp.emp_no || emp['Employee No'] || '--');
            case 'name':
                return emp.full_name || emp.name || emp.Name || emp['Employee Name'] || '--';
            case 'position':
                return emp.position || emp.Position || emp['Position Name'] || '--';
            case 'building':
                return emp.building || emp.BUILDING || '--';
            case 'type':
                return emp.type || emp.TYPE || emp['ROLE TYPE STD'] || '--';
            case 'incentive':
                return this._getIncentive(emp, 'current');
            case 'conditions':
                return this._getConditionsSummary(emp);

            // Attendance values
            case 'unapproved_absence':
                return parseFloat(emp.attendance ? emp.attendance.unapproved_absence : (emp.unapproved_absence || emp['Unapproved Absences'] || 0)) || 0;
            case 'actual_days':
                return parseFloat(emp.attendance ? emp.attendance.actual_days : (emp.actual_working_days || emp['Actual Working Days'] || 0)) || 0;
            case 'attendance_rate':
                return parseFloat(emp.attendance ? emp.attendance.rate : (emp.attendance_rate || emp['Attendance Rate'] || 0)) || 0;

            // AQL values
            case 'aql_failures':
                return parseFloat(emp.aql ? emp.aql.failures : (emp.aql_failures || emp['AQL_Failures'] || 0)) || 0;
            case 'continuous_fail':
                return String(emp.aql ? emp.aql.continuous_fail : (emp.continuous_fail || emp['Continuous_FAIL'] || 'NO'));
            case 'area_reject_rate':
                return parseFloat(emp.aql ? emp.aql.area_reject_rate : (emp.area_reject_rate || emp['Area_Reject_Rate'] || 0)) || 0;

            // 5PRS values
            case 'pass_rate':
                return parseFloat(emp.prs ? emp.prs.pass_rate : (emp.prs_pass_rate || emp['5PRS_Pass_Rate'] || 0)) || 0;
            case 'inspection_qty':
                return parseFloat(emp.prs ? emp.prs.inspection_qty : (emp.prs_inspection_qty || emp['5PRS_Inspection_Qty'] || 0)) || 0;

            // Boss info
            case 'boss_name':
                return emp.boss_name || emp['Boss Name'] || '--';
            case 'boss_building':
                return emp.boss_building || emp['Boss Building'] || '--';

            default:
                return emp[col.key] || '--';
        }
    },

    /**
     * Format a column value for display.
     *
     * @param {*} value
     * @param {string} formatter - 'vnd', 'percent', 'number', 'days', 'text', undefined
     * @returns {string} Formatted HTML
     * @private
     */
    _formatColumnValue: function (value, formatter) {
        switch (formatter) {
            case 'vnd':
                var amount = parseFloat(value) || 0;
                var color = amount > 0 ? '#2e7d32' : '#9e9e9e';
                return '<span style="color:' + color + '; font-weight:' + (amount > 0 ? '600' : '400') + ';">'
                    + this._formatVND(amount) + '</span>';
            case 'percent':
                return this._formatPercent(value) + '%';
            case 'number':
                return String(value);
            case 'days':
                return value + this._t('common.days');
            case 'text':
                return this._escapeHtml(String(value));
            default:
                return this._escapeHtml(String(value));
        }
    },

    // ====================================================================
    // Private: Data Helpers
    // ====================================================================

    /**
     * Find an employee by employee number.
     * Issue #28: Uses String() for comparison.
     *
     * @param {string} empNoStr
     * @returns {Object|null}
     * @private
     */
    _findEmployee: function (empNoStr) {
        var data = window.employeeData || this.employees;
        for (var i = 0; i < data.length; i++) {
            var emp = data[i];
            var id = String(emp.emp_no || emp['Employee No'] || '').trim();
            if (id === empNoStr) return emp;
        }
        return null;
    },

    /**
     * Get incentive amount using employeeHelpers (Issue #37).
     *
     * @param {Object} emp
     * @param {string} type - 'current' or 'previous'
     * @returns {number}
     * @private
     */
    _getIncentive: function (emp, type) {
        if (window.employeeHelpers) {
            return window.employeeHelpers.getIncentive(emp, type);
        }
        if (type === 'current') {
            return parseFloat(emp.currentIncentive || emp.current_incentive || 0) || 0;
        }
        if (type === 'previous') {
            return parseFloat(emp.previousIncentive || emp.previous_incentive || 0) || 0;
        }
        return 0;
    },

    /**
     * Get conditions summary string (e.g. "8/10 passed").
     *
     * @param {Object} emp
     * @returns {string}
     * @private
     */
    _getConditionsSummary: function (emp) {
        var helpers = window.employeeHelpers;
        if (!helpers) return '--';

        var empType = String(emp.type || emp.TYPE || emp['ROLE TYPE STD'] || '').toUpperCase();
        var isType1 = empType.indexOf('TYPE-1') !== -1 || empType === '1';
        var maxCond = isType1 ? 10 : 4;

        var passed = 0;
        var total = 0;
        for (var i = 1; i <= maxCond; i++) {
            var result = helpers.getCondition(emp, i);
            if (result !== 'N/A') {
                total++;
                if (result === 'YES') passed++;
            }
        }

        if (total === 0) return '--';

        var color = (passed === total) ? '#2e7d32' : '#c62828';
        return '<span style="color:' + color + '; font-weight:600;">' + passed + '/' + total + '</span>';
    },

    // ====================================================================
    // Private: Formatting & Rendering Utilities
    // ====================================================================

    /**
     * Format badge HTML for condition results or incentive status.
     *
     * @param {string} value - 'YES', 'NO', 'N/A' (for condition) or '>0' / '=0' check
     * @param {string} type - 'condition' or 'incentive'
     * @returns {string} HTML span with badge class
     * @private
     */
    _formatBadge: function (value, type) {
        if (type === 'condition') {
            var upper = String(value).toUpperCase();
            if (upper === 'YES') {
                return '<span class="badge-pass">PASS</span>';
            } else if (upper === 'NO') {
                return '<span class="badge-fail">FAIL</span>';
            } else {
                return '<span class="badge-na">N/A</span>';
            }
        }
        if (type === 'incentive') {
            var amount = parseFloat(value) || 0;
            if (amount > 0) {
                return '<span class="badge-pass">' + this._formatVND(amount) + '</span>';
            } else {
                return '<span class="badge-fail">0</span>';
            }
        }
        return '<span class="badge-na">' + this._escapeHtml(String(value)) + '</span>';
    },

    /**
     * Render an info item (label + value pair).
     *
     * @param {string} label
     * @param {string} value - Can contain HTML
     * @returns {string} HTML
     * @private
     */
    _renderInfoItem: function (label, value) {
        return '<div style="padding: 8px 12px; background: #f8f9fa; border-radius: 6px;">'
            + '<div style="font-size: 0.72rem; color: #9e9e9e; margin-bottom: 2px;">' + this._escapeHtml(label) + '</div>'
            + '<div style="font-size: 0.92rem; font-weight: 500;">' + value + '</div>'
            + '</div>';
    },

    /**
     * Render a mini KPI card for position modal summary.
     *
     * @param {string} label
     * @param {string} value
     * @returns {string} HTML
     * @private
     */
    _renderMiniKpi: function (label, value) {
        return '<div style="flex: 1; min-width: 160px; padding: 14px 18px; background: #f8f9fa;'
            + ' border-radius: 8px; border-left: 4px solid #1a237e;">'
            + '<div style="font-size: 0.78rem; color: #757575;">' + this._escapeHtml(label) + '</div>'
            + '<div style="font-size: 1.2rem; font-weight: 700; color: #1a237e; margin-top: 4px;">' + value + '</div>'
            + '</div>';
    },

    /**
     * Escape HTML to prevent XSS.
     *
     * @param {string} str
     * @returns {string}
     * @private
     */
    _escapeHtml: function (str) {
        if (str === null || str === undefined) return '';
        var div = document.createElement('div');
        div.textContent = String(str);
        return div.innerHTML;
    },

    /**
     * Format amount as VND with comma separators.
     * Delegates to DashboardCharts.formatVND if available.
     *
     * @param {number} amount
     * @returns {string}
     * @private
     */
    _formatVND: function (amount) {
        if (typeof DashboardCharts !== 'undefined' && DashboardCharts.formatVND) {
            return DashboardCharts.formatVND(amount);
        }
        var num = parseFloat(amount);
        if (!num || isNaN(num)) return '0';
        return new Intl.NumberFormat('vi-VN').format(Math.round(num));
    },

    /**
     * Format value as percentage with one decimal.
     * Delegates to DashboardCharts.formatPercent if available.
     *
     * @param {number} value
     * @returns {string}
     * @private
     */
    _formatPercent: function (value) {
        if (typeof DashboardCharts !== 'undefined' && DashboardCharts.formatPercent) {
            return DashboardCharts.formatPercent(value);
        }
        var num = parseFloat(value);
        if (isNaN(num)) return '0.0';
        return num.toFixed(1);
    },

    /**
     * Translation helper shortcut.
     * Delegates to DashboardI18n.t() if available, otherwise returns key.
     *
     * @param {string} key - Translation key
     * @returns {string}
     * @private
     */
    _t: function (key) {
        if (typeof DashboardI18n !== 'undefined' && DashboardI18n.t) {
            return DashboardI18n.t(key);
        }
        return key;
    }
};

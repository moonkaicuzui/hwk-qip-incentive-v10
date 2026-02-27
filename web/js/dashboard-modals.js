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

        // Render condition doughnut chart (Phase C - deferred rendering)
        // Must run AFTER innerHTML so <canvas> exists in DOM
        try {
            if (this._conditionDoughnutData) {
                var cd = this._conditionDoughnutData;
                var cdCanvas = document.getElementById('conditionDoughnutChart');
                if (cdCanvas && typeof Chart !== 'undefined') {
                    DashboardCharts.destroyChart('conditionDoughnutChart');
                    var total = cd.pass + cd.fail;
                    var pct = total > 0 ? Math.round((cd.pass / total) * 100) : 0;
                    new Chart(cdCanvas.getContext('2d'), {
                        type: 'doughnut',
                        data: {
                            labels: [DashboardI18n.t('status.pass'), DashboardI18n.t('status.fail')],
                            datasets: [{
                                data: [cd.pass, cd.fail],
                                backgroundColor: ['#28a745', '#dc3545'],
                                borderWidth: 0
                            }]
                        },
                        options: {
                            responsive: true,
                            maintainAspectRatio: true,
                            cutout: '65%',
                            plugins: {
                                legend: { display: false },
                                tooltip: { enabled: true }
                            }
                        },
                        plugins: [{
                            id: 'conditionCenterText',
                            afterDraw: function(chart) {
                                var ctx = chart.ctx;
                                ctx.save();
                                ctx.font = 'bold 14px sans-serif';
                                ctx.textAlign = 'center';
                                ctx.textBaseline = 'middle';
                                ctx.fillStyle = pct >= 100 ? '#28a745' : '#dc3545';
                                var cx = (chart.chartArea.left + chart.chartArea.right) / 2;
                                var cy = (chart.chartArea.top + chart.chartArea.bottom) / 2;
                                ctx.fillText(pct + '%', cx, cy);
                                ctx.restore();
                            }
                        }]
                    });
                }
                this._conditionDoughnutData = null;
            }
        } catch (e) {
            console.error('[Phase C] Condition doughnut chart error:', e);
        }

        // Show using Bootstrap 5 Modal API
        var modalEl = document.getElementById('employeeModal');
        if (modalEl) {
            // Fix: Ensure Employee Detail appears above Position Detail (z-index stacking)
            modalEl.style.zIndex = '1060';
            modalEl.addEventListener('shown.bs.modal', function () {
                var backdrops = document.querySelectorAll('.modal-backdrop');
                if (backdrops.length > 1) {
                    backdrops[backdrops.length - 1].style.zIndex = '1058';
                }
            }, { once: true });
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
        var notReceiving = filtered.length - receivingCount;

        // Determine TYPE for icon
        var sampleType = filtered.length > 0 ? String(filtered[0].type || filtered[0].TYPE || filtered[0]['ROLE TYPE STD'] || '').toUpperCase() : '';
        var typeIcon = sampleType.indexOf('1') >= 0 ? '🏆' : sampleType.indexOf('2') >= 0 ? '📊' : '🆕';

        // Find max/min incentive
        var maxIncentive = 0, minIncentive = Infinity;
        filtered.forEach(function (emp) {
            var amt = self._getIncentive(emp, 'current');
            if (amt > maxIncentive) maxIncentive = amt;
            if (amt > 0 && amt < minIncentive) minIncentive = amt;
        });
        if (minIncentive === Infinity) minIncentive = 0;

        var html = '';

        // Summary cards + Doughnut chart row
        html += '<div style="display: flex; gap: 16px; margin-bottom: 20px; flex-wrap: wrap; align-items: flex-start;">';

        // Left: Mini KPIs
        html += '<div style="flex: 1; min-width: 200px;">';
        html += this._renderMiniKpi(typeIcon + ' ' + t('kpi.recipients'), receivingCount + '/' + filtered.length + t('common.people_count'));
        html += this._renderMiniKpi(t('kpi.totalAmount'), this._formatVND(totalIncentive) + ' ' + t('unit.currency'));
        html += this._renderMiniKpi(t('typeTable.avgReceiving'), this._formatVND(avgIncentive) + ' ' + t('unit.currency'));
        html += this._renderMiniKpi(t('kpi.maxMin'), this._formatVND(maxIncentive) + ' / ' + this._formatVND(minIncentive) + ' ' + t('unit.currency'));
        html += '</div>';

        // Right: Doughnut chart
        html += '<div style="width: 200px; text-align: center;">';
        html += '<canvas id="positionDoughnutChart" width="180" height="180"></canvas>';
        html += '<div style="font-size: 0.8rem; color: #757575; margin-top: 4px;">' + t('kpi.paymentRate') + '</div>';
        html += '</div>';

        html += '</div>';

        // Employee table
        var columns = [
            { key: 'emp_no', label: t('table.empNo') },
            { key: 'name', label: t('table.name') },
            { key: 'building', label: t('table.building') },
            { key: 'conditions', label: t('modal.conditionStatus'), formatter: 'html' },
            { key: 'incentive', label: t('table.incentive') }
        ];
        html += this._createEmployeeTable(filtered, columns);

        bodyEl.innerHTML = html;

        // Render Doughnut chart after HTML is in DOM
        try {
            var dCanvas = document.getElementById('positionDoughnutChart');
            if (dCanvas && typeof Chart !== 'undefined') {
                DashboardCharts.destroyChart('positionDoughnutChart');
                var payRate = filtered.length > 0 ? ((receivingCount / filtered.length) * 100).toFixed(1) : '0.0';
                DashboardCharts.charts['positionDoughnutChart'] = new Chart(dCanvas.getContext('2d'), {
                    type: 'doughnut',
                    data: {
                        labels: [t('filter.received'), t('filter.notReceived')],
                        datasets: [{
                            data: [receivingCount, notReceiving],
                            backgroundColor: ['#28a745', '#dc3545'],
                            borderWidth: 0
                        }]
                    },
                    options: {
                        responsive: false,
                        cutout: '65%',
                        plugins: {
                            legend: { display: false },
                            tooltip: { enabled: true }
                        }
                    },
                    plugins: [{
                        id: 'centerText',
                        afterDraw: function(chart) {
                            var ctx = chart.ctx;
                            ctx.save();
                            ctx.font = 'bold 1.4rem sans-serif';
                            ctx.fillStyle = '#1a237e';
                            ctx.textAlign = 'center';
                            ctx.textBaseline = 'middle';
                            var cx = (chart.chartArea.left + chart.chartArea.right) / 2;
                            var cy = (chart.chartArea.top + chart.chartArea.bottom) / 2;
                            ctx.fillText(payRate + '%', cx, cy);
                            ctx.restore();
                        }
                    }]
                });
            }
        } catch (e) {
            console.error('[DashboardModals] Position doughnut chart error:', e);
        }

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
            } else if (type === 'lowPassRate') {
                // V9 feature: 5PRS 2-table structure (threshold violators + Top 10)
                html += this._renderLowPassRateContent(th);
            } else if (type === 'consecutiveAqlFail') {
                // V9 feature: AQL 3-month/2-month split + Line Leader aggregation
                html += this._renderConsecutiveAqlContent(th);
            } else if (type === 'areaRejectRate') {
                // Task #22: V9 feature: AQL Building 3-Table modal
                html += this._renderAreaRejectContent(th);
            } else if (type === 'buildingReviewTotal') {
                // V9 feature: Cross-Building enhanced modal with color badges
                html += this._renderBuildingReviewContent(th);
            } else {
                // Generic: filter + table
                var filtered = this._filterEmployees(type, th);

                html += '<p style="margin: 0 0 12px; color: #616161;">';
                html += this._t('kpi.recipients') + ': <strong>' + filtered.length + '</strong>';
                html += this._t('common.people_count');
                html += '</p>';

                var columns = this._getValidationColumns(type);
                html += this._createEmployeeTable(filtered, columns, type);
            }

            bodyDiv.innerHTML = html;

            // V9 feature: Enable table sorting (▲▼ click)
            this._enableTableSorting(bodyDiv);

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
        // Task #20: Supervisor Click - make boss name clickable to navigate to boss detail
        var bossId = String(emp.boss_id || emp.Boss_ID || emp['Boss ID'] || '');
        if (bossId && bossId !== '--' && bossId !== 'undefined' && bossId !== 'null') {
            var bossCard = '<span style="cursor: pointer; color: #1565c0; text-decoration: underline; font-weight: 600;"'
                + ' onclick="DashboardModals.showEmployeeDetail(\'' + this._escapeHtml(bossId) + '\')"'
                + ' title="' + t('modal.clickToViewBoss') + '">'
                + bossName + ' 👆</span>';
            html += this._renderInfoItem(t('modal.bossName'), bossCard);
        } else {
            html += this._renderInfoItem(t('modal.bossName'), bossName);
        }
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

            // Row background color based on result (Phase C Korean UX)
            var rowBg = result === 'YES' ? 'background: rgba(40,167,69,0.08);' :
                        result === 'NO' ? 'background: rgba(220,53,69,0.08);' : '';

            html += '<tr style="' + rowBg + '">';
            html += '<td style="text-align: center; color: #9e9e9e;">' + i + '</td>';
            html += '<td>' + conditionNames[i - 1] + '</td>';
            html += '<td style="text-align: right;">' + valueStr + '</td>';
            html += '<td style="text-align: right;">' + thresholdStr + '</td>';
            html += '<td style="text-align: center;">' + badge + '</td>';
            html += '</tr>';

            // Task #20: Condition Improvement Guide (shown when condition FAIL)
            if (result === 'NO') {
                var guideKey = 'guide.condition' + i;
                var guideText = t(guideKey);
                if (guideText && guideText !== guideKey) {
                    html += '<tr><td colspan="5" style="background: #fff3cd; padding: 8px 12px; border-left: 3px solid #ffc107; font-size: 0.82rem;">';
                    html += '<span style="color: #856404;">💡 ' + guideText + '</span>';
                    html += '</td></tr>';
                }
            }
        }

        html += '</tbody></table></div>';

        // Summary line + Doughnut
        var failCount = totalApplicable - passCount;
        var summaryColor = (totalApplicable > 0 && passCount === totalApplicable) ? '#2e7d32' : '#c62828';
        html += '<div style="display: flex; align-items: center; gap: 16px; margin-top: 10px;">';
        html += '<canvas id="conditionDoughnutChart" width="80" height="80" style="flex-shrink:0;"></canvas>';
        html += '<p style="margin: 0; font-weight: 600; color: ' + summaryColor + ';">';
        html += passCount + '/' + totalApplicable + ' ' + t('modal.conditionsPassed');
        if (totalApplicable > 0 && passCount === totalApplicable) {
            html += ' (100%) ✅';
        } else if (totalApplicable > 0) {
            html += ' (' + Math.round(passCount / totalApplicable * 100) + '%) ❌';
        }
        html += '</p></div>';
        html += '</div>';

        // Store data for deferred doughnut render (after innerHTML set)
        this._conditionDoughnutData = { pass: passCount, fail: failCount };

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
                + this._formatVND(currentIncentive) + ' ' + t('unit.currency') + '</span>'
        );
        html += this._renderInfoItem(
            t('modal.previousIncentive'),
            this._formatVND(previousIncentive) + ' ' + t('unit.currency')
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

        // Task #18: Continuous Months Reset Notice (when previous > current)
        html += this._renderContinuousMonthsReset(emp, continuousMonths);

        // Task #19: TYPE-3 New Employee Roadmap
        html += this._renderType3Roadmap(emp);

        // V9 feature: AQL Inspector 3-Part breakdown
        html += this._renderAqlInspector3Part(emp, currentIncentive);

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
        html += this._renderInfoItem(t('condition.10'), String(inspectionQty) + ' ' + t('unit.pairs'));
        html += this._renderInfoItem(t('modal.totalQty'), String(totalQty) + ' ' + t('unit.pairs'));
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

        // Header with sortable columns (V9 feature: ▲▼ click sorting)
        html += '<thead><tr>';
        html += '<th style="width: 40px;">#</th>';
        columns.forEach(function (col) {
            var isNumeric = (col.formatter === 'vnd' || col.formatter === 'percent' || col.formatter === 'number' || col.formatter === 'days');
            var align = isNumeric ? ' text-align:right;' : '';
            var sortType = isNumeric ? 'number' : 'text';
            html += '<th style="cursor:pointer; user-select:none;' + align + '" ';
            html += 'data-sort-key="' + self._escapeHtml(col.key) + '" ';
            html += 'data-sort-type="' + sortType + '" ';
            html += 'data-formatter="' + (col.formatter || 'text') + '">';
            html += self._escapeHtml(col.label);
            html += ' <span class="sort-indicator" style="opacity:0.3; font-size:0.7em;">▲▼</span>';
            html += '</th>';
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
            case 'html':
                return value;  // Pass through pre-formatted HTML (e.g., condition badges)
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
            var t = DashboardI18n.t.bind(DashboardI18n);
            if (upper === 'YES') {
                return '<span class="badge-pass">' + t('status.pass') + '</span>';
            } else if (upper === 'NO') {
                return '<span class="badge-fail">' + t('status.fail') + '</span>';
            } else {
                return '<span class="badge-na">' + t('status.na') + '</span>';
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
    },

    // ====================================================================
    // V9 Feature: Table Sorting (▲▼ click)
    // ====================================================================

    /**
     * Enable click-to-sort on all sortable table headers within a container.
     * Binds click events to <th> elements with data-sort-key attribute.
     *
     * @param {HTMLElement} container - Parent element containing table(s)
     * @private
     */
    _enableTableSorting: function (container) {
        if (!container) return;
        var self = this;

        var headers = container.querySelectorAll('th[data-sort-key]');
        headers.forEach(function (th) {
            th.addEventListener('click', function () {
                var table = th.closest('table');
                if (!table) return;

                var sortKey = th.getAttribute('data-sort-key');
                var sortType = th.getAttribute('data-sort-type') || 'text';
                var formatter = th.getAttribute('data-formatter') || 'text';
                var tbody = table.querySelector('tbody');
                if (!tbody) return;

                // Determine sort direction (toggle)
                var currentDir = th.getAttribute('data-sort-dir') || 'none';
                var newDir = (currentDir === 'asc') ? 'desc' : 'asc';

                // Reset all headers in this table
                table.querySelectorAll('th[data-sort-key]').forEach(function (h) {
                    h.setAttribute('data-sort-dir', 'none');
                    var ind = h.querySelector('.sort-indicator');
                    if (ind) { ind.textContent = '▲▼'; ind.style.opacity = '0.3'; }
                });

                // Set current header
                th.setAttribute('data-sort-dir', newDir);
                var indicator = th.querySelector('.sort-indicator');
                if (indicator) {
                    indicator.textContent = newDir === 'asc' ? '▲' : '▼';
                    indicator.style.opacity = '1';
                }

                // Sort rows
                var rows = Array.prototype.slice.call(tbody.querySelectorAll('tr'));
                var colIndex = self._getColumnIndex(th);

                rows.sort(function (a, b) {
                    var aCell = a.cells[colIndex];
                    var bCell = b.cells[colIndex];
                    if (!aCell || !bCell) return 0;

                    var aVal = (aCell.textContent || '').trim();
                    var bVal = (bCell.textContent || '').trim();

                    if (sortType === 'number' || formatter === 'vnd' || formatter === 'percent' || formatter === 'number' || formatter === 'days') {
                        var aNum = parseFloat(aVal.replace(/[^0-9.\-]/g, '')) || 0;
                        var bNum = parseFloat(bVal.replace(/[^0-9.\-]/g, '')) || 0;
                        return newDir === 'asc' ? (aNum - bNum) : (bNum - aNum);
                    } else {
                        var cmp = aVal.localeCompare(bVal, undefined, { sensitivity: 'base' });
                        return newDir === 'asc' ? cmp : -cmp;
                    }
                });

                // Re-append sorted rows and update row numbers
                rows.forEach(function (row, idx) {
                    tbody.appendChild(row);
                    if (row.cells[0]) row.cells[0].textContent = (idx + 1);
                });
            });
        });
    },

    /**
     * Get the column index of a <th> element within its row.
     * @param {HTMLElement} th
     * @returns {number}
     * @private
     */
    _getColumnIndex: function (th) {
        var row = th.parentElement;
        if (!row) return 0;
        var cells = Array.prototype.slice.call(row.children);
        return cells.indexOf(th);
    },

    // ====================================================================
    // Task #22: V9 Feature: AQL Building 3-Table Modal (Area Reject Rate)
    // ====================================================================

    /**
     * Render AQL Building analysis with three tables:
     *  Table 1: Building-level AQL summary (tests, pass, fail, reject rate, grade)
     *  Table 2: Inspector statistics per building (inspectors, fail inspectors, pass-only)
     *  Table 3: Individual inspector/auditor details
     *
     * Grade system based on V9 dynamic thresholds:
     *  A: reject rate <= threshold * 0.5
     *  B: reject rate <= threshold * 0.83
     *  C: reject rate <= threshold
     *  FAIL: reject rate > threshold
     *
     * @param {Object} th - Thresholds
     * @returns {string} HTML
     * @private
     */
    _renderAreaRejectContent: function (th) {
        var self = this;
        var t = this._t;
        var thAreaReject = parseFloat(th.area_reject_rate || 3.0);
        var employees = this.employees;

        // Get TYPE-1 employees with AQL data
        var type1Emps = employees.filter(function (emp) {
            var empType = String(emp.type || emp.TYPE || '').toUpperCase();
            return empType.indexOf('TYPE-1') !== -1 || empType === '1';
        });

        // --- Compute building-level AQL statistics ---
        var buildingMap = {};
        type1Emps.forEach(function (emp) {
            var bld = String(emp.building || emp.BUILDING || 'Unknown').trim();
            if (!bld || bld === 'nan' || bld === 'NaN' || bld === 'null' || bld === 'undefined') bld = 'Unknown';
            if (!buildingMap[bld]) {
                buildingMap[bld] = {
                    totalTests: 0, totalPass: 0, totalFail: 0,
                    inspectorCount: 0, failInspectors: 0, passOnlyInspectors: 0,
                    inspectors: []
                };
            }
            var aql = emp.aql || {};
            var tests = parseFloat(aql.total_tests || emp.total_tests || emp['Total_Tests'] || 0) || 0;
            var passCount = parseFloat(aql.pass_count || emp.pass_count || emp['Pass_Count'] || 0) || 0;
            var failPercent = parseFloat(aql.fail_percent || emp.fail_percent || emp['AQL_Fail_Percent'] || 0) || 0;
            var personalFail = parseFloat(aql.personal_fail || emp.personal_fail || emp['AQL_Personal_Fail'] || 0) || 0;
            var rejectRate = parseFloat(aql.area_reject_rate || emp.area_reject_rate || emp['Area_Reject_Rate'] || 0) || 0;
            var continuousFail = String(aql.continuous_fail || emp.continuous_fail || emp['Continuous_FAIL'] || 'NO');

            if (tests > 0) {
                buildingMap[bld].totalTests += tests;
                buildingMap[bld].totalPass += passCount;
                buildingMap[bld].totalFail += (tests - passCount);
                buildingMap[bld].inspectorCount++;

                if (personalFail > 0) {
                    buildingMap[bld].failInspectors++;
                } else {
                    buildingMap[bld].passOnlyInspectors++;
                }
            }

            // Always collect inspector detail
            buildingMap[bld].inspectors.push({
                empNo: String(emp.emp_no || emp['Employee No'] || ''),
                name: emp.full_name || emp.name || emp['Employee Name'] || '--',
                position: emp.position || emp.Position || '--',
                building: bld,
                personalFail: personalFail,
                rejectRate: rejectRate,
                continuousFail: continuousFail,
                incentive: self._getIncentive(emp, 'current')
            });
        });

        var buildings = Object.keys(buildingMap).sort();

        // Grade helper
        function getGrade(rejectRate) {
            if (rejectRate <= thAreaReject * 0.5) return { grade: 'A', color: '#2e7d32', bg: '#e8f5e9' };
            if (rejectRate <= thAreaReject * 0.83) return { grade: 'B', color: '#1565c0', bg: '#e3f2fd' };
            if (rejectRate <= thAreaReject) return { grade: 'C', color: '#e65100', bg: '#fff3e0' };
            return { grade: 'FAIL', color: '#c62828', bg: '#fbe9e7' };
        }

        var html = '';

        // === Summary KPI Row ===
        var totalAboveThreshold = 0;
        var totalInspectors = 0;
        buildings.forEach(function (bld) {
            var stats = buildingMap[bld];
            totalInspectors += stats.inspectorCount;
            var bldRate = stats.totalTests > 0 ? ((stats.totalFail / stats.totalTests) * 100) : 0;
            if (bldRate >= thAreaReject) totalAboveThreshold++;
        });

        html += '<div style="display: flex; gap: 16px; margin-bottom: 20px; flex-wrap: wrap;">';
        html += '<div style="flex:1; min-width:140px; padding:16px; background:linear-gradient(135deg, #1565c0, #0d47a1); color:#fff; border-radius:12px; text-align:center;">';
        html += '<div style="font-size:2rem; font-weight:700;">' + buildings.length + '</div>';
        html += '<div style="font-size:0.85rem; opacity:0.9;">' + t('team.buildings').replace(/^\s/, '') + '</div>';
        html += '</div>';
        html += '<div style="flex:1; min-width:140px; padding:16px; background:linear-gradient(135deg, #2e7d32, #1b5e20); color:#fff; border-radius:12px; text-align:center;">';
        html += '<div style="font-size:2rem; font-weight:700;">' + totalInspectors + '</div>';
        html += '<div style="font-size:0.85rem; opacity:0.9;">' + t('modal.aqlInspectors') + '</div>';
        html += '</div>';
        html += '<div style="flex:1; min-width:140px; padding:16px; background:linear-gradient(135deg, ' + (totalAboveThreshold > 0 ? '#ef4444, #dc2626' : '#43a047, #2e7d32') + '); color:#fff; border-radius:12px; text-align:center;">';
        html += '<div style="font-size:2rem; font-weight:700;">' + totalAboveThreshold + '</div>';
        html += '<div style="font-size:0.85rem; opacity:0.9;">' + t('modal.buildingsAboveThreshold') + '</div>';
        html += '</div>';
        html += '</div>';

        // === Table 1: Building AQL Summary ===
        html += '<div style="margin-bottom:24px;">';
        html += '<h4 style="font-size:1rem; margin:0 0 8px; color:#1565c0;">📊 ' + t('modal.aqlBuildingSummary') + '</h4>';
        html += '<div class="table-container"><table>';
        html += '<thead><tr>';
        html += '<th>' + t('team.building') + '</th>';
        html += '<th style="text-align:right;">' + t('modal.totalTests') + '</th>';
        html += '<th style="text-align:right;">' + t('modal.passCount') + '</th>';
        html += '<th style="text-align:right;">' + t('modal.aqlFailCount') + '</th>';
        html += '<th style="text-align:right;">' + t('modal.aqlRejectRate') + '</th>';
        html += '<th style="text-align:center;">' + t('modal.aqlGrade') + '</th>';
        html += '</tr></thead><tbody>';

        var grandTests = 0, grandPass = 0, grandFail = 0;
        buildings.forEach(function (bld) {
            var stats = buildingMap[bld];
            var bldFail = stats.totalTests - stats.totalPass;
            var bldRate = stats.totalTests > 0 ? ((bldFail / stats.totalTests) * 100) : 0;
            var g = getGrade(bldRate);

            grandTests += stats.totalTests;
            grandPass += stats.totalPass;
            grandFail += bldFail;

            html += '<tr>';
            html += '<td>' + self._getBuildingBadge(bld) + '</td>';
            html += '<td style="text-align:right;">' + stats.totalTests.toLocaleString() + '</td>';
            html += '<td style="text-align:right;">' + stats.totalPass.toLocaleString() + '</td>';
            html += '<td style="text-align:right;">' + bldFail.toLocaleString() + '</td>';
            html += '<td style="text-align:right; font-weight:600; color:' + g.color + ';">' + bldRate.toFixed(2) + '%</td>';
            html += '<td style="text-align:center;"><span style="display:inline-block; padding:2px 10px; border-radius:10px; font-size:0.82rem; font-weight:700; color:' + g.color + '; background:' + g.bg + ';">' + g.grade + '</span></td>';
            html += '</tr>';
        });

        // Total row
        var grandRate = grandTests > 0 ? ((grandFail / grandTests) * 100) : 0;
        var grandG = getGrade(grandRate);
        html += '<tr style="font-weight:700; background:#f0f4ff;">';
        html += '<td>' + t('modal.totalCount') + '</td>';
        html += '<td style="text-align:right;">' + grandTests.toLocaleString() + '</td>';
        html += '<td style="text-align:right;">' + grandPass.toLocaleString() + '</td>';
        html += '<td style="text-align:right;">' + grandFail.toLocaleString() + '</td>';
        html += '<td style="text-align:right; color:' + grandG.color + ';">' + grandRate.toFixed(2) + '%</td>';
        html += '<td style="text-align:center;"><span style="display:inline-block; padding:2px 10px; border-radius:10px; font-size:0.82rem; font-weight:700; color:' + grandG.color + '; background:' + grandG.bg + ';">' + grandG.grade + '</span></td>';
        html += '</tr>';
        html += '</tbody></table></div></div>';

        // === Table 2: Inspector Stats per Building ===
        html += '<div style="margin-bottom:24px;">';
        html += '<h4 style="font-size:1rem; margin:0 0 8px; color:#2e7d32;">👥 ' + t('modal.aqlInspectorStats') + '</h4>';
        html += '<div class="table-container"><table>';
        html += '<thead><tr>';
        html += '<th>' + t('team.building') + '</th>';
        html += '<th style="text-align:right;">' + t('modal.aqlTotalInspectors') + '</th>';
        html += '<th style="text-align:right;">' + t('modal.aqlFailInspectors') + '</th>';
        html += '<th style="text-align:right;">' + t('modal.aqlPassOnlyInspectors') + '</th>';
        html += '<th style="text-align:right;">' + t('modal.aqlRejectRate') + '</th>';
        html += '</tr></thead><tbody>';

        var gtInsp = 0, gtFail = 0, gtPass = 0;
        buildings.forEach(function (bld) {
            var stats = buildingMap[bld];
            var bldFail = stats.totalTests - stats.totalPass;
            var bldRate = stats.totalTests > 0 ? ((bldFail / stats.totalTests) * 100) : 0;
            var rateColor = bldRate >= thAreaReject ? '#c62828' : '#2e7d32';

            gtInsp += stats.inspectorCount;
            gtFail += stats.failInspectors;
            gtPass += stats.passOnlyInspectors;

            html += '<tr>';
            html += '<td>' + self._getBuildingBadge(bld) + '</td>';
            html += '<td style="text-align:right;">' + stats.inspectorCount + '</td>';
            html += '<td style="text-align:right; color:#c62828; font-weight:' + (stats.failInspectors > 0 ? '700' : '400') + ';">' + stats.failInspectors + '</td>';
            html += '<td style="text-align:right; color:#2e7d32;">' + stats.passOnlyInspectors + '</td>';
            html += '<td style="text-align:right; color:' + rateColor + '; font-weight:600;">' + bldRate.toFixed(2) + '%</td>';
            html += '</tr>';
        });

        // Total
        html += '<tr style="font-weight:700; background:#f0f4ff;">';
        html += '<td>' + t('modal.totalCount') + '</td>';
        html += '<td style="text-align:right;">' + gtInsp + '</td>';
        html += '<td style="text-align:right; color:#c62828;">' + gtFail + '</td>';
        html += '<td style="text-align:right; color:#2e7d32;">' + gtPass + '</td>';
        html += '<td style="text-align:right;">' + grandRate.toFixed(2) + '%</td>';
        html += '</tr>';
        html += '</tbody></table></div></div>';

        // === Table 3: Individual Inspector Detail ===
        html += '<div>';
        html += '<h4 style="font-size:1rem; margin:0 0 8px; color:#e65100;">🔍 ' + t('modal.aqlIndividualDetail') + '</h4>';
        html += '<div class="table-container"><table>';
        html += '<thead><tr>';
        html += '<th>#</th>';
        html += '<th>' + t('table.empNo') + '</th>';
        html += '<th>' + t('table.name') + '</th>';
        html += '<th>' + t('table.building') + '</th>';
        html += '<th>' + t('table.position') + '</th>';
        html += '<th style="text-align:center;">' + t('condition.5') + '</th>';
        html += '<th style="text-align:center;">' + t('condition.8') + '</th>';
        html += '<th style="text-align:right;">' + t('table.incentive') + '</th>';
        html += '</tr></thead><tbody>';

        var rowIdx = 0;
        buildings.forEach(function (bld) {
            var inspectors = buildingMap[bld].inspectors;
            inspectors.sort(function (a, b) { return b.personalFail - a.personalFail; });

            inspectors.forEach(function (insp) {
                rowIdx++;
                var cond5Color = insp.personalFail === 0 ? '#2e7d32' : '#c62828';
                var cond5Text = insp.personalFail === 0 ? '✅ PASS' : '❌ FAIL (' + insp.personalFail + ')';
                var cond8G = getGrade(insp.rejectRate);
                var cond8Text = insp.rejectRate.toFixed(2) + '% (' + cond8G.grade + ')';

                html += '<tr style="cursor:pointer;" onclick="DashboardModals.showEmployeeDetail(\'' + self._escapeHtml(insp.empNo) + '\')">';
                html += '<td style="text-align:center; color:#9e9e9e;">' + rowIdx + '</td>';
                html += '<td>' + self._escapeHtml(insp.empNo) + '</td>';
                html += '<td>' + self._escapeHtml(insp.name) + '</td>';
                html += '<td>' + self._getBuildingBadge(insp.building) + '</td>';
                html += '<td>' + self._escapeHtml(insp.position) + '</td>';
                html += '<td style="text-align:center; color:' + cond5Color + '; font-weight:600;">' + cond5Text + '</td>';
                html += '<td style="text-align:center;"><span style="color:' + cond8G.color + '; font-weight:600;">' + cond8Text + '</span></td>';
                html += '<td style="text-align:right;">' + self._formatVND(insp.incentive) + '</td>';
                html += '</tr>';
            });
        });

        html += '</tbody></table></div></div>';

        return html;
    },

    // ====================================================================
    // V9 Feature: 5PRS 2-Table Structure (Low Pass Rate + Top 10)
    // ====================================================================

    /**
     * Render 5PRS low pass rate content with two tables:
     *  Table 1: All employees below threshold
     *  Table 2: Top 10 lowest pass rates among all TYPE-1 inspectors
     *
     * @param {Object} th - Thresholds
     * @returns {string} HTML
     * @private
     */
    _renderLowPassRateContent: function (th) {
        var self = this;
        var t = this._t;
        var thPassRate = parseFloat(th['5prs_pass_rate'] || 95);

        // Get all TYPE-1 inspectors
        var allType1 = this.employees.filter(function (emp) {
            var empType = String(emp.type || emp.TYPE || '').toUpperCase();
            var isType1 = empType.indexOf('TYPE-1') !== -1 || empType === '1';
            var hasData = parseFloat(emp.prs ? emp.prs.pass_rate : (emp.prs_pass_rate || 0)) > 0;
            return isType1 && hasData;
        });

        // Table 1: Below threshold
        var lowPass = allType1.filter(function (emp) {
            var val = parseFloat(emp.prs ? emp.prs.pass_rate : (emp.prs_pass_rate || 0)) || 0;
            return val < thPassRate;
        });

        // Table 2: Top 10 lowest pass rates
        var top10 = allType1.slice().sort(function (a, b) {
            var aRate = parseFloat(a.prs ? a.prs.pass_rate : (a.prs_pass_rate || 0)) || 0;
            var bRate = parseFloat(b.prs ? b.prs.pass_rate : (b.prs_pass_rate || 0)) || 0;
            return aRate - bRate;
        }).slice(0, 10);

        var columns = [
            { key: 'emp_no', label: t('table.empNo') },
            { key: 'name', label: t('table.name') },
            { key: 'position', label: t('table.position') },
            { key: 'building', label: t('table.building') },
            { key: 'inspection_qty', label: t('modal.inspectionQty'), formatter: 'number' },
            { key: 'pass_rate', label: t('condition.9'), formatter: 'percent' },
            { key: 'incentive', label: t('table.incentive'), formatter: 'vnd' }
        ];

        var html = '';

        // Table 1: Threshold violators
        html += '<div style="margin-bottom: 24px;">';
        html += '<h4 style="font-size: 1rem; margin: 0 0 8px; color: #c62828;">';
        html += '🔴 ' + t('modal.lowPassRateTable1') + ' (< ' + thPassRate + '%)';
        html += ' — <strong>' + lowPass.length + '</strong>' + t('common.people_count');
        html += '</h4>';
        html += this._createEmployeeTable(lowPass, columns, 'lowPassRate');
        html += '</div>';

        // Table 2: Top 10 lowest
        html += '<div>';
        html += '<h4 style="font-size: 1rem; margin: 0 0 8px; color: #e65100;">';
        html += '📊 ' + t('modal.top10LowestPassRate');
        html += '</h4>';

        // _createEmployeeTable already adds a # (row number) column,
        // so no need for a separate rank column.
        html += this._createEmployeeTable(top10, columns, 'lowPassRate');
        html += '</div>';

        return html;
    },

    // ====================================================================
    // V9 Feature: AQL Consecutive Fail 2-Table + Line Leader Aggregation
    // ====================================================================

    /**
     * Render AQL consecutive failure content:
     *  Section 1: 3-month consecutive failures
     *  Section 2: 2-month consecutive failures
     *  Section 3: Line Leader aggregation (failures per supervisor)
     *
     * @param {Object} th - Thresholds
     * @returns {string} HTML
     * @private
     */
    _renderConsecutiveAqlContent: function (th) {
        var self = this;
        var t = this._t;
        var employees = this.employees;

        // Issue #48: Use includes/indexOf for Continuous_FAIL
        var threeMonthFails = employees.filter(function (emp) {
            var val = String(emp.aql ? emp.aql.continuous_fail : (emp.continuous_fail || emp['Continuous_FAIL'] || 'NO'));
            return val.indexOf('YES_3MONTHS') !== -1;
        });

        var twoMonthFails = employees.filter(function (emp) {
            // Check for 2-month field (Continuous_FAIL_2Month) or pattern match
            var cf2 = String(emp.aql ? (emp.aql.continuous_fail_2month || '') : (emp.continuous_fail_2month || emp['Continuous_FAIL_2Month'] || ''));
            if (cf2 === 'YES') return true;
            // Fallback: includes YES but NOT 3MONTHS
            var cf = String(emp.aql ? emp.aql.continuous_fail : (emp.continuous_fail || emp['Continuous_FAIL'] || 'NO'));
            return cf.indexOf('YES') !== -1 && cf.indexOf('3MONTHS') === -1;
        });

        var baseColumns = [
            { key: 'emp_no', label: t('table.empNo') },
            { key: 'name', label: t('table.name') },
            { key: 'position', label: t('table.position') },
            { key: 'building', label: t('table.building') },
            { key: 'boss_name', label: t('modal.bossName') },
            { key: 'continuous_fail', label: t('modal.failPattern'), formatter: 'text' },
            { key: 'incentive', label: t('table.incentive'), formatter: 'vnd' }
        ];

        var html = '';

        // Summary statistics
        html += '<div style="display: flex; gap: 16px; margin-bottom: 20px;">';
        html += '<div style="flex:1; padding: 16px; background: linear-gradient(135deg, #ef4444, #dc2626); color: #fff; border-radius: 12px; text-align: center;">';
        html += '<div style="font-size: 2rem; font-weight: 700;">' + threeMonthFails.length + '</div>';
        html += '<div style="font-size: 0.85rem; opacity: 0.9;">' + t('modal.threeMonthAqlFail') + '</div>';
        html += '</div>';
        html += '<div style="flex:1; padding: 16px; background: linear-gradient(135deg, #f97316, #ea580c); color: #fff; border-radius: 12px; text-align: center;">';
        html += '<div style="font-size: 2rem; font-weight: 700;">' + twoMonthFails.length + '</div>';
        html += '<div style="font-size: 0.85rem; opacity: 0.9;">' + t('modal.twoMonthAqlFail') + '</div>';
        html += '</div>';
        html += '</div>';

        // Table 1: 3-month failures
        html += '<div style="margin-bottom: 24px;">';
        html += '<h4 style="font-size: 1rem; margin: 0 0 8px; color: #c62828;">';
        html += '🔴 ' + t('modal.threeMonthAqlFail');
        html += ' — <strong>' + threeMonthFails.length + '</strong>' + t('common.people_count');
        html += '</h4>';
        html += this._createEmployeeTable(threeMonthFails, baseColumns, 'consecutiveAqlFail');
        html += '</div>';

        // Table 2: 2-month failures
        html += '<div style="margin-bottom: 24px;">';
        html += '<h4 style="font-size: 1rem; margin: 0 0 8px; color: #e65100;">';
        html += '🟠 ' + t('modal.twoMonthAqlFail');
        html += ' — <strong>' + twoMonthFails.length + '</strong>' + t('common.people_count');
        html += '</h4>';
        html += this._createEmployeeTable(twoMonthFails, baseColumns, 'consecutiveAqlFail');
        html += '</div>';

        // Section 3: Line Leader aggregation
        var allFails = threeMonthFails.concat(twoMonthFails);
        var leaderMap = {};
        allFails.forEach(function (emp) {
            var bossName = emp.boss_name || emp['Boss Name'] || t('common.unknown');
            var bossId = String(emp.boss_id || emp['Boss ID'] || '');
            var key = bossId || bossName;
            if (!leaderMap[key]) {
                leaderMap[key] = { name: bossName, id: bossId, count3m: 0, count2m: 0, total: 0, employees: [] };
            }
            var cf = String(emp.aql ? emp.aql.continuous_fail : (emp.continuous_fail || emp['Continuous_FAIL'] || 'NO'));
            if (cf.indexOf('3MONTHS') !== -1) {
                leaderMap[key].count3m++;
            } else {
                leaderMap[key].count2m++;
            }
            leaderMap[key].total++;
            leaderMap[key].employees.push(emp.full_name || emp.name || '--');
        });

        var leaders = Object.keys(leaderMap).map(function (k) { return leaderMap[k]; });
        leaders.sort(function (a, b) { return b.total - a.total; });

        if (leaders.length > 0) {
            html += '<div>';
            html += '<h4 style="font-size: 1rem; margin: 0 0 8px; color: #1565c0;">';
            html += '📊 ' + t('modal.lineLeaderAggregation');
            html += '</h4>';
            html += '<div class="table-container"><table>';
            html += '<thead><tr>';
            html += '<th>#</th>';
            html += '<th>' + t('modal.supervisorName') + '</th>';
            html += '<th style="text-align:center;">' + t('modal.threeMonthAqlFail') + '</th>';
            html += '<th style="text-align:center;">' + t('modal.twoMonthAqlFail') + '</th>';
            html += '<th style="text-align:center;">' + t('modal.totalCount') + '</th>';
            html += '<th>' + t('modal.subordinateNames') + '</th>';
            html += '</tr></thead><tbody>';

            leaders.forEach(function (leader, idx) {
                html += '<tr>';
                html += '<td style="text-align:center; color:#9e9e9e;">' + (idx + 1) + '</td>';
                html += '<td><strong>' + self._escapeHtml(leader.name) + '</strong></td>';
                html += '<td style="text-align:center;">';
                html += leader.count3m > 0 ? '<span style="color:#c62828; font-weight:700;">' + leader.count3m + '</span>' : '0';
                html += '</td>';
                html += '<td style="text-align:center;">';
                html += leader.count2m > 0 ? '<span style="color:#e65100; font-weight:700;">' + leader.count2m + '</span>' : '0';
                html += '</td>';
                html += '<td style="text-align:center; font-weight:700;">' + leader.total + '</td>';
                html += '<td style="font-size:0.85rem; color:#616161;">' + leader.employees.map(function (n) { return self._escapeHtml(n); }).join(', ') + '</td>';
                html += '</tr>';
            });

            html += '</tbody></table></div>';
            html += '</div>';
        }

        return html;
    },

    // ====================================================================
    // V9 Feature: Cross-Building Enhanced Modal
    // ====================================================================

    /**
     * Building color mapping (V9 pattern from Issue #34).
     * @private
     */
    _BUILDING_COLORS: {
        'A': '#ef4444', 'A1': '#f87171', 'A2': '#fca5a5',
        'B': '#3b82f6', 'B1': '#60a5fa', 'B2': '#93c5fd', 'B3': '#8b5cf6',
        'C': '#10b981', 'D': '#f59e0b',
        'E1': '#6366f1', 'E2': '#818cf8',
        'MTL WH': '#64748b', 'FG-WH': '#94a3b8',
        'QA OFFICE': '#ec4899', 'QIP OFFICE': '#f472b6',
        'INHOUSE EZ': '#14b8a6', 'INHOUSE PRINTING': '#2dd4bf'
    },

    /**
     * Get building color badge HTML.
     * @param {string} building
     * @returns {string} HTML badge
     * @private
     */
    _getBuildingBadge: function (building) {
        if (!building || building === '--' || building === 'N/A') {
            return '<span style="display:inline-block; padding:2px 8px; border-radius:10px; font-size:0.78rem; background:#e0e0e0; color:#757575;">N/A</span>';
        }
        var key = String(building).toUpperCase().trim();
        var color = this._BUILDING_COLORS[key] || '#6c757d';
        return '<span style="display:inline-block; padding:2px 8px; border-radius:10px; font-size:0.78rem; font-weight:600; color:#fff; background:' + color + ';">' + this._escapeHtml(building) + '</span>';
    },

    /**
     * Render Cross-Building review content with color badges and case classification.
     *
     * Case 1: Building mismatch (employee vs boss different buildings)
     * Case 2: Boss building unknown
     *
     * @param {Object} th - Thresholds
     * @returns {string} HTML
     * @private
     */
    _renderBuildingReviewContent: function (th) {
        var self = this;
        var t = this._t;
        var employees = this.employees;

        // Build empMap for boss building lookup (V10 has no boss_building field)
        // Same pattern as dashboard-charts.js line 1730-1752
        var empMap = {};
        employees.forEach(function (emp) {
            var empNo = String(emp.emp_no || emp['Employee No'] || '');
            if (empNo) empMap[empNo] = emp;
        });

        // Helper: get boss building via empMap lookup
        function getBossBuilding(emp) {
            var bossId = String(emp.boss_id || '');
            if (!bossId) return '';
            var boss = empMap[bossId];
            return boss ? String(boss.building || '').toUpperCase().trim() : '';
        }

        // Case 1: Building mismatch (employee and boss have different buildings)
        var case1 = employees.filter(function (emp) {
            var building = String(emp.building || '').toUpperCase().trim();
            var bossBuilding = getBossBuilding(emp);
            if (!building || !bossBuilding) return false;
            // Use startsWith for hierarchical building matching (A matches A2)
            return !building.startsWith(bossBuilding) && !bossBuilding.startsWith(building);
        });

        // Case 2: Boss building unknown (employee has building, boss has no building)
        var case2 = employees.filter(function (emp) {
            var building = String(emp.building || '').toUpperCase().trim();
            var bossId = String(emp.boss_id || '');
            if (!building || !bossId) return false;
            var bossBuilding = getBossBuilding(emp);
            return !bossBuilding;
        });

        var totalCases = case1.length + case2.length;

        var html = '';

        // Summary KPIs
        html += '<div style="display: flex; gap: 16px; margin-bottom: 20px;">';
        html += '<div style="flex:1; padding: 16px; background: linear-gradient(135deg, #ff9800, #f57c00); color: #fff; border-radius: 12px; text-align: center;">';
        html += '<div style="font-size: 2rem; font-weight: 700;">' + totalCases + '</div>';
        html += '<div style="font-size: 0.85rem; opacity: 0.9;">' + t('modal.totalCases') + '</div>';
        html += '</div>';
        html += '<div style="flex:1; padding: 16px; background: linear-gradient(135deg, #ef4444, #dc2626); color: #fff; border-radius: 12px; text-align: center;">';
        html += '<div style="font-size: 2rem; font-weight: 700;">' + case1.length + '</div>';
        html += '<div style="font-size: 0.85rem; opacity: 0.9;">' + t('modal.caseMismatch') + '</div>';
        html += '</div>';
        html += '<div style="flex:1; padding: 16px; background: linear-gradient(135deg, #9e9e9e, #757575); color: #fff; border-radius: 12px; text-align: center;">';
        html += '<div style="font-size: 2rem; font-weight: 700;">' + case2.length + '</div>';
        html += '<div style="font-size: 0.85rem; opacity: 0.9;">' + t('modal.caseNoInfo') + '</div>';
        html += '</div>';
        html += '</div>';

        // Helper: create cross-building table with color badges
        function buildCBTable(emps, showBossBuilding) {
            if (!emps || emps.length === 0) {
                return '<p style="text-align:center; color:#9e9e9e; padding:12px;">' + t('common.noData') + '</p>';
            }
            var tbl = '<div class="table-container"><table>';
            tbl += '<thead><tr>';
            tbl += '<th style="width:40px;">#</th>';
            tbl += '<th>' + t('table.empNo') + '</th>';
            tbl += '<th>' + t('table.name') + '</th>';
            tbl += '<th>' + t('table.position') + '</th>';
            tbl += '<th>' + t('table.building') + '</th>';
            tbl += '<th>' + t('modal.bossName') + '</th>';
            if (showBossBuilding) {
                tbl += '<th>' + t('modal.bossBuilding') + '</th>';
            }
            tbl += '</tr></thead><tbody>';

            emps.forEach(function (emp, idx) {
                var empNo = String(emp.emp_no || '');
                tbl += '<tr style="cursor:pointer;" onclick="DashboardModals.showEmployeeDetail(\'' + self._escapeHtml(empNo) + '\')">';
                tbl += '<td style="text-align:center; color:#9e9e9e;">' + (idx + 1) + '</td>';
                tbl += '<td>' + self._escapeHtml(empNo) + '</td>';
                tbl += '<td>' + self._escapeHtml(emp.full_name || emp.name || '--') + '</td>';
                tbl += '<td>' + self._escapeHtml(emp.position || '--') + '</td>';
                tbl += '<td>' + self._getBuildingBadge(emp.building) + '</td>';
                tbl += '<td>' + self._escapeHtml(emp.boss_name || '--') + '</td>';
                if (showBossBuilding) {
                    tbl += '<td>' + self._getBuildingBadge(getBossBuilding(emp)) + '</td>';
                }
                tbl += '</tr>';
            });

            tbl += '</tbody></table></div>';
            return tbl;
        }

        // Case 1: Building Mismatch
        html += '<div style="margin-bottom: 24px;">';
        html += '<h4 style="font-size: 1rem; margin: 0 0 8px; color: #c62828;">';
        html += '🔴 ' + t('modal.caseMismatch');
        html += ' — <strong>' + case1.length + '</strong>' + t('common.people_count');
        html += '</h4>';
        html += buildCBTable(case1, true);
        html += '</div>';

        // Case 2: Boss No Info
        html += '<div>';
        html += '<h4 style="font-size: 1rem; margin: 0 0 8px; color: #757575;">';
        html += '⚪ ' + t('modal.caseNoInfo');
        html += ' — <strong>' + case2.length + '</strong>' + t('common.people_count');
        html += '</h4>';
        html += buildCBTable(case2, false);
        html += '</div>';

        return html;
    },

    // ====================================================================
    // V9 Feature: AQL Inspector 3-Part Breakdown
    // ====================================================================

    /**
     * Render AQL Inspector 3-Part incentive breakdown.
     * Part 1: AQL 검사 평가 (progression table)
     * Part 2: CFA 자격증 (fixed 700,000 VND if certified)
     * Part 3: HWK 클레임 방지 (progression table)
     *
     * Only shown for AQL Inspector positions.
     *
     * @param {Object} emp - Employee object
     * @param {number} currentIncentive - Current incentive amount
     * @returns {string} HTML
     * @private
     */
    _renderAqlInspector3Part: function (emp, currentIncentive) {
        var t = this._t;
        var position = String(emp.position || emp.Position || '').toUpperCase();

        // Check if this employee is an AQL Inspector
        var isAqlInspector = position.indexOf('AQL') !== -1 && position.indexOf('INSPECTOR') !== -1;
        if (!isAqlInspector) return '';

        // AQL Inspector config is optional — show 3-Part even without it
        var aqlConfig = window.aqlInspectorConfig || window.aqlIncentiveConfig || null;

        var empNo = String(emp.emp_no || emp['Employee No'] || '');
        var inspectorData = null;

        // Look up inspector data in config (if available)
        if (aqlConfig && aqlConfig.aql_inspectors) {
            inspectorData = aqlConfig.aql_inspectors[empNo];
        }

        // Derive data from employee record
        var continuousMonths = parseInt(emp.continuous_months || emp.Continuous_Months || 0, 10) || 0;
        var isPaid = currentIncentive > 0;

        // Part 1: AQL 검사 평가 (from progressive table)
        var part1Amount = 0;
        var part1Months = continuousMonths;
        var progressiveTable = this._getProgressiveTable();
        if (isPaid && part1Months > 0) {
            part1Amount = progressiveTable[Math.min(part1Months, 15)] || 0;
        }

        // Part 2: CFA 자격증 (check config or data)
        var isCfaCertified = false;
        var part2Amount = 0;
        if (inspectorData) {
            isCfaCertified = inspectorData.cfa_certified || false;
        }
        if (isCfaCertified && isPaid) {
            part2Amount = (aqlConfig && aqlConfig.parts && aqlConfig.parts.part2) ? (aqlConfig.parts.part2.amount || 700000) : 700000;
        }

        // Part 3: HWK 클레임 방지 (from config if available)
        var part3Amount = 0;
        var part3Months = 0;
        if (inspectorData) {
            // Try to find current month data in inspector data
            var monthKeys = Object.keys(inspectorData).filter(function (k) { return k.indexOf('_incentive') !== -1; });
            if (monthKeys.length > 0) {
                var latestKey = monthKeys[monthKeys.length - 1];
                var monthData = inspectorData[latestKey];
                if (monthData && typeof monthData === 'object') {
                    part3Months = monthData.part3_months || 0;
                    part3Amount = monthData.part3_amount || 0;
                    // Override part1 if available
                    if (monthData.part1_months !== undefined) part1Months = monthData.part1_months;
                    if (monthData.part1_amount !== undefined) part1Amount = monthData.part1_amount;
                }
            }
        }

        var totalAmount = part1Amount + part2Amount + part3Amount;

        // Build HTML
        var html = '<div style="margin-top: 16px; border: 2px solid #17a2b8; border-radius: 12px; padding: 16px;">';
        html += '<h4 style="font-size: 0.95rem; margin: 0 0 12px; color: #17a2b8;">';
        html += '🎯 ' + t('modal.aqlInspector3Part');
        html += '</h4>';

        if (!isPaid) {
            html += '<div style="padding: 10px; background: #fff3e0; border-radius: 8px; color: #e65100; margin-bottom: 12px; font-size: 0.88rem;">';
            html += '⚠️ ' + t('modal.conditionNotMet');
            html += '</div>';
        }

        html += '<div class="table-container"><table>';
        html += '<thead><tr style="background: #17a2b8; color: #fff;">';
        html += '<th style="width:50%;">' + t('modal.category') + '</th>';
        html += '<th style="width:25%; text-align:center;">' + t('modal.conditionDetail') + '</th>';
        html += '<th style="width:25%; text-align:right;">' + t('modal.amount') + '</th>';
        html += '</tr></thead><tbody>';

        // Part 1
        html += '<tr>';
        html += '<td><strong>Part 1: ' + t('modal.aqlPart1') + '</strong></td>';
        html += '<td style="text-align:center;">' + part1Months + ' ' + t('unit.months') + '</td>';
        html += '<td style="text-align:right;">' + this._formatVND(part1Amount) + ' ' + t('unit.currency') + '</td>';
        html += '</tr>';

        // Part 2
        html += '<tr>';
        html += '<td><strong>Part 2: ' + t('modal.aqlPart2') + '</strong></td>';
        html += '<td style="text-align:center;">' + (isCfaCertified ? '✅' : '❌') + '</td>';
        html += '<td style="text-align:right;">' + this._formatVND(part2Amount) + ' ' + t('unit.currency') + '</td>';
        html += '</tr>';

        // Part 3
        html += '<tr>';
        html += '<td><strong>Part 3: ' + t('modal.aqlPart3') + '</strong></td>';
        html += '<td style="text-align:center;">' + part3Months + ' ' + t('unit.months') + '</td>';
        html += '<td style="text-align:right;">' + this._formatVND(part3Amount) + ' ' + t('unit.currency') + '</td>';
        html += '</tr>';

        // Total
        html += '<tr style="background: #d4edda; font-weight: 700;">';
        html += '<td colspan="2">' + t('modal.total') + '</td>';
        html += '<td style="text-align:right;">' + this._formatVND(totalAmount) + ' ' + t('unit.currency') + '</td>';
        html += '</tr>';

        html += '</tbody></table></div>';
        html += '</div>';

        return html;
    },

    // ====================================================================
    // Task #18: Continuous Months Reset Notice
    // ====================================================================

    /**
     * Show a warning notice when continuous months have been reset
     * (previous_continuous_months > current continuous_months).
     * Ported from V9 integrated_dashboard_final.py:20529-20732
     *
     * @param {Object} emp
     * @param {number} currentMonths - Current continuous months
     * @returns {string} HTML
     * @private
     */
    _renderContinuousMonthsReset: function (emp, currentMonths) {
        var t = this._t;
        var empType = String(emp.type || emp.TYPE || emp['ROLE TYPE STD'] || '').toUpperCase();
        var isType1 = empType.indexOf('TYPE-1') !== -1 || empType === '1';
        if (!isType1) return '';

        var prevMonths = parseInt(emp.previous_continuous_months || emp.Previous_Continuous_Months || emp['Previous_Continuous_Months'] || 0, 10) || 0;
        if (prevMonths <= currentMonths || prevMonths === 0) return '';

        // Build reset notice UI
        var html = '<div style="margin-top: 16px; background: linear-gradient(135deg, #ff6b6b, #ee5a24); border-radius: 12px; padding: 16px; color: #fff;">';

        // Header
        html += '<div style="display: flex; align-items: center; gap: 10px; margin-bottom: 12px;">';
        html += '<span style="font-size: 1.5rem;">⚠️</span>';
        html += '<div>';
        html += '<div style="font-weight: 700; font-size: 1rem;">' + t('reset.title') + '</div>';
        html += '<div style="font-size: 0.8rem; opacity: 0.9;">' + t('reset.subtitle') + '</div>';
        html += '</div></div>';

        // Previous vs Current comparison cards
        html += '<div style="display: grid; grid-template-columns: 1fr auto 1fr; gap: 10px; align-items: center; margin-bottom: 14px;">';

        // Previous card (amber)
        html += '<div style="background: rgba(255,255,255,0.15); border-radius: 8px; padding: 10px; text-align: center;">';
        html += '<div style="font-size: 0.75rem; opacity: 0.85;">' + t('reset.previous') + '</div>';
        html += '<div style="font-size: 1.8rem; font-weight: 800;">' + prevMonths + '</div>';
        html += '<div style="font-size: 0.7rem; opacity: 0.75;">' + t('unit.months') + '</div>';
        html += '</div>';

        // Arrow
        html += '<div style="font-size: 1.5rem; opacity: 0.8;">→</div>';

        // Current card (blue)
        html += '<div style="background: rgba(255,255,255,0.25); border-radius: 8px; padding: 10px; text-align: center;">';
        html += '<div style="font-size: 0.75rem; opacity: 0.85;">' + t('reset.current') + '</div>';
        html += '<div style="font-size: 1.8rem; font-weight: 800;">' + currentMonths + '</div>';
        html += '<div style="font-size: 0.7rem; opacity: 0.75;">' + t('unit.months') + '</div>';
        html += '</div>';
        html += '</div>';

        // 12-circle progress visualization
        html += '<div style="display: flex; gap: 4px; justify-content: center; margin-bottom: 14px; flex-wrap: wrap;">';
        for (var c = 1; c <= 12; c++) {
            var circleStyle = 'width: 24px; height: 24px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 0.6rem; font-weight: 600;';
            if (c <= prevMonths && c > currentMonths) {
                // Lost months (strikethrough)
                circleStyle += ' background: rgba(255,255,255,0.3); color: #fff; text-decoration: line-through;';
            } else if (c <= currentMonths) {
                // Current months
                circleStyle += ' background: #fff; color: #ee5a24;';
            } else {
                // Future months
                circleStyle += ' background: rgba(255,255,255,0.1); color: rgba(255,255,255,0.4);';
            }
            html += '<div style="' + circleStyle + '">' + c + '</div>';
        }
        html += '</div>';

        // Reset reasons
        html += '<div style="background: rgba(0,0,0,0.15); border-radius: 8px; padding: 10px; margin-bottom: 10px; font-size: 0.8rem;">';
        html += '<div style="font-weight: 600; margin-bottom: 6px;">' + t('reset.reasonTitle') + '</div>';
        html += '<div>• ' + t('reset.reason1') + '</div>';
        html += '<div>• ' + t('reset.reason2') + '</div>';
        html += '<div>• ' + t('reset.reason3') + '</div>';
        html += '<div>• ' + t('reset.reason4') + '</div>';
        html += '</div>';

        // Restart tips
        html += '<div style="background: rgba(255,255,255,0.15); border-radius: 8px; padding: 10px; font-size: 0.8rem;">';
        html += '<div style="font-weight: 600; margin-bottom: 6px;">🔄 ' + t('reset.restartTitle') + '</div>';
        html += '<div>✅ ' + t('reset.tip1') + '</div>';
        html += '<div>✅ ' + t('reset.tip2') + '</div>';
        html += '</div>';

        // Encouragement
        html += '<div style="text-align: center; margin-top: 10px; font-size: 0.85rem; font-weight: 600;">';
        html += '💪 ' + t('reset.encouragement');
        html += '</div>';

        html += '</div>';
        return html;
    },

    // ====================================================================
    // Task #19: TYPE-3 New Employee Roadmap
    // ====================================================================

    /**
     * Show a roadmap/timeline for TYPE-3 (policy excluded) new employees.
     * Ported from V9 integrated_dashboard_final.py:20734-20911
     *
     * @param {Object} emp
     * @returns {string} HTML
     * @private
     */
    _renderType3Roadmap: function (emp) {
        var t = this._t;
        var empType = String(emp.type || emp.TYPE || emp['ROLE TYPE STD'] || '').toUpperCase();
        if (empType.indexOf('TYPE-3') === -1 && empType !== '3') return '';

        // Calculate D-day (days until next month 1st)
        var now = new Date();
        var nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
        var daysRemaining = Math.ceil((nextMonth - now) / (1000 * 60 * 60 * 24));

        // Get entrance date
        var entranceDate = emp.entrance_date || emp['Entrance Date'] || emp['Hire Date'] || '--';

        var html = '<div style="margin-top: 16px; background: linear-gradient(135deg, #667eea, #764ba2); border-radius: 12px; padding: 16px; color: #fff;">';

        // Header with D-day badge
        html += '<div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px;">';
        html += '<div>';
        html += '<div style="font-weight: 700; font-size: 1rem;">' + t('type3.title') + '</div>';
        html += '<div style="font-size: 0.8rem; opacity: 0.9;">' + t('type3.subtitle') + '</div>';
        html += '</div>';
        html += '<div style="background: rgba(255,255,255,0.25); border-radius: 20px; padding: 6px 14px; font-weight: 700; font-size: 0.9rem;">';
        html += 'D-' + daysRemaining;
        html += '</div></div>';

        // 4-Step Timeline
        var steps = [
            { icon: '✓', label: t('type3.step1'), done: true },
            { icon: '📚', label: t('type3.step2'), done: true },
            { icon: '🏭', label: t('type3.step3'), done: true },
            { icon: '💰', label: t('type3.step4'), done: false }
        ];

        html += '<div style="display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 14px; position: relative;">';
        // Connecting line
        html += '<div style="position: absolute; top: 18px; left: 10%; right: 10%; height: 2px; background: rgba(255,255,255,0.3);"></div>';

        for (var s = 0; s < steps.length; s++) {
            var step = steps[s];
            var isLast = (s === steps.length - 1);
            var circBg = step.done ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.2)';
            var circColor = step.done ? '#764ba2' : 'rgba(255,255,255,0.6)';
            var pulse = isLast ? ' animation: pulse 2s infinite;' : '';

            html += '<div style="text-align: center; flex: 1; position: relative; z-index: 1;">';
            html += '<div style="width: 36px; height: 36px; border-radius: 50%; background: ' + circBg + '; color: ' + circColor + ';';
            html += ' display: inline-flex; align-items: center; justify-content: center; font-size: 1rem; font-weight: 700;' + pulse + '">';
            html += step.icon;
            html += '</div>';
            html += '<div style="font-size: 0.7rem; margin-top: 4px; opacity: 0.9;">' + step.label + '</div>';
            html += '</div>';
        }
        html += '</div>';

        // Info boxes
        html += '<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 10px;">';

        html += '<div style="background: rgba(255,255,255,0.15); border-radius: 8px; padding: 10px;">';
        html += '<div style="font-size: 0.72rem; opacity: 0.8;">' + t('type3.hireDate') + '</div>';
        html += '<div style="font-weight: 700;">' + this._escapeHtml(String(entranceDate)) + '</div>';
        html += '</div>';

        html += '<div style="background: rgba(255,255,255,0.15); border-radius: 8px; padding: 10px;">';
        html += '<div style="font-size: 0.72rem; opacity: 0.8;">' + t('type3.expectedStart') + '</div>';
        html += '<div style="font-weight: 700;">' + t('type3.nextMonth') + '</div>';
        html += '</div>';

        html += '</div>';

        // Tip: First incentive amount
        html += '<div style="background: rgba(255,255,255,0.2); border-radius: 8px; padding: 10px; text-align: center; font-size: 0.85rem;">';
        html += '💡 ' + t('type3.tip');
        html += '</div>';

        html += '</div>';

        // Inject pulse animation CSS if not already present
        if (!document.getElementById('type3PulseStyle')) {
            var style = document.createElement('style');
            style.id = 'type3PulseStyle';
            style.textContent = '@keyframes pulse { 0%,100% { transform: scale(1); } 50% { transform: scale(1.15); } }';
            document.head.appendChild(style);
        }

        return html;
    }
};

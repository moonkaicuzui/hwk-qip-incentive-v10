/**
 * Dashboard Charts & KPI Module
 * HWK QIP Incentive Dashboard V10
 *
 * Renders all Chart.js charts and populates KPI cards on the dashboard.
 * Uses Chart.js 4.4.0 (loaded via CDN in dashboard.html).
 *
 * Depends on:
 *   - dashboard-data.js (window.employeeData, window.employeeHelpers, window.thresholds)
 *   - Chart.js 4.4.0 (global Chart object)
 *
 * DOM element IDs consumed:
 *   Summary tab:    #recipientsCountValue, #paymentRateValue, #totalAmountValue,
 *                   #recipientsTrend, #paymentRateTrend, #totalAmountTrend,
 *                   #typeTableContainer, #conditionChartsContainer
 *   Validation tab: #kpiTotalWorkingDays .. #kpiLineLeaderNotAssigned (12 cards)
 */

// ---------------------------------------------------------------------------
// DashboardCharts Namespace
// ---------------------------------------------------------------------------

var DashboardCharts = {

    // Store chart instances for cleanup (prevents Chart.js "Canvas already in use")
    charts: {},

    // Color constants
    colors: {
        green:  '#28a745',
        yellow: '#ffc107',
        red:    '#dc3545',
        blue:   '#007bff',
        gray:   '#6c757d',
        greenBg:  'rgba(40, 167, 69, 0.15)',
        yellowBg: 'rgba(255, 193, 7, 0.15)',
        redBg:    'rgba(220, 53, 69, 0.15)',
        blueBg:   'rgba(0, 123, 255, 0.15)',
        grayBg:   'rgba(108, 117, 125, 0.15)'
    },

    // ------------------------------------------------------------------
    // Public API
    // ------------------------------------------------------------------

    /**
     * Initialize all charts and KPI cards.
     * Called from dashboard.html DOMContentLoaded after data is loaded.
     *
     * @param {Object} data - { employees: Array, summary: Object, thresholds: Object }
     */
    init: function (data) {
        if (!data) {
            console.warn('[DashboardCharts] init called with no data');
            return;
        }

        console.log('[DashboardCharts] Initializing charts and KPIs');

        this.renderSummaryKPIs(data);
        this.renderTypeTable(data);
        this.renderConditionCharts(data);
        this.renderValidationKPIs(data);

        console.log('[DashboardCharts] Initialization complete');
    },

    // ------------------------------------------------------------------
    // Chart Lifecycle
    // ------------------------------------------------------------------

    /**
     * Destroy an existing Chart.js instance before recreating it.
     * Prevents "Canvas is already in use" error.
     *
     * @param {string} canvasId - The canvas element id
     */
    destroyChart: function (canvasId) {
        if (this.charts[canvasId]) {
            this.charts[canvasId].destroy();
            delete this.charts[canvasId];
        }
    },

    // ------------------------------------------------------------------
    // Summary Tab: KPI Cards
    // ------------------------------------------------------------------

    /**
     * Populate the 3 main KPI cards in the summary tab.
     *   #recipientsCountValue  - receiving employee count
     *   #paymentRateValue      - receiving / eligible * 100 (%)
     *   #totalAmountValue      - total VND with commas
     *
     * @param {Object} data - { employees, summary, thresholds }
     */
    renderSummaryKPIs: function (data) {
        var employees = data.employees || [];
        var summary = data.summary || {};

        // Calculate from employees (Single Source of Truth)
        var totalCount = employees.length;
        var receivingCount = 0;
        var totalAmount = 0;

        employees.forEach(function (emp) {
            var amount = window.employeeHelpers
                ? window.employeeHelpers.getIncentive(emp, 'current')
                : (parseFloat(emp.currentIncentive || emp.current_incentive || 0) || 0);
            if (amount > 0) {
                receivingCount++;
                totalAmount += amount;
            }
        });

        // Use summary values as override if available and employees array is empty
        if (totalCount === 0 && summary.total_employees) {
            totalCount = parseInt(summary.total_employees, 10) || 0;
            receivingCount = parseInt(summary.receiving_employees, 10) || 0;
            totalAmount = parseFloat(summary.total_incentive, 10) || 0;
        }

        var paymentRate = totalCount > 0
            ? ((receivingCount / totalCount) * 100)
            : 0;

        // Set KPI values
        this._setText('recipientsCountValue', this._formatNumber(receivingCount));
        this._setText('paymentRateValue', this.formatPercent(paymentRate) + '%');
        this._setText('totalAmountValue', this.formatVND(totalAmount) + ' VND');

        // Trend indicators (from summary if available)
        this._renderTrend('recipientsTrend', summary.recipients_trend);
        this._renderTrend('paymentRateTrend', summary.payment_rate_trend);
        this._renderTrend('totalAmountTrend', summary.total_amount_trend);

        console.log('[DashboardCharts] Summary KPIs rendered:',
            'recipients=' + receivingCount,
            'rate=' + this.formatPercent(paymentRate) + '%',
            'total=' + this.formatVND(totalAmount));
    },

    // ------------------------------------------------------------------
    // Summary Tab: TYPE Table
    // ------------------------------------------------------------------

    /**
     * Populate #typeTableContainer with TYPE-1, TYPE-2, TYPE-3 breakdown.
     *
     * Columns: TYPE, Total Employees, Receiving, Payment Rate(%),
     *          Total Amount, Avg (Receiving), Avg (All)
     *
     * @param {Object} data - { employees, summary, thresholds }
     */
    renderTypeTable: function (data) {
        var container = document.getElementById('typeTableContainer');
        if (!container) return;

        var employees = data.employees || [];

        if (employees.length === 0) {
            container.innerHTML = '<p style="color: #757575; text-align: center; padding: 20px;">No data available</p>';
            return;
        }

        // Group employees by TYPE
        var types = { 'TYPE-1': [], 'TYPE-2': [], 'TYPE-3': [] };

        employees.forEach(function (emp) {
            var empType = String(emp.type || emp.TYPE || emp['ROLE TYPE STD'] || '').toUpperCase();
            if (empType.indexOf('TYPE-1') !== -1 || empType === '1') {
                types['TYPE-1'].push(emp);
            } else if (empType.indexOf('TYPE-2') !== -1 || empType === '2') {
                types['TYPE-2'].push(emp);
            } else if (empType.indexOf('TYPE-3') !== -1 || empType === '3') {
                types['TYPE-3'].push(emp);
            } else {
                // Unknown type - default to TYPE-3
                types['TYPE-3'].push(emp);
            }
        });

        // Build table HTML
        var html = '<div class="table-container"><table>';
        html += '<thead><tr>';
        html += '<th>TYPE</th>';
        html += '<th style="text-align:right;">Total</th>';
        html += '<th style="text-align:right;">Receiving</th>';
        html += '<th style="text-align:right;">Rate (%)</th>';
        html += '<th style="text-align:right;">Total Amount (VND)</th>';
        html += '<th style="text-align:right;">Avg (Receiving)</th>';
        html += '<th style="text-align:right;">Avg (All)</th>';
        html += '</tr></thead><tbody>';

        var self = this;
        var grandTotal = 0;
        var grandCount = 0;
        var grandReceiving = 0;
        var grandAmount = 0;

        var typeKeys = ['TYPE-1', 'TYPE-2', 'TYPE-3'];
        typeKeys.forEach(function (typeKey) {
            var emps = types[typeKey];
            var total = emps.length;
            var receiving = 0;
            var amount = 0;

            emps.forEach(function (emp) {
                var incentive = window.employeeHelpers
                    ? window.employeeHelpers.getIncentive(emp, 'current')
                    : (parseFloat(emp.currentIncentive || emp.current_incentive || 0) || 0);
                if (incentive > 0) {
                    receiving++;
                    amount += incentive;
                }
            });

            var rate = total > 0 ? ((receiving / total) * 100) : 0;
            var avgReceiving = receiving > 0 ? (amount / receiving) : 0;
            var avgAll = total > 0 ? (amount / total) : 0;

            // Rate color coding
            var rateColor = self.colors.red;
            if (rate >= 80) rateColor = self.colors.green;
            else if (rate >= 50) rateColor = self.colors.yellow;

            // TYPE badge
            var badgeClass = 'badge-type1';
            if (typeKey === 'TYPE-2') badgeClass = 'badge-type2';
            else if (typeKey === 'TYPE-3') badgeClass = 'badge-type3';

            html += '<tr>';
            html += '<td><span class="badge-type ' + badgeClass + '">' + typeKey + '</span></td>';
            html += '<td style="text-align:right;">' + self._formatNumber(total) + '</td>';
            html += '<td style="text-align:right;">' + self._formatNumber(receiving) + '</td>';
            html += '<td style="text-align:right; color:' + rateColor + '; font-weight:600;">' + self.formatPercent(rate) + '%</td>';
            html += '<td style="text-align:right;">' + self.formatVND(amount) + '</td>';
            html += '<td style="text-align:right;">' + self.formatVND(avgReceiving) + '</td>';
            html += '<td style="text-align:right;">' + self.formatVND(avgAll) + '</td>';
            html += '</tr>';

            grandTotal += total;
            grandReceiving += receiving;
            grandAmount += amount;
        });

        // Total row
        var grandRate = grandTotal > 0 ? ((grandReceiving / grandTotal) * 100) : 0;
        var grandAvgReceiving = grandReceiving > 0 ? (grandAmount / grandReceiving) : 0;
        var grandAvgAll = grandTotal > 0 ? (grandAmount / grandTotal) : 0;

        html += '<tr style="font-weight: 700; background: #f0f4ff;">';
        html += '<td>Total</td>';
        html += '<td style="text-align:right;">' + this._formatNumber(grandTotal) + '</td>';
        html += '<td style="text-align:right;">' + this._formatNumber(grandReceiving) + '</td>';
        html += '<td style="text-align:right;">' + this.formatPercent(grandRate) + '%</td>';
        html += '<td style="text-align:right;">' + this.formatVND(grandAmount) + '</td>';
        html += '<td style="text-align:right;">' + this.formatVND(grandAvgReceiving) + '</td>';
        html += '<td style="text-align:right;">' + this.formatVND(grandAvgAll) + '</td>';
        html += '</tr>';

        html += '</tbody></table></div>';
        container.innerHTML = html;

        console.log('[DashboardCharts] Type table rendered:',
            'TYPE-1=' + types['TYPE-1'].length,
            'TYPE-2=' + types['TYPE-2'].length,
            'TYPE-3=' + types['TYPE-3'].length);
    },

    // ------------------------------------------------------------------
    // Summary Tab: Condition Charts
    // ------------------------------------------------------------------

    /**
     * Render a horizontal bar chart showing pass rate for each of the 10 conditions.
     * Green for YES, red for NO, gray for N/A.
     *
     * @param {Object} data - { employees, summary, thresholds }
     */
    renderConditionCharts: function (data) {
        var container = document.getElementById('conditionChartsContainer');
        if (!container) return;

        var employees = data.employees || [];

        if (employees.length === 0) {
            container.innerHTML = '<p style="color: #757575; text-align: center; padding: 20px;">No data available</p>';
            return;
        }

        // Condition labels
        var conditionLabels = [
            'C1: Attendance Rate',
            'C2: Unapproved Absence',
            'C3: Actual Working Days',
            'C4: Minimum Working Days',
            'C5: AQL Failure (Monthly)',
            'C6: AQL 3-Month Consecutive',
            'C7: Team AQL Consecutive',
            'C8: Area Reject Rate',
            'C9: 5PRS Pass Rate',
            'C10: 5PRS Inspection Qty'
        ];

        // Count YES / NO / N/A for each condition
        var yesCount = [];
        var noCount = [];
        var naCount = [];

        for (var c = 1; c <= 10; c++) {
            var yes = 0;
            var no = 0;
            var na = 0;

            employees.forEach(function (emp) {
                var result = window.employeeHelpers
                    ? window.employeeHelpers.getCondition(emp, c)
                    : 'N/A';
                var upper = String(result).toUpperCase().trim();

                if (upper === 'YES' || upper === 'PASS' || upper === 'TRUE' || upper === '1') {
                    yes++;
                } else if (upper === 'NO' || upper === 'FAIL' || upper === 'FALSE' || upper === '0') {
                    no++;
                } else {
                    na++;
                }
            });

            yesCount.push(yes);
            noCount.push(no);
            naCount.push(na);
        }

        // Ensure canvas element exists
        container.innerHTML = '<canvas id="conditionChart" style="max-height: 420px;"></canvas>';
        var canvas = document.getElementById('conditionChart');
        if (!canvas) return;

        // Destroy existing chart
        this.destroyChart('conditionChart');

        var ctx = canvas.getContext('2d');
        var self = this;

        this.charts['conditionChart'] = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: conditionLabels,
                datasets: [
                    {
                        label: 'PASS',
                        data: yesCount,
                        backgroundColor: self.colors.green,
                        borderColor: self.colors.green,
                        borderWidth: 1
                    },
                    {
                        label: 'FAIL',
                        data: noCount,
                        backgroundColor: self.colors.red,
                        borderColor: self.colors.red,
                        borderWidth: 1
                    },
                    {
                        label: 'N/A',
                        data: naCount,
                        backgroundColor: self.colors.gray,
                        borderColor: self.colors.gray,
                        borderWidth: 1
                    }
                ]
            },
            options: {
                indexAxis: 'y',
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'top',
                        labels: {
                            usePointStyle: true,
                            padding: 16,
                            font: { size: 12 }
                        }
                    },
                    tooltip: {
                        callbacks: {
                            label: function (context) {
                                var total = employees.length;
                                var val = context.parsed.x || 0;
                                var pct = total > 0 ? ((val / total) * 100).toFixed(1) : '0.0';
                                return context.dataset.label + ': ' + val + ' (' + pct + '%)';
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        stacked: true,
                        title: {
                            display: true,
                            text: 'Employee Count',
                            font: { size: 12 }
                        },
                        ticks: {
                            stepSize: 50,
                            font: { size: 11 }
                        },
                        grid: { color: 'rgba(0,0,0,0.06)' }
                    },
                    y: {
                        stacked: true,
                        ticks: {
                            font: { size: 11 }
                        },
                        grid: { display: false }
                    }
                }
            }
        });

        console.log('[DashboardCharts] Condition chart rendered (10 conditions)');
    },

    // ------------------------------------------------------------------
    // Validation Tab: 12 KPI Cards
    // ------------------------------------------------------------------

    /**
     * Populate the 12 validation KPI cards with counts.
     * Each card uses a specific #kpi* element id.
     *
     * Uses window.thresholds for threshold values (loaded by dashboard-data.js).
     *
     * @param {Object} data - { employees, summary, thresholds }
     */
    renderValidationKPIs: function (data) {
        var employees = data.employees || [];
        var thresholds = data.thresholds || window.thresholds || {};
        var summary = data.summary || {};

        // Threshold values with defaults
        var thAttendanceRate = parseFloat(thresholds.attendance_rate) || 88;
        var thUnapprovedAbsence = parseFloat(thresholds.unapproved_absence) || 2;
        var thMinimumWorkingDays = parseFloat(thresholds.minimum_working_days) || 12;
        var thAreaRejectRate = parseFloat(thresholds.area_reject_rate) || 3.0;
        var th5prsPassRate = parseFloat(thresholds['5prs_pass_rate']) || 95;
        var th5prsMinQty = parseFloat(thresholds['5prs_min_qty']) || 100;

        // --- KPI 1: Total Working Days ---
        var workingDays = summary.working_days || thresholds.working_days || '--';
        this._setText('kpiTotalWorkingDays', String(workingDays));

        // --- KPI 2: Unapproved Absence (exceeds threshold) ---
        var absentCount = 0;
        employees.forEach(function (emp) {
            var unapproved = parseFloat(
                emp.unapproved_absence || emp['Unapproved Absences'] ||
                emp.unapproved_absences || 0
            ) || 0;
            if (unapproved > thUnapprovedAbsence) {
                absentCount++;
            }
        });
        this._setKpiCount('kpiAbsentWithoutInform', absentCount);

        // --- KPI 3: Zero Working Days ---
        var zeroWorkingDaysCount = 0;
        employees.forEach(function (emp) {
            var actualDays = parseFloat(
                emp.actual_working_days || emp['Actual Working Days'] ||
                emp.actual_days || 0
            ) || 0;
            if (actualDays === 0) {
                zeroWorkingDaysCount++;
            }
        });
        this._setKpiCount('kpiZeroWorkingDays', zeroWorkingDaysCount);

        // --- KPI 4: Minimum Working Days Not Met ---
        var minDaysNotMetCount = 0;
        employees.forEach(function (emp) {
            var actualDays = parseFloat(
                emp.actual_working_days || emp['Actual Working Days'] ||
                emp.actual_days || 0
            ) || 0;
            if (actualDays > 0 && actualDays < thMinimumWorkingDays) {
                minDaysNotMetCount++;
            }
        });
        this._setKpiCount('kpiMinimumDaysNotMet', minDaysNotMetCount);

        // --- KPI 5: Attendance Rate Below Threshold ---
        var lowAttendanceCount = 0;
        employees.forEach(function (emp) {
            var rate = parseFloat(
                emp.attendance_rate || emp['Attendance Rate'] ||
                emp['Attendance Rate (%)'] || 0
            ) || 0;
            // Only count employees who actually worked (not zero days)
            var actualDays = parseFloat(
                emp.actual_working_days || emp['Actual Working Days'] ||
                emp.actual_days || 0
            ) || 0;
            if (actualDays > 0 && rate > 0 && rate < thAttendanceRate) {
                lowAttendanceCount++;
            }
        });
        this._setKpiCount('kpiAttendanceBelow88', lowAttendanceCount);

        // --- KPI 6: AQL Failure (current month personal failures > 0) ---
        var aqlFailCount = 0;
        employees.forEach(function (emp) {
            var failures = parseFloat(
                emp.aql_failures || emp['AQL_Fail_Count'] ||
                emp.aql_fail_count || 0
            ) || 0;
            // Also check nested conditions
            if (emp.conditions) {
                var c5 = String(emp.conditions.c5 || '').toUpperCase();
                if (c5 === 'NO' || c5 === 'FAIL') {
                    aqlFailCount++;
                    return; // skip further checks
                }
            }
            if (failures > 0) {
                aqlFailCount++;
            }
        });
        this._setKpiCount('kpiAqlFail', aqlFailCount);

        // --- KPI 7: Consecutive AQL Failure (includes 'YES' - Issue #48 data contract) ---
        var consecutiveAqlCount = 0;
        employees.forEach(function (emp) {
            var continuousFail = String(
                emp.continuous_fail || emp['Continuous_FAIL'] ||
                emp.Continuous_FAIL || ''
            );
            // Issue #48: Use includes('YES'), never === 'YES'
            if (continuousFail.indexOf('YES') !== -1) {
                consecutiveAqlCount++;
            }
        });
        this._setKpiCount('kpiConsecutiveAqlFail', consecutiveAqlCount);

        // --- KPI 8: Area Reject Rate exceeds threshold ---
        var areaRejectCount = 0;
        employees.forEach(function (emp) {
            var rejectRate = parseFloat(
                emp.area_reject_rate || emp['Area_Reject_Rate'] ||
                emp['AQL_Area_Reject_Rate'] || 0
            ) || 0;
            if (rejectRate > thAreaRejectRate) {
                areaRejectCount++;
            }
        });
        this._setKpiCount('kpiAreaRejectRate', areaRejectCount);

        // --- KPI 9: 5PRS Pass Rate below threshold ---
        var lowPassRateCount = 0;
        employees.forEach(function (emp) {
            var passRate = parseFloat(
                emp.prs_pass_rate || emp['5PRS_Pass_Rate'] ||
                emp['5PRS Pass Rate (%)'] || 0
            ) || 0;
            // Only count TYPE-1 employees who have 5PRS data
            var empType = String(emp.type || emp.TYPE || emp['ROLE TYPE STD'] || '').toUpperCase();
            if (empType.indexOf('TYPE-1') !== -1 || empType === '1') {
                if (passRate > 0 && passRate < th5prsPassRate) {
                    lowPassRateCount++;
                }
            }
        });
        this._setKpiCount('kpiLowPassRate', lowPassRateCount);

        // --- KPI 10: 5PRS Inspection Qty below threshold ---
        var lowInspectionQtyCount = 0;
        employees.forEach(function (emp) {
            var qty = parseFloat(
                emp.prs_inspection_qty || emp['5PRS_Inspection_Qty'] ||
                emp['5PRS Inspection Qty'] || 0
            ) || 0;
            var empType = String(emp.type || emp.TYPE || emp['ROLE TYPE STD'] || '').toUpperCase();
            if (empType.indexOf('TYPE-1') !== -1 || empType === '1') {
                if (qty > 0 && qty < th5prsMinQty) {
                    lowInspectionQtyCount++;
                }
            }
        });
        this._setKpiCount('kpiLowInspectionQty', lowInspectionQtyCount);

        // --- KPI 11: Cross-Building Review ---
        // Use summary data if available, otherwise placeholder
        var crossBuildingCount = summary.cross_building_count || '--';
        this._setText('kpiBuildingReviewTotal', String(crossBuildingCount));

        // --- KPI 12: LINE LEADER Not Assigned (no subordinates) ---
        var lineLeaderNotAssignedCount = 0;
        var lineLeaders = employees.filter(function (emp) {
            var pos = String(emp.position || emp.POSITION || '').toUpperCase();
            return pos.indexOf('LINE LEADER') !== -1;
        });
        lineLeaders.forEach(function (leader) {
            var leaderId = String(leader['Employee No'] || leader.emp_no || '');
            if (!leaderId) {
                lineLeaderNotAssignedCount++;
                return;
            }
            // Count subordinates (employees whose boss_id matches this leader)
            var subordinateCount = 0;
            employees.forEach(function (emp) {
                var bossId = String(emp.boss_id || emp['Boss ID'] || '');
                if (bossId === leaderId) {
                    subordinateCount++;
                }
            });
            if (subordinateCount === 0) {
                lineLeaderNotAssignedCount++;
            }
        });
        this._setKpiCount('kpiLineLeaderNotAssigned', lineLeaderNotAssignedCount);

        console.log('[DashboardCharts] Validation KPIs rendered:',
            'absent=' + absentCount,
            'zeroDay=' + zeroWorkingDaysCount,
            'lowAttendance=' + lowAttendanceCount,
            'aqlFail=' + aqlFailCount,
            'consecutiveAql=' + consecutiveAqlCount,
            'lineLeaderNA=' + lineLeaderNotAssignedCount);
    },

    // ------------------------------------------------------------------
    // Formatting Utilities
    // ------------------------------------------------------------------

    /**
     * Format a number as Vietnamese Dong (VND) with comma separators.
     * Always rounds to integer.
     *
     * @param {number|string} amount
     * @returns {string} Formatted number (e.g., "1,250,000")
     */
    formatVND: function (amount) {
        var num = parseFloat(amount);
        if (!num || isNaN(num)) return '0';
        return new Intl.NumberFormat('vi-VN').format(Math.round(num));
    },

    /**
     * Format a value as a percentage with one decimal place.
     *
     * @param {number|string} value
     * @returns {string} Formatted percentage (e.g., "85.3")
     */
    formatPercent: function (value) {
        var num = parseFloat(value);
        if (isNaN(num)) return '0.0';
        return num.toFixed(1);
    },

    // ------------------------------------------------------------------
    // Private Helper Methods
    // ------------------------------------------------------------------

    /**
     * Set textContent on an element by id. No-op if element not found.
     *
     * @param {string} id - DOM element id
     * @param {string} text - Text to set
     * @private
     */
    _setText: function (id, text) {
        var el = document.getElementById(id);
        if (el) el.textContent = text;
    },

    /**
     * Set a KPI count value with color coding.
     * 0 = green (good), >0 = red/warning.
     *
     * @param {string} id - DOM element id
     * @param {number} count - Count value
     * @private
     */
    _setKpiCount: function (id, count) {
        var el = document.getElementById(id);
        if (!el) return;

        el.textContent = String(count);

        // Color coding: 0 is good (green), >0 is warning/bad (red)
        if (count === 0) {
            el.style.color = this.colors.green;
        } else {
            el.style.color = this.colors.red;
        }
    },

    /**
     * Format a number with comma separators (no decimals).
     *
     * @param {number} num
     * @returns {string}
     * @private
     */
    _formatNumber: function (num) {
        if (num === null || num === undefined || isNaN(num)) return '0';
        return new Intl.NumberFormat('vi-VN').format(Math.round(num));
    },

    /**
     * Render a trend indicator (up/down arrow with value).
     *
     * @param {string} elementId - DOM element id for the trend span
     * @param {number|Object|null} trendData - Numeric change or { value, direction }
     * @private
     */
    _renderTrend: function (elementId, trendData) {
        var el = document.getElementById(elementId);
        if (!el) return;

        if (!trendData) {
            el.textContent = '';
            el.className = 'kpi-trend';
            return;
        }

        var value, direction;

        if (typeof trendData === 'object') {
            value = trendData.value;
            direction = trendData.direction;
        } else {
            value = parseFloat(trendData);
            direction = value >= 0 ? 'up' : 'down';
        }

        if (value === undefined || value === null || isNaN(parseFloat(value))) {
            el.textContent = '';
            el.className = 'kpi-trend';
            return;
        }

        var numVal = parseFloat(value);
        var arrow = direction === 'up' ? '\u25B2' : '\u25BC'; // ▲ or ▼
        var sign = numVal >= 0 ? '+' : '';
        var displayVal = typeof numVal === 'number' ? sign + numVal.toFixed(1) : String(value);

        el.textContent = arrow + ' ' + displayVal + ' vs prev';
        el.className = 'kpi-trend ' + direction;
    }
};

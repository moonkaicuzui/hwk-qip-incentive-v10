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
        this.renderPositionTables(data);
        this.renderCriteriaTab(data);
        this.renderTeamTab(data);
        this.renderOrgChart(data);
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
    // Position Tab: Position-grouped summary tables
    // ------------------------------------------------------------------

    /**
     * Populate #positionTables with position-grouped employee summary.
     * Groups employees by position, shows count/receiving/amount per position.
     * Each row is clickable to open the position detail modal.
     *
     * @param {Object} data - { employees, summary, thresholds }
     */
    renderPositionTables: function (data) {
        var container = document.getElementById('positionTables');
        if (!container) return;

        var employees = data.employees || [];
        if (employees.length === 0) {
            container.innerHTML = '<p style="color: #757575; text-align: center; padding: 40px;">No data available</p>';
            return;
        }

        // Group employees by position
        var positionMap = {};
        employees.forEach(function (emp) {
            var pos = String(emp.position || emp.Position || emp['Position Name'] || 'Unknown').trim();
            if (!positionMap[pos]) {
                positionMap[pos] = [];
            }
            positionMap[pos].push(emp);
        });

        // Sort positions by employee count (descending)
        var positions = Object.keys(positionMap).sort(function (a, b) {
            return positionMap[b].length - positionMap[a].length;
        });

        var self = this;
        var html = '<h4 style="margin-bottom: 16px; color: var(--header-dark);">Position Summary (' + positions.length + ' positions)</h4>';
        html += '<div class="table-container"><table>';
        html += '<thead><tr>';
        html += '<th>Position</th>';
        html += '<th style="text-align:center;">TYPE</th>';
        html += '<th style="text-align:right;">Total</th>';
        html += '<th style="text-align:right;">Receiving</th>';
        html += '<th style="text-align:right;">Rate (%)</th>';
        html += '<th style="text-align:right;">Total Amount (VND)</th>';
        html += '<th style="text-align:right;">Avg (Receiving)</th>';
        html += '</tr></thead><tbody>';

        var grandTotal = 0, grandReceiving = 0, grandAmount = 0;

        positions.forEach(function (pos) {
            var emps = positionMap[pos];
            var total = emps.length;
            var receiving = 0;
            var amount = 0;

            // Determine predominant TYPE
            var typeCounts = {};
            emps.forEach(function (emp) {
                var incentive = window.employeeHelpers
                    ? window.employeeHelpers.getIncentive(emp, 'current')
                    : (parseFloat(emp.currentIncentive || emp.current_incentive || 0) || 0);
                if (incentive > 0) {
                    receiving++;
                    amount += incentive;
                }
                var t = String(emp.type || emp.TYPE || emp['ROLE TYPE STD'] || '').toUpperCase();
                if (t.indexOf('TYPE-1') !== -1 || t === '1') t = 'TYPE-1';
                else if (t.indexOf('TYPE-2') !== -1 || t === '2') t = 'TYPE-2';
                else if (t.indexOf('TYPE-3') !== -1 || t === '3') t = 'TYPE-3';
                else t = 'N/A';
                typeCounts[t] = (typeCounts[t] || 0) + 1;
            });

            var mainType = 'N/A';
            var maxCount = 0;
            for (var t in typeCounts) {
                if (typeCounts[t] > maxCount) { maxCount = typeCounts[t]; mainType = t; }
            }

            var rate = total > 0 ? ((receiving / total) * 100) : 0;
            var avgReceiving = receiving > 0 ? (amount / receiving) : 0;
            var rateColor = rate >= 80 ? self.colors.green : (rate >= 50 ? self.colors.yellow : self.colors.red);

            var badgeClass = mainType === 'TYPE-1' ? 'badge-type1' : (mainType === 'TYPE-2' ? 'badge-type2' : 'badge-type3');

            html += '<tr style="cursor: pointer;" onclick="if(typeof DashboardModals!==\'undefined\' && DashboardModals.showPositionDetail) DashboardModals.showPositionDetail(\'' + self._escapeAttr(pos) + '\')">';
            html += '<td style="font-weight:600; color: var(--header-dark);">' + self._escapeHtml(pos) + ' <i class="fas fa-external-link-alt" style="font-size:0.7rem; opacity:0.5;"></i></td>';
            html += '<td style="text-align:center;"><span class="badge-type ' + badgeClass + '">' + mainType + '</span></td>';
            html += '<td style="text-align:right;">' + total + '</td>';
            html += '<td style="text-align:right;">' + receiving + '</td>';
            html += '<td style="text-align:right; color:' + rateColor + '; font-weight:600;">' + self.formatPercent(rate) + '%</td>';
            html += '<td style="text-align:right;">' + self.formatVND(amount) + '</td>';
            html += '<td style="text-align:right;">' + self.formatVND(avgReceiving) + '</td>';
            html += '</tr>';

            grandTotal += total;
            grandReceiving += receiving;
            grandAmount += amount;
        });

        // Grand total row
        var grandRate = grandTotal > 0 ? ((grandReceiving / grandTotal) * 100) : 0;
        var grandAvgReceiving = grandReceiving > 0 ? (grandAmount / grandReceiving) : 0;

        html += '<tr style="font-weight: 700; background: #f0f4ff;">';
        html += '<td>Total (' + positions.length + ' positions)</td>';
        html += '<td></td>';
        html += '<td style="text-align:right;">' + self._formatNumber(grandTotal) + '</td>';
        html += '<td style="text-align:right;">' + self._formatNumber(grandReceiving) + '</td>';
        html += '<td style="text-align:right;">' + self.formatPercent(grandRate) + '%</td>';
        html += '<td style="text-align:right;">' + self.formatVND(grandAmount) + '</td>';
        html += '<td style="text-align:right;">' + self.formatVND(grandAvgReceiving) + '</td>';
        html += '</tr>';

        html += '</tbody></table></div>';
        container.innerHTML = html;

        console.log('[DashboardCharts] Position tables rendered: ' + positions.length + ' positions');
    },

    // ------------------------------------------------------------------
    // Criteria Tab: 10 Conditions Overview + Thresholds
    // ------------------------------------------------------------------

    /**
     * Populate #conditionsOverview with the 10 conditions, thresholds, and descriptions.
     * Also renders the progressive incentive table and TYPE-2 calculation methods.
     *
     * @param {Object} data - { employees, summary, thresholds }
     */
    renderCriteriaTab: function (data) {
        var container = document.getElementById('conditionsOverview');
        if (!container) return;

        // Cache data for language-switch re-render
        this._criteriaData = data;

        var thresholds = data.thresholds || window.thresholds || {};
        var employees = data.employees || [];

        var thAttendanceRate = parseFloat(thresholds.attendance_rate) || 88;
        var thUnapprovedAbsence = parseFloat(thresholds.unapproved_absence) || 2;
        var thMinimumWorkingDays = parseFloat(thresholds.minimum_working_days) || 12;
        var thAreaRejectRate = parseFloat(thresholds.area_reject_rate) || 3.0;
        var th5prsPassRate = parseFloat(thresholds['5prs_pass_rate']) || 95;
        var th5prsMinQty = parseFloat(thresholds['5prs_min_qty']) || 100;
        var thConsecutiveAql = parseFloat(thresholds.consecutive_aql_months) || 3;

        var conditions = [
            { num: 1, category: 'Attendance', name: 'Attendance Rate', threshold: '>= ' + thAttendanceRate + '%', desc: 'Monthly attendance rate must meet minimum' },
            { num: 2, category: 'Attendance', name: 'Unapproved Absence', threshold: '<= ' + thUnapprovedAbsence + ' days', desc: 'Maximum unexcused absences allowed' },
            { num: 3, category: 'Attendance', name: 'Actual Working Days', threshold: '> 0', desc: 'Employee must have worked at least 1 day' },
            { num: 4, category: 'Attendance', name: 'Minimum Working Days', threshold: '>= ' + thMinimumWorkingDays + ' days', desc: 'Minimum working days required for eligibility' },
            { num: 5, category: 'AQL', name: 'AQL Failure (Monthly)', threshold: '= 0', desc: 'No personal AQL failures this month' },
            { num: 6, category: 'AQL', name: 'AQL Consecutive Failure', threshold: 'No ' + thConsecutiveAql + '-month streak', desc: 'No consecutive month AQL failures' },
            { num: 7, category: 'AQL', name: 'Team AQL Consecutive', threshold: 'No ' + thConsecutiveAql + '-month streak', desc: 'Team/area has no consecutive failures' },
            { num: 8, category: 'AQL', name: 'Area Reject Rate', threshold: '< ' + thAreaRejectRate + '%', desc: 'Building area reject rate below threshold' },
            { num: 9, category: '5PRS', name: '5PRS Pass Rate', threshold: '>= ' + th5prsPassRate + '%', desc: 'Inspection pass rate meets minimum' },
            { num: 10, category: '5PRS', name: '5PRS Inspection Qty', threshold: '>= ' + th5prsMinQty + ' pairs', desc: 'Minimum inspection quantity required' }
        ];

        var self = this;
        var html = '';

        // --- Section 1: Conditions Table ---
        html += '<div class="table-container"><table>';
        html += '<thead><tr style="background: #1a237e; color: #fff;">';
        html += '<th style="width:40px;">#</th>';
        html += '<th style="width:90px;">Category</th>';
        html += '<th>Condition</th>';
        html += '<th style="width:180px;">Threshold</th>';
        html += '<th>Description</th>';
        html += '<th style="width:70px; text-align:center;">Pass</th>';
        html += '<th style="width:70px; text-align:center;">Fail</th>';
        html += '</tr></thead><tbody>';

        conditions.forEach(function (c) {
            var yes = 0, no = 0;
            employees.forEach(function (emp) {
                var result = window.employeeHelpers
                    ? window.employeeHelpers.getCondition(emp, c.num)
                    : 'N/A';
                var upper = String(result).toUpperCase().trim();
                if (upper === 'YES' || upper === 'PASS' || upper === 'TRUE' || upper === '1') yes++;
                else if (upper === 'NO' || upper === 'FAIL' || upper === 'FALSE' || upper === '0') no++;
            });

            var catColor = c.category === 'Attendance' ? '#1976d2' : (c.category === 'AQL' ? '#e65100' : '#2e7d32');
            html += '<tr>';
            html += '<td style="font-weight:700; color: ' + catColor + ';">C' + c.num + '</td>';
            html += '<td><span style="display:inline-block; padding:2px 8px; border-radius:4px; font-size:0.75rem; font-weight:600; color:#fff; background:' + catColor + ';">' + c.category + '</span></td>';
            html += '<td style="font-weight:600;">' + c.name + '</td>';
            html += '<td><code style="background:#f0f4ff; padding:2px 6px; border-radius:3px;">' + c.threshold + '</code></td>';
            html += '<td style="color: #757575; font-size: 0.85rem;">' + c.desc + '</td>';
            html += '<td style="text-align:center; color:' + self.colors.green + '; font-weight:600;">' + yes + '</td>';
            html += '<td style="text-align:center; color:' + self.colors.red + '; font-weight:600;">' + no + '</td>';
            html += '</tr>';
        });

        html += '</tbody></table></div>';

        // --- Section 2: Progressive Incentive Table ---
        html += '<div class="section-card" style="margin-top: 24px;">';
        html += '<h4 style="color: var(--header-dark); margin-bottom: 12px;">TYPE-1 Progressive Incentive Table (VND)</h4>';
        html += '<div class="table-container"><table>';
        html += '<thead><tr style="background: #283593; color: #fff;">';
        var months = [1,2,3,4,5,6,7,8,9,10,11,12,13,14,15];
        months.forEach(function (m) {
            html += '<th style="text-align:center; padding:6px;">' + m + '</th>';
        });
        html += '</tr></thead><tbody><tr>';
        var amounts = [150,200,250,300,350,400,450,500,550,600,650,700,800,900,1000];
        amounts.forEach(function (a) {
            html += '<td style="text-align:center; padding:6px; font-weight:600;">' + self._formatNumber(a * 1000) + '</td>';
        });
        html += '</tr></tbody></table></div>';
        html += '<p style="color: #757575; font-size: 0.82rem; margin-top: 8px;">* Months = consecutive months of 100% condition fulfillment. Resets to 0 on any failure.</p>';
        html += '</div>';

        // --- Section 3: TYPE Application Matrix ---
        html += '<div class="section-card" style="margin-top: 24px;">';
        html += '<h4 style="color: var(--header-dark); margin-bottom: 12px;">TYPE-based Condition Application</h4>';
        html += '<div class="table-container"><table>';
        html += '<thead><tr>';
        html += '<th>TYPE</th><th>Applied Conditions</th><th>Incentive Method</th>';
        html += '</tr></thead><tbody>';
        html += '<tr><td><span class="badge-type badge-type1">TYPE-1</span></td>';
        html += '<td>C1~C10 (All 10 conditions)</td>';
        html += '<td>Progressive table (1~15 months)</td></tr>';
        html += '<tr><td><span class="badge-type badge-type2">TYPE-2</span></td>';
        html += '<td>C1~C4 (Attendance only)</td>';
        html += '<td>Based on TYPE-1 position average</td></tr>';
        html += '<tr><td><span class="badge-type badge-type3">TYPE-3</span></td>';
        html += '<td>None (Policy excluded)</td>';
        html += '<td>0 VND (Not eligible)</td></tr>';
        html += '</tbody></table></div>';
        html += '</div>';

        container.innerHTML = html;
        console.log('[DashboardCharts] Criteria tab rendered with ' + conditions.length + ' conditions');

        // --- TYPE-2 Calculation Methods (#typeCalculationMethods) ---
        this._renderTypeCalculationMethods(data);

        // --- FAQ Section (#faqSection) ---
        this._renderFAQSection();
    },

    // ------------------------------------------------------------------
    // Criteria Tab: TYPE-2 Calculation Methods
    // ------------------------------------------------------------------

    /**
     * Render TYPE-2 calculation method table with dynamic averages
     * computed from actual employee data.
     * @param {Object} data - { employees, summary, thresholds }
     * @private
     */
    _renderTypeCalculationMethods: function (data) {
        var container = document.getElementById('typeCalculationMethods');
        if (!container) return;

        var employees = data.employees || [];
        var self = this;
        var t = function (key) { return typeof DashboardI18n !== 'undefined' ? DashboardI18n.t(key) : key; };

        // --- Compute TYPE-1 receiving averages from employee data ---
        var type1Averages = {};
        var posGroups = {};

        employees.forEach(function (emp) {
            var empType = String(emp.type || emp.TYPE || emp['ROLE TYPE STD'] || '').toUpperCase();
            if (empType.indexOf('TYPE-1') === -1 && empType !== '1') return;

            var position = String(emp.position || emp.POSITION || emp['Position'] || '').toUpperCase().trim();
            var incentive = 0;
            if (window.employeeHelpers) {
                incentive = window.employeeHelpers.getIncentive(emp, 'current');
            } else {
                incentive = parseFloat(emp.currentIncentive || emp.current_incentive || 0) || 0;
            }

            if (!posGroups[position]) posGroups[position] = [];
            if (incentive > 0) posGroups[position].push(incentive);
        });

        // Compute receiving averages
        Object.keys(posGroups).forEach(function (pos) {
            var values = posGroups[pos];
            if (values.length > 0) {
                var sum = 0;
                values.forEach(function (v) { sum += v; });
                type1Averages[pos] = Math.round(sum / values.length);
            } else {
                type1Averages[pos] = 0;
            }
        });

        // Helper to find average by position pattern
        function getAvg(patterns) {
            for (var i = 0; i < patterns.length; i++) {
                var keys = Object.keys(type1Averages);
                for (var j = 0; j < keys.length; j++) {
                    if (keys[j].indexOf(patterns[i]) !== -1) return type1Averages[keys[j]];
                }
            }
            return 0;
        }

        var llAvg = getAvg(['LINE LEADER']);
        var aiAvg = getAvg(['ASSEMBLY INSPECTOR']);
        var vsAvg = getAvg(['(V) SUPERVISOR', 'V) SUPERVISOR', 'SUPERVISOR']);
        var amAvg = getAvg(['A.MANAGER']);
        var glAvg = getAvg(['GROUP LEADER']);

        // TYPE-2 position definitions with reference and method
        var type2Positions = [
            { pos: '(V) SUPERVISOR', ref: 'TYPE-1 (V) SUPERVISOR', method: '(V) SUPERVISOR ' + t('criteria.receivingAvg'), avg: vsAvg, bg: '' },
            { pos: 'A.MANAGER', ref: 'TYPE-1 A.MANAGER', method: 'A.MANAGER ' + t('criteria.receivingAvg'), avg: amAvg, bg: '' },
            { pos: 'GROUP LEADER', ref: 'TYPE-1 LINE LEADER', method: 'TYPE-1 LINE LEADER ' + t('criteria.receivingAvg') + ' × 2', avg: llAvg * 2, bg: '#fff9e6' },
            { pos: 'LINE LEADER', ref: 'TYPE-1 LINE LEADER', method: 'TYPE-1 LINE LEADER ' + t('criteria.receivingAvg'), avg: llAvg, bg: '#e8f5ff' },
            { pos: 'AQL INSPECTOR', ref: 'TYPE-1 ASSEMBLY INSPECTOR', method: 'ASSEMBLY INSPECTOR ' + t('criteria.receivingAvg'), avg: aiAvg, bg: '' },
            { pos: 'ASSEMBLY INSPECTOR', ref: 'TYPE-1 ASSEMBLY INSPECTOR', method: 'ASSEMBLY INSPECTOR ' + t('criteria.receivingAvg'), avg: aiAvg, bg: '' },
            { pos: 'STITCHING INSPECTOR', ref: 'TYPE-1 ASSEMBLY INSPECTOR', method: 'ASSEMBLY INSPECTOR ' + t('criteria.receivingAvg'), avg: aiAvg, bg: '' },
            { pos: 'BOTTOM INSPECTOR', ref: 'TYPE-1 ASSEMBLY INSPECTOR', method: 'ASSEMBLY INSPECTOR ' + t('criteria.receivingAvg'), avg: aiAvg, bg: '' },
            { pos: 'CUTTING INSPECTOR', ref: 'TYPE-1 ASSEMBLY INSPECTOR', method: 'ASSEMBLY INSPECTOR ' + t('criteria.receivingAvg'), avg: aiAvg, bg: '' },
            { pos: 'MTL INSPECTOR', ref: 'TYPE-1 ASSEMBLY INSPECTOR', method: 'ASSEMBLY INSPECTOR ' + t('criteria.receivingAvg'), avg: aiAvg, bg: '' },
            { pos: 'OCPT STAFF', ref: 'TYPE-1 ASSEMBLY INSPECTOR', method: 'ASSEMBLY INSPECTOR ' + t('criteria.receivingAvg'), avg: aiAvg, bg: '' },
            { pos: 'OSC INSPECTOR', ref: 'TYPE-1 ASSEMBLY INSPECTOR', method: 'ASSEMBLY INSPECTOR ' + t('criteria.receivingAvg'), avg: aiAvg, bg: '' },
            { pos: 'QA TEAM (QA3B)', ref: 'TYPE-1 ASSEMBLY INSPECTOR', method: 'ASSEMBLY INSPECTOR ' + t('criteria.receivingAvg'), avg: aiAvg, bg: '#fff3cd' },
            { pos: 'QA TEAM (QA3A)', ref: 'TYPE-1 GROUP LEADER', method: 'GROUP LEADER ' + t('criteria.receivingAvg'), avg: glAvg > 0 ? glAvg : llAvg * 2, bg: '#d4edda' },
            { pos: 'RQC', ref: 'TYPE-1 ASSEMBLY INSPECTOR', method: 'ASSEMBLY INSPECTOR ' + t('criteria.receivingAvg'), avg: aiAvg, bg: '' }
        ];

        var html = '';

        // Principle alert boxes
        html += '<div style="background:#f0f4ff; border-left:4px solid #ef4444; padding:12px 16px; border-radius:4px; margin-bottom:12px;">';
        html += '<strong style="color:#ef4444;">📊 TYPE-2 ' + t('criteria.type2Principle').substring(0, 6) + ':</strong> ';
        html += t('criteria.type2Principle');
        html += '</div>';

        html += '<div style="background:#e8f5e9; border-left:4px solid #4caf50; padding:12px 16px; border-radius:4px; margin-bottom:12px;">';
        html += '<strong style="color:#1b5e20;">✅ ' + t('criteria.type2AvgBasis').substring(0, 8) + ':</strong> ';
        html += t('criteria.type2AvgBasis');
        html += '<br><small style="color:#555;">' + t('criteria.type2AvgExample') + '</small>';
        html += '</div>';

        // Table
        html += '<div class="table-container"><table>';
        html += '<thead><tr style="background:#c62828; color:#fff;">';
        html += '<th style="width:40px;">#</th>';
        html += '<th>' + t('criteria.type2ColPosition') + '</th>';
        html += '<th>' + t('criteria.type2ColReference') + '</th>';
        html += '<th>' + t('criteria.type2ColMethod') + '</th>';
        html += '<th style="text-align:right;">' + t('criteria.type2ColAverage') + '</th>';
        html += '</tr></thead><tbody>';

        type2Positions.forEach(function (row, idx) {
            var bgStyle = row.bg ? ' style="background:' + row.bg + ';"' : '';
            html += '<tr' + bgStyle + '>';
            html += '<td>' + (idx + 1) + '</td>';
            html += '<td style="font-weight:600;">' + row.pos + '</td>';
            html += '<td>' + row.ref + '</td>';
            html += '<td><span style="color:#d32f2f; font-weight:600;">' + row.method + '</span></td>';
            html += '<td style="text-align:right; font-weight:700; color:#1565c0;">' + self._formatNumber(row.avg) + ' VND</td>';
            html += '</tr>';
        });

        html += '</tbody></table></div>';

        // Special rule boxes
        html += '<div style="background:#fff3cd; border-left:4px solid #ffc107; padding:12px 16px; border-radius:4px; margin-top:16px;">';
        html += '<strong>⚠️ GROUP LEADER:</strong> ' + t('criteria.type2GroupLeaderRule');
        html += '</div>';

        html += '<div style="background:#d1ecf1; border-left:4px solid #17a2b8; padding:12px 16px; border-radius:4px; margin-top:8px;">';
        html += '<strong>📋 QA TEAM:</strong> ' + t('criteria.type2QaTeamRule');
        html += '</div>';

        html += '<div style="background:#e8f5e9; border-left:4px solid #4caf50; padding:12px 16px; border-radius:4px; margin-top:8px;">';
        html += '<strong>✅</strong> ' + t('criteria.type2Conditions');
        html += '</div>';

        container.innerHTML = html;
        console.log('[DashboardCharts] TYPE-2 calculation methods rendered (' + type2Positions.length + ' positions)');
    },

    // ------------------------------------------------------------------
    // Criteria Tab: FAQ Section
    // ------------------------------------------------------------------

    /**
     * Render FAQ accordion with 11 questions and answers.
     * Uses DashboardI18n.tWithThresholds() for threshold placeholder replacement.
     * @private
     */
    _renderFAQSection: function () {
        var container = document.getElementById('faqSection');
        if (!container) return;

        var tw = function (key) {
            return typeof DashboardI18n !== 'undefined' ? DashboardI18n.tWithThresholds(key) : key;
        };

        var faqs = [];
        for (var i = 1; i <= 11; i++) {
            faqs.push({ q: tw('faq.q' + i), a: tw('faq.a' + i) });
        }

        var html = '';
        html += '<style>';
        html += '.faq-item { border: 1px solid #e0e0e0; border-radius: 8px; margin-bottom: 8px; overflow: hidden; }';
        html += '.faq-question { padding: 14px 18px; cursor: pointer; font-weight: 600; color: #1a237e; background: #f8f9ff; display: flex; justify-content: space-between; align-items: center; transition: background 0.2s; }';
        html += '.faq-question:hover { background: #e8eaf6; }';
        html += '.faq-question .faq-arrow { transition: transform 0.3s; font-size: 0.8rem; color: #757575; }';
        html += '.faq-question.active .faq-arrow { transform: rotate(180deg); }';
        html += '.faq-answer { max-height: 0; overflow: hidden; transition: max-height 0.3s ease, padding 0.3s ease; padding: 0 18px; background: #fff; }';
        html += '.faq-answer.show { max-height: 600px; padding: 14px 18px; }';
        html += '.faq-answer p { margin: 0; color: #424242; line-height: 1.7; white-space: pre-line; }';
        html += '</style>';

        faqs.forEach(function (faq, idx) {
            html += '<div class="faq-item">';
            html += '<div class="faq-question" onclick="DashboardCharts._toggleFAQ(this)">';
            html += '<span>Q' + (idx + 1) + '. ' + faq.q + '</span>';
            html += '<span class="faq-arrow">▼</span>';
            html += '</div>';
            html += '<div class="faq-answer"><p>' + faq.a + '</p></div>';
            html += '</div>';
        });

        container.innerHTML = html;
        console.log('[DashboardCharts] FAQ section rendered with ' + faqs.length + ' items');
    },

    /**
     * Toggle FAQ accordion item (called from onclick).
     * Closes other open items and toggles the clicked one.
     * @param {HTMLElement} element - The clicked .faq-question element
     */
    _toggleFAQ: function (element) {
        var answer = element.nextElementSibling;
        var allAnswers = document.querySelectorAll('.faq-answer');
        var allQuestions = document.querySelectorAll('.faq-question');
        // Close all other answers
        allAnswers.forEach(function (a) { if (a !== answer) a.classList.remove('show'); });
        allQuestions.forEach(function (q) { if (q !== element) q.classList.remove('active'); });
        // Toggle current
        answer.classList.toggle('show');
        element.classList.toggle('active');
    },

    // ------------------------------------------------------------------
    // Team Tab: Building/Team summary
    // ------------------------------------------------------------------

    /**
     * Populate #teamSummaryCards and #teamTableContainer with team/building data.
     * Groups employees by building, shows summary cards and detailed table.
     *
     * @param {Object} data - { employees, summary, thresholds }
     */
    renderTeamTab: function (data) {
        var cardsContainer = document.getElementById('teamSummaryCards');
        var tableContainer = document.getElementById('teamTableContainer');
        if (!cardsContainer && !tableContainer) return;

        var employees = data.employees || [];
        if (employees.length === 0) {
            if (tableContainer) tableContainer.innerHTML = '<p style="color: #757575; text-align: center; padding: 40px;">No data available</p>';
            return;
        }

        var self = this;

        // Group by building
        var buildingMap = {};
        employees.forEach(function (emp) {
            var bld = String(emp.building || emp.BUILDING || emp.Building || 'Unknown').trim();
            if (!bld || bld === 'nan' || bld === 'NaN' || bld === 'null' || bld === 'undefined') bld = 'Unknown';
            if (!buildingMap[bld]) buildingMap[bld] = [];
            buildingMap[bld].push(emp);
        });

        var buildings = Object.keys(buildingMap).sort();

        // Building color palette
        var buildingColors = {
            'A': '#e53935', 'B': '#1e88e5', 'B3': '#7b1fa2', 'C': '#43a047',
            'D': '#ff8f00', 'Unknown': '#9e9e9e'
        };
        function getBldColor(bld) {
            for (var key in buildingColors) {
                if (bld.toUpperCase().indexOf(key) === 0) return buildingColors[key];
            }
            return '#607d8b';
        }

        // --- Summary Cards ---
        if (cardsContainer) {
            var cardsHtml = '';
            buildings.forEach(function (bld) {
                var emps = buildingMap[bld];
                var receiving = 0;
                var amount = 0;
                emps.forEach(function (emp) {
                    var incentive = window.employeeHelpers
                        ? window.employeeHelpers.getIncentive(emp, 'current')
                        : (parseFloat(emp.currentIncentive || emp.current_incentive || 0) || 0);
                    if (incentive > 0) { receiving++; amount += incentive; }
                });
                var rate = emps.length > 0 ? ((receiving / emps.length) * 100) : 0;
                var color = getBldColor(bld);

                cardsHtml += '<div style="background:#fff; border-radius:10px; padding:16px; min-width:160px; flex:1; box-shadow:0 2px 8px rgba(0,0,0,0.08); border-top:4px solid ' + color + ';">';
                cardsHtml += '<div style="font-size:0.8rem; color:#757575; margin-bottom:4px;">Building</div>';
                cardsHtml += '<div style="font-size:1.3rem; font-weight:700; color:' + color + ';">' + self._escapeHtml(bld) + '</div>';
                cardsHtml += '<div style="margin-top:8px; font-size:0.82rem;">';
                cardsHtml += '<span style="color:#424242;">Total: <b>' + emps.length + '</b></span>';
                cardsHtml += ' | <span style="color:' + self.colors.green + ';">Receiving: <b>' + receiving + '</b></span>';
                cardsHtml += '</div>';
                cardsHtml += '<div style="font-size:0.82rem; margin-top:4px;">Rate: <b style="color:' + (rate >= 70 ? self.colors.green : self.colors.red) + ';">' + self.formatPercent(rate) + '%</b></div>';
                cardsHtml += '<div style="font-size:0.82rem; margin-top:2px;">Amount: <b>' + self.formatVND(amount) + '</b> VND</div>';
                cardsHtml += '</div>';
            });
            cardsContainer.innerHTML = cardsHtml;
        }

        // --- Detailed Table ---
        if (tableContainer) {
            var html = '<div class="table-container"><table>';
            html += '<thead><tr>';
            html += '<th>Building</th>';
            html += '<th style="text-align:right;">Total</th>';
            html += '<th style="text-align:right;">Receiving</th>';
            html += '<th style="text-align:right;">Rate (%)</th>';
            html += '<th style="text-align:right;">Total Amount (VND)</th>';
            html += '<th style="text-align:right;">TYPE-1</th>';
            html += '<th style="text-align:right;">TYPE-2</th>';
            html += '<th style="text-align:right;">TYPE-3</th>';
            html += '</tr></thead><tbody>';

            var gt = 0, gr = 0, ga = 0, gt1 = 0, gt2 = 0, gt3 = 0;

            buildings.forEach(function (bld) {
                var emps = buildingMap[bld];
                var receiving = 0;
                var amount = 0;
                var type1 = 0, type2 = 0, type3 = 0;

                emps.forEach(function (emp) {
                    var incentive = window.employeeHelpers
                        ? window.employeeHelpers.getIncentive(emp, 'current')
                        : (parseFloat(emp.currentIncentive || emp.current_incentive || 0) || 0);
                    if (incentive > 0) { receiving++; amount += incentive; }
                    var t = String(emp.type || emp.TYPE || emp['ROLE TYPE STD'] || '').toUpperCase();
                    if (t.indexOf('TYPE-1') !== -1 || t === '1') type1++;
                    else if (t.indexOf('TYPE-2') !== -1 || t === '2') type2++;
                    else type3++;
                });

                var rate = emps.length > 0 ? ((receiving / emps.length) * 100) : 0;
                var rateColor = rate >= 70 ? self.colors.green : (rate >= 40 ? self.colors.yellow : self.colors.red);
                var color = getBldColor(bld);

                html += '<tr>';
                html += '<td><span style="display:inline-block; width:12px; height:12px; border-radius:3px; background:' + color + '; margin-right:6px; vertical-align:middle;"></span><b>' + self._escapeHtml(bld) + '</b></td>';
                html += '<td style="text-align:right;">' + emps.length + '</td>';
                html += '<td style="text-align:right;">' + receiving + '</td>';
                html += '<td style="text-align:right; color:' + rateColor + '; font-weight:600;">' + self.formatPercent(rate) + '%</td>';
                html += '<td style="text-align:right;">' + self.formatVND(amount) + '</td>';
                html += '<td style="text-align:right;">' + type1 + '</td>';
                html += '<td style="text-align:right;">' + type2 + '</td>';
                html += '<td style="text-align:right;">' + type3 + '</td>';
                html += '</tr>';

                gt += emps.length; gr += receiving; ga += amount;
                gt1 += type1; gt2 += type2; gt3 += type3;
            });

            // Total row
            var grandRate = gt > 0 ? ((gr / gt) * 100) : 0;
            html += '<tr style="font-weight: 700; background: #f0f4ff;">';
            html += '<td>Total (' + buildings.length + ' buildings)</td>';
            html += '<td style="text-align:right;">' + self._formatNumber(gt) + '</td>';
            html += '<td style="text-align:right;">' + self._formatNumber(gr) + '</td>';
            html += '<td style="text-align:right;">' + self.formatPercent(grandRate) + '%</td>';
            html += '<td style="text-align:right;">' + self.formatVND(ga) + '</td>';
            html += '<td style="text-align:right;">' + gt1 + '</td>';
            html += '<td style="text-align:right;">' + gt2 + '</td>';
            html += '<td style="text-align:right;">' + gt3 + '</td>';
            html += '</tr>';

            html += '</tbody></table></div>';
            tableContainer.innerHTML = html;
        }

        console.log('[DashboardCharts] Team tab rendered: ' + buildings.length + ' buildings');
    },

    // ------------------------------------------------------------------
    // Org Chart Tab: Collapsible Tree with Building/Incentive Filters
    // ------------------------------------------------------------------

    /** Cached org data for filter re-renders */
    _orgData: null,

    /**
     * Initialize the org chart tab: populate building filter, render tree.
     * Replaces the former placeholder.
     *
     * @param {Object} data - { employees, summary, thresholds }
     */
    renderOrgChart: function (data) {
        this._orgData = data;
        var employees = data.employees || [];

        // 1. Populate building filter dropdown
        this._populateBuildingFilter(employees);

        // 2. Populate building summary cards
        this._renderBuildingSummaryCards(employees);

        // 3. Wire filter change events (only once)
        if (!this._orgFiltersWired) {
            this._wireOrgFilters();
            this._orgFiltersWired = true;
        }

        // 4. Draw the tree
        this._drawOrgTree();
    },

    /**
     * Populate the #orgBuildingFilter <select> with unique buildings.
     */
    _populateBuildingFilter: function (employees) {
        var sel = document.getElementById('orgBuildingFilter');
        if (!sel) return;

        var buildings = {};
        employees.forEach(function (emp) {
            var b = String(emp.building || emp.BUILDING || '').toUpperCase().trim();
            if (b && b !== 'NAN' && b !== '') buildings[b] = (buildings[b] || 0) + 1;
        });

        // Keep the first "all" option, remove dynamic ones
        while (sel.options.length > 1) sel.remove(1);

        Object.keys(buildings).sort().forEach(function (b) {
            var opt = document.createElement('option');
            opt.value = b;
            opt.textContent = 'Building ' + b + ' (' + buildings[b] + ')';
            sel.appendChild(opt);
        });
    },

    /**
     * Render building summary cards above the tree.
     */
    _renderBuildingSummaryCards: function (employees) {
        var container = document.getElementById('buildingSummaryCards');
        if (!container) return;

        var stats = { total: 0, managers: 0 };
        var bldg = {};
        employees.forEach(function (emp) {
            var b = String(emp.building || emp.BUILDING || '').toUpperCase().trim();
            var pos = String(emp.position || '').toUpperCase();
            var isManager = pos.indexOf('LINE LEADER') !== -1 || pos.indexOf('GROUP LEADER') !== -1 ||
                            pos.indexOf('SUPERVISOR') !== -1 || pos.indexOf('MANAGER') !== -1;
            if (isManager && emp.type === 'TYPE-1') {
                stats.managers++;
                if (b && b !== 'NAN') {
                    bldg[b] = (bldg[b] || 0) + 1;
                }
            }
        });

        var html = '<div class="org-building-card"><div class="bcard-label">Total Managers</div><div class="bcard-count">' + stats.managers + '</div></div>';
        Object.keys(bldg).sort().forEach(function (b) {
            html += '<div class="org-building-card"><div class="bcard-label">Bldg ' + b + '</div><div class="bcard-count">' + bldg[b] + '</div></div>';
        });
        container.innerHTML = html;
    },

    /**
     * Wire filter change events.
     */
    _wireOrgFilters: function () {
        var self = this;
        var bSel = document.getElementById('orgBuildingFilter');
        var iSel = document.getElementById('orgIncentiveFilter');
        if (bSel) bSel.addEventListener('change', function () { self._drawOrgTree(); });
        if (iSel) iSel.addEventListener('change', function () { self._drawOrgTree(); });
    },

    /**
     * Main draw function — builds hierarchy, renders HTML tree, attaches events.
     */
    _drawOrgTree: function () {
        var treeEl = document.getElementById('orgTreeContent');
        if (!treeEl) return;
        if (!this._orgData) return;

        treeEl.innerHTML = '<div class="org-loading"><i class="fas fa-spinner fa-spin"></i> Loading...</div>';

        var employees = this._orgData.employees || [];
        var selectedBuilding = (document.getElementById('orgBuildingFilter') || {}).value || '';
        var incentiveFilter = (document.getElementById('orgIncentiveFilter') || {}).value || '';

        // Build hierarchy
        var roots = this._buildOrgHierarchy(employees, selectedBuilding, incentiveFilter);
        if (!roots || roots.length === 0) {
            treeEl.innerHTML = '<div class="org-loading">No manager data available.</div>';
            return;
        }

        // Render HTML tree
        var html = this._buildOrgTreeHTML(roots, 0, selectedBuilding);
        treeEl.innerHTML = html;

        // Attach event listeners (only once — duplicate listeners cause double-toggle)
        if (!this._orgEventsAttached) {
            this._attachOrgEvents(treeEl);
            this._orgEventsAttached = true;
        }

        console.log('[DashboardCharts] Org chart rendered: ' + roots.length + ' root nodes');
    },

    /**
     * Build the org hierarchy tree from boss_id relationships.
     * Filters: TYPE-1 managers only, excludes resigned/pregnant employees.
     * Building filter uses boss chain collection for parent managers.
     *
     * @returns {Array} Root nodes of the tree
     */
    _buildOrgHierarchy: function (employees, selectedBuilding, incentiveFilter) {
        // Helper: collect boss chain for building filter
        function collectBossChain(emps, buildingEmpIds) {
            var bossChainIds = new Set();
            var empMap = {};
            emps.forEach(function (e) {
                var id = String(e.emp_no || e['Employee No'] || '');
                if (id && id !== 'nan') empMap[id] = e;
            });
            function addBoss(empId, depth) {
                if (depth > 10) return;
                var e = empMap[empId];
                if (!e) return;
                var bId = String(e.boss_id || '');
                if (bId && bId !== '' && bId !== 'nan' && bId !== '0' && !bossChainIds.has(bId)) {
                    bossChainIds.add(bId);
                    addBoss(bId, depth + 1);
                }
            }
            buildingEmpIds.forEach(function (id) { addBoss(id, 0); });
            return bossChainIds;
        }

        // Collect building employee IDs and boss chain
        var buildingEmployeeIds = new Set();
        var bossChainIds = new Set();

        if (selectedBuilding) {
            var selUpper = selectedBuilding.toUpperCase();
            employees.forEach(function (emp) {
                var b = String(emp.building || emp.BUILDING || '').toUpperCase();
                if (b.indexOf(selUpper) === 0) { // startsWith
                    var id = String(emp.emp_no || emp['Employee No'] || '');
                    if (id && id !== 'nan') buildingEmployeeIds.add(id);
                }
            });
            bossChainIds = collectBossChain(employees, buildingEmployeeIds);
        }

        // Filter TYPE-1 manager-level employees
        var type1Managers = employees.filter(function (emp) {
            // Exclude resigned
            var stop = emp.stop_working_date || emp['Stop working Date'] || '';
            if (stop && String(stop).trim() !== '') return false;

            // Exclude pregnant vacation
            var preg = String(emp.pregnant_vacation || emp['pregnant vacation-yes or no'] || '').toLowerCase();
            if (preg === 'yes') return false;

            // TYPE-1 only
            if (emp.type !== 'TYPE-1') return false;

            var pos = String(emp.position || '').toUpperCase();
            var isManagerLevel = pos.indexOf('MANAGER') !== -1 || pos.indexOf('SUPERVISOR') !== -1 ||
                                 pos.indexOf('GROUP LEADER') !== -1 || pos.indexOf('LINE LEADER') !== -1;
            if (!isManagerLevel) return false;

            // Exclude special calc positions (AQL Inspector, Model Master, Auditor & Trainer)
            if (pos.indexOf('AQL') !== -1 || pos.indexOf('MODEL MASTER') !== -1 || pos.indexOf('AUDITOR') !== -1) return false;

            // Building filter
            var empId = String(emp.emp_no || emp['Employee No'] || '');
            if (selectedBuilding) {
                var isTopMgr = pos === 'MANAGER' && pos.indexOf('A.MANAGER') === -1;
                if (!isTopMgr) {
                    var empB = String(emp.building || emp.BUILDING || '').toUpperCase();
                    var inBldg = empB.indexOf(selectedBuilding.toUpperCase()) === 0;
                    var inChain = bossChainIds.has(empId);
                    if (!inBldg && !inChain) return false;
                }
            }

            // Incentive filter
            if (incentiveFilter) {
                var inc = (window.employeeHelpers) ?
                    window.employeeHelpers.getIncentive(emp, 'current') :
                    (emp.currentIncentive || 0);
                if (incentiveFilter === 'paid' && !(inc > 0)) return false;
                if (incentiveFilter === 'unpaid' && inc > 0) return false;
            }

            return true;
        });

        // Build node map
        var nodeMap = {};
        var rootNodes = [];
        var self = this;

        type1Managers.forEach(function (emp) {
            var empId = String(emp.emp_no || emp['Employee No'] || '');
            var inc = (window.employeeHelpers) ?
                window.employeeHelpers.getIncentive(emp, 'current') :
                (emp.currentIncentive || 0);

            // Count direct subordinates (all employees whose boss_id = this emp)
            var directSubs = employees.filter(function (sub) {
                return String(sub.boss_id || '') === empId;
            });
            var subReceiving = directSubs.filter(function (sub) {
                var sInc = (window.employeeHelpers) ?
                    window.employeeHelpers.getIncentive(sub, 'current') :
                    (sub.currentIncentive || 0);
                return sInc > 0;
            });

            nodeMap[empId] = {
                id: empId,
                name: self._escapeHtml(emp.full_name || emp['Full Name'] || emp.name || '--'),
                position: emp.position || '--',
                type: emp.type || '--',
                incentive: Number(inc) || 0,
                boss_id: String(emp.boss_id || ''),
                building: String(emp.building || emp.BUILDING || ''),
                subordinateCount: directSubs.length,
                subordinateReceiving: subReceiving.length,
                children: []
            };
        });

        // Link parent → child
        Object.keys(nodeMap).forEach(function (id) {
            var node = nodeMap[id];
            var bossId = node.boss_id;
            if (bossId && bossId !== '' && bossId !== 'nan' && bossId !== '0' && nodeMap[bossId]) {
                nodeMap[bossId].children.push(node);
            } else {
                rootNodes.push(node);
            }
        });

        return rootNodes;
    },

    /**
     * Recursively build collapsible HTML tree from hierarchy nodes.
     */
    _buildOrgTreeHTML: function (nodes, depth, selectedBuilding) {
        if (!nodes || nodes.length === 0) return '';

        var html = '<ul>';
        var self = this;
        var selUpper = (selectedBuilding || '').toUpperCase();

        nodes.forEach(function (node) {
            var hasChildren = node.children && node.children.length > 0;
            var liClass = hasChildren ? 'expanded' : 'no-children';
            var posClass = self._getNodePositionClass(node.position);
            var incDot = node.incentive > 0 ? 'received' : 'not-received';

            // Building filter styling
            var bldgStyle = '';
            var bldgTitle = '';
            if (selUpper) {
                var nodeB = (node.building || '').toUpperCase();
                if (nodeB.indexOf(selUpper) === 0) {
                    bldgStyle = 'border: 3px solid #0d6efd; background-color: #e7f3ff;';
                } else {
                    bldgStyle = 'border: 2px dashed #999; opacity: 0.65; background-color: #f8f9fa;';
                    bldgTitle = nodeB ? ('Boss chain (Building ' + nodeB + ')') : 'Boss chain';
                }
            }

            html += '<li class="' + liClass + '">';
            html += '<div class="org-node ' + posClass + '" style="' + bldgStyle + '" title="' + bldgTitle + '">';

            // Incentive dot
            html += '<div class="node-incentive ' + incDot + '"></div>';

            // Node content
            html += '<div class="node-position">' + self._escapeHtml(node.position) + '</div>';
            html += '<div class="node-name">' + node.name + '</div>';
            html += '<div class="node-id">ID: ' + node.id + '</div>';

            // Incentive info row
            var fmtInc = Number(node.incentive).toLocaleString('ko-KR');
            html += '<div class="node-incentive-info" data-node-id="' + node.id + '">';
            html += '<span class="incentive-amount">' + fmtInc + ' VND</span>';
            html += '<button type="button" class="incentive-detail-btn" data-node-id="' + node.id + '" title="Detail">';
            html += '<i class="fas fa-info-circle"></i></button>';
            html += '</div>';

            // Subordinate count
            if (node.subordinateCount > 0) {
                html += '<div class="subordinate-info">';
                html += node.subordinateReceiving + '/' + node.subordinateCount + ' receiving';
                html += '</div>';
            }

            // Toggle button + child count
            if (hasChildren) {
                html += '<span class="child-count">' + node.children.length + '</span>';
                html += '<span class="toggle-btn" aria-hidden="true"></span>';
            }

            html += '</div>'; // .org-node

            // Recurse children
            if (hasChildren) {
                html += self._buildOrgTreeHTML(node.children, depth + 1, selectedBuilding);
            }

            html += '</li>';
        });

        html += '</ul>';
        return html;
    },

    /**
     * Return CSS class name based on position.
     */
    _getNodePositionClass: function (position) {
        var p = String(position || '').toUpperCase();
        if (p.indexOf('A.MANAGER') !== -1 || p.indexOf('ASSISTANT') !== -1) return 'a-manager';
        if (p.indexOf('MANAGER') !== -1) return 'manager';
        if (p.indexOf('SUPERVISOR') !== -1) return 'supervisor';
        if (p.indexOf('GROUP LEADER') !== -1) return 'group-leader';
        if (p.indexOf('LINE LEADER') !== -1) return 'line-leader';
        return '';
    },

    /**
     * Attach click events to the org tree (event delegation).
     */
    _attachOrgEvents: function (treeEl) {
        // Toggle collapse/expand
        treeEl.addEventListener('click', function (e) {
            // Toggle button
            var toggleBtn = e.target.closest('.toggle-btn');
            if (toggleBtn) {
                e.stopPropagation();
                var li = toggleBtn.closest('li');
                if (li) {
                    if (li.classList.contains('collapsed')) {
                        li.classList.remove('collapsed');
                        li.classList.add('expanded');
                    } else {
                        li.classList.remove('expanded');
                        li.classList.add('collapsed');
                    }
                }
                return;
            }

            // Detail button → open employee modal
            var detailBtn = e.target.closest('.incentive-detail-btn');
            if (detailBtn) {
                e.stopPropagation();
                var nodeId = detailBtn.getAttribute('data-node-id');
                if (nodeId && typeof DashboardModals !== 'undefined' && DashboardModals.showEmployeeDetail) {
                    DashboardModals.showEmployeeDetail(nodeId);
                }
                return;
            }

            // Click on incentive info row → open employee modal
            var incInfo = e.target.closest('.node-incentive-info');
            if (incInfo) {
                e.stopPropagation();
                var nId = incInfo.getAttribute('data-node-id');
                if (nId && typeof DashboardModals !== 'undefined' && DashboardModals.showEmployeeDetail) {
                    DashboardModals.showEmployeeDetail(nId);
                }
                return;
            }

            // Click on node itself → toggle children
            var orgNode = e.target.closest('.org-node');
            if (orgNode) {
                var tBtn = orgNode.querySelector('.toggle-btn');
                if (tBtn) tBtn.click();
            }
        });
    },

    // ------------------------------------------------------------------
    // Org Chart: Expand / Collapse / Find Me
    // ------------------------------------------------------------------

    /**
     * Expand all tree nodes.
     */
    expandAll: function () {
        var items = document.querySelectorAll('#orgTreeContent li.collapsed');
        items.forEach(function (li) {
            li.classList.remove('collapsed');
            li.classList.add('expanded');
        });
    },

    /**
     * Collapse all tree nodes.
     */
    collapseAll: function () {
        var items = document.querySelectorAll('#orgTreeContent li.expanded');
        items.forEach(function (li) {
            li.classList.remove('expanded');
            li.classList.add('collapsed');
        });
    },

    /**
     * Find and highlight a node by employee number (prompt user).
     */
    findMe: function () {
        var empId = prompt('Employee No:');
        if (!empId) return;
        empId = empId.trim();

        // Expand all first so the node is visible
        this.expandAll();

        // Find matching node
        var allNodes = document.querySelectorAll('#orgTreeContent .org-node');
        var found = false;
        allNodes.forEach(function (node) {
            node.style.outline = '';
        });
        allNodes.forEach(function (node) {
            var idEl = node.querySelector('.node-id');
            if (idEl && idEl.textContent.indexOf(empId) !== -1) {
                node.style.outline = '3px solid #6366f1';
                node.scrollIntoView({ behavior: 'smooth', block: 'center' });
                found = true;
            }
        });

        if (!found) {
            alert('Employee ' + empId + ' not found in org chart.');
        }
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

        // Helper: resolve nested or flat field paths (Firestore uses nested objects)
        function getNum(emp, paths) {
            for (var i = 0; i < paths.length; i++) {
                var parts = paths[i].split('.');
                var val = emp;
                for (var j = 0; j < parts.length; j++) {
                    if (val == null) break;
                    val = val[parts[j]];
                }
                if (val != null && val !== '' && !isNaN(parseFloat(val))) {
                    return parseFloat(val);
                }
            }
            return 0;
        }

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
            var unapproved = getNum(emp, [
                'attendance.unapproved_absence', 'unapproved_absence',
                'Unapproved Absences', 'unapproved_absences'
            ]);
            if (unapproved > thUnapprovedAbsence) {
                absentCount++;
            }
        });
        this._setKpiCount('kpiAbsentWithoutInform', absentCount);

        // --- KPI 3: Zero Working Days ---
        var zeroWorkingDaysCount = 0;
        employees.forEach(function (emp) {
            var actualDays = getNum(emp, [
                'attendance.actual_days', 'actual_working_days',
                'Actual Working Days', 'actual_days'
            ]);
            if (actualDays === 0) {
                zeroWorkingDaysCount++;
            }
        });
        this._setKpiCount('kpiZeroWorkingDays', zeroWorkingDaysCount);

        // --- KPI 4: Minimum Working Days Not Met ---
        var minDaysNotMetCount = 0;
        employees.forEach(function (emp) {
            var actualDays = getNum(emp, [
                'attendance.actual_days', 'actual_working_days',
                'Actual Working Days', 'actual_days'
            ]);
            if (actualDays > 0 && actualDays < thMinimumWorkingDays) {
                minDaysNotMetCount++;
            }
        });
        this._setKpiCount('kpiMinimumDaysNotMet', minDaysNotMetCount);

        // --- KPI 5: Attendance Rate Below Threshold ---
        var lowAttendanceCount = 0;
        employees.forEach(function (emp) {
            var rate = getNum(emp, [
                'attendance.rate', 'attendance_rate',
                'Attendance Rate', 'Attendance Rate (%)'
            ]);
            var actualDays = getNum(emp, [
                'attendance.actual_days', 'actual_working_days',
                'Actual Working Days', 'actual_days'
            ]);
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
            // Nested: aql.continuous_fail | Flat: continuous_fail, Continuous_FAIL
            var continuousFail = '';
            if (emp.aql && emp.aql.continuous_fail) {
                continuousFail = String(emp.aql.continuous_fail);
            } else {
                continuousFail = String(
                    emp.continuous_fail || emp['Continuous_FAIL'] ||
                    emp.Continuous_FAIL || ''
                );
            }
            // Also check conditions.c6 for V10 normalized data
            if (emp.conditions) {
                var c6 = String(emp.conditions.c6 || '').toUpperCase();
                if (c6 === 'NO' || c6 === 'FAIL') {
                    consecutiveAqlCount++;
                    return;
                }
            }
            // Issue #48: Use indexOf('YES'), never === 'YES'
            if (continuousFail.indexOf('YES') !== -1) {
                consecutiveAqlCount++;
            }
        });
        this._setKpiCount('kpiConsecutiveAqlFail', consecutiveAqlCount);

        // --- KPI 8: Area Reject Rate exceeds threshold ---
        var areaRejectCount = 0;
        employees.forEach(function (emp) {
            // Nested: aql.area_reject_rate | Flat: area_reject_rate, Area_Reject_Rate
            var rejectRate = getNum(emp, [
                'aql.area_reject_rate', 'area_reject_rate',
                'Area_Reject_Rate', 'AQL_Area_Reject_Rate'
            ]);
            if (rejectRate > thAreaRejectRate) {
                areaRejectCount++;
            }
        });
        this._setKpiCount('kpiAreaRejectRate', areaRejectCount);

        // --- KPI 9: 5PRS Pass Rate below threshold ---
        var lowPassRateCount = 0;
        employees.forEach(function (emp) {
            // Nested: prs.pass_rate | Flat: prs_pass_rate, 5PRS_Pass_Rate
            var passRate = getNum(emp, [
                'prs.pass_rate', 'prs_pass_rate',
                '5PRS_Pass_Rate', '5PRS Pass Rate (%)'
            ]);
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
            // Nested: prs.inspection_qty | Flat: prs_inspection_qty, 5PRS_Inspection_Qty
            var qty = getNum(emp, [
                'prs.inspection_qty', 'prs_inspection_qty',
                '5PRS_Inspection_Qty', '5PRS Inspection Qty'
            ]);
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
    },

    /**
     * Escape HTML special characters to prevent XSS.
     * @param {string} str
     * @returns {string}
     * @private
     */
    _escapeHtml: function (str) {
        if (!str) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    },

    /**
     * Escape a string for use in HTML attribute values (onclick handlers).
     * @param {string} str
     * @returns {string}
     * @private
     */
    _escapeAttr: function (str) {
        if (!str) return '';
        return String(str)
            .replace(/\\/g, '\\\\')
            .replace(/'/g, "\\'")
            .replace(/"/g, '\\"');
    }
};

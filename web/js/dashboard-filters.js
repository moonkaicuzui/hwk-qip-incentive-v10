/**
 * Dashboard Filters Module
 * HWK QIP Incentive Dashboard V10
 *
 * Handles search, filter, sort, and pagination for the employee table
 * in the "개인별 상세" (Individual Detail) tab.
 *
 * Depends on:
 *   - dashboard-data.js  (window.employeeData, window.employeeHelpers, window.thresholds)
 *   - dashboard-charts.js (DashboardCharts.formatVND, DashboardCharts.formatPercent)
 *
 * DOM element IDs consumed:
 *   Filters:    #employeeSearch, #positionFilter, #buildingFilter, #incentiveFilter
 *   Table:      #employeeTableBody (tbody)
 *   Pagination: #tablePagination
 *
 * Known issue references:
 *   - Issue #28: ID comparisons use String() conversion
 *   - Issue #37: Use window.employeeHelpers for incentive access
 *   - Issue #45: Building filter uses startsWith() for prefix matching
 *   - Issue #48: Continuous_FAIL uses includes('YES'), never === 'YES'
 */

// ---------------------------------------------------------------------------
// DashboardFilters Namespace
// ---------------------------------------------------------------------------

var DashboardFilters = {

    // Pagination state
    currentPage: 1,
    pageSize: 50,

    // Sort state
    sortColumn: null,
    sortDirection: 'asc',

    // Data references
    allEmployees: [],
    filteredData: [],

    // Thresholds cache (loaded from window.thresholds)
    _thresholds: null,

    // ------------------------------------------------------------------
    // Public API
    // ------------------------------------------------------------------

    /**
     * Initialize filters, populate dropdowns, bind events, and render table.
     * Called from dashboard.html DOMContentLoaded after data is loaded.
     *
     * @param {Object} data - { employees: Array, summary: Object, thresholds: Object }
     */
    init: function (data) {
        if (!data) {
            console.warn('[DashboardFilters] init called with no data');
            return;
        }

        this.allEmployees = data.employees || [];
        this.filteredData = [].concat(this.allEmployees);
        this._thresholds = data.thresholds || window.thresholds || {};

        this.populateFilterOptions();
        this.bindEvents();
        this.renderTable();
    },

    // ------------------------------------------------------------------
    // Filter Options Population
    // ------------------------------------------------------------------

    /**
     * Populate #positionFilter and #buildingFilter dropdowns with unique
     * values extracted from employee data. Adds "All" as the first option.
     */
    populateFilterOptions: function () {
        var positionSet = {};
        var buildingSet = {};

        this.allEmployees.forEach(function (emp) {
            // Position: try snake_case (Firestore) and PascalCase (V9 CSV)
            var pos = emp.position || emp.POSITION || emp['Position'] || '';
            if (pos) positionSet[pos] = true;

            // Building: try multiple field names
            var bldg = emp.building || emp.BUILDING || emp['Building'] || '';
            if (bldg) buildingSet[bldg] = true;
        });

        // Sort alphabetically
        var positions = Object.keys(positionSet).sort();
        var buildings = Object.keys(buildingSet).sort();

        // Populate position filter
        var posSelect = document.getElementById('positionFilter');
        if (posSelect) {
            // Keep the first "All" option, remove the rest
            while (posSelect.options.length > 1) {
                posSelect.remove(1);
            }
            positions.forEach(function (pos) {
                var opt = document.createElement('option');
                opt.value = pos;
                opt.textContent = pos;
                posSelect.appendChild(opt);
            });
        }

        // Populate building filter
        var bldgSelect = document.getElementById('buildingFilter');
        if (bldgSelect) {
            while (bldgSelect.options.length > 1) {
                bldgSelect.remove(1);
            }
            buildings.forEach(function (bldg) {
                var opt = document.createElement('option');
                opt.value = bldg;
                opt.textContent = bldg;
                bldgSelect.appendChild(opt);
            });
        }

    },

    // ------------------------------------------------------------------
    // Event Binding
    // ------------------------------------------------------------------

    /**
     * Bind events for search input, filter dropdowns, and sortable table headers.
     */
    bindEvents: function () {
        var self = this;

        // Search input: debounced input event
        var searchInput = document.getElementById('employeeSearch');
        if (searchInput) {
            var debounceTimer = null;
            searchInput.addEventListener('input', function () {
                clearTimeout(debounceTimer);
                debounceTimer = setTimeout(function () {
                    self.filterAndRender();
                }, 250);
            });
        }

        // Position filter
        var posFilter = document.getElementById('positionFilter');
        if (posFilter) {
            posFilter.addEventListener('change', function () {
                self.filterAndRender();
            });
        }

        // Building filter
        var bldgFilter = document.getElementById('buildingFilter');
        if (bldgFilter) {
            bldgFilter.addEventListener('change', function () {
                self.filterAndRender();
            });
        }

        // Incentive filter
        var incFilter = document.getElementById('incentiveFilter');
        if (incFilter) {
            incFilter.addEventListener('change', function () {
                self.filterAndRender();
            });
        }

        // Table header sort clicks (delegated on thead)
        var thead = document.querySelector('#detail .table-container thead');
        if (thead) {
            thead.addEventListener('click', function (e) {
                var th = e.target.closest('th');
                if (!th) return;
                var column = th.getAttribute('data-sort');
                if (column) {
                    self.handleSort(column);
                }
            });

            // Add data-sort attributes and cursor style to sortable headers
            var sortableColumns = [
                { i18n: 'table.empNo',         sort: 'emp_no' },
                { i18n: 'table.name',           sort: 'full_name' },
                { i18n: 'table.position',       sort: 'position' },
                { i18n: 'table.building',       sort: 'building' },
                { i18n: 'table.type',           sort: 'type' },
                { i18n: 'table.attendanceRate', sort: 'attendance' },
                { i18n: 'table.aql',            sort: 'aql' },
                { i18n: 'table.fivePrs',        sort: 'prs' },
                { i18n: 'table.incentive',      sort: 'incentive' }
            ];

            var ths = thead.querySelectorAll('th');
            ths.forEach(function (th) {
                var i18nKey = th.getAttribute('data-i18n');
                sortableColumns.forEach(function (col) {
                    if (i18nKey === col.i18n) {
                        th.setAttribute('data-sort', col.sort);
                        th.style.cursor = 'pointer';
                        th.title = 'Click to sort';
                    }
                });
            });
        }

    },

    // ------------------------------------------------------------------
    // Filtering
    // ------------------------------------------------------------------

    /**
     * Reset to page 1, apply all filters, and re-render the table.
     */
    filterAndRender: function () {
        this.currentPage = 1;
        this.applyFilters();
        this.renderTable();
    },

    /**
     * Apply all active filters (search, position, building, incentive)
     * and sort to this.allEmployees, storing result in this.filteredData.
     */
    applyFilters: function () {
        var data = [].concat(this.allEmployees);

        // --- Search filter ---
        // Match emp_no or full_name (case-insensitive)
        var searchEl = document.getElementById('employeeSearch');
        var search = (searchEl ? searchEl.value : '').toLowerCase().trim();
        if (search) {
            data = data.filter(function (emp) {
                // Issue #28: Always use String() for ID comparisons
                var empNo = String(emp.emp_no || emp['Employee No'] || '').toLowerCase();
                var fullName = String(emp.full_name || emp['Full Name'] || emp.FULL_NAME || '').toLowerCase();
                return empNo.indexOf(search) !== -1 || fullName.indexOf(search) !== -1;
            });
        }

        // --- Position filter ---
        var posEl = document.getElementById('positionFilter');
        var pos = posEl ? posEl.value : '';
        if (pos) {
            data = data.filter(function (emp) {
                var empPos = emp.position || emp.POSITION || emp['Position'] || '';
                return empPos === pos;
            });
        }

        // --- Building filter ---
        // Issue #45: Use startsWith() for prefix matching (A matches A, A1, A2)
        var bldgEl = document.getElementById('buildingFilter');
        var bldg = bldgEl ? bldgEl.value : '';
        if (bldg) {
            var bldgUpper = bldg.toUpperCase();
            data = data.filter(function (emp) {
                var empBldg = String(emp.building || emp.BUILDING || emp['Building'] || '').toUpperCase();
                return empBldg.indexOf(bldgUpper) === 0; // startsWith polyfill for older browsers
            });
        }

        // --- Incentive filter ---
        // Issue #37: Use window.employeeHelpers for incentive access
        var incEl = document.getElementById('incentiveFilter');
        var incFilter = incEl ? incEl.value : '';
        if (incFilter === 'received') {
            data = data.filter(function (emp) {
                if (window.employeeHelpers && window.employeeHelpers.hasReceivedIncentive) {
                    return window.employeeHelpers.hasReceivedIncentive(emp);
                }
                return (parseFloat(emp.currentIncentive || emp.current_incentive || 0) || 0) > 0;
            });
        } else if (incFilter === 'not-received') {
            data = data.filter(function (emp) {
                if (window.employeeHelpers && window.employeeHelpers.hasReceivedIncentive) {
                    return !window.employeeHelpers.hasReceivedIncentive(emp);
                }
                return (parseFloat(emp.currentIncentive || emp.current_incentive || 0) || 0) <= 0;
            });
        }

        // --- Apply sort ---
        if (this.sortColumn) {
            var self = this;
            data.sort(function (a, b) {
                var valA = self.getSortValue(a, self.sortColumn);
                var valB = self.getSortValue(b, self.sortColumn);

                // String comparison
                if (typeof valA === 'string' && typeof valB === 'string') {
                    var cmp = valA.localeCompare(valB);
                    return self.sortDirection === 'asc' ? cmp : -cmp;
                }

                // Numeric comparison
                var numA = parseFloat(valA) || 0;
                var numB = parseFloat(valB) || 0;
                return self.sortDirection === 'asc' ? numA - numB : numB - numA;
            });
        }

        this.filteredData = data;
    },

    /**
     * Extract a sortable value from an employee object for the given column.
     * Handles both Firestore (snake_case) and V9 CSV (PascalCase) field names.
     *
     * @param {Object} emp - Employee object
     * @param {string} column - Column key from data-sort attribute
     * @returns {string|number} Sortable value
     */
    getSortValue: function (emp, column) {
        switch (column) {
            case 'emp_no':
                return String(emp.emp_no || emp['Employee No'] || '');

            case 'full_name':
                return String(emp.full_name || emp['Full Name'] || emp.FULL_NAME || '');

            case 'position':
                return String(emp.position || emp.POSITION || emp['Position'] || '');

            case 'building':
                return String(emp.building || emp.BUILDING || emp['Building'] || '');

            case 'type':
                return String(emp.type || emp.TYPE || emp['ROLE TYPE STD'] || '');

            case 'attendance':
                return parseFloat(
                    emp.attendance_rate || emp['Attendance Rate'] ||
                    emp['Attendance Rate (%)'] ||
                    (emp.attendance ? emp.attendance.rate : 0) ||
                    0
                ) || 0;

            case 'aql':
                return parseFloat(
                    emp.aql_failures || emp['AQL_Fail_Count'] ||
                    emp.aql_fail_count ||
                    (emp.aql ? emp.aql.failures : 0) ||
                    0
                ) || 0;

            case 'prs':
                return parseFloat(
                    emp.prs_pass_rate || emp['5PRS_Pass_Rate'] ||
                    emp['5PRS Pass Rate (%)'] ||
                    (emp.prs ? emp.prs.pass_rate : 0) ||
                    0
                ) || 0;

            case 'incentive':
                // Issue #37: Use employeeHelpers
                if (window.employeeHelpers && window.employeeHelpers.getIncentive) {
                    return window.employeeHelpers.getIncentive(emp, 'current');
                }
                return parseFloat(emp.currentIncentive || emp.current_incentive || 0) || 0;

            default:
                return '';
        }
    },

    // ------------------------------------------------------------------
    // Table Rendering
    // ------------------------------------------------------------------

    /**
     * Render the employee table body for the current page.
     * Uses innerHTML batch for performance (~540 employees).
     */
    renderTable: function () {
        var tbody = document.getElementById('employeeTableBody');
        if (!tbody) return;

        var start = (this.currentPage - 1) * this.pageSize;
        var end = start + this.pageSize;
        var pageData = this.filteredData.slice(start, end);

        // Empty state
        if (pageData.length === 0) {
            var noDataText = (typeof DashboardI18n !== 'undefined') ? DashboardI18n.t('common.noData') : '데이터 없음';
            tbody.innerHTML = '<tr><td colspan="11" style="text-align: center; color: #757575; padding: 40px 0;">' +
                '<i class="fas fa-inbox" style="font-size: 2rem; display: block; margin-bottom: 8px;"></i>' +
                noDataText + '</td></tr>';
            this.renderPagination();
            return;
        }

        // Build all rows as a single string for performance
        var html = '';
        var self = this;
        var thresholds = this._thresholds || window.thresholds || {};
        var th5prsPassRate = parseFloat(thresholds['5prs_pass_rate']) || 95;

        pageData.forEach(function (emp, index) {
            var rowNum = start + index + 1;

            // --- Employee No (Issue #28: String conversion) ---
            var empNo = String(emp.emp_no || emp['Employee No'] || '--');

            // --- Full Name ---
            var fullName = emp.full_name || emp['Full Name'] || emp.FULL_NAME || '--';

            // --- Position ---
            var position = emp.position || emp.POSITION || emp['Position'] || '--';

            // --- Building ---
            var building = emp.building || emp.BUILDING || emp['Building'] || '--';

            // --- TYPE ---
            var empType = String(emp.type || emp.TYPE || emp['ROLE TYPE STD'] || '--').toUpperCase();
            var typeBadgeClass = 'badge-type3';
            if (empType.indexOf('TYPE-1') !== -1 || empType === '1') {
                typeBadgeClass = 'badge-type1';
                if (empType === '1') empType = 'TYPE-1';
            } else if (empType.indexOf('TYPE-2') !== -1 || empType === '2') {
                typeBadgeClass = 'badge-type2';
                if (empType === '2') empType = 'TYPE-2';
            } else if (empType.indexOf('TYPE-3') !== -1 || empType === '3') {
                typeBadgeClass = 'badge-type3';
                if (empType === '3') empType = 'TYPE-3';
            }

            // --- Attendance Rate ---
            var attendanceRate = parseFloat(
                emp.attendance_rate || emp['Attendance Rate'] ||
                emp['Attendance Rate (%)'] ||
                (emp.attendance ? emp.attendance.rate : 0) ||
                0
            ) || 0;
            var attendanceDisplay = attendanceRate > 0 ? self._formatPercent(attendanceRate) + '%' : '--';

            // --- AQL Status ---
            // Issue #56: TYPE별 N/A 표시 (TYPE-2, TYPE-3는 AQL 조건 미적용)
            var aqlHtml;
            var isType1 = (empType.indexOf('TYPE-1') !== -1);

            if (isType1) {
                // Check AQL failures from multiple field sources
                var aqlFailures = parseFloat(
                    emp.aql_failures || emp['AQL_Fail_Count'] ||
                    emp.aql_fail_count ||
                    (emp.aql ? emp.aql.failures : 0) ||
                    0
                ) || 0;

                // Also check condition 5 result via employeeHelpers
                var c5Result = '';
                if (window.employeeHelpers && window.employeeHelpers.getCondition) {
                    c5Result = String(window.employeeHelpers.getCondition(emp, 5)).toUpperCase();
                }

                // Issue #48: Continuous_FAIL uses includes('YES')
                var continuousFail = String(
                    emp.continuous_fail || emp['Continuous_FAIL'] ||
                    emp.Continuous_FAIL || ''
                );
                var hasConsecutiveFail = continuousFail.indexOf('YES') !== -1;

                if (aqlFailures > 0 || c5Result === 'NO' || c5Result === 'FAIL' || hasConsecutiveFail) {
                    aqlHtml = '<span class="badge-fail">\u274C FAIL</span>';
                } else {
                    aqlHtml = '<span class="badge-pass">\u2705 PASS</span>';
                }
            } else {
                // TYPE-2, TYPE-3: AQL not applicable
                aqlHtml = '<span class="badge-na">\u2796 N/A</span>';
            }

            // --- 5PRS Status ---
            // Issue #56: TYPE-2, TYPE-3은 5PRS 미적용
            var prsHtml;
            if (isType1) {
                var prsPassRate = parseFloat(
                    emp.prs_pass_rate || emp['5PRS_Pass_Rate'] ||
                    emp['5PRS Pass Rate (%)'] ||
                    (emp.prs ? emp.prs.pass_rate : 0) ||
                    0
                ) || 0;

                if (prsPassRate <= 0) {
                    prsHtml = '<span class="badge-na">\u2796 N/A</span>';
                } else if (prsPassRate >= th5prsPassRate) {
                    prsHtml = '<span class="badge-pass">' + self._formatPercent(prsPassRate) + '%</span>';
                } else {
                    prsHtml = '<span class="badge-fail">' + self._formatPercent(prsPassRate) + '%</span>';
                }
            } else {
                prsHtml = '<span class="badge-na">\u2796 N/A</span>';
            }

            // --- Incentive Amount ---
            // Issue #37: Use employeeHelpers for incentive access
            var incentiveAmount = 0;
            if (window.employeeHelpers && window.employeeHelpers.getIncentive) {
                incentiveAmount = window.employeeHelpers.getIncentive(emp, 'current');
            } else {
                incentiveAmount = parseFloat(emp.currentIncentive || emp.current_incentive || 0) || 0;
            }

            var incentiveColor = incentiveAmount > 0 ? '#2e7d32' : '#c62828';
            var incentiveWeight = incentiveAmount > 0 ? '600' : '400';
            var incentiveFormatted = self._formatVND(incentiveAmount);

            // --- Build row ---
            html += '<tr>';
            html += '<td style="text-align: center; color: #757575; font-size: 0.78rem;">' + rowNum + '</td>';
            html += '<td style="font-family: monospace; font-size: 0.82rem;">' + self._escapeHtml(empNo) + '</td>';
            html += '<td><a href="javascript:void(0)" onclick="DashboardFilters._openEmployeeModal(\'' + self._escapeAttr(empNo) + '\')" ' +
                    'style="color: #1565c0; text-decoration: none; font-weight: 500;">' + self._escapeHtml(fullName) + '</a></td>';
            html += '<td>' + self._escapeHtml(position) + '</td>';
            html += '<td>' + self._escapeHtml(building) + '</td>';
            html += '<td><span class="badge-type ' + typeBadgeClass + '">' + self._escapeHtml(empType) + '</span></td>';
            html += '<td style="text-align: right;">' + attendanceDisplay + '</td>';
            html += '<td style="text-align: center;">' + aqlHtml + '</td>';
            html += '<td style="text-align: center;">' + prsHtml + '</td>';
            html += '<td style="text-align: right; color: ' + incentiveColor + '; font-weight: ' + incentiveWeight + ';">' +
                    incentiveFormatted + ' <small style="color:#9e9e9e;">VND</small></td>';
            html += '<td style="text-align: center;">' +
                    '<button onclick="DashboardFilters._openEmployeeModal(\'' + self._escapeAttr(empNo) + '\')" ' +
                    'style="padding: 3px 10px; border: 1px solid #ddd; border-radius: 4px; background: #fff; cursor: pointer; font-size: 0.75rem;" ' +
                    'title="View Detail">' +
                    '<i class="fas fa-search"></i></button></td>';
            html += '</tr>';
        });

        tbody.innerHTML = html;
        this.renderPagination();
    },

    // ------------------------------------------------------------------
    // Pagination
    // ------------------------------------------------------------------

    /**
     * Render pagination controls in #tablePagination.
     * Shows: "Showing X-Y of Z employees" and page buttons.
     * Maximum 5 page number buttons displayed at a time.
     */
    renderPagination: function () {
        var container = document.getElementById('tablePagination');
        if (!container) return;

        var totalItems = this.filteredData.length;
        var totalPages = Math.ceil(totalItems / this.pageSize);
        var currentPage = this.currentPage;

        if (totalPages <= 0) {
            var t = (typeof DashboardI18n !== 'undefined') ? DashboardI18n.t.bind(DashboardI18n) : function(k) { return k; };
            container.innerHTML = '<div style="text-align: center; color: #757575; font-size: 0.82rem; padding: 8px 0;">' +
                t('common.total') + ' 0' + t('common.people_count') + '</div>';
            return;
        }

        var start = (currentPage - 1) * this.pageSize + 1;
        var end = Math.min(currentPage * this.pageSize, totalItems);

        var html = '';

        // Info text
        html += '<div style="display: flex; justify-content: space-between; align-items: center; width: 100%; flex-wrap: wrap; gap: 8px;">';
        var t = (typeof DashboardI18n !== 'undefined') ? DashboardI18n.t.bind(DashboardI18n) : function(k) { return k; };
        html += '<span style="color: #757575; font-size: 0.82rem;">' +
                start + '-' + end + ' / ' + totalItems + t('common.people_count') + '</span>';

        // Page buttons
        html += '<div style="display: flex; gap: 4px; align-items: center;">';

        // Previous button
        if (currentPage > 1) {
            html += '<button onclick="DashboardFilters.goToPage(' + (currentPage - 1) + ')">' +
                    '<i class="fas fa-chevron-left"></i></button>';
        } else {
            html += '<button disabled style="opacity: 0.4; cursor: default;">' +
                    '<i class="fas fa-chevron-left"></i></button>';
        }

        // Page numbers (max 5 visible)
        var maxVisible = 5;
        var startPage = Math.max(1, currentPage - Math.floor(maxVisible / 2));
        var endPage = Math.min(totalPages, startPage + maxVisible - 1);

        // Adjust startPage if endPage hit the limit
        if (endPage - startPage + 1 < maxVisible) {
            startPage = Math.max(1, endPage - maxVisible + 1);
        }

        // First page + ellipsis
        if (startPage > 1) {
            html += '<button onclick="DashboardFilters.goToPage(1)">1</button>';
            if (startPage > 2) {
                html += '<span style="padding: 0 4px; color: #999;">...</span>';
            }
        }

        // Page number buttons
        for (var p = startPage; p <= endPage; p++) {
            if (p === currentPage) {
                html += '<button class="active">' + p + '</button>';
            } else {
                html += '<button onclick="DashboardFilters.goToPage(' + p + ')">' + p + '</button>';
            }
        }

        // Last page + ellipsis
        if (endPage < totalPages) {
            if (endPage < totalPages - 1) {
                html += '<span style="padding: 0 4px; color: #999;">...</span>';
            }
            html += '<button onclick="DashboardFilters.goToPage(' + totalPages + ')">' + totalPages + '</button>';
        }

        // Next button
        if (currentPage < totalPages) {
            html += '<button onclick="DashboardFilters.goToPage(' + (currentPage + 1) + ')">' +
                    '<i class="fas fa-chevron-right"></i></button>';
        } else {
            html += '<button disabled style="opacity: 0.4; cursor: default;">' +
                    '<i class="fas fa-chevron-right"></i></button>';
        }

        html += '</div>'; // page buttons container
        html += '</div>'; // outer flex container

        container.innerHTML = html;
    },

    /**
     * Navigate to a specific page and re-render.
     * Scrolls the table container into view.
     *
     * @param {number} page - 1-indexed page number
     */
    goToPage: function (page) {
        var totalPages = Math.ceil(this.filteredData.length / this.pageSize);
        if (page < 1) page = 1;
        if (page > totalPages) page = totalPages;

        this.currentPage = page;
        this.renderTable();

        // Scroll table into view
        var tableContainer = document.querySelector('#detail .table-container');
        if (tableContainer) {
            tableContainer.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    },

    // ------------------------------------------------------------------
    // Sorting
    // ------------------------------------------------------------------

    /**
     * Handle a sort request on a column. Toggles direction if same column,
     * otherwise sets ascending. Updates sort indicators in header.
     *
     * @param {string} column - Column key from data-sort attribute
     */
    handleSort: function (column) {
        if (this.sortColumn === column) {
            this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
        } else {
            this.sortColumn = column;
            this.sortDirection = 'asc';
        }

        this.filterAndRender();
        this._updateSortIndicators();
    },

    // ------------------------------------------------------------------
    // Attendance Lookup (placeholder for dashboard.html integration)
    // ------------------------------------------------------------------

    /**
     * Search for an employee by ID and display attendance details.
     * Called from the "개인 출결 조회" tab.
     *
     * @param {string} empId - Employee number to search for
     */
    searchAttendance: function (empId) {
        var resultDiv = document.getElementById('attendanceLookupResult');
        if (!resultDiv) return;

        var t = (typeof DashboardI18n !== 'undefined') ? DashboardI18n.t.bind(DashboardI18n) : function(k) { return k; };
        if (!empId) {
            resultDiv.innerHTML = '<p style="color: #757575;">' + t('attendanceLookup.enterEmpNo') + '</p>';
            return;
        }

        var empIdStr = String(empId).trim();
        var employees = window.employeeData || this.allEmployees || [];

        // Issue #28: String() conversion for ID matching
        var found = null;
        for (var i = 0; i < employees.length; i++) {
            var emp = employees[i];
            var no = String(emp.emp_no || emp['Employee No'] || '');
            if (no === empIdStr) {
                found = emp;
                break;
            }
        }

        if (!found) {
            resultDiv.innerHTML = '<p style="color: #c62828;"><i class="fas fa-exclamation-circle"></i> ' +
                t('attendanceLookup.empNoLabel') + this._escapeHtml(empIdStr) + t('attendanceLookup.notFound') + '</p>';
            return;
        }

        // Build basic attendance info
        var name = found.full_name || found['Full Name'] || found.FULL_NAME || '--';
        var position = found.position || found.POSITION || found['Position'] || '--';
        var attendanceRate = parseFloat(
            found.attendance_rate || found['Attendance Rate'] ||
            found['Attendance Rate (%)'] ||
            (found.attendance ? found.attendance.rate : 0) || 0
        ) || 0;
        var actualDays = parseFloat(
            found.actual_working_days || found['Actual Working Days'] ||
            found.actual_days || (found.attendance ? found.attendance.actual_days : 0) || 0
        ) || 0;
        var totalDays = parseFloat(
            found.total_working_days || found['Total Working Days'] ||
            found.total_days || (found.attendance ? found.attendance.total_days : 0) || 0
        ) || 0;
        var unapproved = parseFloat(
            found.unapproved_absence || found['Unapproved Absences'] ||
            found.unapproved_absences || 0
        ) || 0;
        var approvedLeave = parseFloat(
            found.approved_leave_days || found['Approved Leave Days'] || 0
        ) || 0;

        var html = '<div class="section-card">';
        html += '<h3><i class="fas fa-user"></i> ' + this._escapeHtml(name) + ' (' + this._escapeHtml(empIdStr) + ')</h3>';
        html += '<p style="color: #757575; margin-bottom: 16px;">' + this._escapeHtml(position) + '</p>';
        var dayUnit = t('attendanceLookup.day');
        html += '<table style="width: 100%; max-width: 500px;">';
        html += '<tr><td style="padding: 6px 12px; color: #757575;">' + t('attendanceLookup.totalWorkDays') + '</td>' +
                '<td style="padding: 6px 12px; font-weight: 600;">' + totalDays + dayUnit + '</td></tr>';
        html += '<tr><td style="padding: 6px 12px; color: #757575;">' + t('attendanceLookup.actualWorkDays') + '</td>' +
                '<td style="padding: 6px 12px; font-weight: 600;">' + actualDays + dayUnit + '</td></tr>';
        html += '<tr><td style="padding: 6px 12px; color: #757575;">' + t('attendanceLookup.approvedLeave') + '</td>' +
                '<td style="padding: 6px 12px; font-weight: 600;">' + approvedLeave + dayUnit + '</td></tr>';
        html += '<tr><td style="padding: 6px 12px; color: #757575;">' + t('attendanceLookup.unapprovedAbsence') + '</td>' +
                '<td style="padding: 6px 12px; font-weight: 600; color: ' + (unapproved > 0 ? '#c62828' : '#2e7d32') + ';">' +
                unapproved + dayUnit + '</td></tr>';
        html += '<tr><td style="padding: 6px 12px; color: #757575;">' + t('attendanceLookup.attendanceRate') + '</td>' +
                '<td style="padding: 6px 12px; font-weight: 600; color: ' + (attendanceRate >= (window.thresholds && window.thresholds.attendance_rate || THRESHOLD_DEFAULTS.attendance_rate) ? '#2e7d32' : '#c62828') + ';">' +
                this._formatPercent(attendanceRate) + '%</td></tr>';
        html += '</table>';
        html += '</div>';

        resultDiv.innerHTML = html;
    },

    // ------------------------------------------------------------------
    // Private Helpers
    // ------------------------------------------------------------------

    /**
     * Open employee detail modal via DashboardModals.
     * Static method called from onclick handlers in rendered HTML.
     *
     * @param {string} empNo - Employee number
     */
    _openEmployeeModal: function (empNo) {
        if (typeof DashboardModals !== 'undefined' && DashboardModals.showEmployeeDetail) {
            DashboardModals.showEmployeeDetail(empNo);
        } else {
            console.warn('[DashboardFilters] DashboardModals.showEmployeeDetail not available');
        }
    },

    /**
     * Update sort direction indicators (arrows) on table headers.
     * Adds a small arrow character after the sorted column header text.
     * @private
     */
    _updateSortIndicators: function () {
        var thead = document.querySelector('#detail .table-container thead');
        if (!thead) return;

        var self = this;
        var ths = thead.querySelectorAll('th[data-sort]');
        ths.forEach(function (th) {
            // Remove existing sort indicator
            var indicator = th.querySelector('.sort-indicator');
            if (indicator) indicator.remove();

            if (th.getAttribute('data-sort') === self.sortColumn) {
                var span = document.createElement('span');
                span.className = 'sort-indicator';
                span.style.marginLeft = '4px';
                span.style.fontSize = '0.7rem';
                span.textContent = self.sortDirection === 'asc' ? ' \u25B2' : ' \u25BC'; // ▲ or ▼
                th.appendChild(span);
            }
        });
    },

    /**
     * Format a number as Vietnamese Dong (VND) with comma separators.
     * Delegates to DashboardCharts if available, otherwise formats locally.
     *
     * @param {number|string} amount
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
     * Format a value as a percentage with one decimal place.
     * Delegates to DashboardCharts if available.
     *
     * @param {number|string} value
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
     * Escape HTML special characters to prevent XSS in rendered content.
     *
     * @param {string} str - Raw string
     * @returns {string} Escaped string safe for innerHTML
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
     * Escape a string for use inside an HTML attribute (e.g., onclick).
     * Handles single quotes used in onclick="fn('value')".
     *
     * @param {string} str - Raw string
     * @returns {string} Escaped string safe for attribute values
     * @private
     */
    _escapeAttr: function (str) {
        if (!str) return '';
        return String(str)
            .replace(/\\/g, '\\\\')
            .replace(/'/g, "\\'")
            .replace(/"/g, '&quot;');
    }
};

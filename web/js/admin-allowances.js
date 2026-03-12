/**
 * Admin Allowances Module
 * HWK QIP Incentive Dashboard V10
 *
 * Manages condition override (allowance) for employees with valid reasons.
 * Uses Firebase v10.7.1 compat SDK (firebase.firestore() style).
 *
 * Firestore collections:
 *   - allowances/{monthYear}/items/{docId}   : Allowance records
 *   - employees/{monthYear}/all_data/data    : Employee data (read + update)
 *   - dashboard_summary/{monthYear}          : Summary (recalculate on apply/revoke)
 *
 * Depends on: firebase-config.js, auth.js, dashboard-i18n.js, admin.js
 */

var AdminAllowances = {

    _currentEmployee: null,  // currently loaded employee object
    _employeeData: null,     // full employee list for the month

    // ---------------------------------------------------------------
    // Helpers
    // ---------------------------------------------------------------

    _t: function (key) {
        if (typeof DashboardI18n !== 'undefined') {
            return DashboardI18n.t(key);
        }
        return key;
    },

    _escapeHtml: function (str) {
        if (typeof AdminPage !== 'undefined' && AdminPage.escapeHtml) {
            return AdminPage.escapeHtml(str);
        }
        if (!str) return '';
        var div = document.createElement('div');
        div.appendChild(document.createTextNode(String(str)));
        return div.innerHTML;
    },

    _getMonthYear: function () {
        var month = document.getElementById('allowance-month').value;
        var year = document.getElementById('allowance-year').value;
        return month + '_' + year;
    },

    _db: function () {
        return firebase.firestore();
    },

    _currentUser: function () {
        return firebase.auth().currentUser;
    },

    // ---------------------------------------------------------------
    // Initialization
    // ---------------------------------------------------------------

    init: function () {
        this.loadActiveAllowances();
    },

    // ---------------------------------------------------------------
    // Employee Search
    // ---------------------------------------------------------------

    searchEmployee: async function () {
        var t = this._t;
        var monthYear = this._getMonthYear();
        var query = (document.getElementById('allowance-search').value || '').trim();
        if (!query) return;

        try {
            // Load employee data for this month
            var db = this._db();
            var docRef = db.collection('employees').doc(monthYear).collection('all_data').doc('data');
            var doc = await docRef.get();
            if (!doc.exists) {
                this._showEmployeeInfo('<div class="alert alert-warning">' + t('admin.allowances.employeeNotFound') + '</div>');
                return;
            }

            var data = doc.data();
            this._employeeData = data.employees || [];

            // Search by emp_no or name
            var queryLower = query.toLowerCase();
            var found = null;
            for (var i = 0; i < this._employeeData.length; i++) {
                var emp = this._employeeData[i];
                var empNo = String(emp.emp_no || emp['Employee No'] || '');
                var name = String(emp.full_name || emp.name || emp['Employee Name'] || '');
                if (empNo === query || name.toLowerCase().indexOf(queryLower) !== -1) {
                    found = emp;
                    break;
                }
            }

            if (!found) {
                this._showEmployeeInfo('<div class="alert alert-warning">' + t('admin.allowances.employeeNotFound') + '</div>');
                this._hideForm();
                return;
            }

            this._currentEmployee = found;

            // Check if there's already an active allowance for this employee
            var existingAllowance = await this._getExistingAllowance(monthYear, String(found.emp_no || found['Employee No'] || ''));

            this._renderEmployeeInfo(found, existingAllowance);
            this._renderAllowanceForm(found, existingAllowance);

        } catch (error) {
            console.error('[AdminAllowances] searchEmployee error:', error);
            this._showEmployeeInfo('<div class="alert alert-danger">Error: ' + this._escapeHtml(error.message) + '</div>');
        }
    },

    _getExistingAllowance: async function (monthYear, empNo) {
        var db = this._db();
        var snapshot = await db.collection('allowances').doc(monthYear).collection('items')
            .where('employeeNo', '==', empNo)
            .where('status', '==', 'APPLIED')
            .get();
        if (snapshot.empty) return null;
        var doc = snapshot.docs[0];
        return Object.assign({ _id: doc.id }, doc.data());
    },

    // ---------------------------------------------------------------
    // Render Employee Info
    // ---------------------------------------------------------------

    _showEmployeeInfo: function (html) {
        var el = document.getElementById('allowance-employee-info');
        el.innerHTML = html;
        el.style.display = 'block';
    },

    _hideForm: function () {
        document.getElementById('allowance-form').style.display = 'none';
        document.getElementById('allowance-preview').style.display = 'none';
    },

    _renderEmployeeInfo: function (emp, existingAllowance) {
        var t = this._t;
        var esc = this._escapeHtml.bind(this);
        var empNo = esc(emp.emp_no || emp['Employee No'] || '--');
        var name = esc(emp.full_name || emp.name || '--');
        var position = esc(emp.position || '--');
        var building = esc(emp.building || '--');
        var empType = esc(emp.type || '--');
        var passRate = parseFloat(emp.conditions_pass_rate || 0);
        var incentive = parseFloat(emp.current_incentive || emp.currentIncentive || 0);

        var condHtml = this._renderConditionSummary(emp);

        var html = '<div class="card mb-3" style="border-left: 4px solid #1a237e;">';
        html += '<div class="card-body">';
        html += '<div class="row">';
        html += '<div class="col-md-6">';
        html += '<h5>' + name + ' <small class="text-muted">(' + empNo + ')</small></h5>';
        html += '<p class="mb-1"><strong>Position:</strong> ' + position + '</p>';
        html += '<p class="mb-1"><strong>Building:</strong> ' + building + '</p>';
        html += '<p class="mb-1"><strong>Type:</strong> <span class="badge bg-' + (empType.indexOf('1') !== -1 ? 'primary' : 'info') + '">' + empType + '</span></p>';
        html += '<p class="mb-1"><strong>Pass Rate:</strong> <span style="color:' + (passRate >= 100 ? '#2e7d32' : '#c62828') + '; font-weight:700;">' + passRate.toFixed(1) + '%</span></p>';
        html += '<p class="mb-0"><strong>Incentive:</strong> ' + this._formatVND(incentive) + '</p>';
        html += '</div>';
        html += '<div class="col-md-6">' + condHtml + '</div>';
        html += '</div>';

        if (existingAllowance) {
            html += '<div class="alert alert-info mt-3 mb-0">';
            html += '<i class="fa-solid fa-circle-info me-1"></i> ';
            html += t('allowance.applied') + ': ';
            html += '<strong>' + (existingAllowance.conditions || []).map(function (c) { return c.toUpperCase(); }).join(', ') + '</strong>';
            html += ' — ' + esc(existingAllowance.reasonDetail || '');
            html += '</div>';
        }

        html += '</div></div>';

        this._showEmployeeInfo(html);
    },

    _renderConditionSummary: function (emp) {
        var conditions = emp.conditions || {};
        var empType = String(emp.type || '').toUpperCase();
        var isType1 = empType === 'TYPE-1' || empType === '1' || empType === 'TYPE 1';

        var condNames = ['C1: Attendance', 'C2: Unapproved', 'C3: Working Days', 'C4: Min Days',
            'C5: AQL Personal', 'C6: AQL Consecutive', 'C7: AQL Team', 'C8: Area Reject',
            'C9: 5PRS Rate', 'C10: 5PRS Qty'];

        var html = '<table class="table table-sm table-bordered mb-0" style="font-size: 0.85rem;">';
        html += '<thead><tr><th>#</th><th>Condition</th><th>Result</th></tr></thead><tbody>';

        for (var i = 1; i <= 10; i++) {
            var result = String(conditions['c' + i] || 'N/A').toUpperCase();
            if (!isType1 && i >= 5) result = 'N/A';

            var badgeClass = result === 'YES' ? 'bg-success' : result === 'NO' ? 'bg-danger' : 'bg-secondary';
            html += '<tr>';
            html += '<td>' + i + '</td>';
            html += '<td>' + condNames[i - 1] + '</td>';
            html += '<td><span class="badge ' + badgeClass + '">' + result + '</span></td>';
            html += '</tr>';
        }
        html += '</tbody></table>';
        return html;
    },

    // ---------------------------------------------------------------
    // Allowance Form
    // ---------------------------------------------------------------

    _renderAllowanceForm: function (emp, existingAllowance) {
        var t = this._t;
        var formEl = document.getElementById('allowance-form');

        // If already has active allowance, don't show form
        if (existingAllowance) {
            formEl.style.display = 'none';
            return;
        }

        var conditions = emp.conditions || {};
        var empType = String(emp.type || '').toUpperCase();
        var isType1 = empType === 'TYPE-1' || empType === '1' || empType === 'TYPE 1';

        // Find FAIL conditions
        var failConditions = [];
        for (var i = 1; i <= 10; i++) {
            var result = String(conditions['c' + i] || 'N/A').toUpperCase();
            if (!isType1 && i >= 5) continue;
            if (result === 'NO') {
                failConditions.push(i);
            }
        }

        if (failConditions.length === 0) {
            formEl.innerHTML = '<div class="alert alert-success">' + t('admin.allowances.noFailConditions') + '</div>';
            formEl.style.display = 'block';
            return;
        }

        var condNames = {
            1: 'Attendance Rate', 2: 'Unapproved Absence', 3: 'Actual Working Days',
            4: 'Minimum Working Days', 5: 'AQL Personal Failure', 6: 'AQL Consecutive',
            7: 'AQL Team/Area', 8: 'Area Reject Rate', 9: '5PRS Pass Rate', 10: '5PRS Inspection Qty'
        };

        var html = '<div class="card mb-3" style="border-left: 4px solid #f59e0b;">';
        html += '<div class="card-body">';
        html += '<h6>' + t('admin.allowances.selectConditions') + '</h6>';

        // Condition checkboxes (only FAIL ones)
        for (var j = 0; j < failConditions.length; j++) {
            var cn = failConditions[j];
            html += '<div class="form-check mb-1">';
            html += '<input class="form-check-input" type="checkbox" id="allowance-cond-c' + cn + '" value="c' + cn + '" checked>';
            html += '<label class="form-check-label" for="allowance-cond-c' + cn + '">';
            html += '<strong>C' + cn + '</strong>: ' + condNames[cn];
            html += '</label></div>';
        }

        // Reason code
        html += '<div class="row mt-3">';
        html += '<div class="col-md-4">';
        html += '<label class="form-label">' + t('admin.allowances.reasonCode') + '</label>';
        html += '<select class="form-select form-control-admin" id="allowance-reason-code">';
        html += '<option value="MEDICAL">' + t('allowance.reason.MEDICAL') + '</option>';
        html += '<option value="COMPANY_ORDER">' + t('allowance.reason.COMPANY_ORDER') + '</option>';
        html += '<option value="NATURAL_DISASTER">' + t('allowance.reason.NATURAL_DISASTER') + '</option>';
        html += '<option value="OTHER">' + t('allowance.reason.OTHER') + '</option>';
        html += '</select></div>';

        // Reason detail
        html += '<div class="col-md-8">';
        html += '<label class="form-label">' + t('admin.allowances.reasonDetail') + '</label>';
        html += '<textarea class="form-control form-control-admin" id="allowance-reason-detail" rows="2" placeholder="' + t('admin.allowances.reasonDetail') + '"></textarea>';
        html += '</div></div>';

        // Preview + Apply buttons
        html += '<div class="mt-3">';
        html += '<button class="btn btn-outline-admin me-2" onclick="AdminAllowances.showPreview()"><i class="fa-solid fa-eye me-1"></i>' + t('admin.allowances.preview') + '</button>';
        html += '<button class="btn btn-primary-admin" onclick="AdminAllowances.applyAllowance()"><i class="fa-solid fa-check me-1"></i>' + t('admin.allowances.apply') + '</button>';
        html += '</div>';

        html += '</div></div>';

        formEl.innerHTML = html;
        formEl.style.display = 'block';
    },

    // ---------------------------------------------------------------
    // Preview
    // ---------------------------------------------------------------

    showPreview: function () {
        var t = this._t;
        var emp = this._currentEmployee;
        if (!emp) return;

        var selectedConditions = this._getSelectedConditions();
        if (selectedConditions.length === 0) return;

        var preview = this._calculateOverride(emp, selectedConditions);
        var previewEl = document.getElementById('allowance-preview');

        var html = '<div class="card mb-3" style="border-left: 4px solid #2e7d32;">';
        html += '<div class="card-body">';
        html += '<h6><i class="fa-solid fa-eye me-1"></i> ' + t('admin.allowances.preview') + '</h6>';
        html += '<table class="table table-sm">';
        html += '<tr><th></th><th>Before</th><th>After</th></tr>';
        html += '<tr><td>Conditions Passed</td><td>' + preview.original.passed + '/' + preview.original.applicable + '</td>';
        html += '<td><strong>' + preview.overridden.passed + '/' + preview.overridden.applicable + '</strong></td></tr>';
        html += '<tr><td>Pass Rate</td><td>' + preview.original.passRate.toFixed(1) + '%</td>';
        html += '<td><strong style="color:' + (preview.overridden.passRate >= 100 ? '#2e7d32' : '#c62828') + ';">' + preview.overridden.passRate.toFixed(1) + '%</strong></td></tr>';
        html += '<tr><td>Incentive</td><td>' + this._formatVND(preview.original.incentive) + '</td>';
        html += '<td><strong style="color:#2e7d32;">' + this._formatVND(preview.overridden.incentive) + '</strong></td></tr>';
        html += '</table>';
        html += '</div></div>';

        previewEl.innerHTML = html;
        previewEl.style.display = 'block';
    },

    _getSelectedConditions: function () {
        var conditions = [];
        for (var i = 1; i <= 10; i++) {
            var cb = document.getElementById('allowance-cond-c' + i);
            if (cb && cb.checked) {
                conditions.push('c' + i);
            }
        }
        return conditions;
    },

    _calculateOverride: function (emp, selectedConditions) {
        var conditions = emp.conditions || {};
        var empType = String(emp.type || '').toUpperCase();
        var isType1 = empType === 'TYPE-1' || empType === '1' || empType === 'TYPE 1';

        var originalPassed = parseInt(emp.conditions_passed || 0);
        var applicable = parseInt(emp.conditions_applicable || 0);
        var originalRate = parseFloat(emp.conditions_pass_rate || 0);
        var originalIncentive = parseFloat(emp.current_incentive || emp.currentIncentive || 0);

        // Count how many selected conditions are currently NO
        var additionalPasses = 0;
        for (var i = 0; i < selectedConditions.length; i++) {
            var cond = selectedConditions[i];
            var val = String(conditions[cond] || '').toUpperCase();
            if (val === 'NO') additionalPasses++;
        }

        var newPassed = originalPassed + additionalPasses;
        var newRate = applicable > 0 ? (newPassed / applicable * 100) : 0;

        // Calculate incentive if 100%
        var newIncentive = 0;
        if (newRate >= 100) {
            newIncentive = this._calculateIncentiveAmount(emp);
        }

        return {
            original: {
                passed: originalPassed,
                applicable: applicable,
                passRate: originalRate,
                incentive: originalIncentive
            },
            overridden: {
                passed: newPassed,
                applicable: applicable,
                passRate: newRate,
                incentive: newIncentive
            }
        };
    },

    _calculateIncentiveAmount: function (emp) {
        var empType = String(emp.type || '').toUpperCase();
        var continuousMonths = parseInt(emp.continuous_months || 0);

        // TYPE-1: Use progressive table
        if (empType === 'TYPE-1' || empType === '1' || empType === 'TYPE 1') {
            var table = (typeof PROGRESSIVE_TABLE_DEFAULT !== 'undefined') ? PROGRESSIVE_TABLE_DEFAULT : [
                0, 150000, 250000, 300000, 350000, 400000, 450000, 500000,
                650000, 750000, 850000, 950000, 1000000, 1000000, 1000000, 1000000
            ];
            // Use window.progressiveTable if available (loaded from Firestore)
            if (window.progressiveTable) table = window.progressiveTable;

            var idx = Math.min(Math.max(continuousMonths, 0), table.length - 1);
            return table[idx] || 0;
        }

        // TYPE-2/3: Use multiplier-based calculation
        // For preview, we use the employee's existing calculated amount if pass_rate was 100
        // Since we can't easily recalculate TYPE-2 here (needs subordinate data),
        // we look at the data stored by the pipeline
        var baseAmount = parseFloat(emp.type2_calculated_amount || emp.calculated_incentive_amount || 0);
        if (baseAmount > 0) return baseAmount;

        // Fallback: Try to get from the pipeline's stored base incentive
        var pipelineAmount = parseFloat(emp.base_incentive_amount || 0);
        if (pipelineAmount > 0) return pipelineAmount;

        // Last resort for TYPE-2: use a reasonable estimate from progressive table
        if (empType === 'TYPE-2' || empType === '2' || empType === 'TYPE 2') {
            // TYPE-2 typically gets multiplier × base
            // We don't have subordinate data here, so just indicate it needs pipeline data
            return parseFloat(emp.incentive_before_conditions || 0) || 0;
        }

        return 0;
    },

    // ---------------------------------------------------------------
    // Loading UI
    // ---------------------------------------------------------------

    _setLoading: function (isLoading, message) {
        var applyBtn = document.querySelector('[onclick="AdminAllowances.applyAllowance()"]');
        var previewBtn = document.querySelector('[onclick="AdminAllowances.showPreview()"]');
        var formEl = document.getElementById('allowance-form');

        if (isLoading) {
            if (applyBtn) { applyBtn.disabled = true; applyBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin me-1"></i>' + (message || 'Processing...'); }
            if (previewBtn) previewBtn.disabled = true;
            // Show progress bar
            var progressHtml = '<div id="allowance-progress" class="alert alert-info mt-2">'
                + '<i class="fa-solid fa-spinner fa-spin me-2"></i>'
                + '<span id="allowance-progress-text">' + this._escapeHtml(message || 'Processing...') + '</span>'
                + '</div>';
            var existing = document.getElementById('allowance-progress');
            if (existing) existing.remove();
            if (formEl) formEl.insertAdjacentHTML('beforeend', progressHtml);
        } else {
            if (applyBtn) { applyBtn.disabled = false; applyBtn.innerHTML = '<i class="fa-solid fa-check me-1"></i>' + this._t('admin.allowances.apply'); }
            if (previewBtn) previewBtn.disabled = false;
            var prog = document.getElementById('allowance-progress');
            if (prog) prog.remove();
        }
    },

    _updateProgress: function (message) {
        var el = document.getElementById('allowance-progress-text');
        if (el) el.textContent = message;
    },

    // ---------------------------------------------------------------
    // Apply Allowance
    // ---------------------------------------------------------------

    applyAllowance: async function () {
        var t = this._t;
        var emp = this._currentEmployee;
        if (!emp) { alert('No employee selected'); return; }

        var selectedConditions = this._getSelectedConditions();
        if (selectedConditions.length === 0) { alert('No conditions selected'); return; }

        var reasonCode = document.getElementById('allowance-reason-code').value;
        var reasonDetail = (document.getElementById('allowance-reason-detail').value || '').trim();
        if (!reasonDetail) {
            alert(t('admin.allowances.reasonDetail'));
            return;
        }

        if (!confirm(t('admin.allowances.confirmApply'))) return;

        this._setLoading(true, 'Allowance 적용 중...');

        try {
            var db = this._db();
            var user = this._currentUser();
            var monthYear = this._getMonthYear();
            var empNo = String(emp.emp_no || emp['Employee No'] || '');
            var preview = this._calculateOverride(emp, selectedConditions);

            this._updateProgress('Step 1/3: Allowance 문서 생성...');

            // Build original values snapshot
            var originalValues = {};
            for (var i = 0; i < selectedConditions.length; i++) {
                originalValues[selectedConditions[i]] = String(emp.conditions[selectedConditions[i]] || 'NO');
            }
            originalValues.conditions_passed = preview.original.passed;
            originalValues.conditions_applicable = preview.original.applicable;
            originalValues.conditions_pass_rate = preview.original.passRate;
            originalValues.incentive_amount = preview.original.incentive;

            // Build overridden values
            var overriddenValues = {};
            for (var j = 0; j < selectedConditions.length; j++) {
                overriddenValues[selectedConditions[j]] = 'YES';
            }
            overriddenValues.conditions_passed = preview.overridden.passed;
            overriddenValues.conditions_applicable = preview.overridden.applicable;
            overriddenValues.conditions_pass_rate = preview.overridden.passRate;
            overriddenValues.incentive_amount = preview.overridden.incentive;

            // 1. Create allowance document
            var allowanceData = {
                employeeNo: empNo,
                employeeName: emp.full_name || emp.name || '',
                type: emp.type || '',
                position: emp.position || '',
                building: emp.building || '',
                conditions: selectedConditions,
                reasonCode: reasonCode,
                reasonDetail: reasonDetail,
                originalValues: originalValues,
                overriddenValues: overriddenValues,
                status: 'APPLIED',
                appliedAt: firebase.firestore.FieldValue.serverTimestamp(),
                appliedBy: { uid: user.uid, email: user.email },
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                createdBy: { uid: user.uid, email: user.email },
                revokedAt: null,
                revokedBy: null,
                revokeReason: null
            };

            await db.collection('allowances').doc(monthYear).collection('items').add(allowanceData);

            // 2. Update employee data + recalculate summary (single read)
            this._updateProgress('Step 2/3: 직원 데이터 업데이트...');
            await this._updateEmployeeAndSummary(monthYear, empNo, selectedConditions, preview.overridden);

            this._updateProgress('Step 3/3: 완료 처리...');

            // Clear session cache for this month
            this._clearCache(monthYear);

            this._setLoading(false);
            alert(t('admin.allowances.applied'));

            // Refresh the view
            this.searchEmployee();
            this.loadActiveAllowances();

        } catch (error) {
            console.error('[AdminAllowances] applyAllowance error:', error);
            this._setLoading(false);
            alert('Error: ' + error.message);
        }
    },

    // ---------------------------------------------------------------
    // Update Employee Data + Summary in single flow (avoid double read)
    // ---------------------------------------------------------------

    _updateEmployeeAndSummary: async function (monthYear, empNo, selectedConditions, overriddenValues) {
        var db = this._db();
        var docRef = db.collection('employees').doc(monthYear).collection('all_data').doc('data');
        var doc = await docRef.get();
        if (!doc.exists) throw new Error('Employee data not found for ' + monthYear);

        var data = doc.data();
        var employees = data.employees || [];
        var updated = false;

        for (var i = 0; i < employees.length; i++) {
            var e = employees[i];
            var eNo = String(e.emp_no || e['Employee No'] || '');
            if (eNo === empNo) {
                if (!e.conditions) e.conditions = {};
                for (var j = 0; j < selectedConditions.length; j++) {
                    e.conditions[selectedConditions[j]] = 'YES';
                }
                e.conditions_passed = overriddenValues.passed;
                e.conditions_pass_rate = overriddenValues.passRate;
                e.current_incentive = overriddenValues.incentive;
                e.currentIncentive = overriddenValues.incentive;
                e.hasReceivedIncentive = overriddenValues.incentive > 0;
                e.allowance_applied = true;
                e.allowance_conditions = selectedConditions;
                updated = true;
                break;
            }
        }

        if (updated) {
            data.employees = employees;
            data.meta.updated_at = new Date().toISOString();
            await docRef.set(data);
        }

        // Recalculate summary using the same employee data (no second read)
        this._updateProgress('Step 2/3: 대시보드 요약 재계산...');
        var sumDoc = await db.collection('dashboard_summary').doc(monthYear).get();
        if (sumDoc.exists) {
            var summary = sumDoc.data();
            var totalEmployees = employees.length;
            var receivingEmployees = 0;
            var totalIncentive = 0;
            for (var k = 0; k < employees.length; k++) {
                var inc = parseFloat(employees[k].current_incentive || employees[k].currentIncentive || 0);
                if (inc > 0) { receivingEmployees++; totalIncentive += inc; }
            }
            summary.receiving_employees = receivingEmployees;
            summary.total_incentive = totalIncentive;
            summary.payment_rate = totalEmployees > 0 ? (receivingEmployees / totalEmployees * 100) : 0;
            summary.data_updated_at = new Date().toISOString();
            await db.collection('dashboard_summary').doc(monthYear).set(summary, { merge: true });
        }
    },

    // ---------------------------------------------------------------
    // Revoke Allowance
    // ---------------------------------------------------------------

    revokeAllowance: async function (docId) {
        var t = this._t;
        var revokeReason = prompt(t('admin.allowances.revokeReason'));
        if (revokeReason === null) return; // cancelled

        if (!confirm(t('admin.allowances.confirmRevoke'))) return;

        this._setLoading(true, 'Allowance 철회 중...');

        try {
            var db = this._db();
            var user = this._currentUser();
            var monthYear = this._getMonthYear();

            // 1. Get the allowance record
            this._updateProgress('Step 1/3: Allowance 문서 조회...');
            var allowanceRef = db.collection('allowances').doc(monthYear).collection('items').doc(docId);
            var allowanceDoc = await allowanceRef.get();
            if (!allowanceDoc.exists) { this._setLoading(false); return; }

            var allowanceData = allowanceDoc.data();

            // 2. Restore employee data + recalculate summary (single read)
            this._updateProgress('Step 2/3: 직원 데이터 복원...');
            await this._restoreEmployeeAndSummary(monthYear, allowanceData);

            // 3. Update allowance status
            this._updateProgress('Step 3/3: 상태 업데이트...');
            await allowanceRef.update({
                status: 'REVOKED',
                revokedAt: firebase.firestore.FieldValue.serverTimestamp(),
                revokedBy: { uid: user.uid, email: user.email },
                revokeReason: revokeReason || ''
            });

            // Clear session cache
            this._clearCache(monthYear);

            this._setLoading(false);
            alert(t('admin.allowances.revoked'));

            // Refresh
            this.loadActiveAllowances();
            if (this._currentEmployee) {
                this.searchEmployee();
            }

        } catch (error) {
            console.error('[AdminAllowances] revokeAllowance error:', error);
            this._setLoading(false);
            alert('Error: ' + error.message);
        }
    },

    _restoreEmployeeAndSummary: async function (monthYear, allowanceData) {
        var db = this._db();
        var docRef = db.collection('employees').doc(monthYear).collection('all_data').doc('data');
        var doc = await docRef.get();
        if (!doc.exists) return;

        var data = doc.data();
        var employees = data.employees || [];
        var empNo = allowanceData.employeeNo;
        var original = allowanceData.originalValues || {};

        for (var i = 0; i < employees.length; i++) {
            var e = employees[i];
            var eNo = String(e.emp_no || e['Employee No'] || '');
            if (eNo === empNo) {
                if (!e.conditions) e.conditions = {};
                var conditions = allowanceData.conditions || [];
                for (var j = 0; j < conditions.length; j++) {
                    var cKey = conditions[j];
                    e.conditions[cKey] = original[cKey] || 'NO';
                }
                e.conditions_passed = original.conditions_passed || 0;
                e.conditions_pass_rate = original.conditions_pass_rate || 0;
                e.current_incentive = original.incentive_amount || 0;
                e.currentIncentive = original.incentive_amount || 0;
                e.hasReceivedIncentive = (original.incentive_amount || 0) > 0;
                delete e.allowance_applied;
                delete e.allowance_conditions;
                break;
            }
        }

        data.employees = employees;
        data.meta.updated_at = new Date().toISOString();
        await docRef.set(data);

        // Recalculate summary using the same employee data
        this._updateProgress('Step 2/3: 대시보드 요약 재계산...');
        var sumDoc = await db.collection('dashboard_summary').doc(monthYear).get();
        if (sumDoc.exists) {
            var summary = sumDoc.data();
            var totalEmployees = employees.length;
            var receivingEmployees = 0;
            var totalIncentive = 0;
            for (var k = 0; k < employees.length; k++) {
                var inc = parseFloat(employees[k].current_incentive || employees[k].currentIncentive || 0);
                if (inc > 0) { receivingEmployees++; totalIncentive += inc; }
            }
            summary.receiving_employees = receivingEmployees;
            summary.total_incentive = totalIncentive;
            summary.payment_rate = totalEmployees > 0 ? (receivingEmployees / totalEmployees * 100) : 0;
            summary.data_updated_at = new Date().toISOString();
            await db.collection('dashboard_summary').doc(monthYear).set(summary, { merge: true });
        }
    },

    // ---------------------------------------------------------------
    // Active Allowances List
    // ---------------------------------------------------------------

    loadActiveAllowances: async function () {
        var t = this._t;
        var esc = this._escapeHtml.bind(this);
        var monthYear = this._getMonthYear();
        var listEl = document.getElementById('allowance-active-list');

        try {
            var db = this._db();
            var snapshot = await db.collection('allowances').doc(monthYear).collection('items')
                .orderBy('createdAt', 'desc')
                .get();

            if (snapshot.empty) {
                listEl.innerHTML = '<p class="text-muted">' + t('admin.allowances.noActive') + '</p>';
                return;
            }

            var html = '<table class="table table-sm table-bordered">';
            html += '<thead><tr>';
            html += '<th>Employee</th><th>Conditions</th><th>Reason</th><th>Status</th><th>Applied By</th><th>Actions</th>';
            html += '</tr></thead><tbody>';

            snapshot.forEach(function (doc) {
                var d = doc.data();
                var statusBadge = '';
                if (d.status === 'APPLIED') {
                    statusBadge = '<span class="badge bg-success">APPLIED</span>';
                } else if (d.status === 'REVOKED') {
                    statusBadge = '<span class="badge bg-secondary">REVOKED</span>';
                } else {
                    statusBadge = '<span class="badge bg-warning">PENDING</span>';
                }

                var condStr = (d.conditions || []).map(function (c) { return c.toUpperCase(); }).join(', ');
                var reasonCodeLabel = t('allowance.reason.' + d.reasonCode) || d.reasonCode;
                var appliedBy = d.appliedBy ? esc(d.appliedBy.email) : '--';
                var appliedAt = d.appliedAt ? new Date(d.appliedAt.seconds * 1000).toLocaleString() : '--';

                html += '<tr>';
                html += '<td><strong>' + esc(d.employeeName) + '</strong><br><small class="text-muted">' + esc(d.employeeNo) + ' | ' + esc(d.position) + '</small></td>';
                html += '<td>' + esc(condStr) + '</td>';
                html += '<td><span class="badge bg-info">' + esc(reasonCodeLabel) + '</span><br><small>' + esc(d.reasonDetail || '') + '</small></td>';
                html += '<td>' + statusBadge + '<br><small>' + appliedAt + '</small></td>';
                html += '<td><small>' + appliedBy + '</small></td>';
                html += '<td>';
                if (d.status === 'APPLIED') {
                    html += '<button class="btn btn-sm btn-outline-danger" onclick="AdminAllowances.revokeAllowance(\'' + esc(doc.id) + '\')">';
                    html += '<i class="fa-solid fa-xmark me-1"></i>' + t('admin.allowances.revoke');
                    html += '</button>';
                }
                if (d.status === 'REVOKED' && d.revokeReason) {
                    html += '<small class="text-muted d-block mt-1">Revoked: ' + esc(d.revokeReason) + '</small>';
                }
                html += '</td>';
                html += '</tr>';
            });

            html += '</tbody></table>';
            listEl.innerHTML = html;

        } catch (error) {
            console.error('[AdminAllowances] loadActiveAllowances error:', error);
            listEl.innerHTML = '<div class="alert alert-danger">Error loading allowances: ' + esc(error.message) + '</div>';
        }
    },

    // ---------------------------------------------------------------
    // Cache Management
    // ---------------------------------------------------------------

    _clearCache: function (monthYear) {
        var parts = monthYear.split('_');
        if (parts.length === 2) {
            var keys = ['qip_employees_' + parts[0] + '_' + parts[1],
                        'qip_summary_' + parts[0] + '_' + parts[1]];
            keys.forEach(function (k) {
                try { sessionStorage.removeItem(k); } catch (e) { /* ignore */ }
            });
        }
    },

    // ---------------------------------------------------------------
    // Formatting
    // ---------------------------------------------------------------

    _formatVND: function (amount) {
        amount = parseFloat(amount) || 0;
        if (amount === 0) return '<span style="color:#9e9e9e;">0 VND</span>';
        return '<span style="color:#2e7d32; font-weight:600;">' + amount.toLocaleString('vi-VN') + ' VND</span>';
    }
};

// Bind month/year change to reload active allowances
document.addEventListener('DOMContentLoaded', function () {
    var monthEl = document.getElementById('allowance-month');
    var yearEl = document.getElementById('allowance-year');
    if (monthEl) {
        monthEl.addEventListener('change', function () {
            AdminAllowances.loadActiveAllowances();
        });
    }
    if (yearEl) {
        yearEl.addEventListener('change', function () {
            AdminAllowances.loadActiveAllowances();
        });
    }
});

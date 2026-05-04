/**
 * Admin AQL Allowances Module
 * HWK QIP Incentive Dashboard V10
 *
 * PO 기반 예외 승인:
 *   - 관리자가 AQL Reject된 PO 번호(복수)를 등록
 *   - Cloud Function `computeAqlPoImpact` 호출하여 영향 직원 자동 산출
 *   - Apply 시 영향 직원의 c5~c8 override + 인센티브 재계산
 *
 * Firestore:
 *   - aql_reject_pos/{monthYear}/items/{docId}
 *   - employees/{monthYear}/all_data/data (read + update)
 *   - dashboard_summary/{monthYear} (recalc)
 *
 * Depends on: firebase-config.js, auth.js, dashboard-i18n.js, admin.js,
 *             firebase-functions-compat.js
 */

var AdminAqlAllowances = {

    _previewResult: null,    // 마지막 Cloud Function 응답
    _attachments: [],        // base64 첨부 배열
    _poNumbers: [],          // 입력된 PO 번호 배열
    _functions: null,        // firebase.functions() instance

    // ─── Helpers ──────────────────────────────────────────────────

    _t: function (key) {
        if (typeof DashboardI18n !== 'undefined') return DashboardI18n.t(key);
        return key;
    },

    _escapeHtml: function (str) {
        if (str === null || str === undefined) return '';
        var div = document.createElement('div');
        div.appendChild(document.createTextNode(String(str)));
        return div.innerHTML;
    },

    _getMonthYear: function () {
        var month = document.getElementById('aql-allowance-month').value;
        var year = document.getElementById('aql-allowance-year').value;
        return month + '_' + year;
    },

    _db: function () {
        return firebase.firestore();
    },

    _getFunctions: function () {
        if (!this._functions) {
            this._functions = firebase.app().functions('asia-northeast3');
        }
        return this._functions;
    },

    _currentUser: function () {
        return firebase.auth().currentUser;
    },

    _formatVND: function (amount) {
        amount = parseFloat(amount) || 0;
        if (amount === 0) return '<span style="color:#9e9e9e;">0 VND</span>';
        return '<span style="color:#2e7d32; font-weight:600;">' + amount.toLocaleString('vi-VN') + ' VND</span>';
    },

    // ─── Initialization ──────────────────────────────────────────

    init: function () {
        var self = this;

        // 현재 월 default 세팅
        var d = new Date();
        var months = ['january', 'february', 'march', 'april', 'may', 'june',
                      'july', 'august', 'september', 'october', 'november', 'december'];
        var monthEl = document.getElementById('aql-allowance-month');
        var yearEl = document.getElementById('aql-allowance-year');
        if (monthEl && months[d.getMonth()]) monthEl.value = months[d.getMonth()];
        if (yearEl) yearEl.value = String(d.getFullYear());

        // PO 입력 처리: Enter로 태그 추가
        var poInput = document.getElementById('aql-po-input');
        if (poInput) {
            poInput.addEventListener('keydown', function (e) {
                if (e.key === 'Enter' || e.key === ',' || e.key === ' ') {
                    e.preventDefault();
                    var v = poInput.value.trim().replace(/,$/, '');
                    if (v) {
                        self._addPoTag(v);
                        poInput.value = '';
                    }
                } else if (e.key === 'Backspace' && !poInput.value && self._poNumbers.length > 0) {
                    // 빈 입력에서 backspace → 마지막 태그 제거
                    self._removePoTag(self._poNumbers[self._poNumbers.length - 1]);
                }
            });
            poInput.addEventListener('paste', function (e) {
                e.preventDefault();
                var text = (e.clipboardData || window.clipboardData).getData('text');
                if (!text) return;
                var parts = text.split(/[\s,;\n\t]+/).filter(function (p) { return p.trim(); });
                parts.forEach(function (p) { self._addPoTag(p.trim()); });
            });
        }

        // 첨부 파일 처리
        var attachInput = document.getElementById('aql-attachments');
        if (attachInput) {
            attachInput.addEventListener('change', function (e) {
                self._handleAttachments(e.target.files);
            });
        }

        // Month/year 변경 시 active list 재로드
        if (monthEl) monthEl.addEventListener('change', function () { self.loadActiveList(); });
        if (yearEl) yearEl.addEventListener('change', function () { self.loadActiveList(); });

        this.loadActiveList();
    },

    // ─── PO Tag UI ────────────────────────────────────────────────

    _addPoTag: function (po) {
        po = String(po).trim();
        if (!po) return;
        if (this._poNumbers.indexOf(po) !== -1) return; // 중복 방지
        this._poNumbers.push(po);
        this._renderPoTags();
    },

    _removePoTag: function (po) {
        var idx = this._poNumbers.indexOf(po);
        if (idx !== -1) {
            this._poNumbers.splice(idx, 1);
            this._renderPoTags();
        }
    },

    _renderPoTags: function () {
        var self = this;
        var container = document.getElementById('aql-po-tags');
        if (!container) return;

        // Remove existing tags but keep input
        var input = document.getElementById('aql-po-input');
        var tags = container.querySelectorAll('.aql-po-tag');
        tags.forEach(function (t) { t.remove(); });

        // Insert tags before input
        this._poNumbers.forEach(function (po) {
            var tag = document.createElement('span');
            tag.className = 'aql-po-tag badge';
            tag.style.cssText = 'background:#3b82f6; color:#fff; padding:6px 10px; border-radius:6px; display:inline-flex; align-items:center; gap:6px; font-size:0.85rem;';
            tag.innerHTML = self._escapeHtml(po) +
                ' <span style="cursor:pointer; opacity:0.8;" onclick="AdminAqlAllowances._removePoTag(\'' + self._escapeHtml(po) + '\')">×</span>';
            container.insertBefore(tag, input);
        });
    },

    // ─── Attachments ──────────────────────────────────────────────

    _handleAttachments: function (files) {
        var self = this;
        if (!files || files.length === 0) return;
        if (files.length > 3) {
            alert(self._t('admin.aqlAllowances.attachmentMaxLimit'));
            document.getElementById('aql-attachments').value = '';
            return;
        }

        self._attachments = [];
        var preview = document.getElementById('aql-attachment-preview');
        if (preview) preview.innerHTML = '';

        Array.prototype.forEach.call(files, function (file) {
            if (file.size > 1024 * 1024 * 2) { // 2MB 제한
                alert(file.name + ': ' + self._t('admin.aqlAllowances.attachmentSizeExceeded'));
                return;
            }
            var reader = new FileReader();
            reader.onload = function (e) {
                self._attachments.push({
                    name: file.name,
                    type: file.type,
                    size: file.size,
                    base64: e.target.result,
                });
                if (preview) {
                    var item = document.createElement('div');
                    item.style.cssText = 'display:inline-block; margin:4px 8px 4px 0; padding:4px 8px; background:#f1f3f5; border-radius:4px; font-size:0.85rem;';
                    item.innerHTML = '<i class="fa-solid fa-paperclip me-1"></i>' + self._escapeHtml(file.name) + ' (' + (file.size / 1024).toFixed(0) + ' KB)';
                    preview.appendChild(item);
                }
            };
            reader.readAsDataURL(file);
        });
    },

    // ─── Form Validation ─────────────────────────────────────────

    _validateForm: function () {
        var t = this._t.bind(this);
        if (!this._poNumbers || this._poNumbers.length === 0) {
            alert(t('admin.aqlAllowances.noPoEntered')); return false;
        }
        var rootCause = (document.getElementById('aql-root-cause').value || '').trim();
        if (!rootCause) { alert(t('admin.aqlAllowances.rootCauseRequired')); return false; }
        var actionPlan = (document.getElementById('aql-action-plan').value || '').trim();
        if (!actionPlan) { alert(t('admin.aqlAllowances.actionPlanRequired')); return false; }
        var dueDate = document.getElementById('aql-action-due-date').value;
        if (!dueDate) { alert(t('admin.aqlAllowances.actionDueDateRequired')); return false; }
        var exemptConds = this._getExemptConditions();
        if (exemptConds.length === 0) { alert(t('admin.aqlAllowances.noConditionSelected')); return false; }
        return true;
    },

    _getExemptConditions: function () {
        var conds = [];
        ['c5', 'c6', 'c7', 'c8'].forEach(function (k) {
            var cb = document.getElementById('aql-exempt-' + k);
            if (cb && cb.checked) conds.push(k);
        });
        return conds;
    },

    // ─── Cloud Function: computeImpact ──────────────────────────

    computeImpact: async function () {
        var self = this;
        var t = this._t.bind(this);

        if (!this._validateForm()) return;

        var btn = document.getElementById('aql-btn-preview');
        var applyBtn = document.getElementById('aql-btn-apply');
        var resultEl = document.getElementById('aql-preview-result');

        if (btn) {
            btn.disabled = true;
            btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin me-1"></i> ' + t('admin.aqlAllowances.computing');
        }
        if (applyBtn) applyBtn.disabled = true;
        if (resultEl) resultEl.innerHTML = '<div class="alert alert-info"><i class="fa-solid fa-spinner fa-spin me-1"></i> ' + t('admin.aqlAllowances.computing') + '</div>';

        try {
            var functions = this._getFunctions();
            var callable = functions.httpsCallable('computeAqlPoImpact');
            var response = await callable({
                monthYear: this._getMonthYear(),
                poNumbers: this._poNumbers,
                exemptConditions: this._getExemptConditions(),
            });

            var result = response.data;
            this._previewResult = result;

            this._renderPreview(result);

            if (applyBtn && result.autoComputed && result.autoComputed.affectedEmployees && result.autoComputed.affectedEmployees.length > 0) {
                applyBtn.disabled = false;
            }

        } catch (err) {
            console.error('[AdminAqlAllowances] computeImpact error:', err);
            this._previewResult = null;
            var msg = (err && err.message) || 'Compute failed';
            if (resultEl) {
                resultEl.innerHTML = '<div class="alert alert-danger"><i class="fa-solid fa-circle-exclamation me-1"></i> ' + this._escapeHtml(msg) + '</div>';
            }
        } finally {
            if (btn) {
                btn.disabled = false;
                btn.innerHTML = '<i class="fa-solid fa-eye me-1"></i> ' + t('admin.aqlAllowances.computeImpact');
            }
        }
    },

    // ─── Render Preview ──────────────────────────────────────────

    _renderPreview: function (result) {
        var self = this;
        var t = this._t.bind(this);
        var esc = this._escapeHtml.bind(this);
        var resultEl = document.getElementById('aql-preview-result');
        if (!resultEl) return;

        if (!result || !result.autoComputed) {
            resultEl.innerHTML = '<div class="alert alert-warning">' + t('admin.aqlAllowances.noResultReturned') + '</div>';
            return;
        }

        var ac = result.autoComputed;

        if (ac.matchedRowCount === 0) {
            resultEl.innerHTML = '<div class="alert alert-warning"><i class="fa-solid fa-triangle-exclamation me-1"></i> ' + t('admin.aqlAllowances.noPoMatch') + '</div>';
            return;
        }

        var html = '<div class="card" style="border-left: 4px solid #2e7d32;">';
        html += '<div class="card-body">';

        // Summary
        html += '<h6><i class="fa-solid fa-magnifying-glass-chart me-1"></i> ' + t('admin.aqlAllowances.summary') + '</h6>';
        html += '<div class="row text-center mb-3">';
        html += '<div class="col"><div class="text-muted small">' + t('admin.aqlAllowances.matchedRows') + '</div><div style="font-size: 1.2rem; font-weight: 700;">' + ac.matchedRowCount + '</div></div>';
        html += '<div class="col"><div class="text-muted small">' + t('admin.aqlAllowances.matchedFails') + '</div><div style="font-size: 1.2rem; font-weight: 700; color: #c62828;">' + (ac.matchedFailCount || 0) + '</div></div>';
        html += '<div class="col"><div class="text-muted small">' + t('admin.aqlAllowances.totalRejectQty') + '</div><div style="font-size: 1.2rem; font-weight: 700;">' + (ac.totalRejectQty || 0).toLocaleString() + '</div></div>';
        html += '<div class="col"><div class="text-muted small">' + t('admin.aqlAllowances.affectedCount') + '</div><div style="font-size: 1.2rem; font-weight: 700; color: #2e7d32;">' + (ac.affectedEmployees || []).length + '</div></div>';
        html += '</div>';

        // Models, Buildings, Lines
        if (ac.models && ac.models.length > 0) {
            html += '<div class="mb-2"><strong>' + t('admin.aqlAllowances.modelsLabel') + ':</strong> ' + ac.models.slice(0, 5).map(esc).join(', ');
            if (ac.models.length > 5) html += ' <span class="text-muted">… +' + (ac.models.length - 5) + '</span>';
            html += '</div>';
        }
        if (ac.buildings && ac.buildings.length > 0) {
            html += '<div class="mb-2"><strong>' + t('admin.aqlAllowances.buildingsLabel') + ':</strong> ' + ac.buildings.map(esc).join(', ') + '</div>';
        }
        if (ac.lines && ac.lines.length > 0) {
            html += '<div class="mb-2"><strong>' + t('admin.aqlAllowances.linesLabel') + ':</strong> ' + ac.lines.slice(0, 8).map(esc).join(', ');
            if (ac.lines.length > 8) html += ' <span class="text-muted">… +' + (ac.lines.length - 8) + '</span>';
            html += '</div>';
        }

        // Affected employees table
        var affected = ac.affectedEmployees || [];
        if (affected.length === 0) {
            html += '<div class="alert alert-info mt-3 mb-0">' + t('admin.aqlAllowances.noAffected') + '</div>';
        } else {
            html += '<hr><h6 class="mt-3"><i class="fa-solid fa-users me-1"></i> ' + t('admin.aqlAllowances.affectedTitle') + ' (' + affected.length + ')</h6>';
            html += '<div style="max-height: 360px; overflow-y: auto;">';
            html += '<table class="table table-sm table-bordered" style="font-size: 0.85rem;">';
            html += '<thead style="position: sticky; top: 0; background: #f8f9fa; z-index: 1;"><tr>';
            html += '<th>' + t('admin.aqlAllowances.colEmpNo') + '</th>';
            html += '<th>' + t('admin.aqlAllowances.colName') + '</th>';
            html += '<th>' + t('admin.aqlAllowances.colPosition') + '</th>';
            html += '<th class="text-center" colspan="2">' + t('admin.aqlAllowances.colPassRate') + '</th>';
            html += '<th class="text-center" colspan="2">' + t('admin.aqlAllowances.colIncentive') + '</th>';
            html += '</tr><tr style="background: #fafafa;">';
            html += '<th></th><th></th><th></th>';
            html += '<th class="text-center small text-muted">' + t('admin.aqlAllowances.colBefore') + '</th>';
            html += '<th class="text-center small text-muted">' + t('admin.aqlAllowances.colAfter') + '</th>';
            html += '<th class="text-center small text-muted">' + t('admin.aqlAllowances.colBefore') + '</th>';
            html += '<th class="text-center small text-muted">' + t('admin.aqlAllowances.colAfter') + '</th>';
            html += '</tr></thead><tbody>';
            affected.forEach(function (e) {
                var afterColor = e.overriddenPassRate >= 100 ? '#2e7d32' : '#c62828';
                html += '<tr>';
                html += '<td>' + esc(e.empNo) + '</td>';
                html += '<td>' + esc(e.name) + '</td>';
                html += '<td><small>' + esc(e.position) + '</small></td>';
                html += '<td class="text-center">' + e.originalPassRate.toFixed(1) + '%</td>';
                html += '<td class="text-center" style="font-weight:700; color:' + afterColor + ';">' + e.overriddenPassRate.toFixed(1) + '%</td>';
                html += '<td class="text-end">' + self._formatVND(e.originalIncentive) + '</td>';
                html += '<td class="text-end" style="font-weight:700;">' + self._formatVND(e.overriddenIncentive) + '</td>';
                html += '</tr>';
            });
            html += '</tbody></table></div>';
        }

        html += '</div></div>';
        resultEl.innerHTML = html;
    },

    // ─── Apply ───────────────────────────────────────────────────

    applyAllowance: async function () {
        var t = this._t.bind(this);
        if (!this._previewResult || !this._previewResult.autoComputed) {
            alert(t('admin.aqlAllowances.previewRequired')); return;
        }

        var affected = this._previewResult.autoComputed.affectedEmployees || [];
        if (affected.length === 0) {
            alert(t('admin.aqlAllowances.noAffected')); return;
        }

        if (!confirm(t('admin.aqlAllowances.confirmApply'))) return;

        var btn = document.getElementById('aql-btn-apply');
        if (btn) {
            btn.disabled = true;
            btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin me-1"></i> ' + t('admin.aqlAllowances.applying');
        }

        try {
            var db = this._db();
            var user = this._currentUser();
            var monthYear = this._getMonthYear();

            // 1. Build allowance document
            var rootCause = document.getElementById('aql-root-cause').value.trim();
            var actionPlan = document.getElementById('aql-action-plan').value.trim();
            var actionDueDate = document.getElementById('aql-action-due-date').value;
            var exemptConditions = this._getExemptConditions();

            var allowanceData = {
                poNumbers: this._poNumbers.slice(),
                rootCause: rootCause,
                actionPlan: actionPlan,
                actionDueDate: actionDueDate,
                actionStatus: 'PLANNED',
                attachments: this._attachments.slice(),
                exemptConditions: exemptConditions,
                autoComputed: this._previewResult.autoComputed,
                meta: this._previewResult.meta || {},
                status: 'APPLIED',
                appliedAt: firebase.firestore.FieldValue.serverTimestamp(),
                appliedBy: { uid: user.uid, email: user.email },
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                createdBy: { uid: user.uid, email: user.email },
                revokedAt: null,
                revokedBy: null,
                revokeReason: null,
            };

            var allowanceRef = await db.collection('aql_reject_pos').doc(monthYear).collection('items').add(allowanceData);

            // 2. Update employees + summary in single transaction-like flow
            await this._applyToEmployees(monthYear, affected, exemptConditions, allowanceRef.id);

            // 3. Clear cache
            this._clearCache(monthYear);

            // 4. Reset form
            this._resetForm();

            alert(t('admin.aqlAllowances.applied'));

            // 5. Refresh active list
            this.loadActiveList();

        } catch (err) {
            console.error('[AdminAqlAllowances] applyAllowance error:', err);
            alert((t('admin.aqlAllowances.applyError') || 'Apply failed') + ': ' + err.message);
        } finally {
            if (btn) {
                btn.disabled = false;
                btn.innerHTML = '<i class="fa-solid fa-check me-1"></i> ' + t('admin.aqlAllowances.apply');
            }
        }
    },

    _applyToEmployees: async function (monthYear, affected, exemptConditions, allowanceDocId) {
        var db = this._db();
        var docRef = db.collection('employees').doc(monthYear).collection('all_data').doc('data');
        var doc = await docRef.get();
        if (!doc.exists) throw new Error('Employee data not found for ' + monthYear);

        var data = doc.data();
        var employees = data.employees || [];
        var empMap = {};
        for (var i = 0; i < employees.length; i++) {
            var e = employees[i];
            var en = String(e.emp_no || e['Employee No'] || '');
            if (en) empMap[en] = i;
        }

        affected.forEach(function (entry) {
            var en = String(entry.empNo || '');
            if (!(en in empMap)) return;
            var emp = employees[empMap[en]];
            if (!emp.conditions) emp.conditions = {};
            // 영향받은 조건만 YES 처리
            exemptConditions.forEach(function (k) {
                if (entry.overriddenConditions && entry.overriddenConditions[k] === 'YES') {
                    emp.conditions[k] = 'YES';
                }
            });
            emp.conditions_passed = entry.overriddenPassed;
            emp.conditions_pass_rate = entry.overriddenPassRate;
            emp.current_incentive = entry.overriddenIncentive;
            emp.currentIncentive = entry.overriddenIncentive;
            emp.hasReceivedIncentive = entry.overriddenIncentive > 0;
            emp.aql_po_exempt = true;
            var refs = emp.aql_po_refs || [];
            if (refs.indexOf(allowanceDocId) === -1) refs.push(allowanceDocId);
            emp.aql_po_refs = refs;
            var existing = emp.aql_exempt_conditions || [];
            exemptConditions.forEach(function (k) { if (existing.indexOf(k) === -1) existing.push(k); });
            emp.aql_exempt_conditions = existing;
        });

        data.employees = employees;
        data.meta.updated_at = new Date().toISOString();
        await docRef.set(data);

        // Recalculate summary
        var sumRef = db.collection('dashboard_summary').doc(monthYear);
        var sumDoc = await sumRef.get();
        if (sumDoc.exists) {
            var summary = sumDoc.data();
            var receiving = 0;
            var totalInc = 0;
            employees.forEach(function (e) {
                var inc = parseFloat(e.current_incentive || e.currentIncentive || 0);
                if (inc > 0) { receiving++; totalInc += inc; }
            });
            summary.receiving_employees = receiving;
            summary.total_incentive = totalInc;
            summary.payment_rate = employees.length > 0 ? (receiving / employees.length * 100) : 0;
            summary.data_updated_at = new Date().toISOString();
            await sumRef.set(summary, { merge: true });
        }
    },

    // ─── Revoke ──────────────────────────────────────────────────

    revoke: async function (docId) {
        var t = this._t.bind(this);
        var revokeReason = prompt(t('admin.aqlAllowances.revokeReason'));
        if (revokeReason === null) return; // cancelled

        if (!confirm(t('admin.aqlAllowances.confirmRevoke'))) return;

        try {
            var db = this._db();
            var user = this._currentUser();
            var monthYear = this._getMonthYear();

            var allowanceRef = db.collection('aql_reject_pos').doc(monthYear).collection('items').doc(docId);
            var allowanceDoc = await allowanceRef.get();
            if (!allowanceDoc.exists) { alert(t('admin.aqlAllowances.allowanceNotFound')); return; }

            var data = allowanceDoc.data();
            var affected = (data.autoComputed && data.autoComputed.affectedEmployees) || [];

            // 1. Restore employees (originalConditions, originalIncentive)
            await this._restoreEmployees(monthYear, affected, data.exemptConditions || [], docId);

            // 2. Update allowance status
            await allowanceRef.update({
                status: 'REVOKED',
                revokedAt: firebase.firestore.FieldValue.serverTimestamp(),
                revokedBy: { uid: user.uid, email: user.email },
                revokeReason: revokeReason || '',
            });

            this._clearCache(monthYear);

            alert(t('admin.aqlAllowances.revoked'));
            this.loadActiveList();

        } catch (err) {
            console.error('[AdminAqlAllowances] revoke error:', err);
            alert(t('admin.aqlAllowances.revokeError') + ': ' + err.message);
        }
    },

    _restoreEmployees: async function (monthYear, affected, exemptConditions, allowanceDocId) {
        var db = this._db();
        var docRef = db.collection('employees').doc(monthYear).collection('all_data').doc('data');
        var doc = await docRef.get();
        if (!doc.exists) return;

        var data = doc.data();
        var employees = data.employees || [];
        var empMap = {};
        for (var i = 0; i < employees.length; i++) {
            var e = employees[i];
            var en = String(e.emp_no || e['Employee No'] || '');
            if (en) empMap[en] = i;
        }

        affected.forEach(function (entry) {
            var en = String(entry.empNo || '');
            if (!(en in empMap)) return;
            var emp = employees[empMap[en]];
            if (!emp.conditions) emp.conditions = {};

            // 원래 값으로 복원
            exemptConditions.forEach(function (k) {
                if (entry.originalConditions && entry.originalConditions[k]) {
                    emp.conditions[k] = entry.originalConditions[k];
                }
            });
            emp.conditions_passed = entry.originalPassed;
            emp.conditions_pass_rate = entry.originalPassRate;
            emp.current_incentive = entry.originalIncentive;
            emp.currentIncentive = entry.originalIncentive;
            emp.hasReceivedIncentive = entry.originalIncentive > 0;

            // aql_po_refs에서 이 docId 제거
            var refs = (emp.aql_po_refs || []).filter(function (r) { return r !== allowanceDocId; });
            if (refs.length > 0) {
                emp.aql_po_refs = refs;
            } else {
                delete emp.aql_po_refs;
                delete emp.aql_po_exempt;
                delete emp.aql_exempt_conditions;
            }
        });

        data.employees = employees;
        data.meta.updated_at = new Date().toISOString();
        await docRef.set(data);

        // Recalc summary
        var sumRef = db.collection('dashboard_summary').doc(monthYear);
        var sumDoc = await sumRef.get();
        if (sumDoc.exists) {
            var summary = sumDoc.data();
            var receiving = 0;
            var totalInc = 0;
            employees.forEach(function (e) {
                var inc = parseFloat(e.current_incentive || e.currentIncentive || 0);
                if (inc > 0) { receiving++; totalInc += inc; }
            });
            summary.receiving_employees = receiving;
            summary.total_incentive = totalInc;
            summary.payment_rate = employees.length > 0 ? (receiving / employees.length * 100) : 0;
            summary.data_updated_at = new Date().toISOString();
            await sumRef.set(summary, { merge: true });
        }
    },

    // ─── Update Action Status ────────────────────────────────────

    updateActionStatus: async function (docId, newStatus) {
        var t = this._t.bind(this);
        try {
            var db = this._db();
            var monthYear = this._getMonthYear();
            await db.collection('aql_reject_pos').doc(monthYear).collection('items').doc(docId).update({
                actionStatus: newStatus,
                actionStatusUpdatedAt: firebase.firestore.FieldValue.serverTimestamp(),
            });
            this.loadActiveList();
        } catch (err) {
            console.error('[AdminAqlAllowances] updateActionStatus error:', err);
            alert(t('admin.aqlAllowances.actionStatusError') + ': ' + err.message);
        }
    },

    // ─── Active List ─────────────────────────────────────────────

    loadActiveList: async function () {
        var self = this;
        var t = this._t.bind(this);
        var esc = this._escapeHtml.bind(this);
        var monthYear = this._getMonthYear();
        var listEl = document.getElementById('aql-allowance-active-list');
        if (!listEl) return;

        try {
            var db = this._db();
            var snapshot = await db.collection('aql_reject_pos').doc(monthYear).collection('items')
                .orderBy('createdAt', 'desc')
                .get();

            if (snapshot.empty) {
                listEl.innerHTML = '<p class="text-muted">' + t('admin.aqlAllowances.noActive') + '</p>';
                return;
            }

            var html = '<div style="overflow-x: auto;"><table class="table table-sm table-bordered" style="font-size: 0.85rem;">';
            html += '<thead><tr>';
            html += '<th>' + t('admin.aqlAllowances.colPoNumbers') + '</th>';
            html += '<th>' + t('admin.aqlAllowances.colRootCause') + '</th>';
            html += '<th>' + t('admin.aqlAllowances.colActionPlan') + '</th>';
            html += '<th>' + t('admin.aqlAllowances.colDueDate') + '</th>';
            html += '<th>' + t('admin.aqlAllowances.colActionStatus') + '</th>';
            html += '<th>' + t('admin.aqlAllowances.colAffected') + '</th>';
            html += '<th>' + t('admin.aqlAllowances.colAppliedBy') + '</th>';
            html += '<th>' + t('admin.aqlAllowances.colActions') + '</th>';
            html += '</tr></thead><tbody>';

            snapshot.forEach(function (doc) {
                var d = doc.data();
                var poStr = (d.poNumbers || []).map(esc).join(', ');
                var affectedCount = ((d.autoComputed || {}).affectedEmployees || []).length;
                var appliedAt = d.appliedAt ? new Date(d.appliedAt.seconds * 1000).toLocaleString() : '--';
                var appliedBy = d.appliedBy ? esc(d.appliedBy.email) : '--';
                var statusBadge = '';
                if (d.status === 'APPLIED') statusBadge = '<span class="badge bg-success">APPLIED</span>';
                else if (d.status === 'REVOKED') statusBadge = '<span class="badge bg-secondary">REVOKED</span>';
                else statusBadge = '<span class="badge bg-warning">' + esc(d.status || 'PENDING') + '</span>';

                var actionStatusKey = d.actionStatus || 'PLANNED';
                var actionStatusBadge = '<span class="badge bg-info">' + esc(t('admin.aqlAllowances.actionStatus.' + actionStatusKey) || actionStatusKey) + '</span>';

                html += '<tr>';
                html += '<td><div style="max-width: 180px; word-break: break-word;">' + poStr + '</div></td>';
                html += '<td><div style="max-width: 200px; word-break: break-word;">' + esc(d.rootCause || '') + '</div></td>';
                html += '<td><div style="max-width: 220px; word-break: break-word;">' + esc(d.actionPlan || '') + '</div></td>';
                html += '<td>' + esc(d.actionDueDate || '--') + '</td>';
                html += '<td>' + statusBadge + '<br>' + actionStatusBadge + '<br><small class="text-muted">' + appliedAt + '</small></td>';
                html += '<td class="text-center"><strong>' + affectedCount + '</strong></td>';
                html += '<td><small>' + appliedBy + '</small></td>';
                html += '<td>';
                if (d.status === 'APPLIED') {
                    // Action status change dropdown
                    html += '<select class="form-select form-select-sm mb-1" style="font-size:0.75rem;" onchange="AdminAqlAllowances.updateActionStatus(\'' + esc(doc.id) + '\', this.value)">';
                    ['PLANNED', 'IN_PROGRESS', 'COMPLETED'].forEach(function (s) {
                        var sel = (s === actionStatusKey) ? ' selected' : '';
                        html += '<option value="' + s + '"' + sel + '>' + esc(t('admin.aqlAllowances.actionStatus.' + s) || s) + '</option>';
                    });
                    html += '</select>';
                    html += '<button class="btn btn-sm btn-outline-danger" onclick="AdminAqlAllowances.revoke(\'' + esc(doc.id) + '\')">';
                    html += '<i class="fa-solid fa-xmark me-1"></i>' + t('admin.aqlAllowances.revoke') + '</button>';
                }
                if (d.status === 'REVOKED' && d.revokeReason) {
                    html += '<small class="text-muted d-block mt-1">' + t('admin.aqlAllowances.revokeLabel') + ': ' + esc(d.revokeReason) + '</small>';
                }
                html += '</td>';
                html += '</tr>';
            });

            html += '</tbody></table></div>';
            listEl.innerHTML = html;
        } catch (err) {
            console.error('[AdminAqlAllowances] loadActiveList error:', err);
            listEl.innerHTML = '<div class="alert alert-danger">Error: ' + esc(err.message) + '</div>';
        }
    },

    // ─── Reset Form ──────────────────────────────────────────────

    _resetForm: function () {
        this._poNumbers = [];
        this._attachments = [];
        this._previewResult = null;
        this._renderPoTags();
        var fields = ['aql-po-input', 'aql-root-cause', 'aql-action-plan', 'aql-action-due-date', 'aql-attachments'];
        fields.forEach(function (id) {
            var el = document.getElementById(id);
            if (el) el.value = '';
        });
        var preview = document.getElementById('aql-preview-result');
        if (preview) preview.innerHTML = '';
        var attachPrev = document.getElementById('aql-attachment-preview');
        if (attachPrev) attachPrev.innerHTML = '';
        var applyBtn = document.getElementById('aql-btn-apply');
        if (applyBtn) applyBtn.disabled = true;
    },

    // ─── Cache Management ────────────────────────────────────────

    _clearCache: function (monthYear) {
        var parts = monthYear.split('_');
        if (parts.length !== 2) return;
        var keys = ['qip_employees_' + parts[0] + '_' + parts[1],
                    'qip_summary_' + parts[0] + '_' + parts[1],
                    'qip_aqlpos_' + parts[0] + '_' + parts[1]];
        keys.forEach(function (k) {
            try { sessionStorage.removeItem(k); } catch (e) { /* ignore */ }
        });
    },
};

/**
 * Admin Config Management Module
 * HWK QIP Incentive Dashboard V10
 *
 * Manages 3 CRUD config panels + 1 read-only data panel:
 *   1. TYPE-2 Position Mapping  (configs/type2_position_mapping)
 *   2. QIP Talent Pool          (configs/talent_pool)
 *   3. Auditor Area Mapping     (configs/auditor_area_mapping)
 *   4. Continuous Months         (configs/continuous_months) [read-only]
 *
 * Depends on: firebase-config.js, auth.js, dashboard-i18n.js, admin.js
 */

var AdminConfigs = {
    // In-memory state for each config
    positionData: null,
    talentPoolData: null,
    auditorData: null,
    continuousData: null,

    // Currently editing auditor ID (for condition modal)
    editingAuditorId: null,

    /**
     * Initialize config panels (called on Tab 2 first activation).
     */
    init: function() {
        this.loadPositionMapping();
        this.loadTalentPool();
        this.loadAuditorMapping();
    },

    // =====================================================================
    // Helper: Translate
    // =====================================================================
    _t: function(key) {
        return (typeof DashboardI18n !== 'undefined') ? DashboardI18n.t(key) : key;
    },

    _escapeHtml: function(str) {
        if (!str) return '';
        var div = document.createElement('div');
        div.appendChild(document.createTextNode(String(str)));
        return div.innerHTML;
    },

    _showMessage: function(elementId, message, type) {
        if (typeof AdminPage !== 'undefined') {
            AdminPage.showMessage(elementId, message, type);
        }
    },

    /**
     * Write audit log to threshold_history collection.
     */
    _writeAuditLog: async function(type, changes, monthYear) {
        try {
            await db.collection('threshold_history').add({
                timestamp: firebase.firestore.FieldValue.serverTimestamp(),
                changed_by: firebase.auth().currentUser.email,
                month_year: monthYear || 'config',
                changes: changes,
                type: type
            });
        } catch (e) {
            console.error('[AdminConfigs] Audit log failed:', e);
        }
    },

    // =====================================================================
    // 1. TYPE-2 Position Mapping
    // =====================================================================

    async loadPositionMapping() {
        var self = this;
        try {
            var doc = await db.collection('configs').doc('type2_position_mapping').get();
            if (doc.exists) {
                self.positionData = doc.data();
            } else {
                self.positionData = { position_mappings: {} };
            }
            self.renderPositionMapping();
        } catch (error) {
            console.error('[AdminConfigs] Failed to load position mapping:', error);
            document.getElementById('position-mapping-table').innerHTML =
                '<p class="text-danger"><i class="fa-solid fa-triangle-exclamation me-1"></i> ' + error.message + '</p>';
        }
    },

    renderPositionMapping: function() {
        var container = document.getElementById('position-mapping-table');
        var mappings = (this.positionData && this.positionData.position_mappings) ? this.positionData.position_mappings : {};
        var self = this;

        if (Object.keys(mappings).length === 0) {
            container.innerHTML = '<p class="text-muted text-center py-3">' + self._t('admin.cfgNoData') + '</p>';
            return;
        }

        var html = '<table class="table config-table"><thead><tr>' +
            '<th>' + self._t('admin.cfgPositionName') + '</th>' +
            '<th>' + self._t('admin.cfgMappedTo') + '</th>' +
            '<th>' + self._t('admin.cfgDescription') + '</th>' +
            '<th style="width:80px;"></th>' +
            '</tr></thead><tbody>';

        Object.keys(mappings).forEach(function(posName) {
            var val = mappings[posName];

            // QA TEAM has sub-mappings
            if (posName === 'QA TEAM' && typeof val === 'object' && !val.mapped_to) {
                Object.keys(val).forEach(function(subKey, idx) {
                    var sub = val[subKey];
                    html += '<tr>' +
                        '<td>' + (idx === 0 ? '<strong>QA TEAM</strong> → ' : '<span class="ms-3">→ ') + self._escapeHtml(subKey) + (idx === 0 ? '' : '</span>') + '</td>' +
                        '<td><code>' + self._escapeHtml(sub.mapped_to) + '</code></td>' +
                        '<td class="text-muted" style="font-size:0.78rem;">' + self._escapeHtml(sub.description || '') + '</td>' +
                        '<td></td></tr>';
                });
            } else {
                html += '<tr>' +
                    '<td><strong>' + self._escapeHtml(posName) + '</strong></td>' +
                    '<td><code>' + self._escapeHtml(val.mapped_to) + '</code></td>' +
                    '<td class="text-muted" style="font-size:0.78rem;">' + self._escapeHtml(val.description || '') + '</td>' +
                    '<td><button class="btn-delete-sm" onclick="AdminConfigs.removePositionMapping(\'' + self._escapeHtml(posName).replace(/'/g, "\\'") + '\')">' +
                    '<i class="fa-solid fa-trash-can"></i></button></td></tr>';
            }
        });

        html += '</tbody></table>';
        container.innerHTML = html;
    },

    addPositionMapping: function() {
        var nameInput = document.getElementById('cfg-pos-name');
        var mappedSelect = document.getElementById('cfg-pos-mapped');
        var name = nameInput.value.trim().toUpperCase();
        var mapped = mappedSelect.value;

        if (!name) {
            this._showMessage('position-mapping-message', 'Please enter a position name.', 'danger');
            return;
        }

        if (!this.positionData) this.positionData = { position_mappings: {} };
        this.positionData.position_mappings[name] = {
            mapped_to: mapped,
            description: name + ' → ' + mapped
        };

        nameInput.value = '';
        this.renderPositionMapping();
        this._showMessage('position-mapping-message', 'Added "' + name + '". Click Save to persist.', 'success');
    },

    removePositionMapping: function(name) {
        if (!confirm('Remove "' + name + '" from position mapping?')) return;
        if (this.positionData && this.positionData.position_mappings) {
            delete this.positionData.position_mappings[name];
        }
        this.renderPositionMapping();
        this._showMessage('position-mapping-message', 'Removed "' + name + '". Click Save to persist.', 'warning');
    },

    async savePositionMapping() {
        var self = this;
        var btn = document.getElementById('btn-save-position-mapping');
        btn.disabled = true;
        btn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status"></span> Saving...';

        try {
            var saveData = Object.assign({}, self.positionData);
            saveData._metadata = {
                updated_at: new Date().toISOString(),
                updated_by: firebase.auth().currentUser.email,
                version: firebase.firestore.FieldValue.increment(1)
            };

            await db.collection('configs').doc('type2_position_mapping').set(saveData);

            await self._writeAuditLog('position_mapping', [{
                field: 'TYPE-2 Position Mapping',
                field_key: 'position_mappings',
                old_value: null,
                new_value: 'Updated (' + Object.keys(saveData.position_mappings || {}).length + ' mappings)'
            }]);

            self._showMessage('position-mapping-message', 'Position mapping saved successfully.', 'success');
        } catch (error) {
            console.error('[AdminConfigs] Save position mapping failed:', error);
            self._showMessage('position-mapping-message', 'Save failed: ' + error.message, 'danger');
        } finally {
            btn.disabled = false;
            btn.innerHTML = '<i class="fa-solid fa-floppy-disk me-1"></i> <span data-i18n="admin.cfgSave">' + self._t('admin.cfgSave') + '</span>';
        }
    },

    // =====================================================================
    // 2. QIP Talent Pool
    // =====================================================================

    async loadTalentPool() {
        var self = this;
        try {
            var doc = await db.collection('configs').doc('talent_pool').get();
            if (doc.exists) {
                self.talentPoolData = doc.data();
            } else {
                self.talentPoolData = {
                    talent_pool: { members: [], settings: { auto_apply: true, stack_with_regular: true, require_conditions: false } }
                };
            }

            // Set toggle states
            var settings = (self.talentPoolData.talent_pool || {}).settings || {};
            var autoApply = document.getElementById('tp-auto-apply');
            var stackRegular = document.getElementById('tp-stack-regular');
            var requireCond = document.getElementById('tp-require-conditions');
            if (autoApply) autoApply.checked = settings.auto_apply !== false;
            if (stackRegular) stackRegular.checked = settings.stack_with_regular !== false;
            if (requireCond) requireCond.checked = settings.require_conditions === true;

            self.renderTalentPool();
        } catch (error) {
            console.error('[AdminConfigs] Failed to load talent pool:', error);
            document.getElementById('talent-pool-table').innerHTML =
                '<p class="text-danger"><i class="fa-solid fa-triangle-exclamation me-1"></i> ' + error.message + '</p>';
        }
    },

    renderTalentPool: function() {
        var container = document.getElementById('talent-pool-table');
        var members = (this.talentPoolData && this.talentPoolData.talent_pool) ? this.talentPoolData.talent_pool.members || [] : [];
        var self = this;

        if (members.length === 0) {
            container.innerHTML = '<p class="text-muted text-center py-3">' + self._t('admin.cfgNoData') + '</p>';
            return;
        }

        var html = '<table class="table config-table"><thead><tr>' +
            '<th>' + self._t('admin.tpEmpNo') + '</th>' +
            '<th>' + self._t('admin.tpName') + '</th>' +
            '<th>' + self._t('admin.tpStartDate') + '</th>' +
            '<th>' + self._t('admin.tpEndDate') + '</th>' +
            '<th>' + self._t('admin.tpBonus') + ' (VND)</th>' +
            '<th>' + self._t('admin.tpStatus') + '</th>' +
            '<th style="width:60px;"></th>' +
            '</tr></thead><tbody>';

        members.forEach(function(m, idx) {
            var statusBadge = m.status === 'active'
                ? '<span class="badge bg-success">Active</span>'
                : '<span class="badge bg-secondary">Inactive</span>';

            html += '<tr>' +
                '<td><code>' + self._escapeHtml(m.employee_id) + '</code></td>' +
                '<td>' + self._escapeHtml(m.name) + '</td>' +
                '<td>' + self._escapeHtml(m.start_date || '--') + '</td>' +
                '<td>' + self._escapeHtml(m.end_date || '--') + '</td>' +
                '<td>' + (m.monthly_bonus ? Number(m.monthly_bonus).toLocaleString() : '0') + '</td>' +
                '<td>' + statusBadge + '</td>' +
                '<td><button class="btn-delete-sm" onclick="AdminConfigs.removeTalentPoolMember(' + idx + ')">' +
                '<i class="fa-solid fa-trash-can"></i></button></td></tr>';
        });

        html += '</tbody></table>';
        container.innerHTML = html;
    },

    addTalentPoolMember: function() {
        var empId = document.getElementById('tp-emp-id').value.trim();
        var name = document.getElementById('tp-name').value.trim();
        var bonus = parseInt(document.getElementById('tp-bonus').value, 10);
        var endDate = document.getElementById('tp-end-date').value;

        if (!empId || !name) {
            this._showMessage('talent-pool-message', 'Employee No and Name are required.', 'danger');
            return;
        }

        if (!this.talentPoolData) this.talentPoolData = { talent_pool: { members: [], settings: {} } };
        if (!this.talentPoolData.talent_pool) this.talentPoolData.talent_pool = { members: [], settings: {} };
        if (!this.talentPoolData.talent_pool.members) this.talentPoolData.talent_pool.members = [];

        this.talentPoolData.talent_pool.members.push({
            employee_id: empId,
            name: name,
            start_date: new Date().toISOString().split('T')[0],
            end_date: endDate || '2026-12-31',
            monthly_bonus: isNaN(bonus) ? 150000 : bonus,
            currency: 'VND',
            reason: 'QIP Talent Pool Special Incentive',
            status: 'active'
        });

        document.getElementById('tp-emp-id').value = '';
        document.getElementById('tp-name').value = '';
        document.getElementById('tp-bonus').value = '';
        document.getElementById('tp-end-date').value = '';

        this.renderTalentPool();
        this._showMessage('talent-pool-message', 'Added member. Click Save to persist.', 'success');
    },

    removeTalentPoolMember: function(idx) {
        if (!confirm('Remove this member from Talent Pool?')) return;
        if (this.talentPoolData && this.talentPoolData.talent_pool && this.talentPoolData.talent_pool.members) {
            this.talentPoolData.talent_pool.members.splice(idx, 1);
        }
        this.renderTalentPool();
        this._showMessage('talent-pool-message', 'Member removed. Click Save to persist.', 'warning');
    },

    async saveTalentPool() {
        var self = this;
        var btn = document.getElementById('btn-save-talent-pool');
        btn.disabled = true;
        btn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status"></span> Saving...';

        try {
            // Read toggle states
            var settings = {
                auto_apply: document.getElementById('tp-auto-apply').checked,
                stack_with_regular: document.getElementById('tp-stack-regular').checked,
                require_conditions: document.getElementById('tp-require-conditions').checked,
                payment_timing: 'with_regular_incentive'
            };

            if (!self.talentPoolData) self.talentPoolData = { talent_pool: { members: [], settings: settings } };
            self.talentPoolData.talent_pool.settings = settings;

            var saveData = Object.assign({}, self.talentPoolData);
            saveData._metadata = {
                updated_at: new Date().toISOString(),
                updated_by: firebase.auth().currentUser.email,
                version: firebase.firestore.FieldValue.increment(1)
            };

            await db.collection('configs').doc('talent_pool').set(saveData);

            var memberCount = (saveData.talent_pool && saveData.talent_pool.members) ? saveData.talent_pool.members.length : 0;
            await self._writeAuditLog('talent_pool', [{
                field: 'QIP Talent Pool',
                field_key: 'talent_pool',
                old_value: null,
                new_value: 'Updated (' + memberCount + ' members)'
            }]);

            self._showMessage('talent-pool-message', 'Talent Pool saved successfully.', 'success');
        } catch (error) {
            console.error('[AdminConfigs] Save talent pool failed:', error);
            self._showMessage('talent-pool-message', 'Save failed: ' + error.message, 'danger');
        } finally {
            btn.disabled = false;
            btn.innerHTML = '<i class="fa-solid fa-floppy-disk me-1"></i> <span data-i18n="admin.cfgSave">' + self._t('admin.cfgSave') + '</span>';
        }
    },

    // =====================================================================
    // 3. Auditor/Trainer Area Mapping
    // =====================================================================

    async loadAuditorMapping() {
        var self = this;
        try {
            var doc = await db.collection('configs').doc('auditor_area_mapping').get();
            if (doc.exists) {
                self.auditorData = doc.data();
            } else {
                self.auditorData = { model_master: { employees: {} }, auditor_trainer_areas: {}, default_reject_rate_threshold: 2.0 };
            }

            // Set default reject rate
            var rateInput = document.getElementById('aud-default-reject-rate');
            if (rateInput && self.auditorData.default_reject_rate_threshold !== undefined) {
                rateInput.value = self.auditorData.default_reject_rate_threshold;
            }

            self.renderModelMasters();
            self.renderAuditors();
        } catch (error) {
            console.error('[AdminConfigs] Failed to load auditor mapping:', error);
            document.getElementById('model-master-table').innerHTML =
                '<p class="text-danger"><i class="fa-solid fa-triangle-exclamation me-1"></i> ' + error.message + '</p>';
        }
    },

    renderModelMasters: function() {
        var container = document.getElementById('model-master-table');
        var employees = (this.auditorData && this.auditorData.model_master) ? this.auditorData.model_master.employees || {} : {};
        var self = this;

        if (Object.keys(employees).length === 0) {
            container.innerHTML = '<p class="text-muted text-center py-2">' + self._t('admin.cfgNoData') + '</p>';
            return;
        }

        var html = '<table class="table config-table"><thead><tr>' +
            '<th>' + self._t('admin.tpEmpNo') + '</th>' +
            '<th>' + self._t('admin.tpName') + '</th>' +
            '<th>' + self._t('admin.cfgDescription') + '</th>' +
            '<th style="width:60px;"></th>' +
            '</tr></thead><tbody>';

        Object.keys(employees).forEach(function(empId) {
            var emp = employees[empId];
            html += '<tr>' +
                '<td><code>' + self._escapeHtml(empId) + '</code></td>' +
                '<td>' + self._escapeHtml(emp.name) + '</td>' +
                '<td class="text-muted" style="font-size:0.78rem;">' + self._escapeHtml(emp.description || 'ALL areas') + '</td>' +
                '<td><button class="btn-delete-sm" onclick="AdminConfigs.removeModelMaster(\'' + empId + '\')">' +
                '<i class="fa-solid fa-trash-can"></i></button></td></tr>';
        });

        html += '</tbody></table>';
        container.innerHTML = html;
    },

    removeModelMaster: function(empId) {
        if (!confirm('Remove Model Master ' + empId + '?')) return;
        if (this.auditorData && this.auditorData.model_master && this.auditorData.model_master.employees) {
            delete this.auditorData.model_master.employees[empId];
        }
        this.renderModelMasters();
        this._showMessage('auditor-mapping-message', 'Removed. Click Save to persist.', 'warning');
    },

    renderAuditors: function() {
        var container = document.getElementById('auditor-accordion');
        var areas = (this.auditorData) ? this.auditorData.auditor_trainer_areas || {} : {};
        var self = this;

        if (Object.keys(areas).length === 0) {
            container.innerHTML = '<p class="text-muted text-center py-2">' + self._t('admin.cfgNoData') + '</p>';
            return;
        }

        var html = '';
        var idx = 0;

        Object.keys(areas).forEach(function(empId) {
            var auditor = areas[empId];
            var collapseId = 'auditor-collapse-' + idx;

            // Build condition summary
            var condSummary = self._buildConditionSummary(auditor.conditions || []);

            html += '<div class="accordion-item">' +
                '<h2 class="accordion-header">' +
                '<button class="accordion-button collapsed" type="button" data-bs-toggle="collapse" data-bs-target="#' + collapseId + '">' +
                '<code class="me-2">' + self._escapeHtml(empId) + '</code> ' +
                self._escapeHtml(auditor.name) +
                '</button></h2>' +
                '<div id="' + collapseId + '" class="accordion-collapse collapse">' +
                '<div class="accordion-body">' +
                '<p class="text-muted mb-2" style="font-size:0.8rem;">' + self._escapeHtml(auditor.description || '') + '</p>' +
                '<div class="mb-2">' + condSummary + '</div>' +
                '<button class="btn btn-sm btn-outline-admin" onclick="AdminConfigs.openConditionEdit(\'' + empId + '\')">' +
                '<i class="fa-solid fa-pen-to-square me-1"></i> ' + self._t('admin.audEditConditions') +
                '</button>' +
                '<button class="btn btn-sm btn-delete-sm ms-2" onclick="AdminConfigs.removeAuditor(\'' + empId + '\')">' +
                '<i class="fa-solid fa-trash-can me-1"></i> ' + self._t('admin.cfgDelete') +
                '</button>' +
                '</div></div></div>';

            idx++;
        });

        container.innerHTML = html;
    },

    _buildConditionSummary: function(conditions) {
        var self = this;
        if (!conditions || conditions.length === 0) return '<span class="text-muted">No conditions</span>';

        var parts = [];
        conditions.forEach(function(cond) {
            var type = (cond.type || 'AND').toUpperCase();
            var tagClass = type === 'AND' ? 'and' : (type === 'OR' ? 'or' : 'all');
            var filterTexts = (cond.filters || []).map(function(f) {
                return f.column + '=' + f.value;
            }).join(', ');

            parts.push('<span class="condition-tag ' + tagClass + '">' + type + '</span> ' +
                (filterTexts || 'ALL'));
        });

        return parts.join(' <span class="text-muted mx-1">+</span> ');
    },

    removeAuditor: function(empId) {
        if (!confirm('Remove Auditor ' + empId + '?')) return;
        if (this.auditorData && this.auditorData.auditor_trainer_areas) {
            delete this.auditorData.auditor_trainer_areas[empId];
        }
        this.renderAuditors();
        this._showMessage('auditor-mapping-message', 'Removed. Click Save to persist.', 'warning');
    },

    // Condition Edit Modal
    openConditionEdit: function(empId) {
        this.editingAuditorId = empId;
        var auditor = this.auditorData.auditor_trainer_areas[empId];
        if (!auditor) return;

        var body = document.getElementById('condition-edit-body');
        var conditions = auditor.conditions || [];
        var self = this;

        var html = '<p class="fw-bold mb-2">' + self._escapeHtml(empId) + ' - ' + self._escapeHtml(auditor.name) + '</p>';
        html += '<div id="condition-groups">';

        conditions.forEach(function(cond, gIdx) {
            html += self._renderConditionGroup(cond, gIdx);
        });

        html += '</div>';
        html += '<button class="btn btn-sm btn-outline-admin mt-2" onclick="AdminConfigs.addConditionGroup()">' +
            '<i class="fa-solid fa-plus me-1"></i> Add Condition Group</button>';

        body.innerHTML = html;

        var modal = new bootstrap.Modal(document.getElementById('conditionEditModal'));
        modal.show();
    },

    _renderConditionGroup: function(cond, gIdx) {
        var self = this;
        var type = cond.type || 'AND';
        var filters = cond.filters || [];

        var html = '<div class="border rounded p-2 mb-2" data-group="' + gIdx + '">' +
            '<div class="d-flex align-items-center justify-content-between mb-2">' +
            '<select class="form-select form-select-sm" style="width:100px;" id="cond-type-' + gIdx + '">' +
            '<option value="AND"' + (type === 'AND' ? ' selected' : '') + '>AND</option>' +
            '<option value="OR"' + (type === 'OR' ? ' selected' : '') + '>OR</option>' +
            '<option value="ALL"' + (type === 'ALL' ? ' selected' : '') + '>ALL</option>' +
            '</select>' +
            '<button class="btn btn-sm btn-delete-sm" onclick="AdminConfigs.removeConditionGroup(' + gIdx + ')">' +
            '<i class="fa-solid fa-trash-can"></i></button></div>';

        html += '<div id="cond-filters-' + gIdx + '">';
        filters.forEach(function(f, fIdx) {
            html += self._renderFilterRow(gIdx, fIdx, f);
        });
        html += '</div>';

        html += '<button class="btn btn-sm btn-outline-admin mt-1" onclick="AdminConfigs.addFilterRow(' + gIdx + ')">' +
            '<i class="fa-solid fa-plus me-1"></i> Add Filter</button>';
        html += '</div>';

        return html;
    },

    _renderFilterRow: function(gIdx, fIdx, filter) {
        var col = filter ? filter.column : 'BUILDING';
        var val = filter ? filter.value : '';

        return '<div class="row g-1 mb-1 align-items-center" id="filter-' + gIdx + '-' + fIdx + '">' +
            '<div class="col-5">' +
            '<select class="form-select form-select-sm" id="fcol-' + gIdx + '-' + fIdx + '" onchange="AdminConfigs.updateFilterValues(' + gIdx + ',' + fIdx + ')">' +
            '<option value="BUILDING"' + (col === 'BUILDING' ? ' selected' : '') + '>BUILDING</option>' +
            '<option value="REPACKING PO"' + (col === 'REPACKING PO' ? ' selected' : '') + '>REPACKING PO</option>' +
            '</select></div>' +
            '<div class="col-5">' +
            '<select class="form-select form-select-sm" id="fval-' + gIdx + '-' + fIdx + '">' +
            this._getFilterValueOptions(col, val) +
            '</select></div>' +
            '<div class="col-2">' +
            '<button class="btn btn-sm btn-delete-sm" onclick="AdminConfigs.removeFilterRow(' + gIdx + ',' + fIdx + ')">' +
            '<i class="fa-solid fa-trash-can"></i></button></div></div>';
    },

    _getFilterValueOptions: function(column, selectedValue) {
        var options = [];
        if (column === 'BUILDING') {
            options = ['A', 'B', 'C', 'D'];
        } else if (column === 'REPACKING PO') {
            options = ['NORMAL PO', 'REPACKING PO'];
        }
        return options.map(function(o) {
            return '<option value="' + o + '"' + (o === selectedValue ? ' selected' : '') + '>' + o + '</option>';
        }).join('');
    },

    updateFilterValues: function(gIdx, fIdx) {
        var col = document.getElementById('fcol-' + gIdx + '-' + fIdx).value;
        var valSelect = document.getElementById('fval-' + gIdx + '-' + fIdx);
        valSelect.innerHTML = this._getFilterValueOptions(col, '');
    },

    addConditionGroup: function() {
        var container = document.getElementById('condition-groups');
        var gIdx = container.children.length;
        var div = document.createElement('div');
        div.innerHTML = this._renderConditionGroup({ type: 'AND', filters: [] }, gIdx);
        container.appendChild(div.firstChild);
    },

    removeConditionGroup: function(gIdx) {
        var groups = document.getElementById('condition-groups');
        var group = groups.querySelector('[data-group="' + gIdx + '"]');
        if (group) group.remove();
    },

    addFilterRow: function(gIdx) {
        var container = document.getElementById('cond-filters-' + gIdx);
        var fIdx = container.children.length;
        var div = document.createElement('div');
        div.innerHTML = this._renderFilterRow(gIdx, fIdx, null);
        container.appendChild(div.firstChild);
    },

    removeFilterRow: function(gIdx, fIdx) {
        var row = document.getElementById('filter-' + gIdx + '-' + fIdx);
        if (row) row.remove();
    },

    applyConditionEdit: function() {
        var empId = this.editingAuditorId;
        if (!empId || !this.auditorData || !this.auditorData.auditor_trainer_areas[empId]) return;

        var groups = document.getElementById('condition-groups').children;
        var conditions = [];

        for (var g = 0; g < groups.length; g++) {
            var group = groups[g];
            var gIdx = group.getAttribute('data-group');
            var typeSelect = document.getElementById('cond-type-' + gIdx);
            if (!typeSelect) continue;

            var type = typeSelect.value;
            var filters = [];
            var filterContainer = document.getElementById('cond-filters-' + gIdx);
            if (filterContainer) {
                var rows = filterContainer.children;
                for (var r = 0; r < rows.length; r++) {
                    var rowId = rows[r].id;
                    var parts = rowId.split('-');
                    var fGIdx = parts[1];
                    var fIdx = parts[2];
                    var colEl = document.getElementById('fcol-' + fGIdx + '-' + fIdx);
                    var valEl = document.getElementById('fval-' + fGIdx + '-' + fIdx);
                    if (colEl && valEl) {
                        filters.push({ column: colEl.value, value: valEl.value });
                    }
                }
            }

            conditions.push({ type: type, filters: filters });
        }

        this.auditorData.auditor_trainer_areas[empId].conditions = conditions;

        // Close modal
        var modalEl = document.getElementById('conditionEditModal');
        var modal = bootstrap.Modal.getInstance(modalEl);
        if (modal) modal.hide();

        this.renderAuditors();
        this._showMessage('auditor-mapping-message', 'Conditions updated for ' + empId + '. Click Save to persist.', 'success');
    },

    async saveAuditorMapping() {
        var self = this;
        var btn = document.getElementById('btn-save-auditor-mapping');
        btn.disabled = true;
        btn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status"></span> Saving...';

        try {
            // Update reject rate from input
            var rateInput = document.getElementById('aud-default-reject-rate');
            if (rateInput && rateInput.value) {
                self.auditorData.default_reject_rate_threshold = parseFloat(rateInput.value);
            }

            var saveData = Object.assign({}, self.auditorData);
            saveData._metadata = {
                updated_at: new Date().toISOString(),
                updated_by: firebase.auth().currentUser.email,
                version: firebase.firestore.FieldValue.increment(1)
            };

            await db.collection('configs').doc('auditor_area_mapping').set(saveData);

            var auditorCount = Object.keys(saveData.auditor_trainer_areas || {}).length;
            var masterCount = Object.keys((saveData.model_master || {}).employees || {}).length;
            await self._writeAuditLog('area_mapping', [{
                field: 'Auditor/Trainer Area Mapping',
                field_key: 'auditor_area_mapping',
                old_value: null,
                new_value: 'Updated (' + masterCount + ' masters, ' + auditorCount + ' auditors)'
            }]);

            self._showMessage('auditor-mapping-message', 'Auditor mapping saved successfully.', 'success');
        } catch (error) {
            console.error('[AdminConfigs] Save auditor mapping failed:', error);
            self._showMessage('auditor-mapping-message', 'Save failed: ' + error.message, 'danger');
        } finally {
            btn.disabled = false;
            btn.innerHTML = '<i class="fa-solid fa-floppy-disk me-1"></i> <span data-i18n="admin.cfgSave">' + self._t('admin.cfgSave') + '</span>';
        }
    },

    // =====================================================================
    // 4. Continuous Months (Read-Only)
    // =====================================================================

    async loadContinuousMonths() {
        var self = this;
        var container = document.getElementById('continuous-months-table');

        try {
            var doc = await db.collection('configs').doc('continuous_months').get();
            if (doc.exists) {
                self.continuousData = doc.data();
            } else {
                self.continuousData = { employees: {} };
            }
            self.renderContinuousMonths();
            self.bindContinuousSearch();
        } catch (error) {
            console.error('[AdminConfigs] Failed to load continuous months:', error);
            container.innerHTML =
                '<p class="text-danger"><i class="fa-solid fa-triangle-exclamation me-1"></i> ' + error.message + '</p>';
        }
    },

    renderContinuousMonths: function(filterText) {
        var container = document.getElementById('continuous-months-table');
        var employees = (this.continuousData) ? this.continuousData.employees || {} : {};
        var self = this;
        var month = (this.continuousData && this.continuousData.month) || '';

        var entries = Object.entries(employees);

        // Filter
        if (filterText) {
            var lower = filterText.toLowerCase();
            entries = entries.filter(function(entry) {
                var empId = entry[0];
                var emp = entry[1];
                return empId.includes(lower) || (emp.name || '').toLowerCase().includes(lower);
            });
        }

        if (entries.length === 0) {
            container.innerHTML = '<p class="text-muted text-center py-3">' + self._t('admin.cfgNoData') + '</p>';
            return;
        }

        // Determine column names from data
        var prevKey = month + '_continuous_months';
        var expectedKey = month ? (month.substring(0, 3) + '_expected_months') : 'expected_months';
        // Use generic approach - find keys ending with _continuous_months
        var sampleEmp = entries[0][1];
        var prevMonthKey = Object.keys(sampleEmp).find(function(k) { return k.endsWith('_continuous_months'); }) || 'continuous_months';
        var expectedMonthKey = Object.keys(sampleEmp).find(function(k) { return k.endsWith('_expected_months'); }) || 'expected_months';
        var incentiveKey = Object.keys(sampleEmp).find(function(k) { return k.endsWith('_incentive'); }) || 'incentive';

        var html = '<div style="max-height:400px; overflow-y:auto;">' +
            '<table class="table config-table"><thead><tr>' +
            '<th>' + self._t('admin.tpEmpNo') + '</th>' +
            '<th>' + self._t('admin.tpName') + '</th>' +
            '<th>' + self._t('admin.cmPosition') + '</th>' +
            '<th>' + self._t('admin.cmPrevMonths') + '</th>' +
            '<th>' + self._t('admin.cmCurrentMonths') + '</th>' +
            '<th>' + self._t('admin.cmIncentive') + '</th>' +
            '</tr></thead><tbody>';

        entries.forEach(function(entry) {
            var empId = entry[0];
            var emp = entry[1];

            html += '<tr>' +
                '<td><code>' + self._escapeHtml(empId) + '</code></td>' +
                '<td>' + self._escapeHtml(emp.name || '--') + '</td>' +
                '<td style="font-size:0.78rem;">' + self._escapeHtml(emp.position || '--') + '</td>' +
                '<td>' + (emp[prevMonthKey] !== undefined ? emp[prevMonthKey] : '--') + '</td>' +
                '<td>' + (emp[expectedMonthKey] !== undefined ? emp[expectedMonthKey] : '--') + '</td>' +
                '<td>' + (emp[incentiveKey] ? Number(emp[incentiveKey]).toLocaleString() : '0') + ' VND</td>' +
                '</tr>';
        });

        html += '</tbody></table></div>';
        html += '<p class="text-muted mt-2" style="font-size:0.78rem;">' +
            self._t('admin.cmTotal') + ': ' + entries.length + ' / ' + Object.keys(employees).length +
            (this.continuousData.last_updated ? ' | ' + self._t('admin.cmLastUpdated') + ': ' + this.continuousData.last_updated : '') +
            '</p>';

        container.innerHTML = html;
    },

    bindContinuousSearch: function() {
        var self = this;
        var searchInput = document.getElementById('cm-search');
        if (!searchInput) return;

        searchInput.addEventListener('input', function() {
            self.renderContinuousMonths(this.value);
        });
    }
};

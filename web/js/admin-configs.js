/**
 * Admin Config Management Module
 * HWK QIP Incentive Dashboard V10
 *
 * Manages 6 CRUD config panels + 1 read-only data panel:
 *   1. TYPE-2 Position Mapping  (configs/type2_position_mapping)
 *   2. QIP Talent Pool          (configs/talent_pool)
 *   3. Auditor Area Mapping     (configs/auditor_area_mapping)
 *   4. Continuous Months         (configs/continuous_months) [read-only]
 *   5. Position Condition Matrix (configs/position_condition_matrix) [NEW]
 *   6. Progressive Incentive Table  (same doc, section)         [NEW]
 *   7. TYPE-2 Multipliers           (same doc, section)         [NEW]
 *
 * Depends on: firebase-config.js, auth.js, dashboard-i18n.js, admin.js
 */

var AdminConfigs = {
    // In-memory state for each config
    positionData: null,
    talentPoolData: null,
    auditorData: null,
    continuousData: null,

    // Shared cache for position_condition_matrix Firestore doc
    _posCondMatrixCache: null,

    // Currently editing auditor ID (for condition modal)
    editingAuditorId: null,

    /**
     * Initialize config panels (called on Tab 2 first activation).
     */
    init: function() {
        this.loadPositionMapping();
        this.loadTalentPool();
        this.loadAuditorMapping();
        this.loadConditionMatrix();
        this.loadProgressiveTable();
        this.loadType2Multipliers();
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
            this._showMessage('position-mapping-message', this._t('admin.cfg.enterPosition'), 'danger');
            return;
        }

        if (!this.positionData) this.positionData = { position_mappings: {} };
        this.positionData.position_mappings[name] = {
            mapped_to: mapped,
            description: name + ' → ' + mapped
        };

        nameInput.value = '';
        this.renderPositionMapping();
        this._showMessage('position-mapping-message', this._t('admin.cfg.added') + name + this._t('admin.cfg.clickSave'), 'success');
    },

    removePositionMapping: function(name) {
        if (!confirm(this._t('admin.cfg.confirmRemove') + '"' + name + '"?')) return;
        if (this.positionData && this.positionData.position_mappings) {
            delete this.positionData.position_mappings[name];
        }
        this.renderPositionMapping();
        this._showMessage('position-mapping-message', this._t('admin.cfg.removed') + name + this._t('admin.cfg.removedClickSave'), 'warning');
    },

    async savePositionMapping() {
        var self = this;
        var btn = document.getElementById('btn-save-position-mapping');
        btn.disabled = true;
        btn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status"></span> ' + self._t('admin.msg.saving');

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

            self._showMessage('position-mapping-message', self._t('admin.cfg.positionMappingSaved'), 'success');
        } catch (error) {
            console.error('[AdminConfigs] Save position mapping failed:', error);
            self._showMessage('position-mapping-message', self._t('admin.cfg.saveFailed') + error.message, 'danger');
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
            this._showMessage('talent-pool-message', this._t('admin.cfg.empNoNameRequired'), 'danger');
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
        this._showMessage('talent-pool-message', this._t('admin.cfg.addedMember'), 'success');
    },

    removeTalentPoolMember: function(idx) {
        if (!confirm(this._t('admin.cfgConfirmDelete'))) return;
        if (this.talentPoolData && this.talentPoolData.talent_pool && this.talentPoolData.talent_pool.members) {
            this.talentPoolData.talent_pool.members.splice(idx, 1);
        }
        this.renderTalentPool();
        this._showMessage('talent-pool-message', this._t('admin.cfg.memberRemoved'), 'warning');
    },

    async saveTalentPool() {
        var self = this;
        var btn = document.getElementById('btn-save-talent-pool');
        btn.disabled = true;
        btn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status"></span> ' + self._t('admin.msg.saving');

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

            self._showMessage('talent-pool-message', self._t('admin.cfg.talentPoolSaved'), 'success');
        } catch (error) {
            console.error('[AdminConfigs] Save talent pool failed:', error);
            self._showMessage('talent-pool-message', self._t('admin.cfg.saveFailed') + error.message, 'danger');
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
        if (!confirm(this._t('admin.cfg.confirmRemove') + empId + '?')) return;
        if (this.auditorData && this.auditorData.model_master && this.auditorData.model_master.employees) {
            delete this.auditorData.model_master.employees[empId];
        }
        this.renderModelMasters();
        this._showMessage('auditor-mapping-message', this._t('admin.cfg.removedSave'), 'warning');
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
        if (!confirm(this._t('admin.cfg.confirmRemove') + empId + '?')) return;
        if (this.auditorData && this.auditorData.auditor_trainer_areas) {
            delete this.auditorData.auditor_trainer_areas[empId];
        }
        this.renderAuditors();
        this._showMessage('auditor-mapping-message', this._t('admin.cfg.removedSave'), 'warning');
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
        this._showMessage('auditor-mapping-message', this._t('admin.cfg.conditionsUpdated') + empId + this._t('admin.cfg.conditionsClickSave'), 'success');
    },

    async saveAuditorMapping() {
        var self = this;
        var btn = document.getElementById('btn-save-auditor-mapping');
        btn.disabled = true;
        btn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status"></span> ' + self._t('admin.msg.saving');

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

            self._showMessage('auditor-mapping-message', self._t('admin.cfg.auditorMappingSaved'), 'success');
        } catch (error) {
            console.error('[AdminConfigs] Save auditor mapping failed:', error);
            self._showMessage('auditor-mapping-message', self._t('admin.cfg.saveFailed') + error.message, 'danger');
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
    },

    // =====================================================================
    // Shared: Position Condition Matrix Document
    // =====================================================================

    _loadPosCondMatrix: async function() {
        if (this._posCondMatrixCache) return this._posCondMatrixCache;
        var doc = await db.collection('configs').doc('position_condition_matrix').get();
        this._posCondMatrixCache = doc.exists ? doc.data() : {};
        return this._posCondMatrixCache;
    },

    _savePosCondMatrixSection: async function(sectionKey, sectionData, auditType) {
        var updateObj = {};
        updateObj[sectionKey] = sectionData;
        await db.collection('configs').doc('position_condition_matrix').set(updateObj, { merge: true });
        this._posCondMatrixCache = null;
        await this._writeAuditLog(auditType, [{
            field: auditType,
            field_key: sectionKey,
            old_value: null,
            new_value: 'Updated'
        }]);
    },

    // =====================================================================
    // 5. Position Condition Matrix
    // =====================================================================

    async loadConditionMatrix() {
        var self = this;
        var container = document.getElementById('condition-matrix-container');
        try {
            var data = await self._loadPosCondMatrix();
            self.renderConditionMatrix(data.position_matrix || {}, data.conditions || {});
        } catch (error) {
            console.error('[AdminConfigs] Failed to load condition matrix:', error);
            container.innerHTML = '<p class="text-danger"><i class="fa-solid fa-triangle-exclamation me-1"></i> ' + self._escapeHtml(error.message) + '</p>';
        }
    },

    renderConditionMatrix: function(matrix, conditions) {
        var container = document.getElementById('condition-matrix-container');
        var self = this;
        var lang = (typeof DashboardI18n !== 'undefined' && DashboardI18n.currentLang) ? DashboardI18n.currentLang : 'ko';
        var COND_SHORT = {
            'attendance_rate': { ko: '출근율', en: 'Attend.', vi: 'Chuyên cần' },
            'attendance_unapproved_absence': { ko: '무단결근', en: 'Absence', vi: 'Vắng' },
            'actual_working_days': { ko: '실근무일', en: 'Work Days', vi: 'Ngày làm' },
            'attendance_minimum_days': { ko: '최소근무', en: 'Min Days', vi: 'Tối thiểu' },
            'aql_personal_failure': { ko: '개인AQL', en: 'Per.AQL', vi: 'AQL CN' },
            'aql_personal_continuous': { ko: '연속AQL', en: 'Cons.AQL', vi: 'AQL LT' },
            'aql_team_area': { ko: '팀AQL', en: 'Team AQL', vi: 'AQL nhóm' },
            'aql_area_reject': { ko: '불량률', en: 'Reject%', vi: 'Lỗi%' },
            '5prs_pass_rate': { ko: '5PRS률', en: '5PRS%', vi: '5PRS%' },
            '5prs_inspection_qty': { ko: '5PRS량', en: '5PRS Qty', vi: 'SL 5PRS' }
        };
        var condLabels = [];
        for (var c = 1; c <= 10; c++) {
            var cond = conditions[String(c)];
            var shortName = 'C' + c;
            var tooltip = '';
            if (cond) {
                var shortMap = COND_SHORT[cond.id];
                shortName = shortMap ? (shortMap[lang] || shortMap.ko) : cond.id;
                tooltip = cond.description + ' (' + cond.name + ')';
            }
            condLabels.push({ num: c, short: shortName, tooltip: tooltip });
        }
        var html = '';

        var types = ['TYPE-1', 'TYPE-2'];
        types.forEach(function(typeName) {
            var section = matrix[typeName] || {};
            var keys = Object.keys(section);

            html += '<div class="mb-3">';
            html += '<div class="cond-matrix-section-header" onclick="this.classList.toggle(\'collapsed\'); var b=this.nextElementSibling; b.style.display=b.style.display===\'none\'?\'block\':\'none\';">' +
                '<span><i class="fa-solid fa-layer-group me-2"></i>' + typeName + ' (' + keys.length + ' ' + self._t('admin.cfgAddPosition') + ')</span>' +
                '<i class="fa-solid fa-chevron-down toggle-icon"></i></div>';
            html += '<div class="table-responsive">';
            html += '<table class="table config-table cond-matrix-table" id="matrix-table-' + typeName.replace('-', '') + '">' +
                '<thead><tr>' +
                '<th>' + self._t('admin.cfgPositionName') + '</th>';

            condLabels.forEach(function(cl) {
                html += '<th title="' + self._escapeHtml(cl.tooltip) + '" style="cursor:help;"><small class="text-muted">C' + cl.num + '</small><br>' + self._escapeHtml(cl.short) + '</th>';
            });
            html += '<th>' + self._t('admin.cfgDescription') + '</th>';
            html += '<th style="width:50px;"></th>';
            html += '</tr></thead><tbody>';

            keys.forEach(function(posKey) {
                var pos = section[posKey];
                var applicable = pos.applicable_conditions || [];
                var isDefault = (posKey === 'default');

                html += '<tr data-type="' + self._escapeHtml(typeName) + '" data-key="' + self._escapeHtml(posKey) + '">';
                html += '<td><strong>' + self._escapeHtml(posKey) + '</strong>';
                if (pos.patterns && pos.patterns.length > 0) {
                    html += '<br><small class="text-muted">' + self._escapeHtml(pos.patterns.join(', ')) + '</small>';
                }
                if (pos.position_codes) {
                    html += '<br><small class="text-info">' + self._t('admin.cfgPosCode') + ': ' + self._escapeHtml(pos.position_codes.join(', ')) + '</small>';
                }
                html += '</td>';

                for (var c = 1; c <= 10; c++) {
                    var checked = applicable.indexOf(c) !== -1 ? ' checked' : '';
                    html += '<td><input type="checkbox" class="form-check-input cond-cb" data-cond="' + c + '"' + checked + '></td>';
                }

                html += '<td><input type="text" class="inline-edit-input" value="' + self._escapeHtml(pos.description || '') + '" data-field="description"></td>';
                html += '<td>';
                if (!isDefault) {
                    html += '<button class="btn-delete-sm" onclick="AdminConfigs.removeMatrixPosition(\'' +
                        self._escapeHtml(typeName) + '\',\'' + self._escapeHtml(posKey) + '\')"><i class="fa-solid fa-trash-can"></i></button>';
                }
                html += '</td></tr>';
            });

            html += '</tbody></table></div>';

            // Inline add form
            html += '<div class="d-flex align-items-center gap-2 mb-3">' +
                '<input type="text" class="form-control form-control-sm" style="width:200px;" ' +
                'id="add-pos-input-' + typeName.replace('-', '') + '" placeholder="' + self._t('admin.cfgNewPosPlaceholder') + '" ' +
                'onkeyup="if(event.key===\'Enter\')AdminConfigs.addMatrixPosition(\'' + typeName + '\')">' +
                '<button class="btn btn-sm btn-outline-admin" onclick="AdminConfigs.addMatrixPosition(\'' + typeName + '\')">' +
                '<i class="fa-solid fa-plus me-1"></i>' + self._t('admin.cfgAddPosition') + '</button></div>';
            html += '</div>';
        });

        container.innerHTML = html;
    },

    addMatrixPosition: function(typeName) {
        var input = document.getElementById('add-pos-input-' + typeName.replace('-', ''));
        var posKey = input ? input.value.trim() : '';
        if (!posKey) { if (input) input.focus(); return; }
        posKey = posKey.toUpperCase().replace(/\s+/g, '_');

        var data = this._posCondMatrixCache || {};
        if (!data.position_matrix) data.position_matrix = {};
        if (!data.position_matrix[typeName]) data.position_matrix[typeName] = {};

        if (data.position_matrix[typeName][posKey]) {
            this._showMessage('condition-matrix-message', this._t('admin.cfg.keyExists') + posKey + this._t('admin.cfg.alreadyExists'), 'warning');
            return;
        }

        data.position_matrix[typeName][posKey] = {
            applicable_conditions: [1, 2, 3, 4],
            excluded_conditions: [5, 6, 7, 8, 9, 10],
            description: posKey + ' - new position'
        };

        this._posCondMatrixCache = data;
        this.renderConditionMatrix(data.position_matrix, data.conditions || {});
        this._showMessage('condition-matrix-message', this._t('admin.cfg.added') + posKey + this._t('admin.cfg.addedTo') + typeName + '). ' + this._t('admin.cfg.clickSave'), 'success');
    },

    removeMatrixPosition: function(typeName, posKey) {
        if (posKey === 'default') {
            this._showMessage('condition-matrix-message', this._t('admin.cfgDefaultNoDelete'), 'warning');
            return;
        }
        if (!confirm(this._t('admin.cfg.confirmRemove') + '"' + posKey + '"?')) return;

        var data = this._posCondMatrixCache || {};
        if (data.position_matrix && data.position_matrix[typeName]) {
            delete data.position_matrix[typeName][posKey];
        }
        this._posCondMatrixCache = data;
        this.renderConditionMatrix(data.position_matrix || {}, data.conditions || {});
        this._showMessage('condition-matrix-message', this._t('admin.cfg.removed') + posKey + this._t('admin.cfg.removedClickSave'), 'warning');
    },

    async saveConditionMatrix() {
        var self = this;
        var btn = document.getElementById('btn-save-condition-matrix');
        btn.disabled = true;
        btn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status"></span> ' + self._t('admin.msg.saving');

        try {
            var data = self._posCondMatrixCache || {};
            if (!data.position_matrix) data.position_matrix = {};

            // Read checkboxes and descriptions from DOM
            var tables = document.querySelectorAll('.cond-matrix-table');
            tables.forEach(function(table) {
                var rows = table.querySelectorAll('tbody tr');
                rows.forEach(function(row) {
                    var typeName = row.getAttribute('data-type');
                    var posKey = row.getAttribute('data-key');
                    if (!typeName || !posKey) return;
                    if (!data.position_matrix[typeName]) data.position_matrix[typeName] = {};
                    if (!data.position_matrix[typeName][posKey]) data.position_matrix[typeName][posKey] = {};

                    var pos = data.position_matrix[typeName][posKey];

                    // Read checkboxes
                    var applicable = [];
                    var excluded = [];
                    row.querySelectorAll('.cond-cb').forEach(function(cb) {
                        var cond = parseInt(cb.getAttribute('data-cond'), 10);
                        if (cb.checked) {
                            applicable.push(cond);
                        } else {
                            excluded.push(cond);
                        }
                    });
                    pos.applicable_conditions = applicable;
                    pos.excluded_conditions = excluded;

                    // Read description
                    var descInput = row.querySelector('[data-field="description"]');
                    if (descInput) pos.description = descInput.value;
                });
            });

            await self._savePosCondMatrixSection('position_matrix', data.position_matrix, 'condition_matrix');
            self._showMessage('condition-matrix-message', self._t('admin.cfg.condMatrixSaved'), 'success');
        } catch (error) {
            console.error('[AdminConfigs] Save condition matrix failed:', error);
            self._showMessage('condition-matrix-message', self._t('admin.cfg.saveFailed') + error.message, 'danger');
        } finally {
            btn.disabled = false;
            btn.innerHTML = '<i class="fa-solid fa-floppy-disk me-1"></i> <span data-i18n="admin.cfgSaveMatrix">' + self._t('admin.cfgSaveMatrix') + '</span>';
        }
    },

    // =====================================================================
    // 6. Progressive Incentive Table
    // =====================================================================

    async loadProgressiveTable() {
        var self = this;
        var container = document.getElementById('progressive-table-container');
        try {
            var data = await self._loadPosCondMatrix();
            var progression = (data.incentive_progression && data.incentive_progression.TYPE_1_PROGRESSIVE)
                ? data.incentive_progression.TYPE_1_PROGRESSIVE.progression_table || {}
                : {};
            self.renderProgressiveTable(progression);
        } catch (error) {
            console.error('[AdminConfigs] Failed to load progressive table:', error);
            container.innerHTML = '<p class="text-danger"><i class="fa-solid fa-triangle-exclamation me-1"></i> ' + self._escapeHtml(error.message) + '</p>';
        }
    },

    renderProgressiveTable: function(table) {
        var container = document.getElementById('progressive-table-container');
        var self = this;

        var html = '<div class="table-responsive"><table class="table config-table">' +
            '<thead><tr><th>' + self._t('admin.cfgMonth') + '</th><th>' + self._t('admin.cfgAmount') + '</th></tr></thead><tbody>';

        for (var m = 0; m <= 15; m++) {
            var amount = table[String(m)] !== undefined ? table[String(m)] : 0;
            var formatted = Number(amount).toLocaleString('vi-VN');
            html += '<tr><td><strong>' + m + '</strong> ' + self._t('admin.cfgMonth') + '</td>' +
                '<td><div class="d-flex align-items-center gap-2"><input type="number" class="form-control form-control-admin inline-edit-input prog-table-input" ' +
                'id="prog-month-' + m + '" value="' + amount + '" min="0" step="10000" ' +
                'oninput="var s=this.nextElementSibling;if(s)s.textContent=Number(this.value||0).toLocaleString(\'vi-VN\')+\' VND\'">' +
                '<small class="text-muted" style="white-space:nowrap;">' + formatted + ' VND</small></div></td></tr>';
        }

        html += '</tbody></table></div>';
        container.innerHTML = html;
    },

    async saveProgressiveTable() {
        var self = this;
        var btn = document.getElementById('btn-save-progressive-table');
        btn.disabled = true;
        btn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status"></span> ' + self._t('admin.msg.saving');

        try {
            var table = {};
            var valid = true;
            for (var m = 0; m <= 15; m++) {
                var input = document.getElementById('prog-month-' + m);
                var val = parseInt(input.value, 10);
                if (isNaN(val) || val < 0) {
                    input.classList.add('is-invalid');
                    valid = false;
                } else {
                    input.classList.remove('is-invalid');
                    table[String(m)] = val;
                }
            }

            if (!valid) {
                self._showMessage('progressive-table-message', self._t('admin.cfg.invalidNumbers'), 'danger');
                btn.disabled = false;
                btn.innerHTML = '<i class="fa-solid fa-floppy-disk me-1"></i> <span data-i18n="admin.cfgSaveProgTable">' + self._t('admin.cfgSaveProgTable') + '</span>';
                return;
            }

            // Build full incentive_progression section preserving metadata
            var data = self._posCondMatrixCache || {};
            var progression = (data.incentive_progression && data.incentive_progression.TYPE_1_PROGRESSIVE)
                ? Object.assign({}, data.incentive_progression.TYPE_1_PROGRESSIVE)
                : {};
            progression.progression_table = table;

            var fullSection = Object.assign({}, data.incentive_progression || {});
            fullSection.TYPE_1_PROGRESSIVE = progression;

            await self._savePosCondMatrixSection('incentive_progression', fullSection, 'progressive_table');
            self._showMessage('progressive-table-message', self._t('admin.cfg.progTableSaved'), 'success');
        } catch (error) {
            console.error('[AdminConfigs] Save progressive table failed:', error);
            self._showMessage('progressive-table-message', self._t('admin.cfg.saveFailed') + error.message, 'danger');
        } finally {
            btn.disabled = false;
            btn.innerHTML = '<i class="fa-solid fa-floppy-disk me-1"></i> <span data-i18n="admin.cfgSaveProgTable">' + self._t('admin.cfgSaveProgTable') + '</span>';
        }
    },

    // =====================================================================
    // 7. TYPE-2 Multipliers
    // =====================================================================

    async loadType2Multipliers() {
        var self = this;
        var container = document.getElementById('type2-multipliers-container');
        try {
            var data = await self._loadPosCondMatrix();
            self.renderType2Multipliers(data.type_2_multipliers || {});
        } catch (error) {
            console.error('[AdminConfigs] Failed to load TYPE-2 multipliers:', error);
            container.innerHTML = '<p class="text-danger"><i class="fa-solid fa-triangle-exclamation me-1"></i> ' + self._escapeHtml(error.message) + '</p>';
        }
    },

    renderType2Multipliers: function(multipliers) {
        var container = document.getElementById('type2-multipliers-container');
        var self = this;

        // Filter out metadata keys starting with _
        var keys = Object.keys(multipliers).filter(function(k) { return k.charAt(0) !== '_'; });

        if (keys.length === 0) {
            container.innerHTML = '<div class="text-center py-4">' +
                '<i class="fa-solid fa-calculator fa-2x text-muted mb-2 d-block"></i>' +
                '<p class="text-muted">' + self._t('admin.cfgEmptyType2') + '</p>' +
                '<div class="d-flex align-items-center justify-content-center gap-2 mt-2">' +
                '<input type="text" class="form-control form-control-sm" style="width:200px;" id="add-type2-input" ' +
                'placeholder="' + self._t('admin.cfgNewPosPlaceholder') + '" onkeyup="if(event.key===\'Enter\')AdminConfigs.addType2Multiplier()">' +
                '<button class="btn btn-sm btn-outline-admin" onclick="AdminConfigs.addType2Multiplier()">' +
                '<i class="fa-solid fa-plus me-1"></i>' + self._t('admin.cfgAddPosition') + '</button></div></div>';
            return;
        }

        var html = '<div class="table-responsive"><table class="table config-table">' +
            '<thead><tr>' +
            '<th>' + self._t('admin.cfgPositionName') + '</th>' +
            '<th>' + self._t('admin.cfgMultiplier') + '</th>' +
            '<th>' + self._t('admin.cfgBase') + '</th>' +
            '<th>' + self._t('admin.cfgFormula') + '</th>' +
            '<th>' + self._t('admin.cfgPatterns') + '</th>' +
            '<th style="width:50px;"></th>' +
            '</tr></thead><tbody>';

        keys.forEach(function(key) {
            var m = multipliers[key];
            var patterns = (m.patterns || []).join(', ');

            html += '<tr data-key="' + self._escapeHtml(key) + '">' +
                '<td><strong>' + self._escapeHtml(key) + '</strong></td>' +
                '<td><input type="number" class="form-control form-control-admin inline-edit-input" style="width:80px;" ' +
                'data-field="multiplier" value="' + (m.multiplier || 0) + '" min="0" step="0.1" ' +
                'oninput="var v=parseFloat(this.value);this.classList.toggle(\'border-warning\',(v<0.01||v>10))"></td>' +
                '<td><select class="form-select form-select-sm" style="width:200px;" data-field="base">' +
                '<option value="subordinate_total"' + (m.base === 'subordinate_total' ? ' selected' : '') + '>' + self._t('admin.cfgBaseSubordinate') + '</option>' +
                '<option value="line_leader_average"' + (m.base === 'line_leader_average' ? ' selected' : '') + '>' + self._t('admin.cfgBaseLineLdrAvg') + '</option>' +
                '</select></td>' +
                '<td><input type="text" class="form-control form-control-admin inline-edit-input" ' +
                'data-field="formula" value="' + self._escapeHtml(m.formula || '') + '"></td>' +
                '<td><input type="text" class="form-control form-control-admin inline-edit-input patterns-input" ' +
                'data-field="patterns" value="' + self._escapeHtml(patterns) + '" placeholder="PATTERN1, PATTERN2"></td>' +
                '<td><button class="btn-delete-sm" onclick="AdminConfigs.removeType2Multiplier(\'' + self._escapeHtml(key) + '\')">' +
                '<i class="fa-solid fa-trash-can"></i></button></td>' +
                '</tr>';
        });

        html += '</tbody></table></div>';

        html += '<div class="d-flex align-items-center gap-2 mt-2">' +
            '<input type="text" class="form-control form-control-sm" style="width:200px;" id="add-type2-input" ' +
            'placeholder="' + self._t('admin.cfgNewPosPlaceholder') + '" onkeyup="if(event.key===\'Enter\')AdminConfigs.addType2Multiplier()">' +
            '<button class="btn btn-sm btn-outline-admin" onclick="AdminConfigs.addType2Multiplier()">' +
            '<i class="fa-solid fa-plus me-1"></i>' + self._t('admin.cfgAddPosition') + '</button></div>';

        container.innerHTML = html;
    },

    addType2Multiplier: function() {
        var input = document.getElementById('add-type2-input');
        var key = input ? input.value.trim() : '';
        if (!key) { if (input) input.focus(); return; }
        key = key.toUpperCase().replace(/\s+/g, '_');

        var data = this._posCondMatrixCache || {};
        if (!data.type_2_multipliers) data.type_2_multipliers = {};

        if (data.type_2_multipliers[key]) {
            this._showMessage('type2-multipliers-message', this._t('admin.cfg.keyExists') + key + this._t('admin.cfg.alreadyExists'), 'warning');
            return;
        }

        data.type_2_multipliers[key] = {
            multiplier: 1.0,
            base: 'line_leader_average',
            formula: 'TYPE-1 LINE LEADER average × 1.0',
            patterns: [key.replace(/_/g, ' ')],
            description_ko: key,
            description_en: key
        };

        this._posCondMatrixCache = data;
        this.renderType2Multipliers(data.type_2_multipliers);
        this._showMessage('type2-multipliers-message', this._t('admin.cfg.added') + key + this._t('admin.cfg.clickSave'), 'success');
    },

    removeType2Multiplier: function(key) {
        if (!confirm(this._t('admin.cfg.confirmRemove') + '"' + key + '"?')) return;

        var data = this._posCondMatrixCache || {};
        if (data.type_2_multipliers) {
            delete data.type_2_multipliers[key];
        }
        this._posCondMatrixCache = data;
        this.renderType2Multipliers(data.type_2_multipliers || {});
        this._showMessage('type2-multipliers-message', this._t('admin.cfg.removed') + key + this._t('admin.cfg.removedClickSave'), 'warning');
    },

    async saveType2Multipliers() {
        var self = this;
        var btn = document.getElementById('btn-save-type2-multipliers');
        btn.disabled = true;
        btn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status"></span> ' + self._t('admin.msg.saving');

        try {
            var data = self._posCondMatrixCache || {};
            if (!data.type_2_multipliers) data.type_2_multipliers = {};

            // Read inline edits from DOM
            var rows = document.querySelectorAll('#type2-multipliers-container tbody tr');
            rows.forEach(function(row) {
                var key = row.getAttribute('data-key');
                if (!key || !data.type_2_multipliers[key]) return;

                var m = data.type_2_multipliers[key];

                var multInput = row.querySelector('[data-field="multiplier"]');
                if (multInput) m.multiplier = parseFloat(multInput.value) || 0;

                var baseInput = row.querySelector('[data-field="base"]');
                if (baseInput) m.base = baseInput.value.trim();

                var formulaInput = row.querySelector('[data-field="formula"]');
                if (formulaInput) m.formula = formulaInput.value.trim();

                var patternsInput = row.querySelector('[data-field="patterns"]');
                if (patternsInput) {
                    var pVal = patternsInput.value.trim();
                    m.patterns = pVal ? pVal.split(',').map(function(s) { return s.trim(); }).filter(Boolean) : [];
                }
            });

            await self._savePosCondMatrixSection('type_2_multipliers', data.type_2_multipliers, 'type2_multipliers');
            self._showMessage('type2-multipliers-message', self._t('admin.cfg.type2MultSaved'), 'success');
        } catch (error) {
            console.error('[AdminConfigs] Save TYPE-2 multipliers failed:', error);
            self._showMessage('type2-multipliers-message', self._t('admin.cfg.saveFailed') + error.message, 'danger');
        } finally {
            btn.disabled = false;
            btn.innerHTML = '<i class="fa-solid fa-floppy-disk me-1"></i> <span data-i18n="admin.cfgSaveMultipliers">' + self._t('admin.cfgSaveMultipliers') + '</span>';
        }
    }
};

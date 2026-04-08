/**
 * Admin Email Settings Module (Enhanced)
 * HWK QIP Incentive Dashboard V10
 *
 * Manages multiple email notification types with:
 *   - Per-type ON/OFF toggle
 *   - Separate TO and CC recipient lists per type
 *   - Bootstrap 5 accordion UI
 *   - Migration from legacy system/config.email_recipients
 *
 * Firestore path: config/emailSettings
 * Depends on: firebase-config.js (db), auth.js, admin.js (AdminPage.showMessage)
 */

var AdminEmail = {
    /** @type {Object|null} Cached email settings from Firestore */
    data: null,

    /** Default email types if none exist */
    DEFAULT_EMAIL_TYPES: [
        {
            id: 'incentive_report',
            label: 'Incentive Report / 인센티브 보고서',
            description: 'Monthly incentive calculation results / 월간 인센티브 계산 결과',
            enabled: true,
            to: [],
            cc: []
        },
        {
            id: 'pipeline_alert',
            label: 'Pipeline Alert / 파이프라인 알림',
            description: 'Notifications when pipeline runs complete or fail / 파이프라인 실행 완료/실패 알림',
            enabled: true,
            to: [],
            cc: []
        },
        {
            id: 'threshold_breach',
            label: 'Threshold Breach / 임계값 초과',
            description: 'Alerts when KPI thresholds are breached / KPI 임계값 초과 시 알림',
            enabled: false,
            to: [],
            cc: []
        }
    ],

    /**
     * Initialize the email settings panel.
     */
    init: function() {
        this.load();
    },

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
     * Load email settings from Firestore config/emailSettings.
     */
    load: async function() {
        var container = document.getElementById('email-types-container');
        if (!container) return;

        try {
            var doc = await db.collection('config').doc('emailSettings').get();

            if (doc.exists && doc.data().emailTypes) {
                this.data = doc.data();
            } else {
                this.data = { emailTypes: JSON.parse(JSON.stringify(this.DEFAULT_EMAIL_TYPES)) };
            }

            this.render();
        } catch (error) {
            console.error('[AdminEmail] Load failed:', error);
            container.innerHTML =
                '<p class="text-danger text-center py-3">' +
                '<i class="fa-solid fa-triangle-exclamation me-1"></i> ' +
                this._escapeHtml(error.message) + '</p>';
        }
    },

    /**
     * Save all email settings to Firestore.
     */
    save: async function() {
        try {
            await db.collection('config').doc('emailSettings').set(this.data);
            this._showMessage('email-type-add-msg', 'Settings saved! / 설정 저장됨!', 'success');
        } catch (error) {
            console.error('[AdminEmail] Save failed:', error);
            this._showMessage('email-type-add-msg', 'Save failed: ' + error.message, 'danger');
        }
    },

    /**
     * Toggle enabled state for an email type.
     * @param {string} typeId
     */
    toggleEnabled: function(typeId) {
        var emailType = this.data.emailTypes.find(function(t) { return t.id === typeId; });
        if (!emailType) return;
        emailType.enabled = !emailType.enabled;
        this.save();
        this.render();
    },

    /**
     * Add a recipient (TO or CC) to an email type.
     * @param {string} typeId
     * @param {string} role - 'to' or 'cc'
     */
    addRecipient: function(typeId, role) {
        var emailInput = document.getElementById('einput-' + typeId + '-' + role);
        var nameInput = document.getElementById('ninput-' + typeId + '-' + role);
        var langSelect = document.getElementById('linput-' + typeId + '-' + role);
        if (!emailInput || !nameInput) return;

        var email = emailInput.value.trim().toLowerCase();
        var name = nameInput.value.trim();
        var lang = langSelect ? langSelect.value : 'ko';

        if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            this._showMessage('emsg-' + typeId, this._t('admin.msg.invalidEmail') || 'Invalid email', 'danger');
            emailInput.focus();
            return;
        }
        if (!name) {
            this._showMessage('emsg-' + typeId, this._t('admin.msg.enterName') || 'Enter name', 'danger');
            nameInput.focus();
            return;
        }

        var emailType = this.data.emailTypes.find(function(t) { return t.id === typeId; });
        if (!emailType) return;

        var allRecipients = (emailType.to || []).concat(emailType.cc || []);
        if (allRecipients.some(function(r) { return r.email === email; })) {
            this._showMessage('emsg-' + typeId, this._t('admin.msg.duplicateEmail') || 'Email already exists', 'warning');
            return;
        }

        if (!emailType[role]) emailType[role] = [];
        emailType[role].push({ email: email, name: name, lang: lang });

        emailInput.value = '';
        nameInput.value = '';

        this.save();
        this.render();
    },

    /**
     * Remove a recipient from an email type.
     * @param {string} typeId
     * @param {string} role
     * @param {string} email
     */
    removeRecipient: function(typeId, role, email) {
        if (!confirm('Remove ' + email + '?')) return;

        var emailType = this.data.emailTypes.find(function(t) { return t.id === typeId; });
        if (!emailType || !emailType[role]) return;

        emailType[role] = emailType[role].filter(function(r) { return r.email !== email; });
        this.save();
        this.render();
    },

    /**
     * Add a new email type.
     */
    addEmailType: function() {
        var idInput = document.getElementById('new-etype-id');
        var labelInput = document.getElementById('new-etype-label');
        var descInput = document.getElementById('new-etype-desc');

        var id = (idInput.value || '').trim().toLowerCase().replace(/[^a-z0-9_]/g, '_');
        var label = (labelInput.value || '').trim();

        if (!id || !label) {
            this._showMessage('email-type-add-msg', 'Please fill Type ID and Label', 'danger');
            return;
        }

        if (this.data.emailTypes.some(function(t) { return t.id === id; })) {
            this._showMessage('email-type-add-msg', 'ID already exists', 'warning');
            return;
        }

        this.data.emailTypes.push({
            id: id,
            label: label,
            description: (descInput.value || '').trim(),
            enabled: true,
            to: [],
            cc: []
        });

        idInput.value = '';
        labelInput.value = '';
        descInput.value = '';

        this.save();
        this.render();
    },

    /**
     * Remove an email type entirely.
     * @param {string} typeId
     */
    removeEmailType: function(typeId) {
        if (!confirm('Delete this email type? / 이 이메일 유형을 삭제하시겠습니까?')) return;
        this.data.emailTypes = this.data.emailTypes.filter(function(t) { return t.id !== typeId; });
        this.save();
        this.render();
    },

    /**
     * Migrate legacy email_recipients from system/config into the new format.
     */
    migrateLegacy: async function() {
        try {
            var doc = await db.collection('system').doc('config').get();
            if (!doc.exists || !doc.data().email_recipients) {
                this._showMessage('email-migrate-msg', 'No legacy recipients found.', 'warning');
                return;
            }

            var legacy = doc.data().email_recipients;
            if (!Array.isArray(legacy) || legacy.length === 0) {
                this._showMessage('email-migrate-msg', 'No legacy recipients to migrate.', 'warning');
                return;
            }

            // Find or create incentive_report type
            var target = this.data.emailTypes.find(function(t) { return t.id === 'incentive_report'; });
            if (!target) {
                target = {
                    id: 'incentive_report',
                    label: 'Incentive Report / 인센티브 보고서',
                    description: 'Migrated from legacy settings',
                    enabled: true,
                    to: [],
                    cc: []
                };
                this.data.emailTypes.push(target);
            }

            var imported = 0;
            var self = this;
            legacy.forEach(function(r) {
                var exists = (target.to || []).concat(target.cc || []).some(function(e) { return e.email === r.email; });
                if (!exists) {
                    if (!target.to) target.to = [];
                    target.to.push({
                        email: r.email,
                        name: r.name || '',
                        lang: r.lang || 'ko'
                    });
                    imported++;
                }
            });

            if (imported > 0) {
                await this.save();
                this.render();
                this._showMessage('email-migrate-msg', 'Imported ' + imported + ' recipients into incentive_report TO list.', 'success');
            } else {
                this._showMessage('email-migrate-msg', 'All legacy recipients already exist.', 'warning');
            }
        } catch (error) {
            console.error('[AdminEmail] Migration failed:', error);
            this._showMessage('email-migrate-msg', 'Migration failed: ' + error.message, 'danger');
        }
    },

    /**
     * Render the email types accordion.
     */
    render: function() {
        var container = document.getElementById('email-types-container');
        if (!container || !this.data) return;

        var self = this;
        var types = this.data.emailTypes || [];

        if (types.length === 0) {
            container.innerHTML = '<p class="text-muted text-center py-4"><i class="fa-regular fa-envelope me-1"></i> No email types configured. Add one above.</p>';
            return;
        }

        var langLabels = { ko: '한국어', en: 'English', vi: 'Tiếng Việt' };

        var html = '<div class="accordion" id="emailAccordion">';

        types.forEach(function(et, idx) {
            var safeId = self._escapeHtml(et.id);
            var toCount = (et.to || []).length;
            var ccCount = (et.cc || []).length;

            var statusHtml = et.enabled
                ? '<span class="badge bg-success ms-2"><i class="fa-solid fa-check me-1"></i>ON</span>'
                : '<span class="badge bg-secondary ms-2"><i class="fa-solid fa-xmark me-1"></i>OFF</span>';
            var countHtml = '<span class="badge bg-light text-dark ms-1" style="font-size:0.72rem;">TO:' + toCount + ' CC:' + ccCount + '</span>';

            html += '<div class="accordion-item">';
            html += '<h2 class="accordion-header">';
            html += '<button class="accordion-button' + (idx > 0 ? ' collapsed' : '') + '" type="button" data-bs-toggle="collapse" data-bs-target="#ecollapse-' + safeId + '" style="font-size:0.9rem;font-weight:600;">';
            html += '<i class="fa-solid fa-envelope me-2" style="color:#db2777;"></i>';
            html += self._escapeHtml(et.label) + statusHtml + countHtml;
            html += '</button></h2>';

            html += '<div id="ecollapse-' + safeId + '" class="accordion-collapse collapse' + (idx === 0 ? ' show' : '') + '" data-bs-parent="#emailAccordion">';
            html += '<div class="accordion-body">';

            // Description + toggle + delete
            html += '<div class="d-flex justify-content-between align-items-center mb-3">';
            html += '<span class="text-muted" style="font-size:0.82rem;">' + self._escapeHtml(et.description || '') + '</span>';
            html += '<div class="d-flex align-items-center gap-2">';
            html += '<div class="form-check form-switch">';
            html += '<input class="form-check-input" type="checkbox" id="etoggle-' + safeId + '" ' + (et.enabled ? 'checked' : '') + ' onchange="AdminEmail.toggleEnabled(\'' + safeId + '\')">';
            html += '<label class="form-check-label" for="etoggle-' + safeId + '" style="font-size:0.82rem;">' + (et.enabled ? 'Enabled' : 'Disabled') + '</label>';
            html += '</div>';
            html += '<button class="btn-delete-sm" onclick="AdminEmail.removeEmailType(\'' + safeId + '\')" title="Delete type"><i class="fa-solid fa-trash-can"></i></button>';
            html += '</div></div>';

            // TO section
            html += self._renderRecipientSection(et, 'to', langLabels);
            // CC section
            html += self._renderRecipientSection(et, 'cc', langLabels);

            // Message area
            html += '<div class="message-area" id="emsg-' + safeId + '"></div>';

            html += '</div></div></div>';
        });

        html += '</div>';
        container.innerHTML = html;
    },

    /**
     * Render a TO or CC recipient section.
     * @param {Object} et - email type object
     * @param {string} role - 'to' or 'cc'
     * @param {Object} langLabels
     * @returns {string} HTML
     */
    _renderRecipientSection: function(et, role, langLabels) {
        var self = this;
        var safeId = this._escapeHtml(et.id);
        var recipients = et[role] || [];
        var roleUpper = role.toUpperCase();
        var badgeColor = role === 'to' ? 'primary' : 'secondary';

        var html = '<div class="mb-3">';
        html += '<h6 style="font-size:0.85rem;font-weight:700;color:var(--' + badgeColor + ',#333);">';
        html += '<span class="badge bg-' + badgeColor + ' me-1">' + roleUpper + '</span> ' + roleUpper + ' Recipients</h6>';

        if (recipients.length > 0) {
            html += '<table class="table recipients-table">';
            html += '<thead><tr><th>Name</th><th>Email</th><th>Lang</th><th style="width:50px;"></th></tr></thead><tbody>';

            recipients.forEach(function(r) {
                var langLabel = langLabels[r.lang] || r.lang || 'ko';
                html += '<tr>';
                html += '<td>' + self._escapeHtml(r.name) + '</td>';
                html += '<td><code style="font-size:0.8rem;">' + self._escapeHtml(r.email) + '</code></td>';
                html += '<td><span class="lang-badge ' + self._escapeHtml(r.lang || 'ko') + '">' + self._escapeHtml(langLabel) + '</span></td>';
                html += '<td><button class="btn-remove-sm" onclick="AdminEmail.removeRecipient(\'' + safeId + '\',\'' + role + '\',\'' + self._escapeHtml(r.email).replace(/'/g, "\\'") + '\')" title="Remove">';
                html += '<i class="fa-solid fa-trash-can"></i></button></td>';
                html += '</tr>';
            });

            html += '</tbody></table>';
        } else {
            html += '<p class="text-muted" style="font-size:0.82rem;">No ' + roleUpper + ' recipients yet.</p>';
        }

        // Add form
        html += '<div class="row g-2 align-items-end">';
        html += '<div class="col-md-4">';
        html += '<input type="email" class="form-control form-control-admin" id="einput-' + safeId + '-' + role + '" placeholder="email@example.com">';
        html += '</div>';
        html += '<div class="col-md-3">';
        html += '<input type="text" class="form-control form-control-admin" id="ninput-' + safeId + '-' + role + '" placeholder="Name">';
        html += '</div>';
        html += '<div class="col-md-2">';
        html += '<select class="form-select form-select-admin" id="linput-' + safeId + '-' + role + '">';
        html += '<option value="ko">한국어</option><option value="en">English</option><option value="vi">Tiếng Việt</option>';
        html += '</select></div>';
        html += '<div class="col-md-3">';
        html += '<button class="btn btn-' + (role === 'to' ? 'primary' : 'outline') + '-admin w-100" onclick="AdminEmail.addRecipient(\'' + safeId + '\',\'' + role + '\')">';
        html += '<i class="fa-solid fa-plus me-1"></i> Add ' + roleUpper + '</button></div>';
        html += '</div>';

        html += '</div>';
        return html;
    }
};

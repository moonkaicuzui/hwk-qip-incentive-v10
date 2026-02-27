/**
 * Admin Page Module
 * HWK QIP Incentive Dashboard V10
 *
 * Depends on: firebase-config.js, auth.js (must be loaded first)
 * Uses Firebase v10.7.1 compat SDK (firebase.firestore() style)
 *
 * Firestore collections used:
 *   - thresholds/{month}_{year}       : Threshold configuration per month
 *   - threshold_history               : Change history log
 *   - system/status                   : Pipeline status document
 *   - system/config                   : System config (github_pat, etc.)
 */

var AdminPage = {
    currentMonth: null,
    currentYear: null,

    // Threshold field definitions (defaultVal from centralized THRESHOLD_DEFAULTS in dashboard-data.js)
    THRESHOLD_FIELDS: [
        { id: 'th-attendance-rate',       key: 'attendance_rate',       label: 'Attendance Rate (%)',       defaultVal: (typeof THRESHOLD_DEFAULTS !== 'undefined' ? THRESHOLD_DEFAULTS.attendance_rate : 88) },
        { id: 'th-unapproved-absence',    key: 'unapproved_absence',   label: 'Unapproved Absence (days)', defaultVal: (typeof THRESHOLD_DEFAULTS !== 'undefined' ? THRESHOLD_DEFAULTS.unapproved_absence : 2) },
        { id: 'th-minimum-working-days',  key: 'minimum_working_days', label: 'Minimum Working Days',      defaultVal: (typeof THRESHOLD_DEFAULTS !== 'undefined' ? THRESHOLD_DEFAULTS.minimum_working_days : 12) },
        { id: 'th-area-reject-rate',      key: 'area_reject_rate',     label: 'Area Reject Rate (%)',      defaultVal: (typeof THRESHOLD_DEFAULTS !== 'undefined' ? THRESHOLD_DEFAULTS.area_reject_rate : 3.0) },
        { id: 'th-5prs-pass-rate',        key: '5prs_pass_rate',       label: '5PRS Pass Rate (%)',        defaultVal: (typeof THRESHOLD_DEFAULTS !== 'undefined' ? THRESHOLD_DEFAULTS['5prs_pass_rate'] : 95) },
        { id: 'th-5prs-min-qty',          key: '5prs_min_qty',         label: '5PRS Inspection Qty',       defaultVal: (typeof THRESHOLD_DEFAULTS !== 'undefined' ? THRESHOLD_DEFAULTS['5prs_min_qty'] : 100) }
    ],

    /**
     * Initialize the admin page.
     * Checks admin auth, sets defaults, binds events, loads data.
     */
    async init() {
        try {
            var user = await requireAdmin();
            if (!user) return;

            // Hide auth loading overlay
            document.getElementById('auth-loading').style.display = 'none';

            // Show user email
            document.getElementById('user-email').textContent = user.email;

            // Set default month/year to current
            this.setDefaultMonthYear();

            // Bind events
            this.bindEvents();

            // Load initial data
            this.loadChangeHistory();
            this.loadSystemStatus();
            this.loadEmailSettings();

            // Update working days panel display
            this.updateWorkingDaysDisplay();

        } catch (error) {
            console.error('[Admin] Init failed:', error);
        }
    },

    /**
     * Set dropdowns to current month/year.
     */
    setDefaultMonthYear: function() {
        var now = new Date();
        var months = [
            'january', 'february', 'march', 'april', 'may', 'june',
            'july', 'august', 'september', 'october', 'november', 'december'
        ];

        this.currentMonth = months[now.getMonth()];
        this.currentYear = String(now.getFullYear());

        var monthSelect = document.getElementById('threshold-month');
        var yearSelect = document.getElementById('threshold-year');

        if (monthSelect) monthSelect.value = this.currentMonth;
        if (yearSelect) yearSelect.value = this.currentYear;
    },

    /**
     * Bind event listeners for month/year selector changes.
     */
    bindEvents: function() {
        var self = this;

        // Update internal state when selectors change
        var monthSelect = document.getElementById('threshold-month');
        var yearSelect = document.getElementById('threshold-year');

        if (monthSelect) {
            monthSelect.addEventListener('change', function() {
                self.currentMonth = this.value;
                self.updateWorkingDaysDisplay();
            });
        }

        if (yearSelect) {
            yearSelect.addEventListener('change', function() {
                self.currentYear = this.value;
                self.updateWorkingDaysDisplay();
            });
        }
    },

    /**
     * Get the Firestore document ID for the current month/year.
     * Format: "{month}_{year}" e.g. "february_2026"
     *
     * @returns {string} Document ID
     */
    getDocId: function() {
        var month = document.getElementById('threshold-month').value;
        var year = document.getElementById('threshold-year').value;
        this.currentMonth = month;
        this.currentYear = year;
        return month + '_' + year;
    },

    /**
     * Load thresholds from Firestore for the selected month/year.
     * Populates input fields with current values.
     */
    async loadThresholds() {
        var docId = this.getDocId();
        var self = this;

        var btn = document.getElementById('btn-load-thresholds');
        btn.disabled = true;
        btn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status"></span>';

        try {
            var doc = await db.collection('thresholds').doc(docId).get();

            if (doc.exists) {
                var data = doc.data();
                self.THRESHOLD_FIELDS.forEach(function(field) {
                    var input = document.getElementById(field.id);
                    if (input) {
                        input.value = data[field.key] !== undefined ? data[field.key] : field.defaultVal;
                    }
                });

                // Also load working_days_override if present
                var wdInput = document.getElementById('wd-override-value');
                var wdCurrent = document.getElementById('wd-current-value');
                if (data.working_days_override !== undefined) {
                    wdCurrent.textContent = data.working_days_override + ' days (override)';
                    wdInput.value = data.working_days_override;
                } else if (data.working_days !== undefined) {
                    wdCurrent.textContent = data.working_days + ' days';
                    wdInput.value = '';
                } else {
                    wdCurrent.textContent = 'Not set';
                    wdInput.value = '';
                }

                self.showMessage('threshold-message', 'Thresholds loaded for ' + docId.replace('_', ' ').toUpperCase(), 'success');
            } else {
                // No document exists - set defaults
                self.THRESHOLD_FIELDS.forEach(function(field) {
                    var input = document.getElementById(field.id);
                    if (input) {
                        input.value = field.defaultVal;
                    }
                });
                document.getElementById('wd-current-value').textContent = 'Not set';
                document.getElementById('wd-override-value').value = '';

                self.showMessage('threshold-message', 'No thresholds saved for ' + docId.replace('_', ' ').toUpperCase() + '. Showing defaults.', 'warning');
            }
        } catch (error) {
            console.error('[Admin] Failed to load thresholds:', error);
            self.showMessage('threshold-message', 'Failed to load thresholds: ' + error.message, 'danger');
        } finally {
            btn.disabled = false;
            btn.innerHTML = '<i class="fa-solid fa-download"></i> Load';
        }
    },

    /**
     * Save thresholds to Firestore for the selected month/year.
     * Validates inputs, writes to Firestore, and logs changes to threshold_history.
     */
    async saveThresholds() {
        var docId = this.getDocId();
        var self = this;

        var btn = document.getElementById('btn-save-thresholds');
        btn.disabled = true;
        btn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status"></span> Saving...';

        try {
            // Read and validate values
            var newValues = {};
            var valid = true;

            self.THRESHOLD_FIELDS.forEach(function(field) {
                var input = document.getElementById(field.id);
                var val = parseFloat(input.value);

                if (isNaN(val) || val < 0) {
                    input.classList.add('is-invalid');
                    valid = false;
                } else {
                    input.classList.remove('is-invalid');
                    newValues[field.key] = val;
                }
            });

            if (!valid) {
                self.showMessage('threshold-message', 'Please enter valid positive numbers for all fields.', 'danger');
                btn.disabled = false;
                btn.innerHTML = '<i class="fa-solid fa-floppy-disk me-1"></i> Save Thresholds';
                return;
            }

            // Read current values (for change history)
            var oldDoc = await db.collection('thresholds').doc(docId).get();
            var oldValues = oldDoc.exists ? oldDoc.data() : {};

            // Build change records
            var changes = [];
            self.THRESHOLD_FIELDS.forEach(function(field) {
                var oldVal = oldValues[field.key] !== undefined ? oldValues[field.key] : null;
                var newVal = newValues[field.key];

                if (oldVal !== newVal) {
                    changes.push({
                        field: field.label,
                        field_key: field.key,
                        old_value: oldVal,
                        new_value: newVal
                    });
                }
            });

            // Add metadata
            newValues.updated_at = firebase.firestore.FieldValue.serverTimestamp();
            newValues.updated_by = firebase.auth().currentUser.email;

            // Write to Firestore (merge to preserve working_days_override and other fields)
            await db.collection('thresholds').doc(docId).set(newValues, { merge: true });

            // Write change history if there were changes
            if (changes.length > 0) {
                await db.collection('threshold_history').add({
                    timestamp: firebase.firestore.FieldValue.serverTimestamp(),
                    changed_by: firebase.auth().currentUser.email,
                    month_year: docId,
                    changes: changes,
                    type: 'threshold'
                });
            }

            self.showMessage(
                'threshold-message',
                'Thresholds saved for ' + docId.replace('_', ' ').toUpperCase() +
                (changes.length > 0 ? ' (' + changes.length + ' field(s) changed)' : ' (no changes)'),
                'success'
            );

            // Refresh change history
            self.loadChangeHistory();

        } catch (error) {
            console.error('[Admin] Failed to save thresholds:', error);
            self.showMessage('threshold-message', 'Failed to save: ' + error.message, 'danger');
        } finally {
            btn.disabled = false;
            btn.innerHTML = '<i class="fa-solid fa-floppy-disk me-1"></i> Save Thresholds';
        }
    },

    /**
     * Load change history from Firestore.
     * Reads the last 20 entries from threshold_history collection, sorted newest first.
     */
    async loadChangeHistory() {
        var tbody = document.getElementById('history-table-body');

        try {
            var snapshot = await db.collection('threshold_history')
                .orderBy('timestamp', 'desc')
                .limit(20)
                .get();

            if (snapshot.empty) {
                tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted py-4">' +
                    '<i class="fa-regular fa-folder-open me-1"></i> No change history yet</td></tr>';
                return;
            }

            var html = '';

            snapshot.forEach(function(doc) {
                var data = doc.data();
                var timestamp = data.timestamp
                    ? data.timestamp.toDate().toLocaleString('en-US', {
                        year: 'numeric', month: 'short', day: 'numeric',
                        hour: '2-digit', minute: '2-digit'
                    })
                    : '--';

                var changedBy = data.changed_by || '--';
                // Shorten email for display
                var emailShort = changedBy.split('@')[0];

                var monthYear = data.month_year
                    ? data.month_year.replace('_', ' ').toUpperCase()
                    : '--';

                var changes = data.changes || [];

                if (changes.length === 0) {
                    // Single row for entries without detailed changes
                    html += '<tr>' +
                        '<td>' + timestamp + '</td>' +
                        '<td>' + emailShort + '</td>' +
                        '<td><span class="badge bg-light text-dark">' + monthYear + '</span></td>' +
                        '<td>' + (data.type || 'threshold') + '</td>' +
                        '<td>--</td>' +
                        '<td>--</td>' +
                        '</tr>';
                } else {
                    // One row per changed field
                    changes.forEach(function(change, idx) {
                        html += '<tr>' +
                            '<td>' + (idx === 0 ? timestamp : '') + '</td>' +
                            '<td>' + (idx === 0 ? emailShort : '') + '</td>' +
                            '<td>' + (idx === 0 ? '<span class="badge bg-light text-dark">' + monthYear + '</span>' : '') + '</td>' +
                            '<td>' + (change.field || change.field_key || '--') + '</td>' +
                            '<td><span class="text-danger">' + (change.old_value !== null ? change.old_value : 'N/A') + '</span></td>' +
                            '<td><span class="text-success fw-bold">' + (change.new_value !== null ? change.new_value : 'N/A') + '</span></td>' +
                            '</tr>';
                    });
                }
            });

            tbody.innerHTML = html;

        } catch (error) {
            console.error('[Admin] Failed to load change history:', error);
            tbody.innerHTML = '<tr><td colspan="6" class="text-center text-danger py-3">' +
                '<i class="fa-solid fa-triangle-exclamation me-1"></i> Failed to load history: ' + error.message + '</td></tr>';
        }
    },

    /**
     * Load system status from Firestore.
     * Reads from system/status document.
     */
    async loadSystemStatus() {
        try {
            var doc = await db.collection('system').doc('status').get();

            if (doc.exists) {
                var data = doc.data();

                // Last pipeline run
                var lastRun = data.last_run_at
                    ? (data.last_run_at.toDate
                        ? data.last_run_at.toDate().toLocaleString('en-US', {
                            year: 'numeric', month: 'short', day: 'numeric',
                            hour: '2-digit', minute: '2-digit', second: '2-digit'
                        })
                        : new Date(data.last_run_at).toLocaleString())
                    : '--';
                document.getElementById('status-last-run').textContent = lastRun;

                // Status badge
                var status = data.status || 'unknown';
                var badgeArea = document.getElementById('status-badge-area');

                if (status === 'success') {
                    badgeArea.innerHTML = '<span class="status-badge success"><i class="fa-solid fa-circle-check"></i> Success</span>';
                } else if (status === 'failure' || status === 'error') {
                    badgeArea.innerHTML = '<span class="status-badge failure"><i class="fa-solid fa-circle-xmark"></i> Failure</span>';
                } else {
                    badgeArea.innerHTML = '<span class="status-badge unknown"><i class="fa-solid fa-circle-question"></i> ' + status + '</span>';
                }

                // Last data update
                var lastDataUpdate = data.last_data_update
                    ? (data.last_data_update.toDate
                        ? data.last_data_update.toDate().toLocaleString('en-US', {
                            year: 'numeric', month: 'short', day: 'numeric',
                            hour: '2-digit', minute: '2-digit'
                        })
                        : new Date(data.last_data_update).toLocaleString())
                    : '--';
                document.getElementById('status-last-data-update').textContent = lastDataUpdate;

                // Current month
                var currentMonth = data.current_month || '--';
                document.getElementById('status-current-month').textContent = currentMonth;

            } else {
                // No status document
                document.getElementById('status-last-run').textContent = 'Never';
                document.getElementById('status-badge-area').innerHTML =
                    '<span class="status-badge unknown"><i class="fa-solid fa-circle-question"></i> No data</span>';
                document.getElementById('status-last-data-update').textContent = 'Never';
                document.getElementById('status-current-month').textContent = 'Not set';
            }
        } catch (error) {
            console.error('[Admin] Failed to load system status:', error);
            document.getElementById('status-last-run').textContent = 'Error loading';
            document.getElementById('status-badge-area').innerHTML =
                '<span class="status-badge failure"><i class="fa-solid fa-triangle-exclamation"></i> Load Error</span>';
        }
    },

    /**
     * Trigger GitHub Actions pipeline via workflow_dispatch.
     * Reads GitHub PAT from Firestore system/config document.
     * Shows confirmation dialog before triggering.
     */
    async triggerPipeline() {
        // Confirmation dialog
        var confirmed = confirm(
            'Run Pipeline Now?\n\n' +
            'This will trigger the GitHub Actions auto-update workflow.\n' +
            'The pipeline will:\n' +
            '  1. Download latest data from Google Drive\n' +
            '  2. Recalculate incentives\n' +
            '  3. Regenerate dashboard\n' +
            '  4. Deploy to web\n\n' +
            'Continue?'
        );

        if (!confirmed) return;

        var self = this;
        var btn = document.getElementById('btn-run-pipeline');
        btn.disabled = true;
        btn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status"></span> Triggering...';

        try {
            // Read GitHub PAT from Firestore
            var configDoc = await db.collection('system').doc('config').get();

            if (!configDoc.exists || !configDoc.data().github_pat) {
                self.showMessage(
                    'pipeline-message',
                    'GitHub PAT not configured. Please set the "github_pat" field in Firebase Console under system/config document.',
                    'warning'
                );
                return;
            }

            var config = configDoc.data();
            var pat = config.github_pat;
            var owner = config.github_owner || 'moonkaicuzui';
            var repo = config.github_repo || 'qip-dashboard';
            var workflow = config.github_workflow || 'auto-update-enhanced.yml';

            // Call GitHub API to trigger workflow_dispatch
            var response = await fetch(
                'https://api.github.com/repos/' + owner + '/' + repo + '/actions/workflows/' + workflow + '/dispatches',
                {
                    method: 'POST',
                    headers: {
                        'Authorization': 'token ' + pat,
                        'Accept': 'application/vnd.github.v3+json',
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ ref: 'main' })
                }
            );

            if (response.status === 204) {
                // Success - 204 No Content is the expected response
                self.showMessage(
                    'pipeline-message',
                    'Pipeline triggered successfully! The workflow will start shortly. Check GitHub Actions for progress.',
                    'success'
                );

                // Update system status after a brief delay
                setTimeout(function() {
                    self.loadSystemStatus();
                }, 5000);

            } else {
                var errorBody = await response.text();
                throw new Error('GitHub API returned status ' + response.status + ': ' + errorBody);
            }

        } catch (error) {
            console.error('[Admin] Failed to trigger pipeline:', error);
            self.showMessage(
                'pipeline-message',
                'Failed to trigger pipeline: ' + error.message,
                'danger'
            );
        } finally {
            btn.disabled = false;
            btn.innerHTML = '<i class="fa-solid fa-play me-1"></i> Run Pipeline Now';
        }
    },

    /**
     * Update the Working Days display to show the currently selected period.
     */
    updateWorkingDaysDisplay: function() {
        var month = document.getElementById('threshold-month').value;
        var year = document.getElementById('threshold-year').value;
        var display = (month.charAt(0).toUpperCase() + month.slice(1)) + ' ' + year;
        document.getElementById('wd-selected-period').textContent = display;
    },

    /**
     * Update working days override in Firestore.
     * Writes to thresholds/{month}_{year}.working_days_override field.
     */
    async updateWorkingDays() {
        var docId = this.getDocId();
        var self = this;

        var overrideInput = document.getElementById('wd-override-value');
        var overrideValue = parseInt(overrideInput.value, 10);

        if (isNaN(overrideValue) || overrideValue < 0 || overrideValue > 31) {
            self.showMessage('working-days-message', 'Please enter a valid number between 0 and 31.', 'danger');
            return;
        }

        var btn = document.getElementById('btn-update-working-days');
        btn.disabled = true;
        btn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status"></span> Updating...';

        try {
            // Read current value for history
            var currentDoc = await db.collection('thresholds').doc(docId).get();
            var oldValue = null;
            if (currentDoc.exists) {
                var currentData = currentDoc.data();
                oldValue = currentData.working_days_override !== undefined
                    ? currentData.working_days_override
                    : (currentData.working_days !== undefined ? currentData.working_days : null);
            }

            // Write override to Firestore
            await db.collection('thresholds').doc(docId).set({
                working_days_override: overrideValue,
                working_days_updated_at: firebase.firestore.FieldValue.serverTimestamp(),
                working_days_updated_by: firebase.auth().currentUser.email
            }, { merge: true });

            // Log to change history
            await db.collection('threshold_history').add({
                timestamp: firebase.firestore.FieldValue.serverTimestamp(),
                changed_by: firebase.auth().currentUser.email,
                month_year: docId,
                changes: [{
                    field: 'Working Days Override',
                    field_key: 'working_days_override',
                    old_value: oldValue,
                    new_value: overrideValue
                }],
                type: 'working_days'
            });

            // Update display
            document.getElementById('wd-current-value').textContent = overrideValue + ' days (override)';

            self.showMessage(
                'working-days-message',
                'Working days override set to ' + overrideValue + ' for ' + docId.replace('_', ' ').toUpperCase(),
                'success'
            );

            // Refresh history
            self.loadChangeHistory();

        } catch (error) {
            console.error('[Admin] Failed to update working days:', error);
            self.showMessage('working-days-message', 'Failed to update: ' + error.message, 'danger');
        } finally {
            btn.disabled = false;
            btn.innerHTML = '<i class="fa-solid fa-pen-to-square me-1"></i> Update Working Days';
        }
    },

    /**
     * Show a message in the specified element area.
     *
     * @param {string} elementId - ID of the message container element
     * @param {string} message - Message text to display
     * @param {string} type - Bootstrap alert type: 'success', 'danger', 'warning'
     */
    showMessage: function(elementId, message, type) {
        var container = document.getElementById(elementId);
        if (!container) return;

        var iconMap = {
            success: 'fa-solid fa-circle-check',
            danger: 'fa-solid fa-circle-xmark',
            warning: 'fa-solid fa-triangle-exclamation'
        };

        var icon = iconMap[type] || iconMap.warning;

        container.innerHTML =
            '<div class="alert alert-' + type + ' d-flex align-items-center" role="alert">' +
            '<i class="' + icon + ' me-2"></i>' +
            '<span>' + message + '</span>' +
            '</div>';

        // Auto-hide after 5 seconds
        setTimeout(function() {
            var alert = container.querySelector('.alert');
            if (alert) {
                alert.style.transition = 'opacity 0.3s ease';
                alert.style.opacity = '0';
                setTimeout(function() {
                    container.innerHTML = '';
                }, 300);
            }
        }, 5000);
    },

    /**
     * Handle logout - clear cache and sign out.
     */
    handleLogout: function() {
        signOut();
    },

    // =====================================================================
    // Email Report Settings (Panel 5)
    // =====================================================================

    /**
     * Load email recipients from Firestore system/config document.
     */
    async loadEmailSettings() {
        var container = document.getElementById('email-recipients-list');

        try {
            var doc = await db.collection('system').doc('config').get();

            if (doc.exists && doc.data().email_recipients) {
                var recipients = doc.data().email_recipients;
                this.renderRecipients(recipients);
            } else {
                container.innerHTML =
                    '<p class="text-muted text-center py-3">' +
                    '<i class="fa-regular fa-envelope me-1"></i> No recipients configured</p>';
            }
        } catch (error) {
            console.error('[Admin] Failed to load email settings:', error);
            container.innerHTML =
                '<p class="text-danger text-center py-3">' +
                '<i class="fa-solid fa-triangle-exclamation me-1"></i> Failed to load: ' + this.escapeHtml(error.message) + '</p>';
        }
    },

    /**
     * Render recipients array as an HTML table.
     *
     * @param {Array} recipients - Array of {email, name, lang} objects
     */
    renderRecipients: function(recipients) {
        var container = document.getElementById('email-recipients-list');

        if (!recipients || recipients.length === 0) {
            container.innerHTML =
                '<p class="text-muted text-center py-3">' +
                '<i class="fa-regular fa-envelope me-1"></i> No recipients configured</p>';
            return;
        }

        var langLabels = { ko: '한국어', en: 'English', vi: 'Tiếng Việt' };
        var self = this;

        var html =
            '<table class="table recipients-table">' +
            '<thead><tr>' +
            '<th>Name</th>' +
            '<th>Email</th>' +
            '<th>Lang</th>' +
            '<th style="width: 60px;"></th>' +
            '</tr></thead><tbody>';

        recipients.forEach(function(r) {
            var safeName = self.escapeHtml(r.name || '--');
            var safeEmail = self.escapeHtml(r.email || '--');
            var lang = r.lang || 'ko';
            var langLabel = langLabels[lang] || lang;

            html += '<tr>' +
                '<td>' + safeName + '</td>' +
                '<td><code style="font-size: 0.8rem;">' + safeEmail + '</code></td>' +
                '<td><span class="lang-badge ' + self.escapeHtml(lang) + '">' + self.escapeHtml(langLabel) + '</span></td>' +
                '<td><button class="btn-remove-sm" onclick="AdminPage.removeRecipient(\'' + safeEmail.replace(/'/g, "\\'") + '\')" title="Remove">' +
                '<i class="fa-solid fa-trash-can"></i></button></td>' +
                '</tr>';
        });

        html += '</tbody></table>';
        container.innerHTML = html;
    },

    /**
     * Add a new email recipient to Firestore.
     * Validates input, checks for duplicates, and uses Firestore arrayUnion.
     */
    async addRecipient() {
        var self = this;

        var emailInput = document.getElementById('new-recipient-email');
        var nameInput = document.getElementById('new-recipient-name');
        var langSelect = document.getElementById('new-recipient-lang');

        var email = emailInput.value.trim().toLowerCase();
        var name = nameInput.value.trim();
        var lang = langSelect.value;

        // Validate email
        if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            self.showMessage('email-settings-message', 'Please enter a valid email address.', 'danger');
            emailInput.focus();
            return;
        }

        // Validate name
        if (!name) {
            self.showMessage('email-settings-message', 'Please enter a name.', 'danger');
            nameInput.focus();
            return;
        }

        try {
            // Check for duplicate
            var doc = await db.collection('system').doc('config').get();
            var existing = (doc.exists && doc.data().email_recipients) ? doc.data().email_recipients : [];
            var isDuplicate = existing.some(function(r) { return r.email === email; });

            if (isDuplicate) {
                self.showMessage('email-settings-message', 'This email is already in the recipient list.', 'warning');
                return;
            }

            // Add to Firestore using arrayUnion
            var newRecipient = { email: email, name: name, lang: lang };

            await db.collection('system').doc('config').set({
                email_recipients: firebase.firestore.FieldValue.arrayUnion(newRecipient)
            }, { merge: true });

            // Clear form
            emailInput.value = '';
            nameInput.value = '';
            langSelect.value = 'ko';

            self.showMessage('email-settings-message', 'Added ' + self.escapeHtml(name) + ' (' + self.escapeHtml(email) + ')', 'success');

            // Reload list
            self.loadEmailSettings();

        } catch (error) {
            console.error('[Admin] Failed to add recipient:', error);
            self.showMessage('email-settings-message', 'Failed to add: ' + error.message, 'danger');
        }
    },

    /**
     * Remove a recipient by email address.
     * Reads current array, filters out the target, and writes back.
     *
     * @param {string} email - Email address to remove
     */
    async removeRecipient(email) {
        if (!confirm('Remove ' + email + ' from the recipient list?')) return;

        var self = this;

        try {
            var doc = await db.collection('system').doc('config').get();
            if (!doc.exists) return;

            var recipients = doc.data().email_recipients || [];
            var updated = recipients.filter(function(r) { return r.email !== email; });

            await db.collection('system').doc('config').set({
                email_recipients: updated
            }, { merge: true });

            self.showMessage('email-settings-message', 'Removed ' + self.escapeHtml(email), 'success');

            // Reload list
            self.loadEmailSettings();

        } catch (error) {
            console.error('[Admin] Failed to remove recipient:', error);
            self.showMessage('email-settings-message', 'Failed to remove: ' + error.message, 'danger');
        }
    },

    /**
     * Escape HTML special characters to prevent XSS.
     *
     * @param {string} str - Input string
     * @returns {string} Escaped string
     */
    escapeHtml: function(str) {
        if (!str) return '';
        var div = document.createElement('div');
        div.appendChild(document.createTextNode(String(str)));
        return div.innerHTML;
    }
};

// =====================================================================
// Initialize on DOM ready
// =====================================================================
document.addEventListener('DOMContentLoaded', function() {
    AdminPage.init();
});

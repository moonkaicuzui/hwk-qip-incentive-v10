/**
 * Dashboard Data Module
 * HWK QIP Incentive Dashboard V10
 *
 * Loads data from Firestore via REST API (primary) with SDK fallback.
 * REST API uses standard HTTP fetch — no WebChannel dependency.
 *
 * Depends on: firebase-config.js (must be loaded first)
 *
 * Firestore collections:
 *   - employees/{month}_{year}/all_data/data   (single-doc optimized)
 *   - dashboard_summary/{month}_{year}
 *   - thresholds/{month}_{year}
 *
 * Global variables set:
 *   - window.employeeData        (array of employee objects)
 *   - window.dashboardSummary    (summary object)
 *   - window.thresholds          (thresholds object)
 *   - window.employeeHelpers     (V9-compatible helper functions)
 */

// ---------------------------------------------------------------------------
// Cache Configuration
// ---------------------------------------------------------------------------

var CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes
var QIP_DEBUG = (typeof window !== 'undefined' && window.QIP_DEBUG) || false;
var FIRESTORE_PROJECT_ID = 'hwk-qip-incentive-dashboard';
var FIRESTORE_REST_BASE = 'https://firestore.googleapis.com/v1/projects/' +
    FIRESTORE_PROJECT_ID + '/databases/(default)/documents/';

// ---------------------------------------------------------------------------
// Firestore REST API helpers
// ---------------------------------------------------------------------------

function _parseFirestoreValue(val) {
    if (val === undefined || val === null) return null;
    if (val.stringValue !== undefined) return val.stringValue;
    if (val.integerValue !== undefined) return Number(val.integerValue);
    if (val.doubleValue !== undefined) return val.doubleValue;
    if (val.booleanValue !== undefined) return val.booleanValue;
    if (val.nullValue !== undefined) return null;
    if (val.timestampValue !== undefined) return val.timestampValue;
    if (val.arrayValue) {
        return (val.arrayValue.values || []).map(_parseFirestoreValue);
    }
    if (val.mapValue) {
        return _parseFirestoreRestDoc(val.mapValue.fields || {});
    }
    return null;
}

function _parseFirestoreRestDoc(fields) {
    if (!fields) return {};
    var result = {};
    Object.keys(fields).forEach(function (key) {
        result[key] = _parseFirestoreValue(fields[key]);
    });
    return result;
}

/**
 * Fetch a Firestore document via REST API.
 * @param {string} path - Document path (e.g. "employees/february_2026/all_data/data")
 * @param {string} token - Firebase auth ID token
 * @returns {Promise<Object|null>} Parsed document data or null
 */
function _firestoreRestGet(path, token) {
    return fetch(FIRESTORE_REST_BASE + path, {
        headers: { 'Authorization': 'Bearer ' + token }
    }).then(function (resp) {
        if (!resp.ok) {
            console.warn('[REST] Failed to fetch ' + path + ': ' + resp.status);
            return null;
        }
        return resp.json();
    }).then(function (json) {
        if (!json || !json.fields) return null;
        return _parseFirestoreRestDoc(json.fields);
    }).catch(function (err) {
        console.error('[REST] Error fetching ' + path + ':', err);
        return null;
    });
}

/**
 * List documents in a Firestore collection via REST API.
 * @param {string} collectionPath - Collection path
 * @param {string} token - Firebase auth ID token
 * @returns {Promise<Array>} Array of { id, data } objects
 */
function _firestoreRestList(collectionPath, token) {
    return fetch(FIRESTORE_REST_BASE + collectionPath, {
        headers: { 'Authorization': 'Bearer ' + token }
    }).then(function (resp) {
        if (!resp.ok) return [];
        return resp.json();
    }).then(function (json) {
        var docs = json.documents || [];
        return docs.map(function (doc) {
            var name = doc.name || '';
            var id = name.split('/').pop();
            return { id: id, data: _parseFirestoreRestDoc(doc.fields || {}) };
        });
    }).catch(function () { return []; });
}

// ---------------------------------------------------------------------------
// Centralized Defaults
// ---------------------------------------------------------------------------

var THRESHOLD_DEFAULTS = {
    attendance_rate: 88,
    unapproved_absence: 2,
    minimum_working_days: 12,
    area_reject_rate: 3.0,
    '5prs_pass_rate': 95,
    '5prs_min_qty': 100,
    consecutive_aql_months: 3
};

var PROGRESSIVE_TABLE_DEFAULT = [
    0,        // index 0 (unused)
    150000,   // month 1
    250000,   // month 2
    300000,   // month 3
    350000,   // month 4
    400000,   // month 5
    450000,   // month 6
    500000,   // month 7
    650000,   // month 8
    750000,   // month 9
    850000,   // month 10
    950000,   // month 11
    1000000,  // month 12
    1000000,  // month 13
    1000000,  // month 14
    1000000   // month 15
];

// ---------------------------------------------------------------------------
// DashboardData Namespace
// ---------------------------------------------------------------------------

var DashboardData = {

    _cache: {},

    _cacheKey: function (month, year, type) {
        return 'qip_' + type + '_' + month + '_' + year;
    },

    _getCache: function (key) {
        try {
            var raw = sessionStorage.getItem(key);
            if (!raw) return null;
            var wrapper = JSON.parse(raw);
            if (Date.now() - (wrapper._ts || 0) > CACHE_TTL_MS) {
                sessionStorage.removeItem(key);
                return null;
            }
            return wrapper.data;
        } catch (e) {
            sessionStorage.removeItem(key);
            return null;
        }
    },

    _setCache: function (key, data) {
        try {
            sessionStorage.setItem(key, JSON.stringify({ _ts: Date.now(), data: data }));
        } catch (e) { /* storage full — skip */ }
    },

    _showLoading: function () {
        var el = document.getElementById('loading-overlay');
        if (el) el.style.display = 'flex';
    },

    _hideLoading: function () {
        var el = document.getElementById('loading-overlay');
        if (el) el.style.display = 'none';
    },

    _showError: function (message) {
        var el = document.getElementById('error-message');
        if (el) {
            el.textContent = message;
            el.style.display = 'block';
        }
        console.error('[DashboardData] Error:', message);
    },

    _hideError: function () {
        var el = document.getElementById('error-message');
        if (el) el.style.display = 'none';
    },

    /**
     * Get auth token from current Firebase user.
     * @returns {Promise<string>} ID token
     */
    _getToken: function () {
        var user = firebase.auth().currentUser;
        if (!user) return Promise.reject(new Error('Not authenticated'));
        return user.getIdToken();
    },

    // ------------------------------------------------------------------
    // Loading step indicator
    // ------------------------------------------------------------------

    _updateLoadingStep: function (step, state) {
        var el = document.getElementById('loadStep' + step);
        var bar = document.getElementById('loadingProgressBar');
        if (el) {
            var icon = el.querySelector('.step-icon');
            if (state === 'active') {
                el.className = 'active';
                if (icon) icon.textContent = '◉';
            } else if (state === 'done') {
                el.className = 'done';
                if (icon) icon.textContent = '✓';
            }
        }
        if (bar) {
            var pct = state === 'done' ? (step * 25) : ((step - 1) * 25 + 12);
            bar.style.width = pct + '%';
        }
    },

    // ------------------------------------------------------------------
    // Data loaders (REST API primary)
    // ------------------------------------------------------------------

    loadEmployees: function (month, year) {
        var self = this;
        var key = self._cacheKey(month, year, 'employees');

        var cached = self._getCache(key);
        if (cached) {
            window.employeeData = cached;
            return Promise.resolve(cached);
        }

        var docPath = 'employees/' + month + '_' + year + '/all_data/data';

        return self._getToken().then(function (token) {
            return _firestoreRestGet(docPath, token);
        }).then(function (docData) {
            var employees = (docData && docData.employees) ? docData.employees : [];
            window.employeeData = employees;
            if (employees.length > 0) self._setCache(key, employees);
            return employees;
        }).catch(function (error) {
            console.error('[DashboardData] loadEmployees failed:', error);
            window.employeeData = [];
            return [];
        });
    },

    loadSummary: function (month, year) {
        var self = this;
        var key = self._cacheKey(month, year, 'summary');

        var cached = self._getCache(key);
        if (cached) {
            window.dashboardSummary = cached;
            return Promise.resolve(cached);
        }

        var docPath = 'dashboard_summary/' + month + '_' + year;

        return self._getToken().then(function (token) {
            return _firestoreRestGet(docPath, token);
        }).then(function (summary) {
            summary = summary || {};
            window.dashboardSummary = summary;
            if (Object.keys(summary).length > 0) self._setCache(key, summary);
            return summary;
        }).catch(function (error) {
            console.error('[DashboardData] loadSummary failed:', error);
            window.dashboardSummary = {};
            return {};
        });
    },

    loadThresholds: function (month, year) {
        var self = this;
        var key = self._cacheKey(month, year, 'thresholds');
        var defaults = THRESHOLD_DEFAULTS;

        var cached = self._getCache(key);
        if (cached) {
            window.thresholds = cached;
            window.progressiveTable = cached.progressive_table || PROGRESSIVE_TABLE_DEFAULT;
            return Promise.resolve(cached);
        }

        var docPath = 'thresholds/' + month + '_' + year;

        return self._getToken().then(function (token) {
            return _firestoreRestGet(docPath, token);
        }).then(function (stored) {
            var thresholds = {};
            if (!stored) {
                Object.keys(defaults).forEach(function (k) { thresholds[k] = defaults[k]; });
            } else {
                Object.keys(defaults).forEach(function (k) {
                    thresholds[k] = (stored[k] !== undefined && stored[k] !== null) ? stored[k] : defaults[k];
                });
                Object.keys(stored).forEach(function (k) {
                    if (thresholds[k] === undefined) thresholds[k] = stored[k];
                });
            }
            window.thresholds = thresholds;
            window.progressiveTable = thresholds.progressive_table || PROGRESSIVE_TABLE_DEFAULT;
            self._setCache(key, thresholds);
            return thresholds;
        }).catch(function () {
            window.thresholds = Object.assign({}, defaults);
            window.progressiveTable = PROGRESSIVE_TABLE_DEFAULT;
            return window.thresholds;
        });
    },

    // ------------------------------------------------------------------
    // loadAll — orchestrates parallel loading
    // ------------------------------------------------------------------

    loadAll: function (month, year) {
        var self = this;

        self._hideError();
        self._showLoading();
        self._updateLoadingStep(1, 'active');

        var employeesPromise = self.loadEmployees(month, year).then(function (r) {
            self._updateLoadingStep(1, 'done');
            self._updateLoadingStep(2, 'active');
            return r;
        });
        var summaryPromise = self.loadSummary(month, year).then(function (r) {
            self._updateLoadingStep(2, 'done');
            return r;
        });
        var thresholdsPromise = self.loadThresholds(month, year).then(function (r) {
            self._updateLoadingStep(3, 'active');
            return r;
        });

        return Promise.all([employeesPromise, summaryPromise, thresholdsPromise])
            .then(function (results) {
                self._updateLoadingStep(3, 'done');
                self._updateLoadingStep(4, 'active');

                var employees = results[0];
                var summary = results[1];
                var thresholds = results[2];

                // Phase 1: Data normalization
                if (employees && employees.length > 0) {
                    employees.forEach(function (emp) {
                        emp.currentIncentive = parseFloat(emp.current_incentive || emp.currentIncentive || 0) || 0;
                        emp.previousIncentive = parseFloat(emp.previous_incentive || emp.previousIncentive || 0) || 0;
                        emp.hasReceivedIncentive = emp.currentIncentive > 0;
                        if (emp['Employee No'] !== undefined) emp['Employee No'] = String(emp['Employee No']);
                        if (emp.emp_no !== undefined) emp.emp_no = String(emp.emp_no);
                        if (emp.boss_id !== undefined) emp.boss_id = String(emp.boss_id);
                    });
                }

                _setupEmployeeHelpers();
                window._dashboardMonth = month;
                window._dashboardYear = year;

                self._updateLoadingStep(4, 'done');
                self._hideLoading();

                return {
                    employees: employees,
                    summary: summary,
                    thresholds: thresholds,
                    metadata: { lastUpdated: summary.data_updated_at || summary.calculated_at || null }
                };
            })
            .catch(function (error) {
                console.error('[DashboardData] loadAll failed:', error);
                self._hideLoading();
                self._showError('Failed to load dashboard data. Please refresh the page or try again later.');
                return { employees: [], summary: {}, thresholds: window.thresholds || {} };
            });
    },

    clearCache: function () {
        var keysToRemove = [];
        for (var i = 0; i < sessionStorage.length; i++) {
            var key = sessionStorage.key(i);
            if (key && key.indexOf('qip_') === 0) keysToRemove.push(key);
        }
        keysToRemove.forEach(function (key) { sessionStorage.removeItem(key); });
        this._cache = {};
    },

    getAvailableMonths: function () {
        var self = this;
        var monthOrder = {
            january: 1, february: 2, march: 3, april: 4,
            may: 5, june: 6, july: 7, august: 8,
            september: 9, october: 10, november: 11, december: 12
        };

        return self._getToken().then(function (token) {
            return _firestoreRestList('dashboard_summary', token);
        }).then(function (docs) {
            var months = [];
            docs.forEach(function (doc) {
                var parts = doc.id.split('_');
                if (parts.length === 2) {
                    var monthName = parts[0].toLowerCase();
                    var year = parseInt(parts[1], 10);
                    if (monthOrder[monthName] && !isNaN(year)) {
                        months.push({
                            month: monthName,
                            year: year,
                            month_year: doc.id,
                            monthNum: monthOrder[monthName]
                        });
                    }
                }
            });
            months.sort(function (a, b) {
                if (a.year !== b.year) return b.year - a.year;
                return b.monthNum - a.monthNum;
            });
            months.forEach(function (m) { delete m.monthNum; });
            return months;
        }).catch(function (error) {
            console.error('[DashboardData] getAvailableMonths failed:', error);
            return [];
        });
    }
};

// ---------------------------------------------------------------------------
// Employee Helpers (V9 compatibility)
// ---------------------------------------------------------------------------

function _setupEmployeeHelpers() {
    window.employeeHelpers = {
        getIncentive: function (emp, type) {
            if (!emp) return 0;
            if (type === 'current') return parseFloat(emp.currentIncentive || emp.current_incentive || 0) || 0;
            if (type === 'previous') return parseFloat(emp.previousIncentive || emp.previous_incentive || 0) || 0;
            return 0;
        },
        hasReceivedIncentive: function (emp) {
            if (!emp) return false;
            return (parseFloat(emp.currentIncentive || emp.current_incentive || 0) || 0) > 0;
        },
        getCondition: function (emp, condNum) {
            if (!emp) return 'N/A';
            if (emp.conditions) {
                var val = emp.conditions['c' + condNum];
                if (val !== undefined && val !== null) return String(val);
            }
            var flatKey = 'Condition_' + condNum + '_Result';
            if (emp[flatKey] !== undefined && emp[flatKey] !== null) return String(emp[flatKey]);
            return 'N/A';
        },
        getConditionValue: function (emp, condNum) {
            if (!emp || !emp.condition_values) return 0;
            var val = emp.condition_values['c' + condNum + '_value'];
            return (val !== undefined && val !== null) ? (parseFloat(val) || 0) : 0;
        },
        getConditionThreshold: function (emp, condNum) {
            if (!emp || !emp.condition_values) return 0;
            var val = emp.condition_values['c' + condNum + '_threshold'];
            return (val !== undefined && val !== null) ? (parseFloat(val) || 0) : 0;
        }
    };
}

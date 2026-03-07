/**
 * Dashboard Data Module
 * HWK QIP Incentive Dashboard V10
 *
 * Core module that loads employee and dashboard data from Firestore.
 * Provides caching (sessionStorage, 30-minute TTL), normalization,
 * and V9-compatible helper functions.
 *
 * Depends on: firebase-config.js (must be loaded first)
 * Uses Firebase v10.7.1 compat SDK (firebase.firestore() style)
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

// Debug flag — set to true in browser console for development: window.QIP_DEBUG = true
var QIP_DEBUG = (typeof window !== 'undefined' && window.QIP_DEBUG) || false;

// ---------------------------------------------------------------------------
// Firestore REST API response parser (for SDK fallback)
// ---------------------------------------------------------------------------

/**
 * Parse Firestore REST API value format to plain JS value.
 * REST API returns typed wrappers like { stringValue: "abc" }, { integerValue: "123" }
 */
function _parseFirestoreValue(val) {
    if (val === undefined || val === null) return null;
    if (val.stringValue !== undefined) return val.stringValue;
    if (val.integerValue !== undefined) return Number(val.integerValue);
    if (val.doubleValue !== undefined) return val.doubleValue;
    if (val.booleanValue !== undefined) return val.booleanValue;
    if (val.nullValue !== undefined) return null;
    if (val.arrayValue) {
        return (val.arrayValue.values || []).map(_parseFirestoreValue);
    }
    if (val.mapValue) {
        return _parseFirestoreRestDoc(val.mapValue.fields || {});
    }
    return null;
}

/**
 * Parse a Firestore REST API document fields object into a plain JS object.
 * @param {Object} fields - The "fields" property from REST response
 * @returns {Object} Plain JS object
 */
function _parseFirestoreRestDoc(fields) {
    if (!fields) return {};
    var result = {};
    Object.keys(fields).forEach(function (key) {
        result[key] = _parseFirestoreValue(fields[key]);
    });
    return result;
}

// ---------------------------------------------------------------------------
// Centralized Defaults (Single Source of Truth for fallback values)
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

    // In-memory cache reference (mirrors sessionStorage)
    _cache: {},

    /**
     * Build a sessionStorage key.
     * @param {string} month - Lowercase month name (e.g. "february")
     * @param {number|string} year - 4-digit year
     * @param {string} type - Data type: "employees", "summary", "thresholds"
     * @returns {string}
     */
    _cacheKey: function (month, year, type) {
        return 'qip_' + type + '_' + month + '_' + year;
    },

    /**
     * Read from sessionStorage cache. Returns null when missing or expired.
     * @param {string} key
     * @returns {*|null}
     */
    _getCache: function (key) {
        try {
            var raw = sessionStorage.getItem(key);
            if (!raw) return null;

            var wrapper = JSON.parse(raw);
            var age = Date.now() - (wrapper._ts || 0);
            if (age > CACHE_TTL_MS) {
                sessionStorage.removeItem(key);
                return null;
            }
            return wrapper.data;
        } catch (e) {
            console.warn('[DashboardData] Cache read error for', key, e);
            sessionStorage.removeItem(key);
            return null;
        }
    },

    /**
     * Write to sessionStorage cache with a timestamp.
     * @param {string} key
     * @param {*} data
     */
    _setCache: function (key, data) {
        try {
            var wrapper = { _ts: Date.now(), data: data };
            sessionStorage.setItem(key, JSON.stringify(wrapper));
        } catch (e) {
            // sessionStorage may be full; silently skip caching
            console.warn('[DashboardData] Cache write error for', key, e);
        }
    },

    // ------------------------------------------------------------------
    // Loading UI helpers
    // ------------------------------------------------------------------

    /**
     * Show the full-page loading overlay.
     */
    _showLoading: function () {
        var el = document.getElementById('loading-overlay');
        if (el) el.style.display = 'flex';
    },

    /**
     * Hide the full-page loading overlay.
     */
    _hideLoading: function () {
        var el = document.getElementById('loading-overlay');
        if (el) el.style.display = 'none';
    },

    /**
     * Display a user-friendly error message.
     * @param {string} message
     */
    _showError: function (message) {
        var el = document.getElementById('error-message');
        if (el) {
            el.textContent = message;
            el.style.display = 'block';
        }
        console.error('[DashboardData] Error:', message);
    },

    /**
     * Hide the error message element.
     */
    _hideError: function () {
        var el = document.getElementById('error-message');
        if (el) el.style.display = 'none';
    },

    // ------------------------------------------------------------------
    // Firestore loaders
    // ------------------------------------------------------------------

    /**
     * Load all employee data for a given month.
     *
     * Firestore path: employees/{month}_{year}/all_data/data
     * The document stores { employees: [...] } in a single-doc approach.
     *
     * Results are cached in sessionStorage and also stored in
     * window.employeeData for V9 dashboard compatibility.
     *
     * @param {string} month - Lowercase month name (e.g. "february")
     * @param {number|string} year - 4-digit year
     * @returns {Promise<Array>} Array of employee objects
     */
    /**
     * Firestore REST API fallback for when SDK WebChannel fails.
     * @param {string} path - Firestore document path (e.g. "employees/february_2026/all_data/data")
     * @returns {Promise<Object|null>} Document fields or null
     */
    _restApiFallback: function (path) {
        var user = firebase.auth().currentUser;
        if (!user) return Promise.resolve(null);

        return user.getIdToken().then(function (token) {
            var projectId = 'hwk-qip-incentive-dashboard';
            var url = 'https://firestore.googleapis.com/v1/projects/' + projectId +
                '/databases/(default)/documents/' + path;
            return fetch(url, {
                headers: { 'Authorization': 'Bearer ' + token }
            }).then(function (resp) {
                if (!resp.ok) return null;
                return resp.json();
            }).then(function (json) {
                if (!json || !json.fields) return null;
                return _parseFirestoreRestDoc(json.fields);
            });
        }).catch(function () { return null; });
    },

    loadEmployees: function (month, year) {
        var self = this;
        var key = self._cacheKey(month, year, 'employees');

        // 1. Check cache
        var cached = self._getCache(key);
        if (cached) {
            window.employeeData = cached;
            return Promise.resolve(cached);
        }

        // 2. Fetch from Firestore SDK with timeout
        var docPath = 'employees/' + month + '_' + year + '/all_data/data';

        var sdkCall = db.collection('employees')
            .doc(month + '_' + year)
            .collection('all_data')
            .doc('data')
            .get()
            .then(function (doc) {
                if (!doc.exists) {
                    console.warn('[DashboardData] No employee document found at', docPath);
                    return [];
                }
                return doc.data().employees || [];
            });

        var timeout = new Promise(function (resolve) {
            setTimeout(function () { resolve('TIMEOUT'); }, 15000);
        });

        return Promise.race([sdkCall, timeout])
            .then(function (result) {
                if (result === 'TIMEOUT') {
                    console.warn('[DashboardData] SDK timed out for employees — trying REST API fallback');
                    return self._restApiFallback(docPath);
                }
                return result;
            })
            .then(function (result) {
                // REST fallback returns { employees: [...] } or array
                var employees = Array.isArray(result) ? result : (result && result.employees ? result.employees : []);
                window.employeeData = employees;
                if (employees.length > 0) self._setCache(key, employees);
                return employees;
            })
            .catch(function (error) {
                console.error('[DashboardData] Failed to load employees:', error);
                self._showError(typeof DashboardI18n !== 'undefined' ? DashboardI18n.t('error.loadEmployees') : 'Failed to load employee data. Please check your connection and try again.');
                window.employeeData = [];
                return [];
            });
    },

    /**
     * Load dashboard summary for a given month.
     *
     * Firestore path: dashboard_summary/{month}_{year}
     *
     * @param {string} month - Lowercase month name
     * @param {number|string} year - 4-digit year
     * @returns {Promise<Object>} Summary object
     */
    loadSummary: function (month, year) {
        var self = this;
        var key = self._cacheKey(month, year, 'summary');

        // 1. Check cache
        var cached = self._getCache(key);
        if (cached) {
            window.dashboardSummary = cached;
            return Promise.resolve(cached);
        }

        // 2. Fetch from Firestore SDK with timeout
        var docId = month + '_' + year;
        var docPath = 'dashboard_summary/' + docId;

        var sdkCall = db.collection('dashboard_summary')
            .doc(docId)
            .get()
            .then(function (doc) {
                if (!doc.exists) return {};
                return doc.data();
            });

        var timeout = new Promise(function (resolve) {
            setTimeout(function () { resolve('TIMEOUT'); }, 15000);
        });

        return Promise.race([sdkCall, timeout])
            .then(function (result) {
                if (result === 'TIMEOUT') {
                    console.warn('[DashboardData] SDK timed out for summary — trying REST API fallback');
                    return self._restApiFallback(docPath).then(function (r) { return r || {}; });
                }
                return result;
            })
            .then(function (summary) {
                window.dashboardSummary = summary;
                if (Object.keys(summary).length > 0) self._setCache(key, summary);
                return summary;
            })
            .catch(function (error) {
                console.error('[DashboardData] Failed to load summary:', error);
                window.dashboardSummary = {};
                return {};
            });
    },

    /**
     * Load thresholds (policy parameters) for a given month.
     *
     * Firestore path: thresholds/{month}_{year}
     * Falls back to sensible defaults when the document is missing.
     *
     * @param {string} month - Lowercase month name
     * @param {number|string} year - 4-digit year
     * @returns {Promise<Object>} Thresholds object
     */
    loadThresholds: function (month, year) {
        var self = this;
        var key = self._cacheKey(month, year, 'thresholds');

        // Use centralized defaults (defined at top of file)
        var defaults = THRESHOLD_DEFAULTS;

        // 1. Check cache
        var cached = self._getCache(key);
        if (cached) {
            window.thresholds = cached;
            window.progressiveTable = cached.progressive_table || PROGRESSIVE_TABLE_DEFAULT;
            return Promise.resolve(cached);
        }

        // 2. Fetch from Firestore SDK with timeout
        var docId = month + '_' + year;
        var docPath = 'thresholds/' + docId;

        var sdkCall = db.collection('thresholds')
            .doc(docId)
            .get()
            .then(function (doc) {
                if (!doc.exists) return null;
                return doc.data();
            });

        var timeout = new Promise(function (resolve) {
            setTimeout(function () { resolve('TIMEOUT'); }, 15000);
        });

        return Promise.race([sdkCall, timeout])
            .then(function (result) {
                if (result === 'TIMEOUT') {
                    console.warn('[DashboardData] SDK timed out for thresholds — trying REST API fallback');
                    return self._restApiFallback(docPath);
                }
                return result;
            })
            .then(function (stored) {
                var thresholds = {};
                if (!stored) {
                    Object.keys(defaults).forEach(function (k) {
                        thresholds[k] = defaults[k];
                    });
                } else {
                    Object.keys(defaults).forEach(function (k) {
                        thresholds[k] = (stored[k] !== undefined && stored[k] !== null)
                            ? stored[k]
                            : defaults[k];
                    });
                    Object.keys(stored).forEach(function (k) {
                        if (thresholds[k] === undefined) {
                            thresholds[k] = stored[k];
                        }
                    });
                }

                window.thresholds = thresholds;
                window.progressiveTable = thresholds.progressive_table || PROGRESSIVE_TABLE_DEFAULT;
                if (Object.keys(thresholds).length > 0) self._setCache(key, thresholds);

                return thresholds;
            })
            .catch(function (error) {
                window.thresholds = Object.assign({}, defaults);
                window.progressiveTable = PROGRESSIVE_TABLE_DEFAULT;
                return window.thresholds;
            });
    },

    /**
     * Load all data required to render the dashboard.
     *
     * Fetches employees, summary, and thresholds in parallel, then
     * applies Phase 1 normalization and sets up employeeHelpers.
     *
     * @param {string} month - Lowercase month name (e.g. "february")
     * @param {number|string} year - 4-digit year
     * @returns {Promise<{employees: Array, summary: Object, thresholds: Object}>}
     */
    /**
     * Update loading progress step indicator.
     * @param {number} step - Step number (1-4)
     * @param {string} state - 'active' or 'done'
     */
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

    loadAll: function (month, year) {
        var self = this;

        self._hideError();
        self._showLoading();

        // Start step indicators
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

        return Promise.all([
            employeesPromise,
            summaryPromise,
            thresholdsPromise
        ])
            .then(function (results) {
                self._updateLoadingStep(3, 'done');
                self._updateLoadingStep(4, 'active');

                var employees = results[0];
                var summary = results[1];
                var thresholds = results[2];

                // ----------------------------------------------------------
                // Phase 1: Data normalization (V9 compatibility, Issue #37)
                // ----------------------------------------------------------
                if (employees && employees.length > 0) {
                    employees.forEach(function (emp) {
                        // Normalize incentive fields
                        // Firestore stores snake_case; V9 modals expect camelCase
                        emp.currentIncentive = parseFloat(emp.current_incentive || emp.currentIncentive || 0) || 0;
                        emp.previousIncentive = parseFloat(emp.previous_incentive || emp.previousIncentive || 0) || 0;
                        emp.hasReceivedIncentive = emp.currentIncentive > 0;

                        // Ensure Employee No is a string for ID comparisons (Issue #28)
                        if (emp['Employee No'] !== undefined) {
                            emp['Employee No'] = String(emp['Employee No']);
                        }
                        if (emp.emp_no !== undefined) {
                            emp.emp_no = String(emp.emp_no);
                        }
                        if (emp.boss_id !== undefined) {
                            emp.boss_id = String(emp.boss_id);
                        }
                    });

                }

                // ----------------------------------------------------------
                // Setup employeeHelpers (V9 Issue #37 compatibility)
                // ----------------------------------------------------------
                _setupEmployeeHelpers();

                // Expose month/year globally for download functions (Phase B)
                window._dashboardMonth = month;
                window._dashboardYear = year;

                self._updateLoadingStep(4, 'done');
                self._hideLoading();

                return {
                    employees: employees,
                    summary: summary,
                    thresholds: thresholds,
                    metadata: {
                        lastUpdated: summary.data_updated_at || summary.calculated_at || null
                    }
                };
            })
            .catch(function (error) {
                console.error('[DashboardData] loadAll failed:', error);
                self._hideLoading();
                self._showError(typeof DashboardI18n !== 'undefined' ? DashboardI18n.t('error.loadAll') : 'Failed to load dashboard data. Please refresh the page or try again later.');
                return {
                    employees: [],
                    summary: {},
                    thresholds: window.thresholds || {}
                };
            });
    },

    /**
     * Remove all QIP-related entries from sessionStorage.
     */
    clearCache: function () {
        var keysToRemove = [];
        for (var i = 0; i < sessionStorage.length; i++) {
            var key = sessionStorage.key(i);
            if (key && key.indexOf('qip_') === 0) {
                keysToRemove.push(key);
            }
        }
        keysToRemove.forEach(function (key) {
            sessionStorage.removeItem(key);
        });
        this._cache = {};
    },

    /**
     * Retrieve a list of available month/year combinations from Firestore.
     *
     * Reads all document IDs in the dashboard_summary collection.
     * Each document ID follows the pattern "{month}_{year}".
     *
     * @returns {Promise<Array<{month: string, year: number, month_year: string}>>}
     *          Sorted by year desc, then month desc.
     */
    getAvailableMonths: function () {
        var monthOrder = {
            january: 1, february: 2, march: 3, april: 4,
            may: 5, june: 6, july: 7, august: 8,
            september: 9, october: 10, november: 11, december: 12
        };

        return db.collection('dashboard_summary')
            .get()
            .then(function (snapshot) {
                var months = [];

                snapshot.forEach(function (doc) {
                    var id = doc.id; // e.g. "february_2026"
                    var parts = id.split('_');
                    if (parts.length === 2) {
                        var monthName = parts[0].toLowerCase();
                        var year = parseInt(parts[1], 10);
                        if (monthOrder[monthName] && !isNaN(year)) {
                            months.push({
                                month: monthName,
                                year: year,
                                month_year: id,
                                monthNum: monthOrder[monthName]
                            });
                        }
                    }
                });

                // Sort descending: newest first
                months.sort(function (a, b) {
                    if (a.year !== b.year) return b.year - a.year;
                    return b.monthNum - a.monthNum;
                });

                // Remove internal sort key
                months.forEach(function (m) { delete m.monthNum; });

                return months;
            })
            .catch(function (error) {
                console.error('[DashboardData] Failed to fetch available months:', error);
                return [];
            });
    }
};

// ---------------------------------------------------------------------------
// Employee Helpers (V9 compatibility - Issue #37)
// ---------------------------------------------------------------------------

/**
 * Setup window.employeeHelpers with type-safe accessor functions.
 * These helpers ensure consistent data access across all dashboard modals
 * and UI components, avoiding hardcoded month-column patterns.
 *
 * @private
 */
function _setupEmployeeHelpers() {
    window.employeeHelpers = {

        /**
         * Get incentive amount for an employee.
         * @param {Object} emp - Employee object
         * @param {string} type - "current" or "previous"
         * @returns {number} Incentive amount (0 if not found or NaN)
         */
        getIncentive: function (emp, type) {
            if (!emp) return 0;
            if (type === 'current') {
                var val = emp.currentIncentive || emp.current_incentive || 0;
                var parsed = parseFloat(val);
                return isNaN(parsed) ? 0 : parsed;
            }
            if (type === 'previous') {
                var val2 = emp.previousIncentive || emp.previous_incentive || 0;
                var parsed2 = parseFloat(val2);
                return isNaN(parsed2) ? 0 : parsed2;
            }
            return 0;
        },

        /**
         * Check if an employee has received incentive this month.
         * @param {Object} emp - Employee object
         * @returns {boolean}
         */
        hasReceivedIncentive: function (emp) {
            if (!emp) return false;
            return (parseFloat(emp.currentIncentive || emp.current_incentive || 0) || 0) > 0;
        },

        /**
         * Get condition result (YES / NO / N/A) for a given condition number.
         * Condition numbers range from 1 to 10.
         *
         * Firestore stores conditions as: { conditions: { c1: "YES", c2: "NO", ... } }
         *
         * @param {Object} emp - Employee object
         * @param {number} condNum - Condition number (1-10)
         * @returns {string} "YES", "NO", or "N/A"
         */
        getCondition: function (emp, condNum) {
            if (!emp) return 'N/A';

            // Try nested conditions object first
            if (emp.conditions) {
                var val = emp.conditions['c' + condNum];
                if (val !== undefined && val !== null) return String(val);
            }

            // Fallback: flat keys (e.g., emp.Condition_1_Result)
            var flatKey = 'Condition_' + condNum + '_Result';
            if (emp[flatKey] !== undefined && emp[flatKey] !== null) {
                return String(emp[flatKey]);
            }

            return 'N/A';
        },

        /**
         * Get the actual value for a condition (e.g., attendance rate 92.5%).
         *
         * @param {Object} emp - Employee object
         * @param {number} condNum - Condition number (1-10)
         * @returns {number}
         */
        getConditionValue: function (emp, condNum) {
            if (!emp) return 0;

            if (emp.condition_values) {
                var val = emp.condition_values['c' + condNum + '_value'];
                if (val !== undefined && val !== null) {
                    var parsed = parseFloat(val);
                    return isNaN(parsed) ? 0 : parsed;
                }
            }

            return 0;
        },

        /**
         * Get the threshold for a condition (e.g., 88% for attendance rate).
         *
         * @param {Object} emp - Employee object
         * @param {number} condNum - Condition number (1-10)
         * @returns {number}
         */
        getConditionThreshold: function (emp, condNum) {
            if (!emp) return 0;

            if (emp.condition_values) {
                var val = emp.condition_values['c' + condNum + '_threshold'];
                if (val !== undefined && val !== null) {
                    var parsed = parseFloat(val);
                    return isNaN(parsed) ? 0 : parsed;
                }
            }

            return 0;
        }
    };

}

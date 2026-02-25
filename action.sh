#!/bin/bash
# HWK QIP Incentive System V10 - Local Execution Script
# Usage: ./action.sh

set -e

echo "=============================================="
echo "  HWK QIP INCENTIVE SYSTEM - Version 10"
echo "  Firestore-based Secure Architecture"
echo "=============================================="
echo ""

# ===== Month/Year Selection =====
echo "📅 Select calculation period:"
echo ""
echo "Available months:"
echo "  1) January    2) February    3) March"
echo "  4) April      5) May         6) June"
echo "  7) July       8) August      9) September"
echo "  10) October   11) November   12) December"
echo ""

read -p "Enter month number (1-12): " MONTH_NUM
read -p "Enter year (e.g., 2026): " YEAR

MONTHS=("january" "february" "march" "april" "may" "june" "july" "august" "september" "october" "november" "december")
MONTH=${MONTHS[$((MONTH_NUM-1))]}

if [ -z "$MONTH" ]; then
    echo "❌ Invalid month number: $MONTH_NUM"
    exit 1
fi

echo ""
echo "📋 Selected: $MONTH $YEAR"
echo "=============================================="

# ===== Service Account Setup =====
SA_PATH="/Users/ksmoon/Downloads/qip-dashboard-dabdc4d51ac9.json"
if [ -f "$SA_PATH" ]; then
    export GOOGLE_SERVICE_ACCOUNT=$(cat "$SA_PATH")
    export FIREBASE_SERVICE_ACCOUNT=$(cat "$SA_PATH")
    echo "✅ Service account loaded"
else
    echo "❌ Service account not found at: $SA_PATH"
    exit 1
fi

# ===== Step 1: Config Generation =====
echo ""
echo "Step 1: Config generation..."
if [ -f "src/step0_create_monthly_config.py" ]; then
    python src/step0_create_monthly_config.py --month "$MONTH" --year "$YEAR" 2>/dev/null || echo "⚠️ Config generation skipped (using existing)"
fi
echo "✅ Step 1 complete"

# ===== Step 2: Download from Google Drive =====
echo ""
echo "Step 2: Downloading from Google Drive..."
python scripts/download_from_gdrive.py
echo "✅ Step 2 complete"

# ===== Step 3: Enhanced Download with Config =====
echo ""
echo "Step 3: Enhanced download with config update..."
python scripts/enhanced_download.py 2>/dev/null || echo "⚠️ Enhanced download skipped"
echo "✅ Step 3 complete"

# ===== Step 4: Sync Thresholds from Firestore =====
echo ""
echo "Step 4: Syncing thresholds from Firestore..."
python scripts/sync_thresholds.py --month "$MONTH" --year "$YEAR" 2>/dev/null || echo "⚠️ Threshold sync skipped (using local config)"
echo "✅ Step 4 complete"

# ===== Step 5: Convert Attendance Data =====
echo ""
echo "Step 5: Converting attendance data..."
python src/convert_attendance_data.py "$MONTH" "$YEAR"
echo "✅ Step 5 complete"

# ===== Step 6: Calculate Incentives =====
echo ""
echo "Step 6: Calculating incentives..."
CONFIG_FILE="config_files/config_${MONTH}_${YEAR}.json"
if [ -f "$CONFIG_FILE" ]; then
    python "src/step1_인센티브_계산.py" --config "$CONFIG_FILE"
else
    echo "❌ Config file not found: $CONFIG_FILE"
    exit 1
fi
echo "✅ Step 6 complete"

# ===== Step 7: Upload to Firestore =====
echo ""
echo "Step 7: Uploading results to Firestore..."
python scripts/upload_to_firestore.py --month "$MONTH" --year "$YEAR"
echo "✅ Step 7 complete"

# ===== Step 8: Generate Selector =====
echo ""
echo "Step 8: Generating selector page..."
if [ -f "scripts/create_month_selector.py" ]; then
    python scripts/create_month_selector.py 2>/dev/null || echo "⚠️ Selector generation skipped"
fi
echo "✅ Step 8 complete"

# ===== Summary =====
echo ""
echo "=============================================="
echo "  ✅ Pipeline Complete!"
echo "=============================================="
echo ""
echo "  Period: $MONTH $YEAR"
echo "  Results uploaded to Firestore"
echo ""
echo "  📊 View dashboard:"
echo "     Local: cd web/ && python -m http.server 8080"
echo "     Web:   (GitHub Pages URL after git push)"
echo ""
echo "  🔥 Firestore data available immediately"
echo "=============================================="

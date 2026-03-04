#!/usr/bin/env python3
"""
Check if Google Drive files have changed since last successful pipeline run.

Compares MD5 hashes of downloaded input files against the hash stored
in Firestore system/status.last_input_hash.

Exit codes:
  0 - Changes detected (pipeline should continue)
  1 - No changes detected (pipeline can skip)
  2 - Error occurred (pipeline should continue as fallback)
"""

import hashlib
import json
import os
import sys
import glob


def compute_input_hash():
    """Compute a combined MD5 hash of all input files."""
    input_dir = "input_files"
    if not os.path.exists(input_dir):
        print("⚠️ input_files directory not found")
        return None

    hasher = hashlib.md5()
    file_count = 0

    # Gather all files, sorted for deterministic hashing
    all_files = []
    for root, dirs, files in os.walk(input_dir):
        for f in files:
            if f.endswith(('.csv', '.xlsx', '.json')):
                all_files.append(os.path.join(root, f))

    all_files.sort()

    for filepath in all_files:
        try:
            with open(filepath, 'rb') as fh:
                while True:
                    chunk = fh.read(8192)
                    if not chunk:
                        break
                    hasher.update(chunk)
                file_count += 1
        except Exception as e:
            print(f"⚠️ Could not read {filepath}: {e}")

    if file_count == 0:
        print("⚠️ No input files found")
        return None

    combined_hash = hasher.hexdigest()
    print(f"📊 Computed hash of {file_count} input files: {combined_hash[:16]}...")
    return combined_hash


def get_stored_hash():
    """Get the last input hash from Firestore system/status document."""
    try:
        import firebase_admin
        from firebase_admin import credentials, firestore

        sa_json = os.environ.get('FIREBASE_SERVICE_ACCOUNT', '')
        if not sa_json:
            print("⚠️ FIREBASE_SERVICE_ACCOUNT not set")
            return None

        sa_dict = json.loads(sa_json)
        cred = credentials.Certificate(sa_dict)
        if not firebase_admin._apps:
            firebase_admin.initialize_app(cred, {"projectId": "hwk-qip-incentive-dashboard"})

        db = firestore.client()
        doc = db.collection('system').document('status').get()

        if doc.exists:
            data = doc.to_dict()
            stored = data.get('last_input_hash')
            if stored:
                print(f"📦 Stored hash from last run: {stored[:16]}...")
            return stored
        return None

    except Exception as e:
        print(f"⚠️ Could not read Firestore status: {e}")
        return None


def save_hash(new_hash):
    """Save the new input hash to Firestore."""
    try:
        import firebase_admin
        from firebase_admin import credentials, firestore

        sa_json = os.environ.get('FIREBASE_SERVICE_ACCOUNT', '')
        if not sa_json:
            return

        sa_dict = json.loads(sa_json)
        cred = credentials.Certificate(sa_dict)
        if not firebase_admin._apps:
            firebase_admin.initialize_app(cred, {"projectId": "hwk-qip-incentive-dashboard"})

        db = firestore.client()
        db.collection('system').document('status').set({
            'last_input_hash': new_hash
        }, merge=True)
        print(f"✅ Saved new input hash to Firestore")

    except Exception as e:
        print(f"⚠️ Could not save hash to Firestore: {e}")


def main():
    mode = sys.argv[1] if len(sys.argv) > 1 else "check"

    if mode == "save":
        # Called after successful pipeline run to save the current hash
        current_hash = compute_input_hash()
        if current_hash:
            save_hash(current_hash)
        sys.exit(0)

    # Default: check mode
    current_hash = compute_input_hash()
    if not current_hash:
        print("⚠️ Cannot compute hash, proceeding with pipeline")
        sys.exit(0)  # Continue pipeline on error

    stored_hash = get_stored_hash()
    if not stored_hash:
        print("ℹ️ No previous hash found (first run?), proceeding with pipeline")
        sys.exit(0)

    if current_hash == stored_hash:
        print("✅ No changes detected in Google Drive data - skipping calculation")
        sys.exit(1)  # Exit 1 = no changes
    else:
        print("🔄 Changes detected in Google Drive data - proceeding with pipeline")
        sys.exit(0)  # Exit 0 = changes found


if __name__ == '__main__':
    main()

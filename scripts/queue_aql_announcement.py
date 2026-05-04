#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
AQL Allowance 안내 이메일을 pendingNotifications 컬렉션에 큐잉.
다음 매시간 cron(auto-update.yml의 process_notifications.py)에서 자동 발송.
"""

import os
import sys
import base64
from datetime import datetime, timezone

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from scripts.utils.firebase_common import init_firestore

DOCS_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "docs", "aql_allowance")
HTML_BODY_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "send_aql_allowance_announcement.js")

ATTACHMENTS = [
    ("AQL_Allowance_Guide_KO.html", "AQL_Allowance_Guide_KO.html", "text/html"),
    ("AQL_Allowance_Guide_EN.html", "AQL_Allowance_Guide_EN.html", "text/html"),
    ("AQL_Allowance_Guide_VI.html", "AQL_Allowance_Guide_VI.html", "text/html"),
]


def load_attachment(filename):
    path = os.path.join(DOCS_DIR, filename)
    with open(path, "rb") as f:
        content = f.read()
    return {
        "filename": filename,
        "type": "text/html",
        "size": len(content),
        "base64": "data:text/html;base64," + base64.b64encode(content).decode("ascii"),
    }


# 이메일 본문 HTML (send_aql_allowance_announcement.js와 동일)
BODY_HTML = """<!DOCTYPE html>
<html lang="ko">
<head><meta charset="UTF-8"><title>AQL Allowance Announcement</title></head>
<body style="font-family: -apple-system, 'Segoe UI', 'Apple SD Gothic Neo', sans-serif; max-width: 760px; margin: 30px auto; color: #1f2937; line-height: 1.65; padding: 0 24px;">
<div style="background: linear-gradient(135deg, #1e40af 0%, #3b82f6 100%); color: #fff; padding: 24px 28px; border-radius: 8px 8px 0 0;">
  <h1 style="margin: 0; font-size: 1.5rem;">HWK QIP Incentive — AQL Allowance 시스템 안내</h1>
  <p style="margin: 8px 0 0; opacity: 0.9; font-size: 0.95rem;">PO 기반 예외 승인 모듈이 신규 추가되었습니다</p>
</div>
<div style="background: #f8fafc; padding: 24px 28px; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 8px 8px;">
<p>Nguyen Thi Huynh Nhu님, 안녕하세요.</p>
<p>HWK QIP Incentive Dashboard V10에 <strong>AQL Reject PO Allowance</strong> 기능이 신규 배포되어 안내드립니다. 자세한 내용은 첨부된 한국어 / English / Tiếng Việt 안내문을 참조해 주세요.</p>
<hr style="border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;">
<h3 style="color: #1e40af; margin-top: 0;">📌 핵심 요약 / Key Points</h3>
<ul>
  <li><strong>AQL Allowance 탭</strong>이 관리자 페이지에 신규 추가됨 (기존 Allowance는 "출결 Allowance"로 명칭 변경)</li>
  <li>관리자가 AQL Reject된 PO 번호(복수)와 사유·액션플랜을 입력하면, 시스템이 영향받는 모든 직원의 C5~C8 조건을 자동 면제 처리하여 인센티브를 재계산합니다</li>
  <li>매시간 파이프라인 실행 후에도 자동 재적용되어 데이터 덮어쓰기 방지됨</li>
  <li>대시보드 직원 모달에 파란색 "AQL Allowance" 뱃지 + 액션플랜 진행 상황이 자동 표시됨</li>
</ul>
<h3 style="color: #c0392b;">🤝 협조 요청 사항 / Action Required</h3>
<div style="background: #fef3c7; border-left: 4px solid #f59e0b; padding: 14px 18px; border-radius: 6px; margin: 14px 0;">
<p style="margin: 0 0 8px;"><strong>부서장(팀장)과 면담을 진행하여 아래 정책을 확정해 주시기 바랍니다:</strong></p>
<ol style="margin: 8px 0 0;">
  <li>AQL Reject PO에 대한 <strong>Allowance 승인 권한자 명단</strong></li>
  <li>등록 시 <strong>필수 첨부 자료 종류</strong> (예: root cause 분석 보고서)</li>
  <li><strong>액션플랜 마감일 표준</strong> (예: 등록일로부터 30일 이내)</li>
  <li>면제 사유로 인정 가능한 <strong>외부 요인 카테고리</strong> 명문화</li>
  <li>월별 Allowance 등록 통계의 <strong>QOS 보고 주기</strong></li>
</ol>
</div>
<p>면담이 완료된 후 <strong>면담 결과를 가지고 KS Moon(<a href="mailto:ksmoon@hsvina.com">ksmoon@hsvina.com</a>)에게 미팅 콜</strong>을 요청해 주세요. 정책 확정 후 시스템에 반영하겠습니다.</p>
<hr style="border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;">
<h3 style="color: #1e40af;">📎 첨부 파일 / Attachments</h3>
<ul>
  <li><strong>AQL_Allowance_Guide_KO.html</strong> — 한국어 상세 안내</li>
  <li><strong>AQL_Allowance_Guide_EN.html</strong> — English Detailed Guide</li>
  <li><strong>AQL_Allowance_Guide_VI.html</strong> — Hướng dẫn chi tiết Tiếng Việt</li>
</ul>
<h3 style="color: #1e40af;">🔗 빠른 접속 / Quick Access</h3>
<p>관리자 페이지: <a href="https://moonkaicuzui.github.io/hwk-qip-incentive-v10/">https://moonkaicuzui.github.io/hwk-qip-incentive-v10/</a> → 로그인 → Admin Panel → "AQL Allowance" 탭</p>
<hr style="border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;">
<p style="font-size: 0.85em; color: #6b7280;">시스템 관련 문의: KS Moon &lt;ksmoon@hsvina.com&gt;<br>HWK QIP Incentive Dashboard V10 · AQL Allowance Module v1.0 · 2026-05-04</p>
</div></body></html>"""


def main():
    db = init_firestore()

    # 첨부 파일들 로드
    attachments = []
    for filename, _, _ in ATTACHMENTS:
        attachments.append(load_attachment(filename))
    print(f"📎 첨부 파일 {len(attachments)}개 로드 완료")

    notification = {
        "to": "huynhnhurgqa04@hsvina.com",
        "cc": "ksmoon@hsvina.com",
        "subject": "[QIP Incentive] AQL Allowance 신규 기능 안내 + 부서장 면담 요청 / Action Required",
        "customSubject": "[QIP Incentive] AQL Allowance 신규 기능 안내 + 부서장 면담 요청 / Action Required",
        "customHtml": BODY_HTML,
        "attachments": attachments,
        "type": "aql_allowance_announcement",
        "status": "pending",
        "createdAt": datetime.now(timezone.utc).isoformat() + "Z",
        "createdBy": "ksmoon@hsvina.com (manual queue)",
        "priority": "high",
    }

    doc_ref = db.collection("pendingNotifications").add(notification)
    doc_id = doc_ref[1].id if isinstance(doc_ref, tuple) else doc_ref.id
    print(f"✅ pendingNotifications/{doc_id} 큐잉 완료")
    print(f"   다음 매시간 cron에서 자동 발송됩니다.")
    print(f"   - To: huynhnhurgqa04@hsvina.com")
    print(f"   - CC: ksmoon@hsvina.com")


if __name__ == "__main__":
    main()

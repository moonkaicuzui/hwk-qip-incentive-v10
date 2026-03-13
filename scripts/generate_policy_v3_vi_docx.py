#!/usr/bin/env python3
"""
Generate QIP Incentive Policy Document Version 3 — Vietnamese
Follows same structure as English V3, translated to Vietnamese.
"""

from docx import Document
from docx.shared import Inches, Pt, Cm, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT
from docx.oxml.ns import qn, nsdecls
from docx.oxml import parse_xml
import os


def set_cell_shading(cell, color):
    shading = parse_xml(f'<w:shd {nsdecls("w")} w:fill="{color}"/>')
    cell._tc.get_or_add_tcPr().append(shading)


def make_header_row(table, headers, bg="2F5496"):
    hdr = table.rows[0].cells
    for i, text in enumerate(headers):
        p = hdr[i].paragraphs[0]
        run = p.add_run(text)
        run.bold = True
        run.font.size = Pt(9)
        run.font.color.rgb = RGBColor(255, 255, 255)
        set_cell_shading(hdr[i], bg)


def add_row(table, cells_data, bold=False, bg_color=None):
    row = table.add_row()
    for i, text in enumerate(cells_data):
        cell = row.cells[i]
        p = cell.paragraphs[0]
        run = p.add_run(str(text))
        run.font.size = Pt(9)
        if bold:
            run.bold = True
        if bg_color:
            set_cell_shading(cell, bg_color)
    return row


def bullet(doc, text, bold_prefix=None):
    p = doc.add_paragraph(style='List Bullet')
    if bold_prefix:
        run = p.add_run(bold_prefix)
        run.bold = True
        run.font.size = Pt(10)
        p.add_run(text)
    else:
        run = p.add_run(text)
        run.font.size = Pt(10)
    return p


def bold_para(doc, bold_text, normal_text=""):
    p = doc.add_paragraph()
    run = p.add_run(bold_text)
    run.bold = True
    if normal_text:
        p.add_run(normal_text)
    return p


def create_policy_vi():
    doc = Document()

    section = doc.sections[0]
    section.page_width = Cm(21)
    section.page_height = Cm(29.7)
    section.top_margin = Cm(2)
    section.bottom_margin = Cm(2)
    section.left_margin = Cm(2.5)
    section.right_margin = Cm(2.5)

    style = doc.styles['Normal']
    style.font.name = 'Calibri'
    style.font.size = Pt(10)

    # ══════════════════════════════════════════
    # TRANG BÌA
    # ══════════════════════════════════════════
    for _ in range(6):
        doc.add_paragraph()

    p = doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    run = p.add_run("CHÍNH SÁCH THƯỞNG QIP CỦA HWK")
    run.font.size = Pt(26)
    run.bold = True
    run.font.color.rgb = RGBColor(47, 84, 150)

    p = doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    run = p.add_run("Phiên bản 3 — Cập nhật Tháng 3/2026")
    run.font.size = Pt(14)
    run.font.color.rgb = RGBColor(89, 89, 89)

    doc.add_paragraph()

    p = doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    run = p.add_run("Thời hạn hiệu lực: Tháng 3/2026 ~ Tháng 2/2027")
    run.font.size = Pt(13)
    run.bold = True
    run.font.color.rgb = RGBColor(47, 84, 150)

    doc.add_paragraph()

    p = doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    run = p.add_run("Bộ phận Chương trình Cải tiến Chất lượng (QIP)\nHWK Vina")
    run.font.size = Pt(11)
    run.font.color.rgb = RGBColor(89, 89, 89)

    doc.add_page_break()

    # ══════════════════════════════════════════
    # MỤC LỤC
    # ══════════════════════════════════════════
    doc.add_heading("MỤC LỤC", level=1)

    toc_items = [
        ("Phần 1.", " Tổng quan"),
        ("Phần 2.", " Giải thích chung về cấu trúc chính sách thưởng"),
        ("Phần 3.", " Phạm vi và đối tượng áp dụng"),
        ("Phần 4.", " Định nghĩa & Thuật ngữ viết tắt"),
        ("Phần 5.", " Phương pháp tính thưởng — Chương trình 1"),
        ("Phần 6.", " Phương pháp tính thưởng — Chương trình 2"),
        ("Phần 7.", " Tóm tắt các điều khoản ngoại lệ"),
        ("Phần 8.", " Kiến trúc hệ thống & Bảng điều khiển (V10)"),
        ("Phụ lục 1:", " 10 Điều kiện thưởng — Mô tả chi tiết"),
        ("Phụ lục 2:", " Ma trận áp dụng điều kiện theo chức vụ"),
        ("Phụ lục 3:", " Trạng thái nhóm Talent Pool QIP HWK"),
        ("Phụ lục 4:", " Bản đồ R&R đội QIP"),
        ("Phụ lục 5:", " Bộ sưu tập dữ liệu Firestore"),
    ]
    for bold_part, normal_part in toc_items:
        p = doc.add_paragraph(style='List Number')
        run = p.add_run(bold_part)
        run.bold = True
        p.add_run(normal_part)

    doc.add_page_break()

    # ══════════════════════════════════════════
    # PHẦN 1. TỔNG QUAN
    # ══════════════════════════════════════════
    doc.add_heading("PHẦN 1. TỔNG QUAN", level=1)

    doc.add_paragraph(
        '"CHÍNH SÁCH THƯỞNG QIP CỦA HWK" được thiết kế để cập nhật mỗi 6 tháng. Phiên bản đầu tiên được tạo '
        'vào tháng 2/2025, và tài liệu này là Phiên bản 3 đã cập nhật, phản ánh kiến trúc hệ thống V10 hiện tại '
        'với quản lý dữ liệu dựa trên Firestore và quy trình tính toán tự động.'
    )
    doc.add_paragraph(
        'Tài liệu này cung cấp tổng quan về chính sách thưởng của công ty HWK nhằm đạt được các mục tiêu '
        'chất lượng chính. Bằng cách cung cấp thưởng dựa trên các chỉ số hiệu suất chất lượng, chúng tôi '
        'hướng đến việc tăng cường quản lý chất lượng toàn công ty và đạt được các mốc KPI 5Q với tư cách '
        'là Nhà máy chất lượng Top 3 Toàn cầu. Thông qua chương trình thưởng này, chúng tôi nhằm củng cố '
        'văn hóa quản lý chất lượng của nhà máy HWK, tăng sự gắn kết của nhân viên và giảm tỷ lệ nghỉ việc.'
    )

    doc.add_heading("MỤC ĐÍCH", level=2)
    bullet(doc, "Cải thiện & đạt được hiệu suất chất lượng tốt nhất của HWK thông qua động lực bền vững.")
    bullet(doc, "Thiết lập hệ thống quản lý chất lượng liên tục thông qua thưởng dựa trên hiệu suất chất lượng.")
    bullet(doc, "Đạt mục tiêu 5Q: Thúc đẩy tất cả các đội, bao gồm đội chất lượng, đạt tiêu chuẩn chất lượng cao nhất.")
    bullet(doc, "Tăng cường động lực và ổn định tổ chức thông qua hệ thống khen thưởng gắn liền với hiệu suất chất lượng xuất sắc.")
    bullet(doc, "Tăng cường hợp tác và giao tiếp nội bộ giữa các bộ phận.")

    doc.add_page_break()

    # ══════════════════════════════════════════
    # PHẦN 2
    # ══════════════════════════════════════════
    doc.add_heading("PHẦN 2. GIẢI THÍCH CHUNG VỀ CẤU TRÚC CHÍNH SÁCH THƯỞNG", level=1)

    doc.add_paragraph("Chính sách thưởng QIP của HWK có 2 Chương trình chính:")
    bullet(doc, 'Chương trình 1: "Chương trình thưởng dựa trên hiệu suất hàng tháng"')
    bullet(doc, 'Chương trình 2: "Chương trình thưởng dựa trên hiệu suất 6 tháng"')

    doc.add_paragraph(
        "Chương trình 1 có 3 quy trình đánh giá. Mỗi thành viên QIP được phân loại thành 3 loại: "
        "Type-1, Type-2 và Type-3. Tùy theo loại, phương pháp tính thưởng sẽ khác nhau."
    )

    doc.add_heading("Đánh giá Type-1 (QIP Trực tiếp tại Assembly)", level=2)
    doc.add_paragraph(
        "Đối với thành viên QIP Type-1, hiệu suất được đánh giá dựa trên tối đa 10 điều kiện trong 4 nhóm:"
    )
    bullet(doc, "Điều kiện chuyên cần (C1–C4): Tỷ lệ đi làm, vắng mặt không phép, ngày làm việc thực tế, ngày làm việc tối thiểu")
    bullet(doc, "Điều kiện AQL (C5–C8): Lỗi AQL cá nhân, lỗi AQL liên tục cá nhân, lỗi AQL liên tục nhóm/khu vực, tỷ lệ từ chối khu vực")
    bullet(doc, "Điều kiện 5PRS (C9–C10): Tỷ lệ đạt 5PRS, số lượng kiểm tra 5PRS")

    doc.add_paragraph(
        "QUAN TRỌNG: Các điều kiện áp dụng khác nhau tùy theo chức vụ trong Type-1. Không phải tất cả 10 điều kiện "
        "đều áp dụng cho mọi chức vụ. Tuy nhiên, 100% điều kiện áp dụng phải được đáp ứng để nhân viên nhận thưởng."
    )

    doc.add_heading("Đánh giá Type-2 (QIP Gián tiếp tại Assembly)", level=2)
    doc.add_paragraph("Đối với thành viên QIP Type-2, chỉ đánh giá điều kiện chuyên cần (C1–C4):")
    bullet(doc, "Tỷ lệ đi làm ≥ 88%")
    bullet(doc, "Vắng mặt không phép ≤ 2 ngày")
    bullet(doc, "Ngày làm việc thực tế > 0")
    bullet(doc, "Ngày làm việc tối thiểu ≥ 12 ngày")
    doc.add_paragraph(
        "Số tiền thưởng hàng tháng được tính dựa trên mức thưởng trung bình của các chức vụ Type-1 tương ứng "
        "và hệ số nhân theo chức vụ."
    )

    doc.add_heading("Type-3 (Thành viên QIP mới)", level=2)
    doc.add_paragraph(
        "Đối với thành viên QIP Type-3 (nhân viên mới với dưới 30 ngày làm việc), không tiến hành đánh giá "
        "và chính sách thưởng không áp dụng. Sau khoảng 3 tháng, Type-3 được nâng lên Type-2."
    )

    doc.add_heading("Chương trình 2 — Thưởng dựa trên hiệu suất 6 tháng", level=2)
    doc.add_paragraph(
        "Chương trình 2 là chương trình thưởng bổ sung cho các thành viên Talent Pool QIP được chọn. "
        "Trong hệ thống V10, Chương trình 2 được triển khai dưới dạng thưởng Talent Pool tự động "
        "áp dụng cùng với thưởng thường xuyên (Chương trình 1). Xem Phần 6 để biết chi tiết."
    )

    doc.add_page_break()

    # ══════════════════════════════════════════
    # PHẦN 3
    # ══════════════════════════════════════════
    doc.add_heading("PHẦN 3. PHẠM VI VÀ ĐỐI TƯỢNG ÁP DỤNG", level=1)

    doc.add_paragraph(
        "Chính sách này áp dụng cho tất cả thành viên đội QIP. "
        "Ngoại trừ nhân viên QIP Type-3, là nhân viên mới đang trong quá trình làm quen và đào tạo, "
        "có dưới 30 ngày làm việc."
    )

    doc.add_heading("Phân loại nhân viên QIP", level=2)

    bold_para(doc, "Type 1 — QIP trực tiếp tại assembly: ", "kiểm tra chất lượng sản phẩm cuối cùng")
    bullet(doc, "Kiểm tra viên tại dây chuyền Assembly")
    bullet(doc, "Kiểm tra viên tại dây chuyền Repacking")
    bullet(doc, "Kiểm tra viên AQL (AQL Inspector)")
    bullet(doc, "Đào tạo viên kiểm tra kiểm tra viên (Đội Audit & Training)")
    bullet(doc, "Đội Model Master QIP")
    bullet(doc, "Kiểm tra viên RQC Assembly (mã chức vụ A1B — miễn C7 và C10 từ tháng 2/2026)")
    bullet(doc, "Line Leader")

    bold_para(doc, "Type 2 — QIP gián tiếp tại assembly: ", "đóng góp vào chất lượng sản phẩm cuối cùng")
    bullet(doc, "Đội QIP Vật liệu (MTL)")
    bullet(doc, "Đội QIP Cắt (Cutting)")
    bullet(doc, "Đội QIP OSC/Inhouse")
    bullet(doc, "Đội QIP May (Stitching)")
    bullet(doc, "Đội QIP Đế (Bottom)")
    bullet(doc, "Đội QIP Đóng gói (Packing)")
    bullet(doc, "Đội QA")
    bullet(doc, "Đội QIP văn phòng")
    bullet(doc, "Đội OCPT")
    bullet(doc, "Tất cả thành viên QIP khác không thuộc Type 1 và Bộ phận Kiểm nghiệm (LAB)")

    bold_para(doc, "Type 3 — QIP mới: ", "Nhân viên mới với dưới 30 ngày làm việc")
    bullet(doc, "Không đánh giá hoặc thanh toán thưởng trong thời gian thử việc")
    bullet(doc, "Tự động nâng lên Type-2 sau khoảng 3 tháng")

    doc.add_heading("Kỳ đánh giá & Lịch thanh toán", level=2)
    bullet(doc, "Kỳ đánh giá: Từ ngày đầu tiên đến ngày cuối cùng của tháng.")
    bullet(doc, "Kỳ xét thưởng: Từ ngày 1 đến ngày 15 của tháng sau.")
    bullet(doc, "Nhân viên đang làm việc: Thanh toán trong kỳ lương tiếp theo.")
    bullet(doc, "Nhân viên đã nghỉ: Thanh toán trong vòng 14 ngày làm việc kể từ ngày nghỉ.")

    doc.add_page_break()

    # ══════════════════════════════════════════
    # PHẦN 4
    # ══════════════════════════════════════════
    doc.add_heading("PHẦN 4. ĐỊNH NGHĨA & THUẬT NGỮ VIẾT TẮT", level=1)

    tbl = doc.add_table(rows=1, cols=2)
    tbl.style = 'Table Grid'
    make_header_row(tbl, ["Thuật ngữ", "Định nghĩa"])

    terms = [
        ["QIP", "Chương trình Cải tiến Chất lượng — Hệ thống thưởng nhân viên tập trung vào chất lượng của HWK"],
        ["5Q", "5 Mục tiêu Chất lượng — Mục tiêu hiệu suất chất lượng chiến lược của HWK"],
        ["AQL", "Mức Chất lượng Chấp nhận được — Tiêu chuẩn kiểm tra lấy mẫu quốc tế"],
        ["5PRS", "Lấy mẫu ngẫu nhiên 5 đôi — Phương pháp kiểm tra chất lượng nội bộ"],
        ["CFA", "Kiểm tra viên Cuối cùng được Chứng nhận — Chứng chỉ kiểm tra AQL được adidas phê duyệt"],
        ["PO", "Đơn hàng Sản xuất — Đơn vị đơn hàng sản xuất riêng lẻ"],
        ["C1–C10", "10 điều kiện thưởng được hệ thống đánh giá"],
        ["TYPE-1", "Nhân viên chất lượng trực tiếp với đánh giá đầy đủ điều kiện"],
        ["TYPE-2", "Nhân viên gián tiếp/quản lý chỉ đánh giá chuyên cần"],
        ["TYPE-3", "Nhân viên mới (< 3 tháng) không được nhận thưởng"],
        ["Bảng lũy tiến", "Bảng số tiền thưởng tăng theo tháng liên tục đạt điều kiện (150K–1M VND)"],
        ["Tháng liên tục", "Số tháng liên tiếp đáp ứng tất cả điều kiện áp dụng"],
        ["Allowance", "Ngoại lệ ghi đè — Trường hợp miễn điều kiện được quản lý phê duyệt"],
        ["Firestore", "Cơ sở dữ liệu NoSQL của Google Cloud được sử dụng cho lưu trữ dữ liệu V10"],
        ["RBAC", "Kiểm soát Truy cập theo Vai trò — Hệ thống phân quyền admin và người dùng thường"],
    ]
    for t in terms:
        add_row(tbl, t)

    doc.add_page_break()

    # ══════════════════════════════════════════
    # PHẦN 5. CHƯƠNG TRÌNH 1
    # ══════════════════════════════════════════
    doc.add_heading("PHẦN 5. PHƯƠNG PHÁP TÍNH THƯỞNG — CHƯƠNG TRÌNH 1", level=1)

    # 5.1
    doc.add_heading("5.1 10 Điều kiện Thưởng", level=2)
    doc.add_paragraph(
        "Hệ thống V10 đánh giá tối đa 10 điều kiện cho mỗi thành viên QIP. Không phải tất cả điều kiện đều áp dụng "
        "cho mọi chức vụ — điều kiện áp dụng được xác định bởi Ma trận Điều kiện-Chức vụ (xem Phần 5.2 và Phụ lục 2). "
        "Tuy nhiên, TẤT CẢ điều kiện áp dụng phải được đáp ứng (tỷ lệ đạt 100%) để nhân viên nhận thưởng."
    )

    tbl = doc.add_table(rows=1, cols=5)
    tbl.style = 'Table Grid'
    make_header_row(tbl, ["#", "Điều kiện", "Nhóm", "Ngưỡng mặc định", "Mô tả"])

    conditions = [
        ["C1", "Tỷ lệ đi làm", "Chuyên cần", "≥ 88%", "Tỷ lệ chuyên cần có điều chỉnh nghỉ phép"],
        ["C2", "Vắng không phép", "Chuyên cần", "≤ 2 ngày", "Số ngày vắng AR1 (không phép) trong giới hạn"],
        ["C3", "Ngày làm thực tế", "Chuyên cần", "> 0 ngày", "Ít nhất 1 ngày làm việc thực tế trong tháng"],
        ["C4", "Ngày làm tối thiểu", "Chuyên cần", "≥ 12 ngày", "Chỉ áp dụng sau ngày 20 (báo cáo giữa kỳ miễn)"],
        ["C5", "Lỗi AQL cá nhân", "AQL", "= 0 lỗi", "Không có lỗi AQL cá nhân trong tháng hiện tại"],
        ["C6", "AQL liên tục cá nhân", "AQL", "Không liên tục", "2025: 3+ tháng, 2026+: 2+ tháng liên tục"],
        ["C7", "AQL liên tục nhóm/KV", "AQL", "Không liên tục", "Cùng ngưỡng theo năm như C6"],
        ["C8", "Tỷ lệ từ chối KV", "AQL", "< 3.0%", "Tỷ lệ từ chối của khu vực phụ trách dưới ngưỡng"],
        ["C9", "Tỷ lệ đạt 5PRS", "5PRS", "≥ 95%", "Tỷ lệ đạt kiểm tra chất lượng 5PRS"],
        ["C10", "SL kiểm tra 5PRS", "5PRS", "≥ 100 đôi", "Số lượng kiểm tra 5PRS tối thiểu"],
    ]
    for c in conditions:
        add_row(tbl, c)

    doc.add_paragraph()
    bold_para(doc, "Lưu ý về ngưỡng có thể cấu hình: ",
              "Tất cả ngưỡng trên là giá trị mặc định hệ thống. Quản trị viên có thể điều chỉnh ngưỡng hàng tháng "
              "qua Admin Panel. 7 ngưỡng có thể cấu hình. Mọi thay đổi đều được ghi nhật ký kiểm tra không thể sửa đổi.")

    bold_para(doc, "Lưu ý về chính sách lỗi liên tục: ",
              "Từ năm 2026, ngưỡng lỗi liên tục đã được cập nhật từ 3 tháng xuống 2 tháng. "
              "Nghĩa là 2 tháng trở lên lỗi AQL liên tục sẽ dẫn đến mất thưởng (C6, C7). "
              "Năm 2025, chỉ 3 tháng trở lên mới bị loại.")

    # 5.2
    doc.add_heading("5.2 Ma trận Áp dụng Điều kiện theo Chức vụ (Type-1)", level=2)
    doc.add_paragraph(
        "Các chức vụ khác nhau trong Type-1 có các điều kiện áp dụng khác nhau:"
    )

    tbl = doc.add_table(rows=1, cols=11)
    tbl.style = 'Table Grid'
    make_header_row(tbl, ["Chức vụ", "C1", "C2", "C3", "C4", "C5", "C6", "C7", "C8", "C9", "C10"])

    matrix = [
        ["ASSEMBLY INSPECTOR", "Có", "Có", "Có", "Có", "Có", "Có", "—", "—", "Có", "Có"],
        ["RQC ASSEMBLY INSPECTOR\n(A1B, từ 02/2026)", "Có", "Có", "Có", "Có", "Có", "Có", "—", "—", "Có", "—"],
        ["AQL INSPECTOR", "Có", "Có", "Có", "Có", "Có", "—", "—", "—", "—", "—"],
        ["LINE LEADER", "Có", "Có", "Có", "Có", "—", "—", "Có", "—", "—", "—"],
        ["AUDITOR & TRAINER", "Có", "Có", "Có", "Có", "—", "—", "Có", "Có", "—", "—"],
        ["MODEL MASTER", "Có", "Có", "Có", "Có", "—", "—", "—", "Có", "—", "—"],
        ["Quản lý (Group Leader,\nSupervisor, Manager, v.v.)", "Có", "Có", "Có", "Có", "—", "—", "—", "—", "—", "—"],
    ]
    for m in matrix:
        add_row(tbl, m)

    doc.add_paragraph()
    bold_para(doc, "RQC Assembly Inspector (A1B): ",
              "Từ tháng 2/2026, mã chức vụ A1B được phân loại là RQC_ASSEMBLY_INSPECTOR. "
              "C7 (AQL nhóm/KV) và C10 (SL kiểm tra 5PRS) được miễn vì kiểm tra viên RQC "
              "thực hiện kiểm tra quy trình và báo cáo, không phải kiểm tra dây chuyền.")

    doc.add_page_break()

    # 5.3
    doc.add_heading("5.3 Bảng Thưởng Lũy tiến Type-1", level=2)
    doc.add_paragraph(
        "Đối với thành viên Type-1 đạt tất cả điều kiện, số tiền thưởng tăng theo tháng liên tục đạt điều kiện:"
    )

    tbl = doc.add_table(rows=2, cols=14)
    tbl.style = 'Table Grid'
    headers = ["Tháng", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12–15"]
    amounts = ["VND (×1.000)", "150", "250", "300", "350", "400", "450", "500", "650", "750", "850", "950", "1.000"]

    for i, text in enumerate(headers):
        cell = tbl.rows[0].cells[i]
        p = cell.paragraphs[0]
        run = p.add_run(text)
        run.bold = True
        run.font.size = Pt(8)
        run.font.color.rgb = RGBColor(255, 255, 255)
        set_cell_shading(cell, "2F5496")
    for i, text in enumerate(amounts):
        cell = tbl.rows[1].cells[i]
        p = cell.paragraphs[0]
        run = p.add_run(text)
        run.font.size = Pt(8)
        if i == 0:
            run.bold = True

    doc.add_paragraph()
    doc.add_paragraph("Quy tắc chính:")
    bullet(doc, "Giới hạn tối đa: 1.000.000 VND/tháng (đạt tại tháng thứ 12 liên tục)")
    bullet(doc, "Reset khi thất bại: Nếu nhân viên không đạt điều kiện bất kỳ tháng nào, tháng liên tục reset về 0")
    bullet(doc, "Chuyển tiếp: Tháng liên tục được chuyển tiếp từ tháng trước khi đạt điều kiện")
    bullet(doc, "Theo dõi tối đa: 15 tháng (số tiền giữ nguyên 1.000.000 VND từ tháng 12 trở đi)")

    # 5.4
    doc.add_heading("5.4 AQL Inspector — Tính thưởng 3 Phần", level=2)
    doc.add_paragraph(
        "AQL Inspector nhận thưởng đặc biệt gồm 3 phần. Số tiền hàng tháng là tổng của cả 3 phần:"
    )

    bold_para(doc, "Phần 1: Kết quả Đánh giá Kiểm tra AQL")
    doc.add_paragraph("Dựa trên bảng lũy tiến (giống Phần 5.3). Yêu cầu tỷ lệ từ chối bởi adidas/T1QM/bên thứ 3 < 3%.")

    bold_para(doc, "Phần 2: Thưởng Chứng chỉ CFA")
    doc.add_paragraph("AQL Inspector có chứng chỉ AQL do adidas phê duyệt nhận cố định 700.000 VND/tháng.")

    bold_para(doc, "Phần 3: Thưởng Phòng ngừa Khiếu nại HWK")
    doc.add_paragraph("Thưởng bổ sung cho việc phòng ngừa khiếu nại HWK, tăng lũy tiến từ tháng thứ 4:")

    tbl = doc.add_table(rows=2, cols=6)
    tbl.style = 'Table Grid'
    headers2 = ["Tháng", "1–3", "4–6", "7–9", "10–12", "13–15"]
    amounts2 = ["VND (×1.000)", "0", "300", "500", "700", "900"]
    for i, text in enumerate(headers2):
        cell = tbl.rows[0].cells[i]
        p = cell.paragraphs[0]
        run = p.add_run(text)
        run.bold = True
        run.font.size = Pt(9)
        run.font.color.rgb = RGBColor(255, 255, 255)
        set_cell_shading(cell, "2F5496")
    for i, text in enumerate(amounts2):
        cell = tbl.rows[1].cells[i]
        p = cell.paragraphs[0]
        run = p.add_run(text)
        run.font.size = Pt(9)
        if i == 0:
            run.bold = True

    doc.add_paragraph()
    doc.add_paragraph("Ví dụ: AQL Inspector có chứng chỉ CFA tại tháng liên tục thứ 12:")
    bullet(doc, "Phần 1 (Lũy tiến): 1.000.000 VND")
    bullet(doc, "Phần 2 (Chứng chỉ CFA): 700.000 VND")
    bullet(doc, "Phần 3 (Phòng ngừa HWK): 700.000 VND")
    bullet(doc, "Tổng: 2.400.000 VND")

    doc.add_page_break()

    # 5.5
    doc.add_heading("5.5 Tính Thưởng Line Leader (Type-1)", level=2)
    doc.add_paragraph("Line Leader trong Type-1 nhận thưởng dựa trên hiệu suất đội ngũ dưới quyền:")
    bold_para(doc, "Công thức: ", "Tổng thưởng nhân viên dưới quyền × 12%")
    doc.add_paragraph(
        "Hệ thống sử dụng bản đồ nhân viên dưới quyền để xác định tất cả thành viên của mỗi Line Leader. "
        "Chỉ nhân viên dưới quyền đã nhận thưởng (> 0 VND) được tính vào tổng. "
        "Line Leader cũng phải đạt tất cả điều kiện áp dụng (C1, C2, C3, C4, C7)."
    )

    # 5.6
    doc.add_heading("5.6 Tính Thưởng Type-2", level=2)
    doc.add_paragraph(
        "Thành viên Type-2 phải đạt 100% điều kiện chuyên cần (C1–C4). Số tiền thưởng được tính "
        "dựa trên mức thưởng trung bình của các chức vụ Type-1 tương ứng."
    )

    bold_para(doc, "Bảng Ánh xạ Chức vụ TYPE-2:")
    tbl = doc.add_table(rows=1, cols=3)
    tbl.style = 'Table Grid'
    make_header_row(tbl, ["Chức vụ Type-2", "Tham chiếu thưởng", "Mô tả"])

    mappings = [
        ["BOTTOM INSPECTOR", "TB ASSEMBLY INSPECTOR", "Sử dụng TB thưởng Type-1 Assembly Inspector"],
        ["CUTTING INSPECTOR", "TB ASSEMBLY INSPECTOR", "Sử dụng TB thưởng Type-1 Assembly Inspector"],
        ["MTL INSPECTOR", "TB ASSEMBLY INSPECTOR", "Sử dụng TB thưởng Type-1 Assembly Inspector"],
        ["STITCHING INSPECTOR", "TB ASSEMBLY INSPECTOR", "Sử dụng TB thưởng Type-1 Assembly Inspector"],
        ["OSC INSPECTOR", "TB ASSEMBLY INSPECTOR", "Sử dụng TB thưởng Type-1 Assembly Inspector"],
        ["OCPT STAFF", "TB ASSEMBLY INSPECTOR", "Sử dụng TB thưởng Type-1 Assembly Inspector"],
        ["RQC", "TB ASSEMBLY INSPECTOR", "Sử dụng TB thưởng Type-1 Assembly Inspector"],
        ["AQL INSPECTOR (TYPE-2)", "TB ASSEMBLY INSPECTOR", "Sử dụng TB thưởng Type-1 Assembly Inspector"],
        ["QA TEAM (mặc định)", "TB ASSEMBLY INSPECTOR", "Sử dụng TB thưởng Type-1 Assembly Inspector"],
        ["QA TEAM (mã QA3A)", "TB GROUP LEADER", "Đặc biệt: ánh xạ tới TB Group Leader"],
        ["QA TEAM (mã QA3B)", "TB ASSEMBLY INSPECTOR", "Sử dụng TB thưởng Type-1 Assembly Inspector"],
        ["LINE LEADER (TYPE-2)", "TB LINE LEADER", "Sử dụng TB thưởng Type-1 Line Leader"],
    ]
    for m in mappings:
        add_row(tbl, m)

    doc.add_paragraph()
    p = doc.add_paragraph()
    run = p.add_run("TB = Trung bình")
    run.italic = True

    # 5.7
    doc.add_heading("5.7 Hệ số Nhân Chức vụ Quản lý Type-2", level=2)
    doc.add_paragraph(
        "Đối với các chức vụ quản lý trong Type-2, thưởng = TB thưởng LINE LEADER Type-1 (chỉ người nhận) × hệ số:"
    )

    tbl = doc.add_table(rows=1, cols=4)
    tbl.style = 'Table Grid'
    make_header_row(tbl, ["Chức vụ", "Hệ số", "Công thức", "Mô tả"])

    multipliers = [
        ["GROUP LEADER", "2.0×", "TB LL × 2.0", "TB Line Leader nhận thưởng × 2.0"],
        ["SUPERVISOR /\n(V) SUPERVISOR /\nA.SUPERVISOR", "2.5×", "TB LL × 2.5", "TB Line Leader nhận thưởng × 2.5"],
        ["A.MANAGER", "3.0×", "TB LL × 3.0", "TB Line Leader nhận thưởng × 3.0"],
        ["MANAGER", "3.5×", "TB LL × 3.5", "TB Line Leader nhận thưởng × 3.5"],
        ["S.MANAGER", "4.0×", "TB LL × 4.0", "TB Line Leader nhận thưởng × 4.0"],
    ]
    for m in multipliers:
        add_row(tbl, m)

    doc.add_paragraph()
    doc.add_paragraph("Ví dụ: Nếu TB thưởng Line Leader Type-1 là 400.000 VND:")
    bullet(doc, "Group Leader = 400.000 × 2.0 = 800.000 VND")
    bullet(doc, "(V) Supervisor = 400.000 × 2.5 = 1.000.000 VND")
    bullet(doc, "A.Manager = 400.000 × 3.0 = 1.200.000 VND")
    bullet(doc, "Manager = 400.000 × 3.5 = 1.400.000 VND")
    bullet(doc, "S.Manager = 400.000 × 4.0 = 1.600.000 VND")

    bold_para(doc, "Lưu ý: ", "\"TB LINE LEADER nhận thưởng\" nghĩa là trung bình thưởng của Line Leader Type-1 "
              "chỉ tính những người nhận thưởng (> 0 VND). Người có 0 VND bị loại khỏi phép tính trung bình.")

    # 5.8
    doc.add_heading("5.8 Thưởng Đội Audit & Training (Trainer)", level=2)
    doc.add_paragraph("Mỗi nhân viên đào tạo có khu vực phụ trách riêng để kiểm tra và đào tạo kiểm tra viên.")
    bullet(doc, "Nếu tỷ lệ lỗi (Tỷ lệ Từ chối Khu vực, C8) dưới ngưỡng: Đạt yêu cầu.")
    bullet(doc, "Nếu tỷ lệ lỗi trên ngưỡng: Không đạt yêu cầu.")
    bullet(doc, "Điều kiện áp dụng: C1, C2, C3, C4, C7 (AQL liên tục nhóm/KV), C8 (Tỷ lệ từ chối KV)")
    doc.add_paragraph("Bảng lũy tiến (Phần 5.3) áp dụng cho tính số tiền thưởng.")

    # 5.9
    doc.add_heading("5.9 Thưởng Đội Model Master", level=2)
    doc.add_paragraph("Thưởng đội Model Master dựa trên tỷ lệ từ chối AQL HWK trên tất cả nhà máy.")
    bullet(doc, "Nếu tỷ lệ từ chối AQL chính thức của HWK trên tất cả nhà máy (C8) dưới ngưỡng: Đủ điều kiện.")
    bullet(doc, "Điều kiện áp dụng: C1, C2, C3, C4, C8 (Tỷ lệ Từ chối Khu vực)")
    doc.add_paragraph("Bảng lũy tiến (Phần 5.3) áp dụng cho tính số tiền thưởng.")

    doc.add_page_break()

    # ══════════════════════════════════════════
    # PHẦN 6
    # ══════════════════════════════════════════
    doc.add_heading("PHẦN 6. PHƯƠNG PHÁP TÍNH THƯỞNG — CHƯƠNG TRÌNH 2", level=1)

    doc.add_paragraph(
        'Chương trình 2 là "Chương trình Thưởng dựa trên Hiệu suất 6 Tháng." Chỉ các thành viên QIP được chọn '
        "mới được đánh giá qua quy trình toàn diện kéo dài 6 tháng."
    )

    bold_para(doc, "QUAN TRỌNG: ", "Ai nhận thưởng theo Chương trình 1 cũng có thể nhận thưởng theo Chương trình 2.")

    steps = [
        ("Bước 1: Thiết lập Mục tiêu", "Mỗi tháng 1 và tháng 7, đội QIP đánh giá hiệu suất 6 tháng trước và lập kế hoạch 6 tháng tới."),
        ("Bước 2: Phân công Nhiệm vụ", "Quản lý QIP chọn \"đúng người\" cho mỗi mục tiêu. Số tiền thưởng và kỳ thanh toán được xác định. COO phê duyệt."),
        ("Bước 3: Theo dõi & Phản hồi Hàng tháng", "Đội QA, đội văn phòng và quản lý QIP đánh giá hàng tháng bằng KPI đo lường được."),
        ("Bước 4: Đánh giá Cuối cùng", "Sau 6 tháng, quản lý QIP xem xét kế hoạch và kết quả, ra quyết định cuối cùng."),
        ("Bước 5: Xác nhận Thành viên Talent Pool", "Quản lý QIP yêu cầu phê duyệt từ HR và COO qua hệ thống groupware HS."),
        ("Bước 6: Phát triển Talent Pool QIP HWK", "Quy trình liên tục với chu kỳ mới mỗi 6 tháng. Mục tiêu chứng nhận 3–5% tổng thành viên QIP. Chứng nhận có hiệu lực 12 tháng."),
    ]
    for title, desc in steps:
        bold_para(doc, title)
        doc.add_paragraph(desc)

    doc.add_paragraph()
    bold_para(doc, "Triển khai trong Hệ thống V10:")
    bullet(doc, "Tự động áp dụng: Thưởng Talent Pool tự động áp dụng cùng thưởng thường xuyên")
    bullet(doc, "Cộng dồn: Thưởng Talent Pool cộng thêm vào thưởng thường xuyên (Chương trình 1)")
    bullet(doc, "Thời gian thanh toán: Cùng kỳ thưởng hàng tháng")
    bullet(doc, "Yêu cầu điều kiện: Không — thành viên Talent Pool nhận thưởng bất kể đạt/không đạt điều kiện")
    bullet(doc, "Loại trừ: Nhân viên đã nghỉ tự động bị loại")

    doc.add_page_break()

    # ══════════════════════════════════════════
    # PHẦN 7
    # ══════════════════════════════════════════
    doc.add_heading("PHẦN 7. TÓM TẮT CÁC ĐIỀU KHOẢN NGOẠI LỆ", level=1)

    doc.add_heading("7.1 Các trường hợp KHÔNG nhận Thưởng", level=2)

    bold_para(doc, "Đối với Type-1 (Chương trình 1):")
    bullet(doc, "Nếu bất kỳ điều kiện áp dụng nào không đạt (yêu cầu đạt 100%), không nhận thưởng hàng tháng.")
    bullet(doc, "Nếu tỷ lệ đi làm < ngưỡng, vắng không phép > ngưỡng, ngày làm thực tế = 0, hoặc ngày làm tối thiểu < ngưỡng.")
    bullet(doc, "Nếu tỷ lệ đạt 5PRS < ngưỡng (chức vụ áp dụng C9), không nhận thưởng.")
    bullet(doc, "Nếu số lượng kiểm tra 5PRS < ngưỡng (chức vụ áp dụng C10), không nhận thưởng.")
    bullet(doc, "Nếu có khiếu nại chính thức từ adidas và trách nhiệm thuộc về cá nhân, không nhận thưởng.")
    bullet(doc, "Nếu số lần AQL PO bị từ chối cá nhân > 0 (chức vụ áp dụng C5), không nhận thưởng.")
    bullet(doc, "Đối với Line Leader: Nếu bất kỳ kiểm tra viên nào trong đội có lỗi AQL liên tục vượt ngưỡng, Line Leader không nhận thưởng.")
    bullet(doc, "Đối với Trainer: Nếu tỷ lệ từ chối AQL chính thức hàng tháng của tòa nhà phụ trách vượt ngưỡng, không nhận thưởng.")

    bold_para(doc, "Đối với Type-2 (Chương trình 1):")
    bullet(doc, "Nếu điều kiện chuyên cần (C1–C4) không đạt 100%, không nhận thưởng hàng tháng.")
    bullet(doc, "Nếu có khiếu nại chính thức từ adidas hoặc khiếu nại nội bộ nghiêm trọng thuộc trách nhiệm cá nhân, không nhận thưởng.")

    bold_para(doc, "Đối với Type-3 (Chương trình 1):")
    bullet(doc, "TẤT CẢ thành viên QIP Type-3 không nhận thưởng hàng tháng (loại trừ theo chính sách).")

    bold_para(doc, "Đối với Chương trình 2:")
    bullet(doc, "Nếu đề xuất của quản lý QIP bị COO từ chối trong kỳ cập nhật 6 tháng, tất cả quy trình Chương trình 2 không có hiệu lực.")

    doc.add_heading("7.2 Trường hợp Ngoại lệ ĐƯỢC nhận Thưởng (Ghi đè Quản lý / Allowance)", level=2)

    doc.add_paragraph(
        "Hệ thống V10 bao gồm hệ thống Allowance/Ghi đè Ngoại lệ có thể truy cập qua Admin Dashboard:"
    )
    bullet(doc, "Do hạn chế ngày phép hoặc vấn đề cá nhân khẩn cấp, nếu nhân viên không đạt điều kiện chuyên cần, "
           "quản lý QIP có thể xem xét và cho phép ngoại lệ.")
    bullet(doc, "Nếu trường hợp AQL bị từ chối liên quan đến \"lỗi sở hữu chất lượng của đội sản xuất\" "
           "chứ không phải hiệu suất kém của kiểm tra viên, PO AQL bị từ chối sẽ không tính vào đánh giá.")
    bullet(doc, "Nếu kết quả 5PRS dưới ngưỡng với lý do hợp lý (luân chuyển khu vực, cập nhật R&R, v.v.), "
           "quản lý QIP có thể cho phép ngoại lệ.")
    bullet(doc, "Từng trường hợp cụ thể có thể được quản lý QIP cho phép ngoại lệ.")

    bold_para(doc, "Triển khai Allowance trong Hệ thống V10:")
    doc.add_paragraph("Hệ thống cung cấp 4 mã lý do:")

    tbl = doc.add_table(rows=1, cols=2)
    tbl.style = 'Table Grid'
    make_header_row(tbl, ["Mã lý do", "Mô tả"])
    codes = [
        ["MEDICAL", "Lý do y tế (ốm đau, chấn thương, nhập viện)"],
        ["COMPANY_ORDER", "Lệnh công ty (điều chuyển, nhiệm vụ bắt buộc)"],
        ["NATURAL_DISASTER", "Thiên tai (lũ lụt, bão, v.v.)"],
        ["OTHER", "Lý do khác (yêu cầu nhập chi tiết)"],
    ]
    for c in codes:
        add_row(tbl, c)

    doc.add_paragraph()
    doc.add_paragraph("Quy trình Allowance trong hệ thống:")
    bullet(doc, "1. Quản trị viên tìm kiếm nhân viên trong tab Allowance")
    bullet(doc, "2. Hệ thống hiển thị trạng thái điều kiện hiện tại (đạt/không đạt)")
    bullet(doc, "3. Quản trị viên chọn các điều kiện không đạt cần ghi đè")
    bullet(doc, "4. Quản trị viên cung cấp mã lý do + chi tiết giải trình (bắt buộc)")
    bullet(doc, "5. Màn hình xem trước hiển thị tác động trước khi áp dụng")
    bullet(doc, "6. Khi Áp dụng: hệ thống cập nhật dữ liệu, tính lại thưởng, cập nhật bảng tóm tắt")
    bullet(doc, "7. Allowance có thể thu hồi (khôi phục trạng thái điều kiện ban đầu)")
    bullet(doc, "8. Tính lại hàng loạt có sẵn cho tất cả nhân viên allowance có thưởng 0")

    doc.add_paragraph(
        "Tất cả ghi đè allowance được theo dõi với nhật ký kiểm tra đầy đủ bao gồm: ngày, quản trị viên, "
        "nhân viên, điều kiện ghi đè, mã lý do, chi tiết, và số tiền thưởng tính lại."
    )

    doc.add_page_break()

    # ══════════════════════════════════════════
    # PHẦN 8
    # ══════════════════════════════════════════
    doc.add_heading("PHẦN 8. KIẾN TRÚC HỆ THỐNG & BẢNG ĐIỀU KHIỂN (V10)", level=1)

    doc.add_paragraph(
        "Hệ thống Thưởng QIP HWK V10 là nền tảng đám mây tự động hóa toàn bộ quy trình tính thưởng. "
        "Tất cả dữ liệu nhân viên được tải an toàn từ Firestore sau xác thực."
    )

    doc.add_heading("8.1 Luồng Dữ liệu & Pipeline CI/CD", level=2)
    doc.add_paragraph("Hệ thống tự động chạy mỗi 6 giờ (và kích hoạt thủ công):")
    bullet(doc, "Google Drive: Tải lên dữ liệu nguồn (nhân sự, chuyên cần, AQL, 5PRS)")
    bullet(doc, "GitHub Actions: Pipeline CI/CD tự động tải dữ liệu, đồng bộ ngưỡng và cấu hình từ Firestore")
    bullet(doc, "Tự động phát hiện: Hệ thống tự động phát hiện tháng cần tính lại")
    bullet(doc, "Python Engine: Xử lý tất cả 10 điều kiện và tính số tiền thưởng")
    bullet(doc, "Firestore Upload: Tải kết quả lên cơ sở dữ liệu Firestore")
    bullet(doc, "Xử lý Email: Gửi thông báo email đang chờ qua SMTP")
    bullet(doc, "Triển khai: Bảng điều khiển được triển khai lên GitHub Pages")

    doc.add_heading("8.2 Tính năng Bảng điều khiển (8 Tab)", level=2)
    bullet(doc, "Tab Tóm tắt: Thẻ KPI (số người nhận, tỷ lệ thanh toán, tổng số tiền), bảng phân loại TYPE, biểu đồ điều kiện, biểu đồ xu hướng")
    bullet(doc, "Tab Chi tiết Chức vụ: Bảng phân tích theo từng chức vụ")
    bullet(doc, "Tab Chi tiết Cá nhân: Danh sách nhân viên có tìm kiếm/lọc/phân trang với modal chi tiết điều kiện")
    bullet(doc, "Tab Tiêu chí Thưởng: Tham chiếu ngưỡng hiện tại và mô tả điều kiện")
    bullet(doc, "Tab Sơ đồ Tổ chức: Cấu trúc tổ chức đội QIP với tính toán thưởng dự kiến")
    bullet(doc, "Tab Quản lý Nhóm: Phân tích và so sánh hiệu suất cấp nhóm")
    bullet(doc, "Tab Tóm tắt Xác minh: 12 thẻ xác minh KPI, kiểm tra tính toàn vẹn dữ liệu")
    bullet(doc, "Tab Tra cứu Chuyên cần: Lịch chuyên cần cá nhân với tra cứu trạng thái hàng ngày")

    doc.add_heading("8.3 Admin Panel (5 Tab)", level=2)
    doc.add_paragraph("Admin Panel chỉ dành cho quản trị viên (kiểm soát truy cập theo vai trò):")
    bullet(doc, "Ngưỡng: Điều chỉnh 7 ngưỡng hàng tháng với lịch sử thay đổi và nhật ký kiểm tra")
    bullet(doc, "Quản lý Cấu hình: Ánh xạ chức vụ, cấu hình bảng lũy tiến, quy tắc phân loại TYPE")
    bullet(doc, "Hệ thống: Giám sát trạng thái pipeline, cấu hình hệ thống, quản lý danh sách email admin")
    bullet(doc, "Tra cứu Dữ liệu: Truy vấn và xác minh dữ liệu Firestore trực tiếp")
    bullet(doc, "Allowances: Quản lý ghi đè ngoại lệ với quy trình áp dụng/thu hồi và tính lại hàng loạt")

    doc.add_heading("8.4 Quản lý Ngưỡng", level=2)
    doc.add_paragraph(
        "Tất cả giá trị ngưỡng được quản lý tập trung trong Firestore. Mọi thay đổi tạo bản ghi không thể sửa đổi "
        "bao gồm: trường thay đổi, giá trị cũ/mới, người thay đổi (email), và thời gian."
    )

    tbl = doc.add_table(rows=1, cols=3)
    tbl.style = 'Table Grid'
    make_header_row(tbl, ["Thông số", "Mặc định", "Cấu hình"])
    params = [
        ["Tỷ lệ đi làm (C1)", "88%", "Có"],
        ["Vắng không phép (C2)", "2 ngày", "Có"],
        ["Ngày làm tối thiểu (C4)", "12 ngày", "Có"],
        ["Tỷ lệ từ chối KV (C8)", "3.0%", "Có"],
        ["Tỷ lệ đạt 5PRS (C9)", "95%", "Có"],
        ["SL tối thiểu 5PRS (C10)", "100 đôi", "Có"],
        ["Tháng AQL liên tục (C6, C7)", "3 tháng", "Có"],
    ]
    for p_row in params:
        add_row(tbl, p_row)

    doc.add_heading("8.5 Hệ thống Phản hồi", level=2)
    doc.add_paragraph("Hệ thống bao gồm hệ thống phản hồi/theo dõi vấn đề cho tất cả người dùng đã xác thực:")
    bullet(doc, "Loại phản hồi: LỖI (BUG), CẢI TIẾN, TÍNH NĂNG MỚI, UI/UX, DỮ LIỆU, KHÁC")
    bullet(doc, "Mức ưu tiên: Khẩn cấp, Cao, Trung bình, Thấp")
    bullet(doc, "Luồng trạng thái: ĐÃ GỬI → ĐANG XEM XÉT → ĐANG TIẾN HÀNH → HOÀN THÀNH (hoặc TỪ CHỐI)")
    bullet(doc, "Tính năng: Đính kèm hình ảnh (tối đa 3), nhiều người nhận thông báo, trả lời admin qua email")

    doc.add_heading("8.6 Hệ thống Thông báo Email", level=2)
    doc.add_paragraph("3 thông báo email tự động qua Cloud Functions (Node.js 22):")
    bullet(doc, "Phản hồi mới → Tất cả quản trị viên nhận email thông báo (3 ngôn ngữ: ko/en/vi)")
    bullet(doc, "Trạng thái phản hồi thay đổi → Người báo cáo nhận thông báo cập nhật")
    bullet(doc, "Admin trả lời phản hồi → Người báo cáo nhận email trả lời")

    doc.add_heading("8.7 Hỗ trợ Đa ngôn ngữ", level=2)
    doc.add_paragraph("Toàn bộ bảng điều khiển hỗ trợ 3 ngôn ngữ: Tiếng Hàn (ko), Tiếng Anh (en), và Tiếng Việt (vi).")

    doc.add_heading("8.8 Xác thực & RBAC", level=2)
    doc.add_paragraph("Xác thực Firebase Email/Mật khẩu với Kiểm soát Truy cập theo Vai trò:")
    bullet(doc, "Người dùng thường: Xem bảng điều khiển chỉ đọc + gửi phản hồi")
    bullet(doc, "Quản trị viên: Toàn quyền bao gồm admin panel, quản lý ngưỡng, ghi đè allowance, quản lý phản hồi")

    doc.add_page_break()

    # ══════════════════════════════════════════
    # PHỤ LỤC 1
    # ══════════════════════════════════════════
    doc.add_heading("PHỤ LỤC 1: 10 ĐIỀU KIỆN THƯỞNG — MÔ TẢ CHI TIẾT", level=1)

    appendix_conditions = [
        ("C1 — Tỷ lệ Đi làm",
         "Tỷ lệ đi làm hàng tháng phải đạt ngưỡng (mặc định ≥ 88%). "
         "Tính: (Ngày Làm Thực tế) / (Tổng Ngày Làm − Ngày Nghỉ Phép Được Duyệt) × 100%. "
         "Nghỉ phép được duyệt không tính là vắng. Đi công tác tính là ngày làm việc thực tế."),
        ("C2 — Vắng mặt Không phép",
         "Số ngày vắng AR1 (không phép) phải trong giới hạn (mặc định ≤ 2 ngày/tháng). "
         "Ngoại lệ có thể được quản lý QIP phê duyệt qua hệ thống Allowance."),
        ("C3 — Ngày Làm Thực tế",
         "Nhân viên phải có ít nhất 1 ngày làm việc thực tế trong tháng."),
        ("C4 — Ngày Làm Tối thiểu",
         "Nhân viên phải làm ít nhất số ngày tối thiểu (mặc định 12) trong tháng. "
         "QUAN TRỌNG: Chỉ áp dụng sau ngày 20 của tháng hiện tại. Báo cáo giữa kỳ (trước ngày 20) tự động miễn."),
        ("C5 — Lỗi AQL Cá nhân",
         "Không có lỗi AQL cá nhân trong tháng hiện tại. Bất kỳ 1 lỗi nào đều loại khỏi thưởng. "
         "Ngoại lệ qua hệ thống Allowance."),
        ("C6 — Lỗi AQL Liên tục Cá nhân",
         "Không có lỗi AQL liên tục cá nhân. Ngưỡng theo năm: "
         "2025: chỉ 3+ tháng liên tục = loại. 2026+: 2+ tháng liên tục = loại."),
        ("C7 — Lỗi AQL Liên tục Nhóm/Khu vực",
         "Không có lỗi AQL liên tục nhóm/khu vực. Cùng ngưỡng theo năm như C6. "
         "Áp dụng cho: Line Leader, Đội Audit & Training. "
         "RQC Assembly Inspector (A1B) MIỄN điều kiện này từ tháng 2/2026."),
        ("C8 — Tỷ lệ Từ chối Khu vực",
         "Tỷ lệ từ chối trong khu vực phụ trách phải dưới ngưỡng (mặc định < 3.0%). "
         "Áp dụng cho: Model Master (tất cả nhà máy) và Đội Audit & Training (khu vực tòa nhà được phân công)."),
        ("C9 — Tỷ lệ Đạt 5PRS",
         "Tỷ lệ đạt kiểm tra 5PRS phải đạt ngưỡng (mặc định ≥ 95%). "
         "Áp dụng cho: Assembly Inspector (bao gồm RQC Assembly Inspector A1B)."),
        ("C10 — Số lượng Kiểm tra 5PRS",
         "Số lượng kiểm tra 5PRS tối thiểu phải đạt (mặc định ≥ 100 đôi/tháng). "
         "Áp dụng cho: Assembly Inspector. "
         "RQC Assembly Inspector (A1B) MIỄN điều kiện này từ tháng 2/2026."),
    ]

    for title, desc in appendix_conditions:
        bold_para(doc, title)
        doc.add_paragraph(desc)
        doc.add_paragraph()

    doc.add_page_break()

    # ══════════════════════════════════════════
    # PHỤ LỤC 2
    # ══════════════════════════════════════════
    doc.add_heading("PHỤ LỤC 2: MA TRẬN ÁP DỤNG ĐIỀU KIỆN THEO CHỨC VỤ", level=1)

    doc.add_heading("Chức vụ Type-1", level=2)

    tbl = doc.add_table(rows=1, cols=11)
    tbl.style = 'Table Grid'
    make_header_row(tbl, ["Chức vụ", "C1", "C2", "C3", "C4", "C5", "C6", "C7", "C8", "C9", "C10"])

    full_matrix = [
        ["ASSEMBLY INSPECTOR", "Có", "Có", "Có", "Có", "Có", "Có", "—", "—", "Có", "Có"],
        ["RQC ASSEMBLY INSPECTOR\n(A1B, từ 02/2026)", "Có", "Có", "Có", "Có", "Có", "Có", "—", "—", "Có", "—"],
        ["AQL INSPECTOR", "Có", "Có", "Có", "Có", "Có", "—", "—", "—", "—", "—"],
        ["LINE LEADER", "Có", "Có", "Có", "Có", "—", "—", "Có", "—", "—", "—"],
        ["AUDITOR & TRAINER", "Có", "Có", "Có", "Có", "—", "—", "Có", "Có", "—", "—"],
        ["MODEL MASTER", "Có", "Có", "Có", "Có", "—", "—", "—", "Có", "—", "—"],
        ["Quản lý (GL, Supervisor,\nManager)", "Có", "Có", "Có", "Có", "—", "—", "—", "—", "—", "—"],
    ]
    for m in full_matrix:
        add_row(tbl, m)

    doc.add_heading("Chức vụ Type-2", level=2)
    doc.add_paragraph("Tất cả Type-2 chỉ áp dụng điều kiện chuyên cần (C1–C4). Số tiền thưởng theo Phần 5.6 và 5.7.")

    doc.add_heading("Chức vụ Type-3", level=2)
    doc.add_paragraph("Type-3 không có điều kiện áp dụng và không nhận thưởng. Tự động chuyển Type-2 sau khoảng 3 tháng.")

    doc.add_page_break()

    # PHỤ LỤC 3
    doc.add_heading("PHỤ LỤC 3: TRẠNG THÁI TALENT POOL QIP HWK", level=1)
    doc.add_paragraph(
        "Talent Pool QIP HWK được quản lý qua cấu hình hệ thống V10. "
        "Thành viên Talent Pool nhận thưởng bổ sung hàng tháng độc lập với thưởng Type-1/Type-2."
    )
    bullet(doc, "Tự động áp dụng: Có — Thưởng tự động cùng thưởng thường xuyên")
    bullet(doc, "Cộng dồn: Có — Cộng thêm vào thưởng thường xuyên")
    bullet(doc, "Thời gian thanh toán: Cùng kỳ thưởng hàng tháng")
    bullet(doc, "Yêu cầu điều kiện: Không — nhận thưởng bất kể đạt/không đạt")
    bullet(doc, "Loại trừ: Nhân viên đã nghỉ tự động bị loại; yêu cầu trạng thái hoạt động")

    doc.add_page_break()

    # PHỤ LỤC 4
    doc.add_heading("PHỤ LỤC 4: BẢN ĐỒ R&R ĐỘI QIP", level=1)
    doc.add_paragraph("Vui lòng tham khảo tài liệu Bản đồ R&R Đội QIP riêng cho danh sách 69 công việc.")

    # PHỤ LỤC 5
    doc.add_heading("PHỤ LỤC 5: BỘ SƯU TẬP DỮ LIỆU FIRESTORE", level=1)
    doc.add_paragraph("Hệ thống V10 sử dụng các bộ sưu tập Firestore sau:")

    tbl = doc.add_table(rows=1, cols=3)
    tbl.style = 'Table Grid'
    make_header_row(tbl, ["Bộ sưu tập", "Mục đích", "Quyền truy cập"])
    collections = [
        ["employees/{monthYear}/all_data/data", "Dữ liệu nhân viên + thưởng", "Xác thực: đọc, Admin: ghi"],
        ["dashboard_summary/{monthYear}", "Thống kê tóm tắt KPI", "Xác thực: đọc, Admin: ghi"],
        ["thresholds/{monthYear}", "7 ngưỡng cấu hình", "Xác thực: đọc, Admin: ghi"],
        ["threshold_history/{autoId}", "Nhật ký kiểm tra không sửa đổi", "Xác thực: đọc, Admin: tạo"],
        ["allowances/{monthYear}/items/{docId}", "Ghi đè ngoại lệ", "Xác thực: đọc, Admin: ghi"],
        ["system/config", "Cài đặt hệ thống", "Xác thực: đọc, Admin: ghi"],
        ["configs/{document}", "Ánh xạ chức vụ, cấu hình", "Xác thực: đọc, Admin: ghi"],
        ["system_feedback/{autoId}", "Phản hồi / theo dõi vấn đề", "Xác thực: đọc/tạo, Admin: đầy đủ"],
        ["pendingNotifications/{autoId}", "Hàng đợi thông báo email", "Xác thực: tạo, Admin: đọc"],
        ["config/email", "Thông tin SMTP", "Chỉ Admin"],
        ["email_logs/{autoId}", "Nhật ký gửi email", "Chỉ Admin"],
    ]
    for c in collections:
        add_row(tbl, c)

    # Footer
    doc.add_paragraph()
    doc.add_paragraph()
    p = doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    run = p.add_run("— Hết —")
    run.font.size = Pt(11)
    run.font.color.rgb = RGBColor(128, 128, 128)
    run.italic = True

    return doc


if __name__ == "__main__":
    doc = create_policy_vi()
    output_path = os.path.expanduser(
        "~/Downloads/2025 QIP INCENTIVE POLICY Version3_Mar2026-Feb2027_Vi.docx"
    )
    doc.save(output_path)
    print(f"Policy document (Vietnamese) saved to: {output_path}")
    print(f"File size: {os.path.getsize(output_path):,} bytes")

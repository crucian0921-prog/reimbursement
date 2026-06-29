# -*- coding: utf-8 -*-
"""
AI Reimburse Assistant —— 单体后端（Flask）
用一个进程把"前端页面 + API"都跑起来，方便先跑通整条流程：
    python app.py
打开 http://127.0.0.1:5000 即可使用。

后续如果要按 PRD 6.1 迁移到 Next.js(前端) + FastAPI(后端) 的正式架构，
这里的每个 /api/... 路由可以原样搬到 FastAPI 里，业务逻辑（services/ 下三个模块）完全不用改。
"""
import os
import uuid
import shutil

from flask import Flask, request, jsonify, send_from_directory, send_file

from services import ocr_service, validator, docx_generator

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
UPLOAD_DIR = os.path.join(BASE_DIR, "uploads")
OUTPUT_DIR = os.path.join(BASE_DIR, "outputs")
os.makedirs(UPLOAD_DIR, exist_ok=True)
os.makedirs(OUTPUT_DIR, exist_ok=True)

app = Flask(__name__, static_folder="static", template_folder="templates")

# 用内存字典存 session（MVP阶段按 PRD 第7节"不包含数据库"的约束，重启即清空）
SESSIONS = {}


def _session_or_404(session_id):
    session = SESSIONS.get(session_id)
    if not session:
        return None
    return session


@app.route("/")
def index():
    return send_from_directory(app.template_folder, "index.html")


@app.route("/api/session", methods=["POST"])
def create_session():
    session_id = uuid.uuid4().hex[:12]
    session_dir = os.path.join(UPLOAD_DIR, session_id)
    os.makedirs(session_dir, exist_ok=True)
    SESSIONS[session_id] = {
        "files": [],          # [{"file_type", "path", "filename"}]
        "basic_info": {},
        "purpose": "",
        "structured_data": None,
        "validation": None,
        "docx_path": None,
    }
    return jsonify({"session_id": session_id})


@app.route("/api/session/<session_id>/basic-info", methods=["POST"])
def set_basic_info(session_id):
    session = _session_or_404(session_id)
    if session is None:
        return jsonify({"error": "session not found"}), 404

    data = request.get_json(force=True) or {}
    session["basic_info"] = {
        "reimburse_reason": data.get("reimburse_reason", ""),
        "reimburse_method": data.get("reimburse_method", ""),
        "payer_name": data.get("payer_name", ""),
        "student_id": data.get("student_id", ""),
        "contact": data.get("contact", ""),
        "activity_time": data.get("activity_time", ""),
    }
    session["purpose"] = data.get("purpose", "")
    return jsonify({"ok": True})


@app.route("/api/session/<session_id>/upload", methods=["POST"])
def upload_files(session_id):
    session = _session_or_404(session_id)
    if session is None:
        return jsonify({"error": "session not found"}), 404

    session_dir = os.path.join(UPLOAD_DIR, session_id)
    saved = []
    # 前端用三个字段名分别提交：invoices / orders / payments / approval
    for file_type in ("invoices", "orders", "payments", "approval"):
        for f in request.files.getlist(file_type):
            if not f or not f.filename:
                continue
            safe_name = f"{file_type}_{uuid.uuid4().hex[:8]}_{f.filename}"
            path = os.path.join(session_dir, safe_name)
            f.save(path)
            singular = file_type[:-1] if file_type != "approval" else "approval"
            record = {"file_type": singular, "path": path, "filename": f.filename}
            session["files"].append(record)
            saved.append({"file_type": singular, "filename": f.filename})

    return jsonify({"saved": saved, "total_files": len(session["files"])})


@app.route("/api/session/<session_id>/process", methods=["POST"])
def process_session(session_id):
    """对应 PRD 的 OCR识别 + AI结构化 两步，这里合并成一个接口返回，
    前端按需要拆成两个状态条目展示即可（不影响真实处理顺序）。"""
    session = _session_or_404(session_id)
    if session is None:
        return jsonify({"error": "session not found"}), 404

    ocr_results = ocr_service.run_ocr(session["files"])
    structured = ocr_service.merge_structured_data(
        session["basic_info"], ocr_results, session["purpose"]
    )
    session["structured_data"] = structured

    return jsonify({
        "ocr_status": "done",
        "structuring_status": "done",
        "structured_data": structured,
        "mock_mode": ocr_service.USE_MOCK,
    })


@app.route("/api/session/<session_id>/validate", methods=["POST"])
def validate_session(session_id):
    session = _session_or_404(session_id)
    if session is None:
        return jsonify({"error": "session not found"}), 404
    if not session["structured_data"]:
        return jsonify({"error": "请先调用 /process"}), 400

    uploaded_files = {"invoices": [], "orders": [], "payments": [], "approval": []}
    for rec in session["files"]:
        key = rec["file_type"] + "s" if rec["file_type"] != "approval" else "approval"
        uploaded_files.setdefault(key, []).append(rec)

    result = validator.run_validation(session["structured_data"], uploaded_files)
    session["validation"] = result
    return jsonify(result)


@app.route("/api/session/<session_id>/generate", methods=["POST"])
def generate_docx_route(session_id):
    session = _session_or_404(session_id)
    if session is None:
        return jsonify({"error": "session not found"}), 404
    if not session["structured_data"]:
        return jsonify({"error": "请先调用 /process"}), 400

    output_path = os.path.join(OUTPUT_DIR, f"{session_id}_报销材料.docx")
    docx_generator.generate_docx(session["structured_data"], output_path)
    session["docx_path"] = output_path

    return jsonify({"download_url": f"/api/session/{session_id}/download"})


@app.route("/api/session/<session_id>/download", methods=["GET"])
def download_docx(session_id):
    session = _session_or_404(session_id)
    if session is None or not session.get("docx_path"):
        return jsonify({"error": "文件还未生成"}), 404
    return send_file(
        session["docx_path"],
        as_attachment=True,
        download_name="报销材料.docx",
    )


@app.route("/api/session/<session_id>/json", methods=["GET"])
def get_structured_json(session_id):
    """对应 PRD 的"查看结构化JSON（开发模式）" """
    session = _session_or_404(session_id)
    if session is None:
        return jsonify({"error": "session not found"}), 404
    return jsonify({
        "structured_data": session["structured_data"],
        "validation": session["validation"],
    })


@app.route("/api/session/<session_id>", methods=["DELETE"])
def reset_session(session_id):
    session = SESSIONS.pop(session_id, None)
    session_dir = os.path.join(UPLOAD_DIR, session_id)
    if os.path.isdir(session_dir):
        shutil.rmtree(session_dir, ignore_errors=True)
    return jsonify({"ok": True})


if __name__ == "__main__":
    print("Mock OCR 模式：", ocr_service.USE_MOCK, "（设置环境变量 OPENAI_API_KEY 后将调用真实 GPT-4o Vision）")
    app.run(host="127.0.0.1", port=5000, debug=True)

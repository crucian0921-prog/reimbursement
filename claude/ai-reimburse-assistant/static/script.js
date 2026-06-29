// ===== 全局状态 =====
let SESSION_ID = null;
const selectedFiles = { invoices: [], orders: [], payments: [], approval: [] };

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));

function toast(msg) {
  const el = $("#toast");
  el.textContent = msg;
  el.classList.add("show");
  setTimeout(() => el.classList.remove("show"), 2200);
}

// ===== 初始化 session =====
async function initSession() {
  const res = await fetch("/api/session", { method: "POST" });
  const data = await res.json();
  SESSION_ID = data.session_id;
}

// ===== 文件上传交互（点击打开，选择后存到内存 + 渲染缩略图） =====
function setupUploadZones() {
  $$(".upload-zone").forEach((zone) => {
    const type = zone.dataset.type;
    const input = zone.querySelector(`input[data-input="${type}"]`);
    zone.addEventListener("click", () => input.click());
    zone.addEventListener("dragover", (e) => { e.preventDefault(); zone.style.borderColor = "var(--accent)"; });
    zone.addEventListener("dragleave", () => { zone.style.borderColor = ""; });
    zone.addEventListener("drop", (e) => {
      e.preventDefault();
      zone.style.borderColor = "";
      handleFiles(type, e.dataTransfer.files);
    });
    input.addEventListener("change", () => handleFiles(type, input.files));
  });

  // 审批截图（单独的行内上传，非 dropzone）
  const approvalInput = document.querySelector('input[data-input="approval"]');
  approvalInput.addEventListener("change", () => handleFiles("approval", approvalInput.files));
}

function handleFiles(type, fileList) {
  for (const f of fileList) selectedFiles[type].push(f);
  document.querySelector(`[data-count="${type}"]`).textContent =
    selectedFiles[type].length ? `已选择 ${selectedFiles[type].length} 个文件` : "";
  renderPreviews();
  updateSummaryPreview();
}

function renderPreviews() {
  const row = $("#preview-row");
  row.innerHTML = "";
  const labelMap = { invoices: "发票", orders: "订单", payments: "支付", approval: "审批" };
  Object.entries(selectedFiles).forEach(([type, files]) => {
    files.forEach((file) => {
      const thumb = document.createElement("div");
      thumb.className = "preview-thumb";
      const badge = document.createElement("div");
      badge.className = "badge";
      badge.textContent = labelMap[type];
      if (file.type && file.type.startsWith("image/")) {
        const img = document.createElement("img");
        img.src = URL.createObjectURL(file);
        thumb.appendChild(img);
      } else {
        thumb.style.display = "flex";
        thumb.style.alignItems = "center";
        thumb.style.justifyContent = "center";
        thumb.textContent = "📄";
      }
      thumb.appendChild(badge);
      row.appendChild(thumb);
    });
  });
}

function updateSummaryPreview() {
  $("#sum-invoice-count").textContent = `${selectedFiles.invoices.length} 张`;
  const linkedParts = [];
  if (selectedFiles.orders.length) linkedParts.push("订单");
  if (selectedFiles.payments.length) linkedParts.push("支付");
  $("#sum-linked").textContent = linkedParts.length ? linkedParts.join(" + ") : "—";
}

// ===== AI 处理状态展示 =====
function setStatus(step, state, subtitle) {
  const pill = document.querySelector(`[data-pill="${step}"]`);
  const sub = document.querySelector(`[data-sub="${step}"]`);
  pill.classList.remove("active", "done");
  if (state === "active") { pill.textContent = "处理中"; pill.classList.add("active"); }
  else if (state === "done") { pill.textContent = "已完成"; pill.classList.add("done"); }
  else { pill.textContent = "待执行"; }
  if (subtitle) sub.textContent = subtitle;
}

// ===== 校验结果渲染 =====
function renderValidation(result) {
  const groups = [
    { key: "complete", title: "完整项", icon: "✔" },
    { key: "missing", title: "缺失项", icon: "❌" },
    { key: "risk", title: "风险项", icon: "⚠" },
  ];
  const container = $("#validation-result");
  container.innerHTML = "";
  groups.forEach(({ key, title, icon }) => {
    const items = result[key] || [];
    if (!items.length) return;
    const groupEl = document.createElement("div");
    groupEl.className = "val-group";
    groupEl.innerHTML = `<div class="val-group-title ${key}">${icon} ${title} (${items.length})</div>`;
    items.forEach((it) => {
      const itemEl = document.createElement("div");
      itemEl.className = `val-item ${key}`;
      itemEl.innerHTML = `
        <div class="val-label">${it.label}</div>
        <div class="val-detail">${it.detail}</div>
        ${it.action ? `<span class="val-action">${it.action}</span>` : ""}
      `;
      groupEl.appendChild(itemEl);
    });
    container.appendChild(groupEl);
  });
  if (!container.children.length) {
    container.innerHTML = '<p class="field-hint">暂无校验结果</p>';
  }
}

// ===== 材料明细表渲染 =====
function renderItemsTable(structured) {
  const tbody = $("#items-tbody");
  const items = structured.items || [];
  if (!items.length) {
    tbody.innerHTML = '<tr class="empty-row"><td colspan="5">未识别到明细，请检查上传的发票内容</td></tr>';
  } else {
    tbody.innerHTML = items.map((it, idx) => `
      <tr>
        <td>${String(idx + 1).padStart(2, "0")}</td>
        <td>${it.name}</td>
        <td>¥ ${it.unit_price.toFixed(2)}</td>
        <td>${it.quantity}</td>
        <td class="num">¥ ${it.subtotal.toFixed(2)}</td>
      </tr>
    `).join("");
  }
  $("#items-total").textContent = `¥ ${structured.total_amount.toFixed(2)}`;
  $("#sum-total").textContent = `¥ ${structured.total_amount.toFixed(2)}`;
}

function collectBasicInfo() {
  return {
    reimburse_reason: $("#f-reason").value.trim(),
    reimburse_method: $("#f-method").value,
    activity_time: $("#f-activity-time").value,
    payer_name: $("#f-name").value.trim(),
    student_id: $("#f-student-id").value.trim(),
    contact: $("#f-contact").value.trim(),
    purpose: $("#f-purpose").value.trim(),
  };
}

async function uploadAllFiles() {
  const form = new FormData();
  let any = false;
  Object.entries(selectedFiles).forEach(([type, files]) => {
    files.forEach((f) => { form.append(type, f); any = true; });
  });
  if (!any) return; // 没有文件也允许跑通流程（mock 模式下方便演示）
  await fetch(`/api/session/${SESSION_ID}/upload`, { method: "POST", body: form });
}

// ===== 主流程：生成报销 Word =====
async function runGenerateFlow() {
  const basic = collectBasicInfo();
  if (!basic.reimburse_reason || !basic.payer_name || !basic.student_id) {
    toast("请先完整填写基础信息（报销事由 / 姓名 / 学号）");
    return;
  }

  const btn = $("#btn-generate");
  btn.disabled = true;
  btn.textContent = "⏳ 处理中...";

  try {
    // 1. 保存基础信息
    await fetch(`/api/session/${SESSION_ID}/basic-info`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(basic),
    });

    // 2. 上传文件
    setStatus("ocr", "active", "正在解析图像文件...");
    await uploadAllFiles();

    // 3. OCR + AI 结构化
    const procRes = await fetch(`/api/session/${SESSION_ID}/process`, { method: "POST" });
    const procData = await procRes.json();
    setStatus("ocr", "done", `${selectedFiles.invoices.length + selectedFiles.orders.length + selectedFiles.payments.length} 份图像文件已解析`);
    setStatus("structuring", "active", "正在匹配订单与支付记录...");
    await new Promise((r) => setTimeout(r, 250)); // 给"结构化中"状态一个可见的过渡
    setStatus("structuring", "done", "结构化数据已生成");
    renderItemsTable(procData.structured_data);

    if (procData.mock_mode) {
      toast("当前为 Mock OCR 模式（未配置 OPENAI_API_KEY），展示的是模拟识别结果");
    }

    // 4. 校验规则
    setStatus("validate", "active", "等待数据校验完成...");
    const valRes = await fetch(`/api/session/${SESSION_ID}/validate`, { method: "POST" });
    const valData = await valRes.json();
    setStatus("validate", "done", "校验已完成");
    renderValidation(valData);

    // 5. 生成 Word
    const genRes = await fetch(`/api/session/${SESSION_ID}/generate`, { method: "POST" });
    const genData = await genRes.json();
    if (genData.download_url) {
      $("#btn-download").disabled = false;
      $("#btn-download").dataset.url = genData.download_url;
      toast("报销 Word 已生成，可点击下载");
    }
  } catch (err) {
    console.error(err);
    toast("处理出错，请检查后端日志（控制台已打印详情）");
  } finally {
    btn.disabled = false;
    btn.textContent = "📄 生成报销 Word";
  }
}

function setupButtons() {
  $("#btn-generate").addEventListener("click", runGenerateFlow);

  $("#btn-download").addEventListener("click", () => {
    const url = $("#btn-download").dataset.url;
    if (url) window.location.href = url;
  });

  $("#link-json").addEventListener("click", async (e) => {
    e.preventDefault();
    if (!SESSION_ID) return;
    const res = await fetch(`/api/session/${SESSION_ID}/json`);
    const data = await res.json();
    $("#json-content").textContent = JSON.stringify(data, null, 2);
    $("#json-modal").classList.add("open");
  });
  $("#modal-close").addEventListener("click", () => $("#json-modal").classList.remove("open"));
  $("#json-modal").addEventListener("click", (e) => {
    if (e.target.id === "json-modal") $("#json-modal").classList.remove("open");
  });
}

// ===== 启动 =====
(async function start() {
  await initSession();
  setupUploadZones();
  setupButtons();
})();

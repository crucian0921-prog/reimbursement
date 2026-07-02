'use client';

import React, { useState } from 'react';

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  (typeof window !== 'undefined' ? `http://${window.location.hostname}:8000` : 'http://127.0.0.1:8000');

interface TableItem {
  id: number;
  name: string;
  price: number;
  quantity: number;
}

interface AiItem {
  name?: string;
  price?: string | number;
  quantity?: string | number;
  total?: string | number;
  [key: string]: unknown;
}

interface AiData {
  items?: AiItem[];
  amount?: string | number;
  purpose_statement?: string;
  purchase_explanation?: string;
  activity_plan?: string;
  activity_relation?: string;
  expected_effect?: string;
  advance_payment_note?: string;
  dynamic_activity_name?: string;
  dynamic_activity_info?: string;
  dynamic_relation?: string;
  dynamic_effect?: string;
  image_groups?: unknown[];
  image_base64_list?: string[];
  [key: string]: unknown;
}

interface DescriptionFields {
  purpose_statement: string;
  purchase_explanation: string;
  activity_plan: string;
  activity_relation: string;
  expected_effect: string;
  advance_payment_note: string;
}

const emptyDescriptionFields: DescriptionFields = {
  purpose_statement: '',
  purchase_explanation: '',
  activity_plan: '',
  activity_relation: '',
  expected_effect: '',
  advance_payment_note: '',
};

const parseMoney = (value: unknown): number => {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  const match = String(value ?? '').replace(/,/g, '').match(/-?\d+(\.\d+)?/);
  return match ? Number(match[0]) : 0;
};

const firstValue = (data: Record<string, unknown>, keys: string[]) => {
  for (const key of keys) {
    const value = data[key];
    if (value !== undefined && value !== null && value !== '') return value;
  }
  return undefined;
};

const getAiItems = (aiData: AiData): AiItem[] => {
  const nested =
    aiData.data && typeof aiData.data === 'object' && !Array.isArray(aiData.data)
      ? (aiData.data as Record<string, unknown>)
      : {};
  const candidates = [
    aiData.items,
    aiData.invoice_items,
    aiData.goods,
    aiData.products,
    aiData.details,
    aiData['商品清单'],
    aiData['明细'],
    nested.items,
    nested.invoice_items,
    nested.goods,
    nested.products,
    nested.details,
  ];
  return (candidates.find((value) => Array.isArray(value) && value.length > 0) || []) as AiItem[];
};

const inferAiAmount = (aiData: AiData, result: Record<string, unknown>): number => {
  const amountKeys = ['amount', 'total_amount', 'order_paid_amount', 'paid_amount', 'total', '价税合计', '合计金额'];
  for (const key of amountKeys) {
    const amount = parseMoney(aiData[key] ?? result[key]);
    if (amount > 0) return amount;
  }
  for (const key of ['purchase_explanation', 'advance_payment_note', 'purpose_statement']) {
    const amount = parseMoney(aiData[key]);
    if (amount > 0) return amount;
  }
  return 0;
};

const inferItemName = (aiData: AiData): string => {
  const explicitName = firstValue(aiData, ['name', 'product_name', 'item_name', 'goods_name', 'title']);
  if (explicitName) return String(explicitName);

  const text = ['purchase_explanation', 'purpose_statement', 'activity_relation']
    .map((key) => String(aiData[key] || ''))
    .join(' ');
  const patterns = [/(?:购买|采购|采购物资为|所购物品为)([^，。,；;\n]+)/, /采购类别为([^，。,；;\n]+)/];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    const name = match?.[1]?.trim();
    if (name && !['训练物资', '相关物资', '社团活动相关物资'].includes(name)) return name;
  }
  return '请根据发票和订单截图核对商品名称';
};

export default function ReimbursePage() {
  const [items, setItems] = useState<TableItem[]>([]);
  const [rawFiles, setRawFiles] = useState<File[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [fullAiData, setFullAiData] = useState<AiData>({});
  const [descriptionFields, setDescriptionFields] = useState<DescriptionFields>(emptyDescriptionFields);
  const [, setCheckStatus] = useState<string>('');
  const [checkDetails, setCheckDetails] = useState<string[]>([]);
  const [reason, setReason] = useState('');
  const [name, setName] = useState('');
  const [studentId, setStudentId] = useState('');
  const [contact, setContact] = useState('');
  const [method, setMethod] = useState('对私转账');
  const [activityTime, setActivityTime] = useState('');

  const totalAmount = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const canExportWord = items.length > 0 || Object.keys(fullAiData).length > 0;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const selectedFiles = Array.from(e.target.files);
      setRawFiles((prev) => [...prev, ...selectedFiles]);
    }
    e.target.value = '';
  };

  const handleRemoveItem = (id: number) => {
    setItems((prev) => prev.filter((item) => item.id !== id));
  };

  const handleClearFiles = () => {
    setRawFiles([]);
    setItems([]);
    setFullAiData({});
    setDescriptionFields(emptyDescriptionFields);
    setCheckDetails([]);
  };

  const handleDescriptionChange = (key: keyof DescriptionFields, value: string) => {
    setDescriptionFields((prev) => ({ ...prev, [key]: value }));
  };

  const handleExtractItems = async () => {
    if (rawFiles.length === 0) {
      alert('请先上传发票、订单截图或支付记录。');
      return;
    }

    setIsLoading(true);
    const formDataPayload = new FormData();
    const baseInfo = {
      reason,
      name,
      studentId,
      contact,
      method,
      activityTime,
    };

    formDataPayload.append('user_info', JSON.stringify(baseInfo));
    formDataPayload.append('formData', JSON.stringify(baseInfo));
    rawFiles.forEach((file) => {
      formDataPayload.append('files', file);
    });

    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/reimburse/process`, {
        method: 'POST',
        body: formDataPayload,
      });

      if (!response.ok) {
        const errorText = await response.text();
        let detail = errorText;
        try {
          const parsed = JSON.parse(errorText);
          detail = parsed.detail || parsed.message || errorText;
        } catch {
          detail = errorText;
        }
        throw new Error(`后端返回异常，状态码：${response.status}。原因：${detail}`);
      }

      const result = await response.json();
      const aiData = result.ai_data || {};
      setFullAiData(aiData);
      setDescriptionFields({
        purpose_statement: String(aiData.purpose_statement || ''),
        purchase_explanation: String(aiData.purchase_explanation || ''),
        activity_plan: String(
          aiData.activity_plan ||
            [aiData.dynamic_activity_name ? `活动名称：${aiData.dynamic_activity_name}` : '', aiData.dynamic_activity_info || '']
              .filter(Boolean)
              .join('\n'),
        ),
        activity_relation: String(aiData.activity_relation || aiData.dynamic_relation || ''),
        expected_effect: String(aiData.expected_effect || aiData.dynamic_effect || ''),
        advance_payment_note: String(aiData.advance_payment_note || ''),
      });

      const recognizedItems = getAiItems(aiData);
      if (recognizedItems.length > 0) {
        const formattedItems: TableItem[] = recognizedItems.map((item: AiItem, idx: number) => {
          const itemRecord = item as Record<string, unknown>;
          const itemName = firstValue(itemRecord, [
            'name',
            'product_name',
            'item_name',
            'goods_name',
            'title',
            '名称',
            '商品名称',
            '项目名称',
          ]);
          const price = firstValue(itemRecord, ['price', 'unit_price', '单价', '金额']);
          const total = firstValue(itemRecord, ['total', 'amount', 'subtotal', 'line_total', '价税合计', '总价', '合计']);
          const quantity = firstValue(itemRecord, ['quantity', 'qty', 'count', 'num', '数量']);
          return {
            id: idx + 1,
            name: String(itemName || '未命名明细'),
            price: parseMoney(price || total) || 0,
            quantity: parseMoney(quantity) || 1,
          };
        });
        setItems(formattedItems);
      } else {
        const totalAmt = inferAiAmount(aiData, result);
        setItems(totalAmt > 0 ? [{ id: 1, name: inferItemName(aiData), price: Number(totalAmt), quantity: 1 }] : []);
      }

      if (result.check_status) {
        setCheckStatus(result.check_status);
        setCheckDetails(result.check_details || []);
      }

      alert('AI 提取与合规校验成功。');
    } catch (error) {
      console.error('请求失败', error);
      alert(`提取失败：${error instanceof Error ? error.message : '请检查后端服务。'}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleExportWord = async () => {
    const payload = {
      base_info: {
        reason,
        name,
        studentId,
        contact,
        method,
        activityTime,
      },
      ai_data: {
        ...fullAiData,
        ...descriptionFields,
        amount: totalAmount,
        items: items.map((item) => ({
          name: item.name,
          quantity: item.quantity,
          price: item.price,
          total: item.price * item.quantity,
        })),
      },
      check_details: checkDetails,
    };

    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/reimburse/export`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        throw new Error(`Word 生成异常，状态码：${response.status}`);
      }

      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = `清华大学SIGS报销单-${name || '未命名'}.docx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(downloadUrl);

      alert('规范报销 Word 已生成并下载。');
    } catch (error) {
      console.error('导出失败', error);
      alert('导出 Word 失败，请确保后端服务正在运行。');
    }
  };

  return (
    <div className="reimburse-shell">
      <header className="top-nav">
        <div className="brand-lockup">
          <div className="brand-mark">R</div>
          <div>
            <div className="brand-title">SIGS Reimburse Studio</div>
            <div className="brand-subtitle">AI 报销材料整理</div>
          </div>
        </div>
        <div className="nav-status">
          <span>Backend</span>
          <strong>localhost:8000</strong>
        </div>
      </header>

      <main className="studio-wrap">
        <section className="hero-panel">
          <div className="hero-copy">
            <p className="eyebrow">Tsinghua SIGS reimbursement</p>
            <h1>SIGS 智能报销工作台</h1>
            <p className="hero-note">面向社团活动、训练物资和赛事差旅材料整理。先预览明细与说明，确认后生成规范 Word。</p>
          </div>
          <div className="hero-folder" aria-hidden="true">
            <div className="sigs-card">
              <span>清华 SIGS</span>
              <strong>Reimburse</strong>
              <small>AI Material Studio</small>
            </div>
          </div>
          <div className="hero-stats" aria-label="当前报销数据">
            <div>
              <span>文件</span>
              <strong>{rawFiles.length}</strong>
            </div>
            <div>
              <span>明细</span>
              <strong>{items.length}</strong>
            </div>
            <div>
              <span>金额</span>
              <strong>¥ {totalAmount.toFixed(2)}</strong>
            </div>
          </div>
        </section>

        <div className="workbench" id="workbench">
          <div className="main-stack">
            <section className="glass-card base-card">
              <div className="section-head">
                <div>
                  <span className="step-label">01</span>
                  <h2>基础信息</h2>
                </div>
                <p>这些内容会写入封面、证明材料和垫付说明。</p>
              </div>

              <div className="form-grid">
                <label className="field field-wide">
                  <span>报销事由</span>
                  <input type="text" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="例如：2026广东省省赛-跆拳道比赛" />
                </label>
                <label className="field">
                  <span>报销方式</span>
                  <select value={method} onChange={(e) => setMethod(e.target.value)}>
                    <option value="对私转账">对私转账</option>
                    <option value="对公转账">对公转账</option>
                  </select>
                </label>
                <label className="field">
                  <span>活动时间</span>
                  <input type="date" value={activityTime} onChange={(e) => setActivityTime(e.target.value)} />
                </label>
                <label className="field">
                  <span>报销人姓名</span>
                  <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="请输入真实姓名" />
                </label>
                <label className="field">
                  <span>学号</span>
                  <input type="text" value={studentId} onChange={(e) => setStudentId(e.target.value)} placeholder="请输入学号" />
                </label>
                <label className="field field-wide">
                  <span>联系方式</span>
                  <input type="text" value={contact} onChange={(e) => setContact(e.target.value)} placeholder="请输入手机号" />
                </label>
              </div>
            </section>

            <section className="glass-card upload-card">
              <div className="section-head">
                <div>
                  <span className="step-label">02</span>
                  <h2>材料上传</h2>
                </div>
                <button type="button" className="ghost-button" onClick={handleClearFiles} disabled={rawFiles.length === 0}>
                  清空
                </button>
              </div>

              <div className="upload-grid">
                {[
                  ['发票材料', '电子发票、酒店票据等'],
                  ['订单截图', '购买详情、商品页面'],
                  ['支付记录', '微信、支付宝、银行卡流水'],
                ].map(([title, sub]) => (
                  <label className="upload-tile" key={title}>
                    <input type="file" accept="image/*,.pdf" multiple onChange={handleFileChange} />
                    <span className="upload-symbol">+</span>
                    <strong>{title}</strong>
                    <small>{sub}</small>
                  </label>
                ))}
              </div>

              {rawFiles.length > 0 && (
                <div className="file-strip">
                  <div className="file-strip-head">
                    <strong>已缓存文件</strong>
                    <span>共 {rawFiles.length} 个</span>
                  </div>
                  <div className="file-list">
                    {rawFiles.map((file, idx) => (
                      <span key={`${file.name}-${idx}`} className="file-chip">
                        {file.name}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </section>

            <section className="glass-card preview-card">
              <div className="section-head preview-head">
                <div>
                  <span className="step-label">03</span>
                  <h2>证明材料明细 & 活动说明</h2>
                </div>
                <button type="button" className="primary-button" disabled={isLoading} onClick={handleExtractItems}>
                  {isLoading ? '正在提取...' : '提取并预览明细'}
                </button>
              </div>

              <div className="table-shell">
                <table className="items-table">
                  <thead>
                    <tr>
                      <th>序号</th>
                      <th>名称明细</th>
                      <th>单价</th>
                      <th>数量</th>
                      <th className="num">合计</th>
                      <th className="center">操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.length === 0 ? (
                      <tr className="empty-row">
                        <td colSpan={6}>暂无明细。上传材料后点击提取。</td>
                      </tr>
                    ) : (
                      items.map((item, index) => (
                        <tr key={item.id}>
                          <td>{index + 1}</td>
                          <td className="item-name">{item.name}</td>
                          <td>¥ {item.price.toFixed(2)}</td>
                          <td>{item.quantity}</td>
                          <td className="num">¥ {(item.price * item.quantity).toFixed(2)}</td>
                          <td className="center">
                            <button type="button" className="danger-button" onClick={() => handleRemoveItem(item.id)}>
                              删除
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {canExportWord && (
                <div className="description-grid">
                  <div className="description-title">
                    <h3>生成说明预览</h3>
                    <p>这里的内容可以人工修改，最终 Word 会使用你修改后的版本。</p>
                  </div>
                  <label className="field field-wide">
                    <span>用途</span>
                    <textarea value={descriptionFields.purpose_statement} onChange={(e) => handleDescriptionChange('purpose_statement', e.target.value)} rows={3} />
                  </label>
                  <label className="field field-wide">
                    <span>购买说明</span>
                    <textarea value={descriptionFields.purchase_explanation} onChange={(e) => handleDescriptionChange('purchase_explanation', e.target.value)} rows={4} />
                  </label>
                  <label className="field field-wide">
                    <span>活动策划</span>
                    <textarea value={descriptionFields.activity_plan} onChange={(e) => handleDescriptionChange('activity_plan', e.target.value)} rows={5} />
                  </label>
                  <label className="field">
                    <span>器材与活动关联</span>
                    <textarea value={descriptionFields.activity_relation} onChange={(e) => handleDescriptionChange('activity_relation', e.target.value)} rows={5} />
                  </label>
                  <label className="field">
                    <span>预期效果</span>
                    <textarea value={descriptionFields.expected_effect} onChange={(e) => handleDescriptionChange('expected_effect', e.target.value)} rows={5} />
                  </label>
                  {descriptionFields.advance_payment_note.trim() && (
                    <label className="field field-wide">
                      <span>垫付说明</span>
                      <textarea value={descriptionFields.advance_payment_note} onChange={(e) => handleDescriptionChange('advance_payment_note', e.target.value)} rows={6} />
                    </label>
                  )}
                </div>
              )}
            </section>
          </div>

          <aside className="side-stack">
            <section className="summary-panel">
              <p className="eyebrow">ready to export</p>
              <h2>报销总额</h2>
              <div className="money">¥ {totalAmount.toFixed(2)}</div>
              <button type="button" className="export-button" onClick={handleExportWord} disabled={!canExportWord}>
                生成规范报销 Word
              </button>
            </section>

            <section className="side-card">
              <div className="side-card-head">
                <h2>材料状态</h2>
                <span>{isLoading ? '处理中' : canExportWord ? '已预览' : '待提取'}</span>
              </div>
              <div className="status-list">
                <div>
                  <strong>{rawFiles.length}</strong>
                  <span>上传文件</span>
                </div>
                <div>
                  <strong>{items.length}</strong>
                  <span>识别明细</span>
                </div>
                <div>
                  <strong>{checkDetails.length}</strong>
                  <span>校验结果</span>
                </div>
              </div>
            </section>

            <section className="side-card">
              <div className="side-card-head">
                <h2>规则校验结果</h2>
              </div>
              {checkDetails.length === 0 ? (
                <p className="empty-note">暂无校验结果。</p>
              ) : (
                <ul className="check-list">
                  {checkDetails.map((detail, i) => (
                    <li key={i}>{detail}</li>
                  ))}
                </ul>
              )}
            </section>
          </aside>
        </div>
      </main>
    </div>
  );
}

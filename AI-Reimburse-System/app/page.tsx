'use client';
import React, { useState } from 'react';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || (typeof window !== 'undefined' ? `http://${window.location.hostname}:8000` : 'http://127.0.0.1:8000');
// 定义明细表格的条目接口
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
}

interface AiData {
  items?: AiItem[];
  amount?: string | number;
  activity?: string;
  image_groups?: unknown[];
  image_base64_list?: string[];
  [key: string]: unknown;
}
export default function ReimbursePage() {
  // === 状态管理 ===
  const [items, setItems] = useState<TableItem[]>([]);
  const [rawFiles, setRawFiles] = useState<File[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [fullAiData, setFullAiData] = useState<AiData>({});
  
  // 规则校验需要的状态
  const [, setCheckStatus] = useState<string>('');
  const [checkDetails, setCheckDetails] = useState<string[]>([]);
  // 🔥 用 React State 代替 document.getElementById
  const [reason, setReason] = useState('');
  const [name, setName] = useState('');
  const [studentId, setStudentId] = useState('');
  const [contact, setContact] = useState('');
  const [method, setMethod] = useState('对私转账');
  const [activityTime, setActivityTime] = useState('');
  // 文件选择捕获函数
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const selectedFiles = Array.from(e.target.files);
      setRawFiles((prev) => [...prev, ...selectedFiles]);
    }
  };
  // 核心后端接口连接函数
  const handleExtractItems = async () => {
    console.log("【前端调试】开始触发‘提取并预览明细’。当前就绪文件数:", rawFiles.length);
    setIsLoading(true);
    const formDataPayload = new FormData();
    
    // 自动收集状态里的数据，不再通过 DOM 元素抓取，绝对不卡死
    const baseInfo = {
  reason: reason,
  name: name,
  studentId: studentId,
  contact: contact,
};
// 双重保险，不管后端是用旧的 formData 接收还是新的 user_info 接收，一次性喂饱它！
formDataPayload.append('user_info', JSON.stringify(baseInfo));
formDataPayload.append('formData', JSON.stringify(baseInfo));
    
    // 严格对齐后端 main.py 接收的变量名：'formData'
    formDataPayload.append('formData', JSON.stringify(baseInfo));
    // 打包选中的所有真实文件
    rawFiles.forEach((file) => {
      formDataPayload.append('files', file);
    });
    try {
      const requestUrl = `${API_BASE_URL}/api/v1/reimburse/process`;
      
      const response = await fetch(requestUrl, {
        method: 'POST',
        body: formDataPayload, 
      });
      
      if (!response.ok) {
        throw new Error(`后端返回异常，状态码: ${response.status}`);
      }
      const result = await response.json();
      console.log("【前端调试】后端返回的完整原始 JSON 数据:", result);
      
      // 1. 提取并映射发票商品明细
      const aiData = result.ai_data || {};
      setFullAiData(aiData);
      if (aiData.items && Array.isArray(aiData.items)) {
        const formattedItems: TableItem[] = aiData.items.map((item: AiItem, idx: number) => ({
          id: idx + 1,
          name: item.name || '未命名明细',        
          price: Number(item.price) || 0,        
          quantity: Number(item.quantity) || 1,
        }));
        setItems(formattedItems);
      } else {
        const totalAmt = aiData.amount || result.amount || 0;
        if (totalAmt > 0) {
          setItems([{ id: 1, name: aiData.activity || '发票消费总计', price: Number(totalAmt), quantity: 1 }]);
        }
      }
      // 2. 保存后端返回的校验状态和细节说明
      if (result.check_status) {
        setCheckStatus(result.check_status);
        setCheckDetails(result.check_details || []);
      }
      
      alert('🎉 智谱 AI 提取与合规校验成功！');
    } catch (error) {
      console.error('【❌ 请求失败】', error);
      alert(`提取失败，请检查后端。`);
    } finally {
      setIsLoading(false);
    }
  };
// 🔥 新增：触发后端动态生成 Word 并执行浏览器下载
  const handleExportWord = async () => {
    // 基础信息与发票识别结果打包
    const payload = {
      base_info: {
        reason: reason,
        name: name,
        studentId: studentId,
        contact: contact,
      },
      ai_data: fullAiData,
      check_details: checkDetails, // 规则校验报告
    };
    try {
      console.log("【前端调试】准备开始导出规范 Word，提交的数据:", payload);
      const exportUrl = `${API_BASE_URL}/api/v1/reimburse/export`;
      const response = await fetch(exportUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        throw new Error(`Word 生成异常，状态码: ${response.status}`);
      }
      // 处理二进制文件流并自动触发浏览器下载
      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = `清华大学SIGS报销单-${name || '未命名'}.docx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(downloadUrl);
      
      alert('🎉 规范报销 Word 文档已成功生成并下载！');
    } catch (error) {
      console.error('【❌ 导出失败】', error);
      alert('导出 Word 失败，请确保后端服务在运行。');
    }
  };
  // 计算报销总金额
  const totalAmount = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  return (
    <div style={{ backgroundColor: '#f4f6fa', minHeight: '100vh', fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }}>
      
      {/* 顶部导航 */}
      <header style={{ padding: '15px 30px', background: '#fff', borderBottom: '1px solid #e5e7eb', boxShadow: '0 1px 2px rgba(0,0,0,0.05)', display: 'flex', alignItems: 'center' }}>
        <div style={{ fontWeight: 'bold', color: '#3b82f6', fontSize: '18px', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ fontSize: '20px' }}>✦</span> AI 智能报销助手
        </div>
      </header>
      {/* 主体区域 */}
      <main style={{ padding: '30px', maxWidth: '1400px', margin: '0 auto' }}>
        <div style={{ display: 'flex', gap: '25px', alignItems: 'flex-start' }}>
          
          {/* 左侧主要填写区域 */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '25px' }}>
            
            {/* STEP 01: 基础信息 */}
            <section style={{ background: '#fff', padding: '25px', borderRadius: '12px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <h2 style={{ fontSize: '18px', fontWeight: 600, color: '#1f2937', margin: 0 }}>基础信息</h2>
                <span style={{ background: '#eff6ff', color: '#3b82f6', padding: '4px 10px', borderRadius: '6px', fontSize: '12px', fontWeight: 'bold' }}>STEP 01</span>
              </div>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <span style={{ fontSize: '14px', fontWeight: 500, color: '#4b5563' }}>报销事由</span>
                  <input type="text" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="请输入报销事由..." style={{ padding: '10px 12px', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '14px', outline: 'none' }} />
                </div>
                
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <span style={{ fontSize: '14px', fontWeight: 500, color: '#4b5563' }}>报销方式</span>
                    <select value={method} onChange={(e) => setMethod(e.target.value)} style={{ padding: '10px 12px', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '14px', background: '#fff' }}>
                      <option value="对私转账">对私转账</option>
                      <option value="对公转账">对公转账</option>
                    </select>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <span style={{ fontSize: '14px', fontWeight: 500, color: '#4b5563' }}>活动时间</span>
                    <input type="date" value={activityTime} onChange={(e) => setActivityTime(e.target.value)} style={{ padding: '10px 12px', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '14px' }} />
                  </div>
                </div>
                
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <span style={{ fontSize: '14px', fontWeight: 500, color: '#4b5563' }}>报销人姓名</span>
                    <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="请输入真实姓名" style={{ padding: '10px 12px', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '14px' }} />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <span style={{ fontSize: '14px', fontWeight: 500, color: '#4b5563' }}>学号</span>
                    <input type="text" value={studentId} onChange={(e) => setStudentId(e.target.value)} placeholder="请输入10位数字学号" style={{ padding: '10px 12px', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '14px' }} />
                  </div>
                </div>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <span style={{ fontSize: '14px', fontWeight: 500, color: '#4b5563' }}>联系方式</span>
                  <input type="text" value={contact} onChange={(e) => setContact(e.target.value)} placeholder="请输入手机号" style={{ padding: '10px 12px', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '14px' }} />
                </div>
              </div>
            </section>
            {/* STEP 02: 材料上传 */}
            <section style={{ background: '#fff', padding: '25px', borderRadius: '12px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <h2 style={{ fontSize: '18px', fontWeight: 600, color: '#1f2937', margin: 0 }}>材料上传</h2>
                <span style={{ background: '#eff6ff', color: '#3b82f6', padding: '4px 10px', borderRadius: '6px', fontSize: '12px', fontWeight: 'bold' }}>STEP 02</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '15px' }}>
                <div style={{ position: 'relative', border: '2px dashed #3b82f6', padding: '20px', textAlign: 'center', borderRadius: '10px', background: '#f8fafc', cursor: 'pointer' }}>
                  <input type="file" accept="image/*,.pdf" multiple onChange={handleFileChange} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', opacity: 0, cursor: 'pointer', zIndex: 10 }} />
                  <div style={{ fontSize: '24px', marginBottom: '8px' }}>📄</div>
                  <div style={{ fontWeight: 600, fontSize: '14px', color: '#1e293b' }}>上传发票材料</div>
                </div>
                <div style={{ position: 'relative', border: '2px dashed #3b82f6', padding: '20px', textAlign: 'center', borderRadius: '10px', background: '#f8fafc', cursor: 'pointer' }}>
                  <input type="file" accept="image/*,.pdf" multiple onChange={handleFileChange} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', opacity: 0, cursor: 'pointer', zIndex: 10 }} />
                  <div style={{ fontSize: '24px', marginBottom: '8px' }}>💻</div>
                  <div style={{ fontWeight: 600, fontSize: '14px', color: '#1e293b' }}>上传订单截图</div>
                </div>
                <div style={{ position: 'relative', border: '2px dashed #3b82f6', padding: '20px', textAlign: 'center', borderRadius: '10px', background: '#f8fafc', cursor: 'pointer' }}>
                  <input type="file" accept="image/*,.pdf" multiple onChange={handleFileChange} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', opacity: 0, cursor: 'pointer', zIndex: 10 }} />
                  <div style={{ fontSize: '24px', marginBottom: '8px' }}>💳</div>
                  <div style={{ fontWeight: 600, fontSize: '14px', color: '#1e293b' }}>上传支付记录</div>
                </div>
              </div>
              {rawFiles.length > 0 && (
                <div style={{ marginTop: '20px', fontSize: '13px', color: '#1d4ed8', background: '#eff6ff', padding: '15px', borderRadius: '8px' }}>
                  <div style={{ fontWeight: 'bold' }}>📂 已缓存文件（共 {rawFiles.length} 个）：</div>
                  <ul style={{ margin: 0, paddingLeft: '20px' }}>
                    {rawFiles.map((file, idx) => <li key={idx}>{file.name}</li>)}
                  </ul>
                </div>
              )}
            </section>
            {/* 明细预览表格 */}
            <section style={{ background: '#fff', padding: '25px', borderRadius: '12px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                <h2 style={{ fontSize: '18px', fontWeight: 600, color: '#1f2937', margin: 0 }}>证明材料明细 &amp; 活动说明</h2>
                <button type="button" disabled={isLoading} onClick={handleExtractItems} style={{ padding: '10px 20px', backgroundColor: isLoading ? '#93c5fd' : '#3b82f6', color: '#fff', border: 'none', borderRadius: '8px', cursor: isLoading ? 'not-allowed' : 'pointer', fontWeight: 'bold' }}>
                  {isLoading ? '⏳ 正在提取中...' : '🔍 提取并预览明细'}
                </button>
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', textAlign: 'left', fontSize: '14px', color: '#64748b' }}>
                    <th style={{ padding: '12px' }}>序号</th>
                    <th>名称明细</th>
                    <th>单价</th>
                    <th>数量</th>
                    <th style={{ textAlign: 'right', padding: '12px' }}>合计</th>
                  </tr>
                </thead>
                <tbody style={{ fontSize: '14px', color: '#334155' }}>
                  {items.length === 0 ? (
                    <tr>
                      <td colSpan={5} style={{ padding: '40px', textAlign: 'center', color: '#94a3b8' }}>暂无明细。上传后点击提取。</td>
                    </tr>
                  ) : (
                    items.map((item, index) => (
                      <tr key={item.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '12px' }}>{index + 1}</td>
                        <td style={{ fontWeight: 500 }}>{item.name}</td>
                        <td>¥ {item.price.toFixed(2)}</td>
                        <td>{item.quantity}</td>
                        <td style={{ textAlign: 'right', padding: '12px', fontWeight: 'bold' }}>¥ {(item.price * item.quantity).toFixed(2)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </section>
          </div>
          {/* 右侧边栏 */}
          <div style={{ width: '350px', display: 'flex', flexDirection: 'column', gap: '25px' }}>
            {/* 校验结果 */}
            <section style={{ background: '#fff', padding: '25px', borderRadius: '12px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
              <h2 style={{ fontSize: '16px', fontWeight: 600, color: '#1f2937', marginBottom: '15px' }}>规则校验结果</h2>
              {checkDetails.length === 0 ? (
                <p style={{ color: '#94a3b8', margin: 0 }}>暂无校验结果</p>
              ) : (
                <ul style={{ paddingLeft: '0', margin: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {checkDetails.map((detail, i) => (
                    <li key={i} style={{ padding: '6px 10px', borderRadius: '6px', backgroundColor: '#f0fdf4', color: '#166534', border: '1px solid #bbf7d0' }}>
                      {detail}
                    </li>
                  ))}
                </ul>
              )}
            </section>
            {/* ==================== 👇 找到这个绿色按钮，用这段完全替换 👇 ==================== */}
<button 
  type="button"
  onClick={handleExportWord}
  disabled={items.length === 0} // 如果没有提取出明细，不让点击
  style={{ 
    width: '100%', 
    padding: '14px', 
    backgroundColor: items.length === 0 ? '#9ca3af' : '#10b981', // 没数据时变灰，有数据时是漂亮的绿色
    color: '#fff',
    border: 'none',
    borderRadius: '8px',
    cursor: items.length === 0 ? 'not-allowed' : 'pointer',
    fontWeight: 'bold',
    fontSize: '15px',
    boxShadow: '0 4px 6px -1px rgba(16, 185, 129, 0.2)'
  }}
>
  📄 生成规范报销 Word
</button>
{/* ==================== 👆 替换结束 👆 ==================== */}
            {/* 汇总计算 */}
            <section style={{ background: '#fff', padding: '25px', borderRadius: '12px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', fontSize: '18px' }}>
                <span>报销总额：</span>
                <span style={{ color: '#ef4444' }}>¥ {totalAmount.toFixed(2)}</span>
              </div>
            </section>
          </div>
        </div>
      </main>
    </div>
  );
}

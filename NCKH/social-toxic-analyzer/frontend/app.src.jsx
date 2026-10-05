
const { useState, useEffect, useRef, useMemo } = React;

// Đổi URL này thành địa chỉ backend thật khi triển khai
const API_BASE = window.API_BASE || 'http://localhost:4000';

const SEVERITY_STYLE = {
  'Bình thường':               { bg: 'var(--ok-soft)',    fg: 'var(--ok)' },
  'Cần chú ý':                 { bg: 'var(--warn-soft)',  fg: 'var(--warn)' },
  'Tiêu cực':                  { bg: 'var(--warn-soft)',  fg: '#9C5A20' },
  'Nghiêm trọng - cần can thiệp': { bg: 'var(--danger-soft)', fg: 'var(--danger)' },
};

const CATEGORY_LABELS = {
  bat_nat: 'Bắt nạt / lăng mạ',
  tuc_tiu: 'Ngôn từ tục tĩu',
  ky_thi: 'Kỳ thị / phân biệt',
  de_doa: 'Đe dọa / kích động',
  nguy_co_tam_ly: 'Dấu hiệu nguy cơ tâm lý',
};

function Pill({ severity }) {
  const s = SEVERITY_STYLE[severity] || SEVERITY_STYLE['Bình thường'];
  return (
    <span className="severity-pill" style={{ background: s.bg, color: s.fg }}>
      {severity}
    </span>
  );
}

function SingleAnalysis() {
  const [text, setText] = useState('');
  const [author, setAuthor] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  async function handleAnalyze() {
    if (!text.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, author: author || null }),
      });
      if (!res.ok) throw new Error('Không kết nối được API');
      const data = await res.json();
      setResult(data);
    } catch (e) {
      setError('Chưa kết nối được backend (' + API_BASE + '). Kiểm tra server đã chạy chưa.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <textarea
        placeholder="Dán nội dung bình luận / bài đăng cần phân tích..."
        value={text}
        onChange={(e) => setText(e.target.value)}
      />
      <div className="field-row">
        <input
          type="text"
          placeholder="Tên học sinh / tài khoản (tuỳ chọn)"
          value={author}
          onChange={(e) => setAuthor(e.target.value)}
        />
        <button className="btn" onClick={handleAnalyze} disabled={loading || !text.trim()}>
          {loading ? 'Đang phân tích...' : 'Phân tích'}
        </button>
      </div>
      {error && <p className="note" style={{ color: 'var(--danger)' }}>{error}</p>}

      {result && !result.error && (
        <div className="result-card">
          <div className="result-head">
            <strong>Kết quả</strong>
            <Pill severity={result.severity} />
          </div>

          {result.riskFlag && (
            <div className="risk-banner">
              Nội dung có dấu hiệu nguy cơ tâm lý (ý nghĩ tiêu cực về bản thân / tự hại).
              Khuyến nghị nhà trường liên hệ phụ huynh và chuyên viên tâm lý học đường sớm nhất có thể,
              thay vì chỉ xử lý như một vi phạm thông thường.
            </div>
          )}

          {Object.keys(result.categories).length === 0 ? (
            <div className="cat-list"><span className="note">Không phát hiện dấu hiệu tiêu cực rõ rệt.</span></div>
          ) : (
            <div className="cat-list">
              {Object.entries(result.categories).map(([cat, info]) => (
                <div key={cat} className="cat-item">
                  <div>
                    <div>{CATEGORY_LABELS[cat] || cat}</div>
                    <div className="terms">Cụm từ khớp: {info.matchedTerms.join(', ')}</div>
                  </div>
                  <div style={{ color: 'var(--ink-soft)' }}>×{info.count}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function BatchAnalysis({ onBatchDone }) {
  const [dragging, setDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [batchResult, setBatchResult] = useState(null);
  const fileInput = useRef(null);

  async function uploadFile(file) {
    setLoading(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch(`${API_BASE}/api/analyze-csv`, { method: 'POST', body: formData });
      if (!res.ok) throw new Error('Lỗi upload');
      const data = await res.json();
      setBatchResult(data);
      onBatchDone && onBatchDone(data);
    } catch (e) {
      setError('Không xử lý được file. Kiểm tra backend và định dạng CSV (cột "text" bắt buộc).');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <div
        className={`drop-zone ${dragging ? 'drag' : ''}`}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          const file = e.dataTransfer.files[0];
          if (file) uploadFile(file);
        }}
        onClick={() => fileInput.current.click()}
      >
        {loading ? 'Đang xử lý...' : 'Kéo thả file CSV vào đây, hoặc bấm để chọn file'}
        <div className="note">Cột bắt buộc: text. Tuỳ chọn: author, timestamp.</div>
      </div>
      <input
        ref={fileInput}
        type="file"
        accept=".csv"
        style={{ display: 'none' }}
        onChange={(e) => e.target.files[0] && uploadFile(e.target.files[0])}
      />
      {error && <p className="note" style={{ color: 'var(--danger)' }}>{error}</p>}

      {batchResult && (
        <div style={{ marginTop: 24 }}>
          <div className="stat-row">
            <div className="stat">
              <div className="label">Tổng số dòng</div>
              <div className="value">{batchResult.summary.total}</div>
            </div>
            <div className="stat">
              <div className="label">Cần can thiệp</div>
              <div className="value" style={{ color: 'var(--danger)' }}>
                {batchResult.summary.bySeverity['Nghiêm trọng - cần can thiệp'] || 0}
              </div>
            </div>
            <div className="stat">
              <div className="label">Cảnh báo nguy cơ tâm lý</div>
              <div className="value" style={{ color: 'var(--danger)' }}>{batchResult.summary.riskFlagged}</div>
            </div>
            <div className="stat">
              <div className="label">Bình thường</div>
              <div className="value" style={{ color: 'var(--ok)' }}>
                {batchResult.summary.bySeverity['Bình thường'] || 0}
              </div>
            </div>
          </div>

          <div className="result-card">
            <div className="result-head"><strong>Chi tiết từng dòng</strong></div>
            <div style={{ maxHeight: 360, overflowY: 'auto' }}>
              <table>
                <thead>
                  <tr><th>Tác giả</th><th>Nội dung</th><th>Mức độ</th><th>Điểm</th></tr>
                </thead>
                <tbody>
                  {batchResult.results.map((r) => (
                    <tr key={r.id}>
                      <td>{r.author || '—'}</td>
                      <td style={{ maxWidth: 380 }}>{r.originalText}</td>
                      <td><Pill severity={r.severity} /></td>
                      <td>{r.totalScore}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Dashboard() {
  const [stats, setStats] = useState(null);
  const [error, setError] = useState(null);
  const catChartRef = useRef(null);
  const trendChartRef = useRef(null);
  const catChartInstance = useRef(null);
  const trendChartInstance = useRef(null);

  async function loadStats() {
    try {
      const res = await fetch(`${API_BASE}/api/stats`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      setStats(data);
    } catch (e) {
      setError('Chưa kết nối được backend / chưa có dữ liệu trong MySQL.');
    }
  }

  useEffect(() => { loadStats(); }, []);

  useEffect(() => {
    if (!stats || !catChartRef.current) return;
    if (catChartInstance.current) catChartInstance.current.destroy();
    catChartInstance.current = new Chart(catChartRef.current, {
      type: 'bar',
      data: {
        labels: (stats.bySeverity || []).map((s) => s.severity),
        datasets: [{
          data: (stats.bySeverity || []).map((s) => s.count),
          backgroundColor: '#2D6A6A',
        }],
      },
      options: {
        plugins: { legend: { display: false } },
        scales: { y: { beginAtZero: true, ticks: { precision: 0 } } },
      },
    });
  }, [stats]);

  useEffect(() => {
    if (!stats || !trendChartRef.current) return;
    if (trendChartInstance.current) trendChartInstance.current.destroy();
    trendChartInstance.current = new Chart(trendChartRef.current, {
      type: 'line',
      data: {
        labels: (stats.recentTrend || []).map((t) => t.day),
        datasets: [{
          label: 'Số lượt phân tích',
          data: (stats.recentTrend || []).map((t) => t.count),
          borderColor: '#AE3B45',
          backgroundColor: 'rgba(174,59,69,0.08)',
          fill: true,
          tension: 0.25,
        }],
      },
      options: { plugins: { legend: { display: false } } },
    });
  }, [stats]);

  if (error) return <div className="empty">{error}<br /><button className="btn-outline btn" style={{marginTop:12}} onClick={loadStats}>Thử lại</button></div>;
  if (!stats) return <div className="empty">Đang tải dữ liệu...</div>;

  return (
    <div>
      <div className="stat-row">
        <div className="stat"><div className="label">Tổng lượt phân tích</div><div className="value">{stats.total}</div></div>
        <div className="stat"><div className="label">Cảnh báo nguy cơ tâm lý</div><div className="value" style={{color:'var(--danger)'}}>{stats.riskFlagged}</div></div>
        <div className="stat"><div className="label">14 ngày gần nhất</div><div className="value">{(stats.recentTrend||[]).reduce((a,t)=>a+t.count,0)}</div></div>
        <div className="stat"><div className="label">Nhóm mức độ</div><div className="value">{(stats.bySeverity||[]).length}</div></div>
      </div>
      <div className="charts-grid">
        <div className="chart-box"><h3>Phân bố theo mức độ</h3><canvas ref={catChartRef} height="180"></canvas></div>
        <div className="chart-box"><h3>Xu hướng 14 ngày qua</h3><canvas ref={trendChartRef} height="180"></canvas></div>
      </div>
    </div>
  );
}

function FacebookSync() {
  const [pageId, setPageId] = useState('');
  const [accessToken, setAccessToken] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [data, setData] = useState(null);

  async function handleSync() {
    setLoading(true);
    setError(null);
    setData(null);
    try {
      const res = await fetch(`${API_BASE}/api/sync-facebook`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pageId: pageId || undefined,
          accessToken: accessToken || undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Lỗi không xác định');
      setData(json);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <div className="note" style={{ marginBottom: 14 }}>
        Lấy bình luận từ các bài viết gần nhất trên Facebook Page mà bạn quản lý, phân tích tự động.
        Nếu để trống, hệ thống sẽ dùng <code>FB_PAGE_ID</code> / <code>FB_PAGE_ACCESS_TOKEN</code> cấu hình sẵn trong file <code>.env</code> của backend.
      </div>
      <div className="field-row" style={{ marginTop: 0 }}>
        <input type="text" placeholder="Page ID (tuỳ chọn nếu đã set .env)" value={pageId} onChange={(e) => setPageId(e.target.value)} />
      </div>
      <div className="field-row">
        <input type="text" placeholder="Page Access Token (tuỳ chọn nếu đã set .env)" value={accessToken} onChange={(e) => setAccessToken(e.target.value)} />
        <button className="btn" onClick={handleSync} disabled={loading}>
          {loading ? 'Đang lấy dữ liệu...' : 'Đồng bộ & phân tích'}
        </button>
      </div>
      {error && <p className="note" style={{ color: 'var(--danger)' }}>{error}</p>}

      {data && (
        <div style={{ marginTop: 24 }}>
          <div className="stat-row">
            <div className="stat"><div className="label">Đã lấy</div><div className="value">{data.fetchedCount ?? data.summary.total}</div></div>
            <div className="stat"><div className="label">Cần can thiệp</div><div className="value" style={{color:'var(--danger)'}}>{data.summary.bySeverity['Nghiêm trọng - cần can thiệp'] || 0}</div></div>
            <div className="stat"><div className="label">Cảnh báo tâm lý</div><div className="value" style={{color:'var(--danger)'}}>{data.summary.riskFlagged}</div></div>
            <div className="stat"><div className="label">Bình thường</div><div className="value" style={{color:'var(--ok)'}}>{data.summary.bySeverity['Bình thường'] || 0}</div></div>
          </div>
          <div className="result-card">
            <div className="result-head"><strong>Chi tiết</strong></div>
            <div style={{ maxHeight: 360, overflowY: 'auto' }}>
              <table>
                <thead><tr><th>Tác giả</th><th>Nội dung</th><th>Mức độ</th><th>Điểm</th></tr></thead>
                <tbody>
                  {data.results.map((r) => (
                    <tr key={r.id}>
                      <td>{r.author || '(bài đăng của Page)'}</td>
                      <td style={{ maxWidth: 380 }}>{r.originalText}</td>
                      <td><Pill severity={r.severity} /></td>
                      <td>{r.totalScore}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function App() {
  const [tab, setTab] = useState('single');

  return (
    <div className="app">
      <div className="header">
        <div>
          <h1 className="serif">Lăng Kính</h1>
          <p>Công cụ hỗ trợ nhà trường phát hiện sớm hành vi bắt nạt, ngôn từ độc hại và dấu hiệu
          nguy cơ tâm lý trong hoạt động mạng xã hội của học sinh, sinh viên.</p>
        </div>
      </div>

      <div className="tabs">
        <button className={`tab ${tab==='single'?'active':''}`} onClick={()=>setTab('single')}>Phân tích nhanh</button>
        <button className={`tab ${tab==='batch'?'active':''}`} onClick={()=>setTab('batch')}>Tải lên hàng loạt</button>
        <button className={`tab ${tab==='facebook'?'active':''}`} onClick={()=>setTab('facebook')}>Đồng bộ Facebook</button>
        <button className={`tab ${tab==='dashboard'?'active':''}`} onClick={()=>setTab('dashboard')}>Thống kê</button>
      </div>

      {tab === 'single' && <SingleAnalysis />}
      {tab === 'batch' && <BatchAnalysis />}
      {tab === 'facebook' && <FacebookSync />}
      {tab === 'dashboard' && <Dashboard />}
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);

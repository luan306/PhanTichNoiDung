require('dotenv').config();
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const csvParse = require('csv-parse/sync');
const { analyzeText, analyzeBatch, summarize } = require('./detector');
const { fetchPageContent } = require('./facebook');
const db = require('./db'); // pool MySQL, xem db.js

const app = express();
const upload = multer({ storage: multer.memoryStorage() });

app.use(cors());
app.use(express.json({ limit: '2mb' }));

// ---------- Phân tích 1 văn bản ----------
app.post('/api/analyze', async (req, res) => {
  const { text, author, source } = req.body;
  if (!text) return res.status(400).json({ error: 'Thiếu trường "text"' });

  const result = analyzeText(text);

  try {
    await db.saveResult({ ...result, author, source });
  } catch (err) {
    console.error('Lỗi lưu DB:', err.message);
    // không chặn phản hồi nếu lưu DB lỗi, vẫn trả kết quả phân tích
  }

  res.json(result);
});

// ---------- Phân tích hàng loạt qua JSON ----------
app.post('/api/analyze-batch', async (req, res) => {
  const { items } = req.body; // [{ id, text, author, timestamp }]
  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'Thiếu mảng "items"' });
  }

  const results = analyzeBatch(items);
  const summary = summarize(results);

  try {
    await db.saveBatch(results);
  } catch (err) {
    console.error('Lỗi lưu DB batch:', err.message);
  }

  res.json({ results, summary });
});

// ---------- Phân tích hàng loạt qua file CSV upload ----------
// CSV cần có cột: text (bắt buộc), author, timestamp (tuỳ chọn)
app.post('/api/analyze-csv', upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Thiếu file CSV' });

  let records;
  try {
    records = csvParse.parse(req.file.buffer.toString('utf8'), {
      columns: true,
      skip_empty_lines: true,
      trim: true,
    });
  } catch (err) {
    return res.status(400).json({ error: 'CSV không hợp lệ: ' + err.message });
  }

  const items = records.map((r, idx) => ({
    id: r.id || idx + 1,
    text: r.text || r.content || '',
    author: r.author || r.user || null,
    timestamp: r.timestamp || r.date || null,
  }));

  const results = analyzeBatch(items);
  const summary = summarize(results);

  try {
    await db.saveBatch(results);
  } catch (err) {
    console.error('Lỗi lưu DB batch (CSV):', err.message);
  }

  res.json({ results, summary });
});

// ---------- Đồng bộ & phân tích bình luận từ Facebook Page ----------
// Body (tuỳ chọn, nếu không truyền sẽ lấy từ .env): { pageId, accessToken, postLimit, commentsPerPost }
app.post('/api/sync-facebook', async (req, res) => {
  const pageId = req.body.pageId || process.env.FB_PAGE_ID;
  const accessToken = req.body.accessToken || process.env.FB_PAGE_ACCESS_TOKEN;
  const postLimit = req.body.postLimit || 10;
  const commentsPerPost = req.body.commentsPerPost || 100;

  if (!pageId || !accessToken) {
    return res.status(400).json({
      error: 'Thiếu pageId/accessToken. Truyền trong body hoặc cấu hình FB_PAGE_ID, FB_PAGE_ACCESS_TOKEN trong .env',
    });
  }

  try {
    const items = await fetchPageContent({ pageId, accessToken, postLimit, commentsPerPost });

    if (items.length === 0) {
      return res.json({ results: [], summary: summarize([]), message: 'Không có bình luận/bài viết nào để phân tích.' });
    }

    const results = analyzeBatch(items);
    const summary = summarize(results);

    try {
      await db.saveBatch(results.map((r, i) => ({ ...r, source: items[i].source })));
    } catch (err) {
      console.error('Lỗi lưu DB (facebook sync):', err.message);
    }

    res.json({ results, summary, fetchedCount: items.length });
  } catch (err) {
    console.error('Lỗi đồng bộ Facebook:', err.fbError || err.message);
    res.status(502).json({
      error: 'Không lấy được dữ liệu từ Facebook: ' + err.message,
      fbError: err.fbError || null,
    });
  }
});

// ---------- Lấy lịch sử đã lưu (phân trang đơn giản) ----------
app.get('/api/history', async (req, res) => {
  const { limit = 50, offset = 0, minSeverityScore } = req.query;
  try {
    const rows = await db.getHistory({
      limit: Number(limit),
      offset: Number(offset),
      minSeverityScore: minSeverityScore ? Number(minSeverityScore) : undefined,
    });
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ---------- Thống kê tổng quan cho dashboard ----------
app.get('/api/stats', async (req, res) => {
  try {
    const stats = await db.getStats();
    res.json(stats);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Social Behavior Analyzer API đang chạy tại http://localhost:${PORT}`);
});

const mysql = require('mysql2/promise');

const DEMO_STATS = {
  total: 128,
  bySeverity: [
    { severity: 'Bình thường', count: 52 },
    { severity: 'Cần chú ý', count: 35 },
    { severity: 'Tiêu cực', count: 24 },
    { severity: 'Nghiêm trọng - cần can thiệp', count: 17 },
  ],
  riskFlagged: 41,
  recentTrend: [
    { day: '2026-09-16', count: 5, avgScore: 15.4 },
    { day: '2026-09-17', count: 8, avgScore: 18.2 },
    { day: '2026-09-18', count: 11, avgScore: 22.1 },
    { day: '2026-09-19', count: 7, avgScore: 19.8 },
    { day: '2026-09-20', count: 12, avgScore: 24.7 },
    { day: '2026-09-21', count: 9, avgScore: 21.5 },
    { day: '2026-09-22', count: 10, avgScore: 25.3 },
    { day: '2026-09-23', count: 13, avgScore: 27.9 },
    { day: '2026-09-24', count: 9, avgScore: 20.8 },
    { day: '2026-09-25', count: 14, avgScore: 30.2 },
    { day: '2026-09-26', count: 11, avgScore: 26.1 },
    { day: '2026-09-27', count: 8, avgScore: 18.4 },
    { day: '2026-09-28', count: 15, avgScore: 31.6 },
    { day: '2026-09-29', count: 6, avgScore: 17.3 },
  ],
};

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'social_behavior_analyzer',
  waitForConnections: true,
  connectionLimit: 10,
  connectTimeout: 2000,
});

async function safeDbOperation(operation, fallbackValue) {
  try {
    return await operation();
  } catch (err) {
    const message = err && err.message ? err.message : String(err);
    console.warn('[DB] MySQL not available or schema missing. Returning fallback value. Details:', message);
    return fallbackValue;
  }
}

async function saveResult(result) {
  return safeDbOperation(async () => {
    const sql = `
      INSERT INTO analyzed_texts
        (author, source, original_text, total_score, severity, risk_flag, categories_json, analyzed_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `;
    await pool.execute(sql, [
      result.author || null,
      result.source || null,
      result.originalText,
      result.totalScore,
      result.severity,
      result.riskFlag ? 1 : 0,
      JSON.stringify(result.categories || {}),
      result.analyzedAt,
    ]);
  }, null);
}

async function saveBatch(results) {
  if (!results.length) return;

  return safeDbOperation(async () => {
    const sql = `
      INSERT INTO analyzed_texts
        (author, source, original_text, total_score, severity, risk_flag, categories_json, analyzed_at)
      VALUES ?
    `;
    const values = results.map((r) => [
      r.author || null,
      null,
      r.originalText,
      r.totalScore,
      r.severity,
      r.riskFlag ? 1 : 0,
      JSON.stringify(r.categories || {}),
      r.analyzedAt,
    ]);
    await pool.query(sql, [values]);
  }, null);
}

async function getHistory({ limit = 50, offset = 0, minSeverityScore }) {
  return safeDbOperation(async () => {
    let sql = `SELECT * FROM analyzed_texts`;
    const params = [];
    if (minSeverityScore !== undefined) {
      sql += ` WHERE total_score >= ?`;
      params.push(minSeverityScore);
    }
    sql += ` ORDER BY analyzed_at DESC LIMIT ? OFFSET ?`;
    params.push(limit, offset);
    const [rows] = await pool.query(sql, params);
    return rows;
  }, [
    {
      id: 1,
      author: 'demo-01',
      source: 'demo',
      original_text: 'Mày ngu như lợn, không ai muốn nói chuyện với mày nữa.',
      total_score: 34,
      severity: 'Nghiêm trọng - cần can thiệp',
      risk_flag: 1,
      categories_json: JSON.stringify({ bat_nat: { count: 1, matchedTerms: ['mày ngu như lợn'], score: 14 } }),
      analyzed_at: new Date().toISOString(),
    },
    {
      id: 2,
      author: 'demo-02',
      source: 'demo',
      original_text: 'Cái kiểu này chơi kiểu ngu thật, không ai thèm nghe.',
      total_score: 22,
      severity: 'Tiêu cực',
      risk_flag: 1,
      categories_json: JSON.stringify({ bat_nat: { count: 1, matchedTerms: ['ngu'], score: 12 } }),
      analyzed_at: new Date(Date.now() - 86400000).toISOString(),
    },
  ].slice(0, limit));
}

async function getStats() {
  return safeDbOperation(async () => {
    const [[{ total }]] = await pool.query(
      `SELECT COUNT(*) AS total FROM analyzed_texts`
    );
    const [bySeverity] = await pool.query(
      `SELECT severity, COUNT(*) AS count FROM analyzed_texts GROUP BY severity`
    );
    const [riskFlagged] = await pool.query(
      `SELECT COUNT(*) AS count FROM analyzed_texts WHERE risk_flag = 1`
    );
    const [recentTrend] = await pool.query(
      `SELECT DATE(analyzed_at) AS day, COUNT(*) AS count, AVG(total_score) AS avgScore
       FROM analyzed_texts
       WHERE analyzed_at >= DATE_SUB(NOW(), INTERVAL 14 DAY)
       GROUP BY DATE(analyzed_at)
       ORDER BY day ASC`
    );

    return {
      total,
      bySeverity,
      riskFlagged: riskFlagged[0].count,
      recentTrend,
    };
  }, DEMO_STATS);
}

module.exports = { saveResult, saveBatch, getHistory, getStats, pool };

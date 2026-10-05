/**
 * detector.js
 * Engine phân tích hành vi tiêu cực trong văn bản / bình luận / bài đăng
 * theo kiến trúc Neuro-Symbolic AI:
 *  - Neural-like scoring: đánh giá cảm xúc, cường độ tiêu cực, ngữ cảnh bất ổn
 *  - Symbolic rules: từ điển chuyên gia + luật nếu-thì
 *  - Fusion: tổng hợp điểm số rồi quyết định mức độ nguy cơ
 */

const fs = require('fs');
const path = require('path');

const dictionaries = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'dictionaries.json'), 'utf8')
);

const CATEGORY_WEIGHTS = {
  bat_nat: 3,
  tuc_tiu: 1,
  ky_thi: 3,
  de_doa: 4,
  nguy_co_tam_ly: 5,
};

const SEVERITY_LEVELS = [
  { max: 0, label: 'Bình thường', color: 'green' },
  { max: 3, label: 'Cần chú ý', color: 'yellow' },
  { max: 7, label: 'Tiêu cực', color: 'orange' },
  { max: Infinity, label: 'Nghiêm trọng - cần can thiệp', color: 'red' },
];

const NEGATIVE_INTENSITY_WORDS = [
  'buồn', 'chán', 'mệt', 'tệ', 'sợ', 'khổ', 'tự hại', 'đau khổ',
  'cô đơn', 'mất hy vọng', 'biến mất', 'không muốn sống', 'mất kiểm soát',
  'hết chịu nổi', 'không ai cần mình', 'tự làm hại', 'hận', 'mất niềm tin'
];

const RISK_PATTERNS = [
  'muốn chết',
  'không muốn sống nữa',
  'biến mất khỏi thế giới',
  'không ai cần mình',
  'mình chán đời',
  'mình muốn biến mất',
  'tự làm hại bản thân',
  'không còn muốn sống',
  'mệt mỏi',
  'hết hy vọng'
];

function normalize(text) {
  return String(text || '')
    .toLowerCase()
    .normalize('NFC')
    .replace(/(.)\1{2,}/g, '$1$1')
    .replace(/[._\-*]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function findMatches(normalizedText, keywords) {
  const matches = [];
  const unique = new Set();

  for (const kw of keywords) {
    const term = normalize(kw);
    if (!term) continue;

    const regex = new RegExp(`(?<![\\p{L}\\p{N}])${escapeRegex(term)}(?=[\\p{L}\\p{N}]|$)`, 'giu');
    const result = normalizedText.match(regex);
    if (result && result[0]) {
      const val = result[0].trim();
      if (!unique.has(val)) {
        unique.add(val);
        matches.push(val);
      }
    }

    if (normalizedText.includes(term)) {
      const val = term.trim();
      if (!unique.has(val)) {
        unique.add(val);
        matches.push(val);
      }
    }
  }

  return matches;
}

function getSeverity(score) {
  return SEVERITY_LEVELS.find((lvl) => score <= lvl.max) || SEVERITY_LEVELS[SEVERITY_LEVELS.length - 1];
}

function computeNeuralScore(normalizedText) {
  let score = 0;

  for (const word of NEGATIVE_INTENSITY_WORDS) {
    const phrase = normalize(word);
    if (normalizedText.includes(phrase)) {
      score += 5;
    }
  }

  for (const pattern of RISK_PATTERNS) {
    const phrase = normalize(pattern);
    if (normalizedText.includes(phrase)) {
      score += 12;
    }
  }

  const negativeClauses = [
    'không muốn sống',
    'không còn muốn',
    'mình chán đời',
    'không ai cần mình',
    'biến mất',
    'tự làm hại',
    'mệt mỏi',
    'hết hy vọng'
  ];

  negativeClauses.forEach((clause) => {
    if (normalizedText.includes(clause)) score += 6;
  });

  return Math.min(score, 60);
}

function detectCategories(normalizedText) {
  const results = {};
  let symbolicScore = 0;

  for (const [category, keywords] of Object.entries(dictionaries)) {
    const matches = findMatches(normalizedText, keywords);
    const weight = CATEGORY_WEIGHTS[category] || 1;
    const categoryScore = matches.length * weight;
    symbolicScore += categoryScore;

    if (matches.length > 0) {
      results[category] = {
        count: matches.length,
        matchedTerms: matches,
        score: categoryScore,
      };
    }
  }

  return { results, symbolicScore };
}

function analyzeText(text) {
  if (!text || typeof text !== 'string') {
    return { error: 'Văn bản không hợp lệ' };
  }

  const normalized = normalize(text);
  const { results, symbolicScore } = detectCategories(normalized);
  const neuralScore = computeNeuralScore(normalized);

  const totalScore = Math.min(100, Math.round((neuralScore * 0.6) + (symbolicScore * 0.9)));
  const severity = getSeverity(totalScore);

  const riskFlag = Boolean(
    results.nguy_co_tam_ly ||
    normalized.includes('không muốn sống') ||
    normalized.includes('muốn chết') ||
    normalized.includes('biến mất') ||
    normalized.includes('tự làm hại') ||
    normalized.includes('không ai cần mình')
  );

  return {
    originalText: text,
    totalScore,
    severity: severity.label,
    severityColor: severity.color,
    categories: results,
    riskFlag,
    analyzedAt: new Date().toISOString(),
    model: 'neuro-symbolic-ai',
    neuralScore,
    symbolicScore,
  };
}

function analyzeBatch(items) {
  if (!Array.isArray(items)) return [];

  return items.map((item, idx) => ({
    id: item.id ?? idx + 1,
    author: item.author || null,
    timestamp: item.timestamp || null,
    ...analyzeText(item.text || ''),
  }));
}

function summarize(results) {
  const summary = {
    total: results.length,
    bySeverity: {},
    byCategory: {},
    riskFlagged: 0,
    topOffenders: {},
  };

  for (const r of results) {
    summary.bySeverity[r.severity] = (summary.bySeverity[r.severity] || 0) + 1;
    if (r.riskFlag) summary.riskFlagged += 1;

    for (const cat of Object.keys(r.categories || {})) {
      summary.byCategory[cat] = (summary.byCategory[cat] || 0) + r.categories[cat].count;
    }

    if (r.author && r.totalScore > 0) {
      summary.topOffenders[r.author] = (summary.topOffenders[r.author] || 0) + r.totalScore;
    }
  }

  summary.topOffenders = Object.entries(summary.topOffenders)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([author, score]) => ({ author, score }));

  return summary;
}

module.exports = {
  analyzeText,
  analyzeBatch,
  summarize,
  CATEGORY_WEIGHTS,
  normalize,
  computeNeuralScore,
  detectCategories,
};

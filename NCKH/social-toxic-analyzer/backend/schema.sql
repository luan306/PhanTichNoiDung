CREATE DATABASE IF NOT EXISTS social_behavior_analyzer
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

USE social_behavior_analyzer;

CREATE TABLE IF NOT EXISTS analyzed_texts (
  id INT AUTO_INCREMENT PRIMARY KEY,
  author VARCHAR(255) NULL,
  source VARCHAR(255) NULL,           -- vd: 'facebook', 'form khảo sát', 'zalo group'...
  original_text TEXT NOT NULL,
  total_score INT NOT NULL DEFAULT 0,
  severity VARCHAR(50) NOT NULL,
  risk_flag TINYINT(1) NOT NULL DEFAULT 0,
  categories_json JSON NULL,
  analyzed_at DATETIME NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_analyzed_at (analyzed_at),
  INDEX idx_risk_flag (risk_flag),
  INDEX idx_author (author)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Session Persistence Database Schema
-- SQLite schema for enhanced session management

-- Main sessions table
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  start_time DATETIME NOT NULL,
  last_activity DATETIME NOT NULL,
  message_count INTEGER DEFAULT 0,
  session_data TEXT NOT NULL, -- JSON serialized SessionData
  summary TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Context memory table for key-value storage
CREATE TABLE IF NOT EXISTS context_memory (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL, -- JSON serialized value
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  accessed_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Conversation entries table (for easier querying)
CREATE TABLE IF NOT EXISTS conversation_entries (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  timestamp DATETIME NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('user_input', 'agent_response', 'system_message')),
  content TEXT NOT NULL,
  metadata TEXT, -- JSON serialized metadata
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_sessions_last_activity ON sessions(last_activity);
CREATE INDEX IF NOT EXISTS idx_sessions_start_time ON sessions(start_time);
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_context_memory_accessed ON context_memory(accessed_at);
CREATE INDEX IF NOT EXISTS idx_conversation_session_id ON conversation_entries(session_id);
CREATE INDEX IF NOT EXISTS idx_conversation_timestamp ON conversation_entries(timestamp);

-- View for session summaries
CREATE VIEW IF NOT EXISTS session_summaries AS
SELECT 
  s.id,
  s.user_id,
  s.start_time as createdAt,
  s.last_activity as lastActiveAt,
  s.message_count as messageCount,
  COALESCE(s.summary, 'Session started ' || datetime(s.start_time)) as summary
FROM sessions s
ORDER BY s.last_activity DESC;
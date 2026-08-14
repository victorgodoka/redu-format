-- `key` is a reserved word, hence rl_key. One row per rate-limited key (e.g. "login:1.2.3.4"),
-- fixed window: count resets to 1 once reset_at is in the past instead of being deleted on expiry.
-- Millisecond precision matters here (unlike tournaments.starts_at): a plain-second DATETIME
-- floors any sub-second window away, so a fast-expiring window would never be seen as expired.
CREATE TABLE rate_limits (
  rl_key VARCHAR(191) NOT NULL PRIMARY KEY,
  count INT NOT NULL DEFAULT 1,
  reset_at DATETIME(3) NOT NULL
) ENGINE=InnoDB;

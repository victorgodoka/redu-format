-- Tournaments are no longer REDU-only: each one names the banlist (and, with
-- it, the card pool) its decks are checked against. Everything already in the
-- table predates that choice and is REDU, which is also the default for a new
-- tournament that says nothing.
ALTER TABLE tournaments ADD COLUMN banlist VARCHAR(32) NOT NULL DEFAULT 'redu-2012-10' AFTER engine;

-- Lets Staff extend the deadline of a round in progress (e.g. the duel engine
-- went down). Overrides the normal active_since + roundLimitDays computation
-- when set - active_since itself stays untouched, since elsewhere in the
-- codebase it's relied on as "set once, never touched again".
ALTER TABLE match_deadlines ADD COLUMN deadline_override DATETIME(3) NULL;

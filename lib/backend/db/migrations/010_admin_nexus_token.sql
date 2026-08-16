-- The admin dashboard's linked Dueling Nexus token used to live only inside
-- the signed admin JWT (see lib/auth/session.ts), so it vanished every time
-- the 8-hour admin session expired and had to be re-pasted. Persisting it
-- here means it survives across admin logins - the JWT still carries a copy
-- for cheap reads during the current session, but this column is the durable
-- source of truth.
ALTER TABLE admins ADD COLUMN nexus_token VARCHAR(512) NULL AFTER last_role_check_at;

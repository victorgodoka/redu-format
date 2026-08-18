-- Real image upload for the tournament banner instead of an admin-typed URL:
-- the bytes live in the row itself (small, infrequent reads), so there's no
-- object storage to wire up.
ALTER TABLE tournaments DROP COLUMN banner_url;
ALTER TABLE tournaments ADD COLUMN banner_image MEDIUMBLOB NULL AFTER description;
ALTER TABLE tournaments ADD COLUMN banner_mime VARCHAR(100) NULL AFTER banner_image;

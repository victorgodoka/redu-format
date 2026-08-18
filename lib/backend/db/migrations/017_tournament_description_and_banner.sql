-- Editorial content for the tournament page: a rich-text blurb (parsed by
-- lib/rich-text.ts, never raw HTML) and a banner image URL. Both optional.
ALTER TABLE tournaments ADD COLUMN description TEXT NULL AFTER name;
ALTER TABLE tournaments ADD COLUMN banner_url VARCHAR(2048) NULL AFTER description;

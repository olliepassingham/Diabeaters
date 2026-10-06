-- Feed clips are limited by length in the app (90 seconds), not by a 50MB file.
-- A one-minute iPhone recording is often larger than that.
UPDATE storage.buckets
SET file_size_limit = 524288000
WHERE id = 'community_post_images';

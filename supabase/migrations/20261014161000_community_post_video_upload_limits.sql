-- iPhone camera-roll videos are often video/quicktime and larger than 50MB.
-- Raise the bucket cap and, when a mime allow-list exists, include video types
-- without dropping image types already on the list.

UPDATE storage.buckets AS bucket
SET
  file_size_limit = GREATEST(COALESCE(bucket.file_size_limit, 0), 524288000),
  allowed_mime_types = CASE
    WHEN bucket.allowed_mime_types IS NULL THEN NULL
    ELSE (
      SELECT array_agg(DISTINCT mime)
      FROM unnest(
        bucket.allowed_mime_types || ARRAY[
          'video/mp4',
          'video/quicktime',
          'video/webm',
          'video/x-m4v',
          'application/octet-stream'
        ]::text[]
      ) AS mime
    )
  END
WHERE bucket.id = 'community_post_images';

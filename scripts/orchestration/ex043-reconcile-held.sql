-- EX-04.3 evidence query only. Run against a reviewed read replica or disposable fixture.
-- No payload, recipient, provider response, token, or secret is selected.
BEGIN READ ONLY;
WITH consumers(consumer_key) AS (
  VALUES ('notifications.v1'), ('search-projection.v1')
), held AS (
  SELECT event_id, event_name, hold_reason, created_at, payload
  FROM domain_event_outbox
  WHERE eligibility = 'held'
), notification_state AS (
  SELECT event_id, count(*) AS row_count,
         count(*) FILTER (WHERE status = 'sent') AS recorded_sent,
         count(*) FILTER (WHERE status = 'uncertain') AS uncertain,
         count(*) FILTER (WHERE status IN ('queued', 'failed', 'sending')) AS unresolved
  FROM notifications GROUP BY event_id
), search_presence AS (
  SELECT h.event_id, bool_or(sd.id IS NOT NULL) AS projection_found
  FROM held h
  LEFT JOIN search_documents sd ON
    (h.event_name IN ('content.published', 'content.unpublished')
      AND sd.document_type = 'content'
      AND sd.content_block_id = NULLIF(h.payload->>'contentId', '')::uuid)
    OR (h.event_name IN ('variant.created', 'variant.updated', 'variant.status_changed')
      AND sd.document_type = 'variant'
      AND sd.variant_id = NULLIF(h.payload->>'variantId', '')::uuid)
    OR (h.event_name IN ('product.created', 'product.updated', 'product.status_changed')
      AND sd.document_type = 'variant'
      AND EXISTS (SELECT 1 FROM variants v WHERE v.id = sd.variant_id
        AND v.product_id = NULLIF(h.payload->>'productId', '')::uuid))
    OR (h.event_name IN ('brand.created', 'brand.updated', 'brand.status_changed')
      AND sd.document_type = 'variant'
      AND EXISTS (SELECT 1 FROM variants v JOIN products p ON p.id = v.product_id
        WHERE v.id = sd.variant_id AND p.brand_id = NULLIF(h.payload->>'brandId', '')::uuid))
    OR (h.event_name IN ('category.created', 'category.updated', 'category.tree_updated')
      AND sd.document_type = 'variant'
      AND EXISTS (SELECT 1 FROM variants v JOIN products p ON p.id = v.product_id
        WHERE v.id = sd.variant_id AND p.category_id = NULLIF(h.payload->>'categoryId', '')::uuid))
  GROUP BY h.event_id
)
SELECT h.event_id, h.event_name, h.hold_reason, h.created_at,
       c.consumer_key,
       CASE
         WHEN i.status = 'completed' THEN 'receipt_completed'
         WHEN c.consumer_key = 'notifications.v1' AND COALESCE(n.recorded_sent, 0) > 0 THEN 'recorded_sent_effect_evidence'
         WHEN c.consumer_key = 'notifications.v1' AND COALESCE(n.uncertain, 0) > 0 THEN 'uncertain_remains_held'
         WHEN c.consumer_key = 'notifications.v1' AND COALESCE(n.unresolved, 0) > 0 THEN 'legacy_intent_outcome_unproven'
         WHEN c.consumer_key = 'search-projection.v1' AND COALESCE(s.projection_found, false) THEN 'projection_found'
         ELSE 'uncertain_or_unsupported'
       END AS evidence_disposition,
       COALESCE(n.row_count, 0) AS notification_rows,
       COALESCE(n.recorded_sent, 0) AS recorded_sent_rows,
       COALESCE(n.uncertain, 0) AS uncertain_rows,
       COALESCE(s.projection_found, false) AS search_projection_found
FROM held h
CROSS JOIN consumers c
LEFT JOIN domain_event_inbox i ON i.event_id = h.event_id AND i.consumer_key = c.consumer_key
LEFT JOIN notification_state n ON n.event_id = h.event_id::text AND c.consumer_key = 'notifications.v1'
LEFT JOIN search_presence s ON s.event_id = h.event_id AND c.consumer_key = 'search-projection.v1'
ORDER BY h.created_at, h.event_id, c.consumer_key;
ROLLBACK;

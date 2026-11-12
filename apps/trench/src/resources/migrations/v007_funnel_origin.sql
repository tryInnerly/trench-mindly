-- Several FunnelFox projects share this workspace and may reuse funnel slugs
-- (p_onboarding). These columns let analytics tell same-slug funnels apart.
--
--   p_project_id  FunnelFox project id (webhook events only)
--   p_funnel_id   FunnelFox funnel id. Amplitude events already carry it as
--                 properties.funnelId, and the webhook adapter now sends the
--                 same key
--   p_host        host of the funnel page, from properties.origin (Origin
--                 header in the Amplitude adapter, location.origin in webhooks)
--
-- MATERIALIZED columns added by ALTER are metadata-only: existing parts are not
-- rewritten. For old parts ClickHouse computes the value at read time from
-- properties, which reads the heavy properties column. New inserts store the
-- value physically. No MATERIALIZE COLUMN (backfill) here on purpose.
ALTER TABLE events
    ADD COLUMN IF NOT EXISTS p_project_id String MATERIALIZED JSONExtractString(properties, 'project_id'),
    ADD COLUMN IF NOT EXISTS p_funnel_id String MATERIALIZED JSONExtractString(properties, 'funnelId'),
    ADD COLUMN IF NOT EXISTS p_host String MATERIALIZED domain(JSONExtractString(properties, 'origin'));

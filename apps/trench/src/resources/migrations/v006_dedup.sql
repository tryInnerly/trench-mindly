-- 1. Drop materialized view (must happen before table drop)
DROP TABLE IF EXISTS kafka_events_consumer_{kafka_instance_id};

-- 2. Drop events table (data is expendable)
DROP TABLE IF EXISTS events;

-- 3. Recreate events with ReplacingMergeTree
CREATE TABLE events (
    uuid UUID,
    type String,
    event String,
    user_id String,
    group_id String,
    anonymous_id String,
    instance_id String,
    properties String CODEC(ZSTD(3)),
    traits String CODEC(ZSTD(3)),
    context String CODEC(ZSTD(3)),
    timestamp DateTime64(6, 'UTC'),
    parsed_at DateTime64(6, 'UTC'),

    -- Materialized columns: properties
    p_screen_id String MATERIALIZED JSONExtractString(properties, 'screen_id'),
    p_screen_index Int32 MATERIALIZED JSONExtractInt(properties, 'screen_index'),
    p_screen_cid String MATERIALIZED JSONExtractString(properties, 'screen_cid'),
    p_screen_type String MATERIALIZED JSONExtractString(properties, 'screen_type'),
    p_form_cid String MATERIALIZED JSONExtractString(properties, 'form_cid'),
    p_reply String MATERIALIZED JSONExtractString(properties, 'reply'),
    p_elements String MATERIALIZED JSONExtractRaw(properties, 'elements'),
    p_onboarding String MATERIALIZED JSONExtractString(properties, 'onboarding'),
    p_sandbox Bool MATERIALIZED JSONExtractBool(properties, 'sandbox'),
    p_cta String MATERIALIZED JSONExtractString(properties, 'cta'),
    p_from String MATERIALIZED JSONExtractString(properties, 'from'),
    p_to String MATERIALIZED JSONExtractString(properties, 'to'),
    p_variable String MATERIALIZED JSONExtractString(properties, 'variable'),
    p_url String MATERIALIZED JSONExtractString(properties, 'url'),
    p_error String MATERIALIZED JSONExtractString(properties, 'error'),
    p_message String MATERIALIZED JSONExtractString(properties, 'message'),
    p_ua String MATERIALIZED JSONExtractString(properties, 'ua'),
    p_currency String MATERIALIZED JSONExtractString(properties, 'currency'),
    p_price Float64 MATERIALIZED JSONExtractFloat(properties, 'price'),
    p_price_fact Float64 MATERIALIZED JSONExtractFloat(properties, 'price_fact'),
    p_paid_trial Bool MATERIALIZED JSONExtractBool(properties, 'paid_trial'),
    p_payment_method String MATERIALIZED JSONExtractString(properties, 'payment_method'),
    p_payment_provider String MATERIALIZED JSONExtractString(properties, 'payment_provider'),
    p_product_id String MATERIALIZED JSONExtractString(properties, 'product_id'),
    p_subscription_id String MATERIALIZED JSONExtractString(properties, 'subscription_id'),
    p_transaction_id String MATERIALIZED JSONExtractString(properties, 'transaction_id'),
    p_vendor_discount_id String MATERIALIZED JSONExtractString(properties, 'vendor_discount_id'),
    p_vendor_price_id String MATERIALIZED JSONExtractString(properties, 'vendor_price_id'),
    p_vendor_product_id String MATERIALIZED JSONExtractString(properties, 'vendor_product_id'),
    p_vendor_profile_id String MATERIALIZED JSONExtractString(properties, 'vendor_profile_id'),
    p_utm_campaign String MATERIALIZED JSONExtractString(properties, 'utm_campaign'),
    p_utm_content String MATERIALIZED JSONExtractString(properties, 'utm_content'),
    p_utm_source String MATERIALIZED JSONExtractString(properties, 'utm_source'),
    p_utm_term String MATERIALIZED JSONExtractString(properties, 'utm_term'),
    p_fbclid String MATERIALIZED JSONExtractString(properties, 'fbclid'),
    p_referrer String MATERIALIZED JSONExtractString(properties, 'referrer'),
    p_referring_domain String MATERIALIZED JSONExtractString(properties, 'referring_domain'),
    p_page_counter Int32 MATERIALIZED JSONExtractInt(properties, '[Amplitude] Page Counter'),
    p_page_domain String MATERIALIZED JSONExtractString(properties, '[Amplitude] Page Domain'),
    p_page_location String MATERIALIZED JSONExtractString(properties, '[Amplitude] Page Location'),
    p_page_path String MATERIALIZED JSONExtractString(properties, '[Amplitude] Page Path'),
    p_page_title String MATERIALIZED JSONExtractString(properties, '[Amplitude] Page Title'),
    p_page_url String MATERIALIZED JSONExtractString(properties, '[Amplitude] Page URL'),

    -- Materialized columns: context
    c_ip String MATERIALIZED JSONExtractString(context, 'ip'),
    c_locale String MATERIALIZED JSONExtractString(context, 'locale'),
    c_user_agent String MATERIALIZED JSONExtractString(context, 'userAgent'),
    c_device_type String MATERIALIZED JSONExtractString(context, 'device', 'type')
) ENGINE = ReplacingMergeTree(parsed_at)
  PARTITION BY instance_id
  ORDER BY (instance_id, user_id, timestamp, uuid)
  SETTINGS index_granularity = 8192;

-- 4. Recreate materialized view (same as v001, required because v001 won't re-run)
CREATE MATERIALIZED VIEW kafka_events_consumer_{kafka_instance_id} TO events AS
SELECT
    toUUID(JSONExtractString(json, 'uuid')) AS uuid,
    JSONExtractString(json, 'type') AS type,
    JSONExtractString(json, 'event') AS event,
    JSONExtractString(json, 'user_id') AS user_id,
    JSONExtractString(json, 'group_id') AS group_id,
    JSONExtractString(json, 'anonymous_id') AS anonymous_id,
    JSONExtractString(json, 'instance_id') AS instance_id,
    JSONExtractString(json, 'properties') AS properties,
    JSONExtractString(json, 'traits') AS traits,
    JSONExtractString(json, 'context') AS context,
    parseDateTimeBestEffort(JSONExtractString(json, 'timestamp')) AS timestamp,
    now64() AS parsed_at
FROM kafka_events_data_{kafka_instance_id};

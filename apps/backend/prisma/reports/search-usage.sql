-- Replace the date with the launch date (UTC). Run after the first four weeks.
WITH users_in_window AS (
  SELECT "userId", bool_or("searched") AS searched, bool_or("opened") AS opened
  FROM "search_usage"
  WHERE "day" >= DATE '2026-10-06'
    AND "day" < DATE '2026-10-06' + 28
  GROUP BY "userId"
)
SELECT count(*) AS active_users,
       count(*) FILTER (WHERE searched) AS searching_users,
       count(*) FILTER (WHERE opened) AS users_opening_results,
       100.0 * count(*) FILTER (WHERE searched) / NULLIF(count(*), 0) AS search_usage_percent,
       100.0 * count(*) FILTER (WHERE opened) / NULLIF(count(*) FILTER (WHERE searched), 0) AS result_open_percent
FROM users_in_window;

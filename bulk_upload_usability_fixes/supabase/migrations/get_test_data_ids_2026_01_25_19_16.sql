-- Get test data for API testing
SELECT 
    pr.project_id,
    pr.id as request_id,
    pr.title,
    COUNT(pq.id) as quote_count
FROM public.project_price_requests_2026_01_25_19_16 pr
LEFT JOIN public.project_price_quotes_2026_01_25_19_16 pq ON pr.id = pq.project_price_request_id
WHERE pr.title LIKE '%Test%'
GROUP BY pr.project_id, pr.id, pr.title
ORDER BY pr.created_at DESC
LIMIT 5;
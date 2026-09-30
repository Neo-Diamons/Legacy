UPDATE `todo_items`
SET `user_id` = (
	SELECT `id` FROM `users` ORDER BY `created_at`, `id` LIMIT 1
)
WHERE (`user_id` IS NULL OR `user_id` = '')
	AND EXISTS (SELECT 1 FROM `users`);
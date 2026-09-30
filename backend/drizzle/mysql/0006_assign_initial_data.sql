UPDATE `todo_items`
SET `user_id` = (
	SELECT `id` FROM (SELECT `id` FROM `users` ORDER BY `created_at`, `id` LIMIT 1) AS `first_user`
)
WHERE EXISTS (SELECT 1 FROM `users`);
--> statement-breakpoint
INSERT INTO `projects` (`id`, `user_id`, `name`, `color`)
SELECT '10000000-0000-4000-8000-000000000000', `id`, 'Mon projet', '#4f8ef7'
FROM `users`
WHERE NOT EXISTS (SELECT 1 FROM `projects`)
ORDER BY `created_at`, `id`
LIMIT 1;
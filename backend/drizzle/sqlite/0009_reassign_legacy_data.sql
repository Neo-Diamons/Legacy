UPDATE `todo_items`
SET `project_id` = NULL
WHERE `user_id` = '00000000-0000-4000-8000-000000000000'
	AND `project_id` IS NOT NULL
	AND `project_id` NOT IN (
		SELECT `id` FROM `projects`
		WHERE `user_id` = (
			SELECT `id` FROM `users`
			WHERE `id` <> '00000000-0000-4000-8000-000000000000'
			ORDER BY `created_at`, `id` LIMIT 1
		)
	);
--> statement-breakpoint
UPDATE `projects`
SET `user_id` = (
	SELECT `id` FROM `users`
	WHERE `id` <> '00000000-0000-4000-8000-000000000000'
	ORDER BY `created_at`, `id` LIMIT 1
)
WHERE `user_id` = '00000000-0000-4000-8000-000000000000'
	AND EXISTS (
		SELECT 1 FROM `users`
		WHERE `id` <> '00000000-0000-4000-8000-000000000000'
	);
--> statement-breakpoint
UPDATE `todo_items`
SET `user_id` = (
	SELECT `id` FROM `users`
	WHERE `id` <> '00000000-0000-4000-8000-000000000000'
	ORDER BY `created_at`, `id` LIMIT 1
)
WHERE `user_id` = '00000000-0000-4000-8000-000000000000'
	AND EXISTS (
		SELECT 1 FROM `users`
		WHERE `id` <> '00000000-0000-4000-8000-000000000000'
	);
--> statement-breakpoint
DELETE FROM `users`
WHERE `id` = '00000000-0000-4000-8000-000000000000'
	AND NOT EXISTS (SELECT 1 FROM `projects` WHERE `user_id` = `users`.`id`)
	AND NOT EXISTS (SELECT 1 FROM `todo_items` WHERE `user_id` = `users`.`id`);
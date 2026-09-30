INSERT INTO `users` (`id`, `email`, `name`, `password_hash`, `must_change_password`)
SELECT '00000000-0000-4000-8000-000000000000', 'legacy@localhost.invalid', 'Legacy', '!', 1
WHERE NOT EXISTS (SELECT 1 FROM `users` WHERE `id` = '00000000-0000-4000-8000-000000000000')
	AND (
		EXISTS (SELECT 1 FROM `projects` WHERE `user_id` NOT IN (SELECT `id` FROM `users`))
		OR EXISTS (SELECT 1 FROM `todo_items` WHERE `user_id` NOT IN (SELECT `id` FROM `users`))
	);
--> statement-breakpoint
UPDATE `projects` SET `user_id` = '00000000-0000-4000-8000-000000000000' WHERE `user_id` NOT IN (SELECT `id` FROM `users`);
--> statement-breakpoint
UPDATE `todo_items` SET `user_id` = '00000000-0000-4000-8000-000000000000' WHERE `user_id` NOT IN (SELECT `id` FROM `users`);
--> statement-breakpoint
INSERT INTO `projects` (`id`, `user_id`, `name`, `color`)
SELECT UUID(), `u`.`id`, 'Unassigned (migrated)', '#6366f1'
FROM `users` `u`
WHERE EXISTS (
		SELECT 1 FROM `todo_items` `t`
		WHERE `t`.`user_id` = `u`.`id`
			AND (`t`.`project_id` IS NULL OR `t`.`project_id` NOT IN (SELECT `p`.`id` FROM `projects` `p` WHERE `p`.`user_id` = `u`.`id`))
	)
	AND NOT EXISTS (SELECT 1 FROM `projects` `p` WHERE `p`.`user_id` = `u`.`id` AND `p`.`name` = 'Unassigned (migrated)');
--> statement-breakpoint
UPDATE `todo_items`
SET `project_id` = (
	SELECT `p`.`id` FROM `projects` `p`
	WHERE `p`.`user_id` = `todo_items`.`user_id` AND `p`.`name` = 'Unassigned (migrated)'
	ORDER BY `p`.`created_at`, `p`.`id` LIMIT 1
)
WHERE `project_id` IS NULL
	OR `project_id` NOT IN (SELECT `p`.`id` FROM `projects` `p` WHERE `p`.`user_id` = `todo_items`.`user_id`);
--> statement-breakpoint
ALTER TABLE `todo_items` MODIFY COLUMN `user_id` varchar(36) NOT NULL;--> statement-breakpoint
ALTER TABLE `todo_items` MODIFY COLUMN `project_id` varchar(36) NOT NULL;--> statement-breakpoint
ALTER TABLE `todo_items` ADD CONSTRAINT `todo_items_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `todo_items` ADD CONSTRAINT `todo_items_project_id_projects_id_fk` FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `projects` ADD CONSTRAINT `projects_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;
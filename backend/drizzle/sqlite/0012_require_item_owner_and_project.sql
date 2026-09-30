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
SELECT lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-'
		|| substr('89ab', abs(random()) % 4 + 1, 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6))), `u`.`id`, 'Unassigned (migrated)', '#6366f1'
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
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_projects` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`name` text NOT NULL,
	`color` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_projects`("id", "user_id", "name", "color", "created_at") SELECT "id", "user_id", "name", "color", "created_at" FROM `projects`;--> statement-breakpoint
DROP TABLE `projects`;--> statement-breakpoint
ALTER TABLE `__new_projects` RENAME TO `projects`;
--> statement-breakpoint
CREATE TABLE `__new_todo_items` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`project_id` text NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`completed` integer DEFAULT false NOT NULL,
	`priority` text DEFAULT 'medium' NOT NULL,
	`due_date` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_todo_items`("id", "user_id", "project_id", "name", "description", "completed", "priority", "due_date", "created_at") SELECT "id", "user_id", "project_id", "name", "description", "completed", "priority", "due_date", "created_at" FROM `todo_items`;--> statement-breakpoint
DROP TABLE `todo_items`;--> statement-breakpoint
ALTER TABLE `__new_todo_items` RENAME TO `todo_items`;--> statement-breakpoint
PRAGMA foreign_keys=ON;

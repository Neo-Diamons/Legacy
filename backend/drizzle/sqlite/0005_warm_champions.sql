CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`name` text NOT NULL,
	`password_hash` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);--> statement-breakpoint
INSERT INTO `users` (`id`, `email`, `name`, `password_hash`) VALUES ('00000000-0000-4000-8000-000000000000', 'legacy@local.invalid', 'Legacy user', 'disabled');--> statement-breakpoint
ALTER TABLE `todo_items` ADD `user_id` text DEFAULT '00000000-0000-4000-8000-000000000000' NOT NULL;
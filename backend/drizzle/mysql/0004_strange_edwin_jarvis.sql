CREATE TABLE `users` (
	`id` varchar(36) NOT NULL,
	`email` varchar(255) NOT NULL,
	`name` varchar(255) NOT NULL,
	`password_hash` text NOT NULL,
	`created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `users_id` PRIMARY KEY(`id`),
	CONSTRAINT `users_email_unique` UNIQUE(`email`)
);
--> statement-breakpoint
INSERT INTO `users` (`id`, `email`, `name`, `password_hash`) VALUES ('00000000-0000-4000-8000-000000000000', 'legacy@local.invalid', 'Legacy user', 'disabled');
--> statement-breakpoint
ALTER TABLE `todo_items` ADD `user_id` varchar(36) DEFAULT '00000000-0000-4000-8000-000000000000' NOT NULL;
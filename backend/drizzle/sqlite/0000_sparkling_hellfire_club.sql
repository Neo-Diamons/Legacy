CREATE TABLE IF NOT EXISTS `todo_items` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`completed` integer DEFAULT false NOT NULL
);

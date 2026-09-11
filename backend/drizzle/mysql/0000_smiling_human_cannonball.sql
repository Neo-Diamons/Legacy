CREATE TABLE IF NOT EXISTS `todo_items` (
	`id` varchar(36) NOT NULL,
	`name` text NOT NULL,
	`completed` boolean NOT NULL DEFAULT false,
	CONSTRAINT `todo_items_id` PRIMARY KEY(`id`)
);

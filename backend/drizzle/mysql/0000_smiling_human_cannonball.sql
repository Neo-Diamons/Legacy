CREATE TABLE IF NOT EXISTS `todo_items` (
	`id` varchar(36) NOT NULL,
	`name` varchar(255) NOT NULL,
	`completed` boolean NOT NULL DEFAULT false,
	CONSTRAINT `todo_items_id` PRIMARY KEY(`id`)
);

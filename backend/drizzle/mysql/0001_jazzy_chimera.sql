ALTER TABLE `todo_items` ADD `priority` enum('low','medium','high','urgent') DEFAULT 'medium' NOT NULL;--> statement-breakpoint
ALTER TABLE `todo_items` ADD `due_date` datetime;
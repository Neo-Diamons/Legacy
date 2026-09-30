ALTER TABLE `todo_items` ADD `priority` text DEFAULT 'medium' NOT NULL;--> statement-breakpoint
ALTER TABLE `todo_items` ADD `due_date` integer;
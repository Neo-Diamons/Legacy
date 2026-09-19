PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_todo_items` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`completed` integer DEFAULT false NOT NULL,
	`priority` text DEFAULT 'medium' NOT NULL,
	`due_date` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_todo_items`("id", "name", "description", "completed", "priority", "due_date", "created_at") SELECT "id", "name", "description", "completed", "priority", "due_date", "created_at" FROM `todo_items`;--> statement-breakpoint
DROP TABLE `todo_items`;--> statement-breakpoint
ALTER TABLE `__new_todo_items` RENAME TO `todo_items`;--> statement-breakpoint
PRAGMA foreign_keys=ON;
ALTER TABLE `users` ADD `must_change_password` boolean DEFAULT false NOT NULL;
--> statement-breakpoint
UPDATE `users`
SET `must_change_password` = TRUE
WHERE `id` = '00000000-0000-4000-8000-000000000000';
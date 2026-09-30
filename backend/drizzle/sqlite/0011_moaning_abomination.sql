ALTER TABLE `users` ADD `must_change_password` integer DEFAULT false NOT NULL;
--> statement-breakpoint
UPDATE `users`
SET `must_change_password` = true
WHERE `id` = '00000000-0000-4000-8000-000000000000';
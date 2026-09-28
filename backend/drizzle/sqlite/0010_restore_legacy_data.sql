INSERT OR IGNORE INTO `users` (`id`, `email`, `name`, `password_hash`)
VALUES (
	'00000000-0000-4000-8000-000000000000',
	'legacy@local.invalid',
	'Legacy user',
	'scrypt:16c774f711f8bd660bfc555c3494597a:1f2beb82b4ca566c3a42e63ac9fef618003883ddfdeba8f7b725768dcc3cebb347d827187ce44037d6b50b636c60ba97e8b0e8a80dfd4b3b76ecaf765dea9fd8'
);
--> statement-breakpoint
UPDATE `users`
SET `password_hash` = 'scrypt:16c774f711f8bd660bfc555c3494597a:1f2beb82b4ca566c3a42e63ac9fef618003883ddfdeba8f7b725768dcc3cebb347d827187ce44037d6b50b636c60ba97e8b0e8a80dfd4b3b76ecaf765dea9fd8'
WHERE `id` = '00000000-0000-4000-8000-000000000000';
--> statement-breakpoint
UPDATE `projects`
SET `user_id` = '00000000-0000-4000-8000-000000000000'
WHERE `id` = '10000000-0000-4000-8000-000000000000';
--> statement-breakpoint
UPDATE `todo_items`
SET `user_id` = '00000000-0000-4000-8000-000000000000'
WHERE `id` IN (
	'4caa6111-55e5-4596-95b2-935cfcbc03c5',
	'ffd09370-e257-4eeb-bc82-f0909b984282',
	'dac7e922-b578-4234-8016-df2b94528e49',
	'cad06b5f-cebc-44ca-9e48-aeffa6cb852c'
);
--> statement-breakpoint
UPDATE `todo_items`
SET `project_id` = '10000000-0000-4000-8000-000000000000'
WHERE `id` = 'cad06b5f-cebc-44ca-9e48-aeffa6cb852c';
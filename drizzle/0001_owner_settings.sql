CREATE TABLE `owner_settings` (
  `owner_id` text PRIMARY KEY NOT NULL REFERENCES `owners`(`id`),
  `organization_name` text NOT NULL,
  `contact_email` text NOT NULL,
  `gst_number` text DEFAULT '' NOT NULL,
  `due_day` integer DEFAULT 5 NOT NULL,
  `late_fee_per_day` real DEFAULT 0 NOT NULL,
  `notice_period_days` integer DEFAULT 30 NOT NULL,
  `notification_preferences` text DEFAULT '{}' NOT NULL
);

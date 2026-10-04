CREATE TABLE `bookings` (
	`id` text PRIMARY KEY NOT NULL,
	`room_id` text NOT NULL,
	`property_id` text NOT NULL,
	`tenant_id` text NOT NULL,
	`check_in_date` text NOT NULL,
	`check_out_date` text,
	`monthly_rent` real NOT NULL,
	`deposit_amount` real DEFAULT 0 NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`created_at` text DEFAULT (current_timestamp),
	FOREIGN KEY (`room_id`) REFERENCES `rooms`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`property_id`) REFERENCES `properties`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `complaints` (
	`id` text PRIMARY KEY NOT NULL,
	`property_id` text NOT NULL,
	`tenant_id` text,
	`room_number` text,
	`category` text DEFAULT 'other' NOT NULL,
	`priority` text DEFAULT 'medium' NOT NULL,
	`title` text NOT NULL,
	`status` text DEFAULT 'open' NOT NULL,
	`assigned_to` text,
	`created_at` text DEFAULT (current_timestamp),
	FOREIGN KEY (`property_id`) REFERENCES `properties`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `expenses` (
	`id` text PRIMARY KEY NOT NULL,
	`property_id` text NOT NULL,
	`category` text DEFAULT 'misc' NOT NULL,
	`vendor` text NOT NULL,
	`date` text NOT NULL,
	`amount` real NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`created_at` text DEFAULT (current_timestamp),
	FOREIGN KEY (`property_id`) REFERENCES `properties`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `food_menu` (
	`id` text PRIMARY KEY NOT NULL,
	`property_id` text NOT NULL,
	`day` text NOT NULL,
	`breakfast` text DEFAULT '' NOT NULL,
	`lunch` text DEFAULT '' NOT NULL,
	`dinner` text DEFAULT '' NOT NULL,
	FOREIGN KEY (`property_id`) REFERENCES `properties`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `notices` (
	`id` text PRIMARY KEY NOT NULL,
	`property_id` text NOT NULL,
	`title` text NOT NULL,
	`body` text NOT NULL,
	`audience` text DEFAULT 'All tenants' NOT NULL,
	`posted_by` text NOT NULL,
	`created_at` text DEFAULT (current_timestamp),
	FOREIGN KEY (`property_id`) REFERENCES `properties`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `owners` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`password_hash` text NOT NULL,
	`phone` text,
	`created_at` text DEFAULT (current_timestamp)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `owners_email_unique` ON `owners` (`email`);--> statement-breakpoint
CREATE TABLE `payments` (
	`id` text PRIMARY KEY NOT NULL,
	`booking_id` text NOT NULL,
	`amount` real NOT NULL,
	`type` text NOT NULL,
	`month` text,
	`status` text DEFAULT 'pending' NOT NULL,
	`razorpay_order_id` text,
	`razorpay_payment_id` text,
	`paid_at` text,
	`created_at` text DEFAULT (current_timestamp),
	FOREIGN KEY (`booking_id`) REFERENCES `bookings`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `properties` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`name` text NOT NULL,
	`city` text NOT NULL,
	`locality` text NOT NULL,
	`address` text NOT NULL,
	`description` text,
	`gender_type` text NOT NULL,
	`amenities` text,
	`images` text,
	`created_at` text DEFAULT (current_timestamp),
	FOREIGN KEY (`owner_id`) REFERENCES `owners`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `rooms` (
	`id` text PRIMARY KEY NOT NULL,
	`property_id` text NOT NULL,
	`room_number` text NOT NULL,
	`sharing_type` text NOT NULL,
	`total_beds` integer DEFAULT 1 NOT NULL,
	`occupied_beds` integer DEFAULT 0 NOT NULL,
	`rent_per_bed` real NOT NULL,
	`deposit_amount` real DEFAULT 0 NOT NULL,
	`amenities` text,
	`images` text,
	`status` text DEFAULT 'available' NOT NULL,
	`created_at` text DEFAULT (current_timestamp),
	FOREIGN KEY (`property_id`) REFERENCES `properties`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `services` (
	`id` text PRIMARY KEY NOT NULL,
	`property_id` text NOT NULL,
	`name` text NOT NULL,
	`price` real NOT NULL,
	`billing_cycle` text DEFAULT 'monthly' NOT NULL,
	FOREIGN KEY (`property_id`) REFERENCES `properties`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `staff` (
	`id` text PRIMARY KEY NOT NULL,
	`property_id` text NOT NULL,
	`name` text NOT NULL,
	`role` text NOT NULL,
	`phone` text NOT NULL,
	`shift` text DEFAULT 'morning' NOT NULL,
	`salary` real DEFAULT 0 NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`attendance` integer DEFAULT 100 NOT NULL,
	`created_at` text DEFAULT (current_timestamp),
	FOREIGN KEY (`property_id`) REFERENCES `properties`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `tenant_preferences` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`sleep_schedule` text DEFAULT 'flexible' NOT NULL,
	`cleanliness` integer DEFAULT 3 NOT NULL,
	`noise_tolerance` integer DEFAULT 3 NOT NULL,
	`social_level` integer DEFAULT 3 NOT NULL,
	`food_habit` text DEFAULT 'veg' NOT NULL,
	`smoking` integer DEFAULT false NOT NULL,
	`guests_frequency` text DEFAULT 'occasional' NOT NULL,
	`work_schedule` text DEFAULT 'office' NOT NULL,
	`updated_at` text DEFAULT (current_timestamp),
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `tenant_preferences_tenant_id_unique` ON `tenant_preferences` (`tenant_id`);--> statement-breakpoint
CREATE TABLE `tenants` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`phone` text NOT NULL,
	`id_proof_type` text,
	`id_proof_number` text,
	`emergency_contact` text,
	`kyc_status` text DEFAULT 'pending' NOT NULL,
	`created_at` text DEFAULT (current_timestamp)
);
--> statement-breakpoint
CREATE TABLE `visitors` (
	`id` text PRIMARY KEY NOT NULL,
	`property_id` text NOT NULL,
	`tenant_id` text,
	`name` text NOT NULL,
	`purpose` text,
	`check_in` text NOT NULL,
	`check_out` text,
	`id_verified` integer DEFAULT false NOT NULL,
	`created_at` text DEFAULT (current_timestamp),
	FOREIGN KEY (`property_id`) REFERENCES `properties`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE no action
);

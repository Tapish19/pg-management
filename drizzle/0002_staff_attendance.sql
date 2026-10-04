CREATE TABLE `staff_attendance` (
	`staff_id` text NOT NULL,
	`date` text NOT NULL,
	`status` text NOT NULL,
	PRIMARY KEY(`staff_id`, `date`),
	FOREIGN KEY (`staff_id`) REFERENCES `staff`(`id`) ON UPDATE no action ON DELETE no action
);

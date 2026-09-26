CREATE TABLE `planRequests` (
	`id` int AUTO_INCREMENT NOT NULL,
	`studentId` int NOT NULL,
	`studentName` varchar(160) NOT NULL,
	`studentEmail` varchar(320),
	`planId` enum('premium','plus') NOT NULL,
	`amountCents` int NOT NULL,
	`status` enum('pending','approved','rejected') NOT NULL DEFAULT 'pending',
	`proofUrl` text,
	`rejectionReason` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`reviewedAt` timestamp,
	`reviewedBy` int,
	CONSTRAINT `planRequests_id` PRIMARY KEY(`id`)
);

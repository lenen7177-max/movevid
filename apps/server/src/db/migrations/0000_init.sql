CREATE TABLE `abuse_blocklist` (
	`id` text PRIMARY KEY NOT NULL,
	`kind` text NOT NULL,
	`value` text NOT NULL,
	`reason` text,
	`created_by` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`created_by`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `abuse_blocklist_kind_value_idx` ON `abuse_blocklist` (`kind`,`value`);--> statement-breakpoint
CREATE TABLE `user_client_signal` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`platform` text NOT NULL,
	`device_hash` text NOT NULL,
	`ip_hash` text,
	`last_seen_at` integer NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `user_client_signal_user_device_idx` ON `user_client_signal` (`user_id`,`device_hash`);--> statement-breakpoint
CREATE INDEX `user_client_signal_user_seen_idx` ON `user_client_signal` (`user_id`,`last_seen_at`);--> statement-breakpoint
CREATE TABLE `user_acquisition` (
	`user_id` text PRIMARY KEY NOT NULL,
	`channel` text NOT NULL,
	`referrer_host` text,
	`utm_source` text,
	`utm_medium` text,
	`utm_campaign` text,
	`landing_path` text,
	`first_seen_at` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `user_acquisition_channel_idx` ON `user_acquisition` (`channel`);--> statement-breakpoint
CREATE TABLE `admin_membership_grant` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`tier` text NOT NULL,
	`starts_at` integer NOT NULL,
	`expires_at` integer NOT NULL,
	`granted_by_user_id` text,
	`reason` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`granted_by_user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `admin_membership_grant_user_expiry_idx` ON `admin_membership_grant` (`user_id`,`expires_at`);--> statement-breakpoint
CREATE TABLE `admin_operation` (
	`id` text PRIMARY KEY NOT NULL,
	`actor_user_id` text,
	`target_user_id` text,
	`actor_email` text NOT NULL,
	`target_email` text NOT NULL,
	`action` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`reason` text,
	`metadata` text,
	`error_message` text,
	`completed_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`actor_user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`target_user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `admin_operation_target_created_idx` ON `admin_operation` (`target_user_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `admin_operation_actor_created_idx` ON `admin_operation` (`actor_user_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `admin_operation_status_created_idx` ON `admin_operation` (`status`,`created_at`);--> statement-breakpoint
CREATE TABLE `account` (
	`id` text PRIMARY KEY NOT NULL,
	`account_id` text NOT NULL,
	`provider_id` text NOT NULL,
	`user_id` text NOT NULL,
	`access_token` text,
	`refresh_token` text,
	`id_token` text,
	`access_token_expires_at` integer,
	`refresh_token_expires_at` integer,
	`scope` text,
	`password` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `session` (
	`id` text PRIMARY KEY NOT NULL,
	`expires_at` integer NOT NULL,
	`token` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`ip_address` text,
	`user_agent` text,
	`user_id` text NOT NULL,
	`impersonated_by` text,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `session_token_unique` ON `session` (`token`);--> statement-breakpoint
CREATE TABLE `user` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`email_verified` integer NOT NULL,
	`phone_number` text,
	`phone_number_verified` integer DEFAULT false NOT NULL,
	`image` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer,
	`role` text,
	`banned` integer DEFAULT false,
	`ban_reason` text,
	`ban_expires` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX `user_email_unique` ON `user` (`email`);--> statement-breakpoint
CREATE UNIQUE INDEX `user_phone_number_unique` ON `user` (`phone_number`);--> statement-breakpoint
CREATE TABLE `verification` (
	`id` text PRIMARY KEY NOT NULL,
	`identifier` text NOT NULL,
	`value` text NOT NULL,
	`expires_at` integer NOT NULL,
	`created_at` integer,
	`updated_at` integer
);
--> statement-breakpoint
CREATE TABLE `credit_account` (
	`user_id` text PRIMARY KEY NOT NULL,
	`balance` integer DEFAULT 0 NOT NULL,
	`total_granted` integer DEFAULT 0 NOT NULL,
	`total_consumed` integer DEFAULT 0 NOT NULL,
	`total_expired` integer DEFAULT 0 NOT NULL,
	`total_revoked` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `credit_order` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`package_id` text NOT NULL,
	`provider` text NOT NULL,
	`provider_session_id` text,
	`provider_payment_id` text,
	`status` text DEFAULT 'pending' NOT NULL,
	`credit_amount` integer NOT NULL,
	`amount_cents` integer NOT NULL,
	`currency` text NOT NULL,
	`ledger_transaction_id` text,
	`source_template_id` text,
	`expires_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `credit_order_provider_session_idx` ON `credit_order` (`provider`,`provider_session_id`);--> statement-breakpoint
CREATE INDEX `credit_order_user_created_idx` ON `credit_order` (`user_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `credit_order_status_updated_idx` ON `credit_order` (`status`,`updated_at`);--> statement-breakpoint
CREATE TABLE `credit_signup_grant_claim` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`email_hash` text NOT NULL,
	`ip_hash` text,
	`user_agent_hash` text,
	`device_hash` text,
	`granted_amount` integer DEFAULT 0 NOT NULL,
	`status` text NOT NULL,
	`reason` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `credit_signup_grant_claim_user_status_idx` ON `credit_signup_grant_claim` (`user_id`,`status`);--> statement-breakpoint
CREATE INDEX `credit_signup_grant_claim_email_status_idx` ON `credit_signup_grant_claim` (`email_hash`,`status`);--> statement-breakpoint
CREATE INDEX `credit_signup_grant_claim_ip_created_idx` ON `credit_signup_grant_claim` (`ip_hash`,`status`,`created_at`);--> statement-breakpoint
CREATE INDEX `credit_signup_grant_claim_user_agent_created_idx` ON `credit_signup_grant_claim` (`user_agent_hash`,`status`,`created_at`);--> statement-breakpoint
CREATE INDEX `credit_signup_grant_claim_device_created_idx` ON `credit_signup_grant_claim` (`device_hash`,`status`,`created_at`);--> statement-breakpoint
CREATE TABLE `credit_transaction` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`amount` integer NOT NULL,
	`remaining_amount` integer DEFAULT 0 NOT NULL,
	`source_provider` text NOT NULL,
	`source_type` text NOT NULL,
	`source_id` text NOT NULL,
	`package_id` text,
	`expires_at` integer,
	`metadata` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `credit_transaction_source_idx` ON `credit_transaction` (`source_provider`,`source_type`,`source_id`);--> statement-breakpoint
CREATE INDEX `credit_transaction_user_created_idx` ON `credit_transaction` (`user_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `credit_transaction_user_expiry_idx` ON `credit_transaction` (`user_id`,`expires_at`);--> statement-breakpoint
CREATE INDEX `credit_transaction_expiry_idx` ON `credit_transaction` (`expires_at`,`remaining_amount`);--> statement-breakpoint
CREATE TABLE `billing_checkout_session` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`provider` text NOT NULL,
	`provider_session_id` text NOT NULL,
	`plan_id` text NOT NULL,
	`price_id` text NOT NULL,
	`mode` text NOT NULL,
	`status` text DEFAULT 'created' NOT NULL,
	`expires_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `billing_checkout_session_provider_session_id_idx` ON `billing_checkout_session` (`provider`,`provider_session_id`);--> statement-breakpoint
CREATE TABLE `billing_customer` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`provider` text NOT NULL,
	`provider_customer_id` text NOT NULL,
	`email` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `billing_customer_user_provider_idx` ON `billing_customer` (`user_id`,`provider`);--> statement-breakpoint
CREATE UNIQUE INDEX `billing_customer_provider_customer_id_idx` ON `billing_customer` (`provider`,`provider_customer_id`);--> statement-breakpoint
CREATE TABLE `billing_event` (
	`id` text PRIMARY KEY NOT NULL,
	`provider` text NOT NULL,
	`provider_event_id` text NOT NULL,
	`event_type` text NOT NULL,
	`processed_at` integer NOT NULL,
	`payload_json` text NOT NULL,
	`processing_status` text DEFAULT 'pending' NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `billing_event_provider_event_id_idx` ON `billing_event` (`provider`,`provider_event_id`);--> statement-breakpoint
CREATE TABLE `billing_purchase` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`provider` text NOT NULL,
	`provider_payment_intent_id` text NOT NULL,
	`plan_id` text NOT NULL,
	`price_id` text NOT NULL,
	`status` text NOT NULL,
	`paid_at` integer,
	`provider_event_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `billing_purchase_provider_payment_intent_id_idx` ON `billing_purchase` (`provider`,`provider_payment_intent_id`);--> statement-breakpoint
CREATE INDEX `billing_purchase_user_updated_idx` ON `billing_purchase` (`user_id`,`updated_at`);--> statement-breakpoint
CREATE INDEX `billing_purchase_status_updated_idx` ON `billing_purchase` (`status`,`updated_at`);--> statement-breakpoint
CREATE TABLE `billing_subscription` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`provider` text NOT NULL,
	`provider_subscription_id` text NOT NULL,
	`provider_customer_id` text NOT NULL,
	`plan_id` text NOT NULL,
	`price_id` text NOT NULL,
	`status` text NOT NULL,
	`current_period_end` integer,
	`cancel_at_period_end` integer DEFAULT false NOT NULL,
	`started_at` integer,
	`ended_at` integer,
	`provider_event_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `billing_subscription_provider_subscription_id_idx` ON `billing_subscription` (`provider`,`provider_subscription_id`);--> statement-breakpoint
CREATE INDEX `billing_subscription_user_updated_idx` ON `billing_subscription` (`user_id`,`updated_at`);--> statement-breakpoint
CREATE INDEX `billing_subscription_status_updated_idx` ON `billing_subscription` (`status`,`updated_at`);--> statement-breakpoint
CREATE TABLE `video_job` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`template_id` text NOT NULL,
	`status` text DEFAULT 'processing' NOT NULL,
	`provider` text NOT NULL,
	`quality` text DEFAULT '720p' NOT NULL,
	`model` text DEFAULT 'seedance-2.5' NOT NULL,
	`left_asset_task_id` text,
	`middle_asset_task_id` text,
	`right_asset_task_id` text,
	`provider_task_id` text,
	`progress` integer DEFAULT 0 NOT NULL,
	`left_image_key` text NOT NULL,
	`middle_image_key` text,
	`right_image_key` text,
	`output_key` text,
	`inputs_deleted_at` integer,
	`credits_cost` integer NOT NULL,
	`credits_refunded` integer DEFAULT false NOT NULL,
	`provider_cost` text,
	`error` text,
	`last_polled_at` integer,
	`completed_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `video_job_user_created_idx` ON `video_job` (`user_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `video_job_status_idx` ON `video_job` (`status`);
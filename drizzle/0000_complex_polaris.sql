CREATE TABLE `banners` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`image_key` text NOT NULL,
	`title` text DEFAULT '' NOT NULL,
	`subtitle` text DEFAULT '' NOT NULL,
	`button_text` text DEFAULT '' NOT NULL,
	`link` text DEFAULT '' NOT NULL,
	`sort` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `categories` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`image_key` text,
	`sort` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `customers` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`telegram_id` text NOT NULL,
	`first_name` text DEFAULT '' NOT NULL,
	`username` text,
	`phone` text DEFAULT '' NOT NULL,
	`address` text DEFAULT '' NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `customers_telegram_id_unique` ON `customers` (`telegram_id`);--> statement-breakpoint
CREATE TABLE `delivery_rates` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`wilaya_id` integer NOT NULL,
	`wilaya_name` text NOT NULL,
	`home_fee` integer NOT NULL,
	`desk_fee` integer NOT NULL,
	`is_available` integer DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `delivery_rates_wilaya_id_unique` ON `delivery_rates` (`wilaya_id`);--> statement-breakpoint
CREATE TABLE `order_items` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`order_id` integer NOT NULL,
	`product_id` integer,
	`name` text NOT NULL,
	`price` integer NOT NULL,
	`qty` integer NOT NULL,
	`variant_details` text DEFAULT '' NOT NULL,
	FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `order_items_order_idx` ON `order_items` (`order_id`);--> statement-breakpoint
CREATE TABLE `order_status_history` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`order_id` integer NOT NULL,
	`old_status` text NOT NULL,
	`new_status` text NOT NULL,
	`note` text DEFAULT '' NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `history_order_idx` ON `order_status_history` (`order_id`);--> statement-breakpoint
CREATE TABLE `orders` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`token` text NOT NULL,
	`status` text DEFAULT 'new' NOT NULL,
	`source` text NOT NULL,
	`customer_id` integer,
	`telegram_chat_id` text,
	`name` text NOT NULL,
	`phone` text NOT NULL,
	`phone_alt` text DEFAULT '' NOT NULL,
	`wilaya_id` integer DEFAULT 16 NOT NULL,
	`wilaya_name` text DEFAULT 'الجزائر' NOT NULL,
	`daira` text DEFAULT '' NOT NULL,
	`commune` text DEFAULT '' NOT NULL,
	`district` text DEFAULT '' NOT NULL,
	`address` text NOT NULL,
	`landmark` text DEFAULT '' NOT NULL,
	`delivery_type` text DEFAULT 'home' NOT NULL,
	`notes` text DEFAULT '' NOT NULL,
	`payment` text DEFAULT 'cod' NOT NULL,
	`receipt_key` text,
	`subtotal` integer NOT NULL,
	`delivery_fee` integer NOT NULL,
	`total` integer NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `orders_token_unique` ON `orders` (`token`);--> statement-breakpoint
CREATE INDEX `orders_status_idx` ON `orders` (`status`);--> statement-breakpoint
CREATE INDEX `orders_customer_idx` ON `orders` (`customer_id`);--> statement-breakpoint
CREATE TABLE `products` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`category_id` integer,
	`name` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`price` integer NOT NULL,
	`old_price` integer,
	`images` text DEFAULT '[]' NOT NULL,
	`video_url` text DEFAULT '' NOT NULL,
	`variants` text DEFAULT '{}' NOT NULL,
	`sections` text DEFAULT '[]' NOT NULL,
	`available` integer DEFAULT true NOT NULL,
	`sort` integer DEFAULT 0 NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`category_id`) REFERENCES `categories`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `products_category_idx` ON `products` (`category_id`);--> statement-breakpoint
CREATE TABLE `settings` (
	`id` integer PRIMARY KEY NOT NULL,
	`name` text DEFAULT 'متجر الجزائر' NOT NULL,
	`tagline` text DEFAULT 'تسوق أونلاين في 69 ولاية' NOT NULL,
	`logo_key` text,
	`color` text DEFAULT '#1b6b44' NOT NULL,
	`currency` text DEFAULT 'د.ج' NOT NULL,
	`default_home_delivery_fee` integer DEFAULT 600 NOT NULL,
	`default_desk_delivery_fee` integer DEFAULT 350 NOT NULL,
	`free_shipping_over` integer DEFAULT 0 NOT NULL,
	`announcement` text DEFAULT 'التوصيل متوفر لجميع الولايات الـ 69 والدفع عند الاستلام' NOT NULL,
	`whatsapp` text DEFAULT '' NOT NULL,
	`transfer_info` text DEFAULT '' NOT NULL,
	`cloudinary_cloud_name` text DEFAULT '' NOT NULL,
	`cloudinary_upload_preset` text DEFAULT '' NOT NULL,
	`is_open` integer DEFAULT true NOT NULL
);

// Auto-generated from data/erbeauti_100tables_mysql.sql
export const SAMPLE_100_SQL = `
-- ERBeauti 100-Table Sample Database
-- Generated from erbeauti_100tables.db

CREATE TABLE addresses (
            id          INT PRIMARY KEY AUTO_INCREMENT,
            user_id     INT NOT NULL REFERENCES users(id),
            tag         TEXT DEFAULT 'default',
            receiver    TEXT NOT NULL,
            phone       TEXT NOT NULL,
            province    TEXT,
            city        TEXT,
            district    TEXT,
            detail      TEXT,
            is_default  INT DEFAULT 0
        );

CREATE TABLE attachments (id INT PRIMARY KEY AUTO_INCREMENT, user_id INT REFERENCES users(id), file_name TEXT NOT NULL, file_size INT, mime_type TEXT, url TEXT NOT NULL, uploaded_at TEXT DEFAULT CURRENT_TIMESTAMP, created_at TEXT DEFAULT CURRENT_TIMESTAMP);

CREATE TABLE attachments_001 (id INT PRIMARY KEY AUTO_INCREMENT, user_id INT REFERENCES users(id), file_name TEXT NOT NULL, file_size INT, mime_type TEXT, url TEXT NOT NULL, uploaded_at TEXT DEFAULT CURRENT_TIMESTAMP, created_at TEXT DEFAULT CURRENT_TIMESTAMP);

CREATE TABLE attachments_002 (id INT PRIMARY KEY AUTO_INCREMENT, user_id INT REFERENCES users(id), file_name TEXT NOT NULL, file_size INT, mime_type TEXT, url TEXT NOT NULL, uploaded_at TEXT DEFAULT CURRENT_TIMESTAMP, created_at TEXT DEFAULT CURRENT_TIMESTAMP);

CREATE TABLE attachments_003 (id INT PRIMARY KEY AUTO_INCREMENT, user_id INT REFERENCES users(id), file_name TEXT NOT NULL, file_size INT, mime_type TEXT, url TEXT NOT NULL, uploaded_at TEXT DEFAULT CURRENT_TIMESTAMP, created_at TEXT DEFAULT CURRENT_TIMESTAMP);

CREATE TABLE attachments_004 (id INT PRIMARY KEY AUTO_INCREMENT, user_id INT REFERENCES users(id), file_name TEXT NOT NULL, file_size INT, mime_type TEXT, url TEXT NOT NULL, uploaded_at TEXT DEFAULT CURRENT_TIMESTAMP, created_at TEXT DEFAULT CURRENT_TIMESTAMP);

CREATE TABLE attachments_005 (id INT PRIMARY KEY AUTO_INCREMENT, user_id INT REFERENCES users(id), file_name TEXT NOT NULL, file_size INT, mime_type TEXT, url TEXT NOT NULL, uploaded_at TEXT DEFAULT CURRENT_TIMESTAMP, created_at TEXT DEFAULT CURRENT_TIMESTAMP);

CREATE TABLE banners (id INT PRIMARY KEY AUTO_INCREMENT, title TEXT, image_url TEXT NOT NULL, link_url TEXT, sort_order INT DEFAULT 0, is_active INT DEFAULT 1, created_at TEXT DEFAULT CURRENT_TIMESTAMP);

CREATE TABLE banners_001 (id INT PRIMARY KEY AUTO_INCREMENT, title TEXT, image_url TEXT NOT NULL, link_url TEXT, sort_order INT DEFAULT 0, is_active INT DEFAULT 1, created_at TEXT DEFAULT CURRENT_TIMESTAMP);

CREATE TABLE banners_002 (id INT PRIMARY KEY AUTO_INCREMENT, title TEXT, image_url TEXT NOT NULL, link_url TEXT, sort_order INT DEFAULT 0, is_active INT DEFAULT 1, created_at TEXT DEFAULT CURRENT_TIMESTAMP);

CREATE TABLE banners_003 (id INT PRIMARY KEY AUTO_INCREMENT, title TEXT, image_url TEXT NOT NULL, link_url TEXT, sort_order INT DEFAULT 0, is_active INT DEFAULT 1, created_at TEXT DEFAULT CURRENT_TIMESTAMP);

CREATE TABLE banners_004 (id INT PRIMARY KEY AUTO_INCREMENT, title TEXT, image_url TEXT NOT NULL, link_url TEXT, sort_order INT DEFAULT 0, is_active INT DEFAULT 1, created_at TEXT DEFAULT CURRENT_TIMESTAMP);

CREATE TABLE banners_005 (id INT PRIMARY KEY AUTO_INCREMENT, title TEXT, image_url TEXT NOT NULL, link_url TEXT, sort_order INT DEFAULT 0, is_active INT DEFAULT 1, created_at TEXT DEFAULT CURRENT_TIMESTAMP);

CREATE TABLE carts (
            id          INT PRIMARY KEY AUTO_INCREMENT,
            user_id     INT NOT NULL REFERENCES users(id),
            product_id  INT NOT NULL REFERENCES products(id),
            quantity    INT NOT NULL DEFAULT 1,
            created_at  TEXT DEFAULT CURRENT_TIMESTAMP
        );

CREATE TABLE categories (
            id          INT PRIMARY KEY AUTO_INCREMENT,
            parent_id   INT REFERENCES categories(id),
            name        TEXT NOT NULL,
            slug        TEXT UNIQUE,
            description TEXT,
            sort_order  INT DEFAULT 0,
            is_active   INT DEFAULT 1
        );

CREATE TABLE coupons (id INT PRIMARY KEY AUTO_INCREMENT, code TEXT UNIQUE NOT NULL, type TEXT NOT NULL, value DOUBLE NOT NULL, min_amount DOUBLE DEFAULT 0, max_uses INT DEFAULT 100, used_count INT DEFAULT 0, expires_at TEXT, created_at TEXT DEFAULT CURRENT_TIMESTAMP);

CREATE TABLE coupons_001 (id INT PRIMARY KEY AUTO_INCREMENT, code TEXT UNIQUE NOT NULL, type TEXT NOT NULL, value DOUBLE NOT NULL, min_amount DOUBLE DEFAULT 0, max_uses INT DEFAULT 100, used_count INT DEFAULT 0, expires_at TEXT, created_at TEXT DEFAULT CURRENT_TIMESTAMP);

CREATE TABLE coupons_002 (id INT PRIMARY KEY AUTO_INCREMENT, code TEXT UNIQUE NOT NULL, type TEXT NOT NULL, value DOUBLE NOT NULL, min_amount DOUBLE DEFAULT 0, max_uses INT DEFAULT 100, used_count INT DEFAULT 0, expires_at TEXT, created_at TEXT DEFAULT CURRENT_TIMESTAMP);

CREATE TABLE coupons_003 (id INT PRIMARY KEY AUTO_INCREMENT, code TEXT UNIQUE NOT NULL, type TEXT NOT NULL, value DOUBLE NOT NULL, min_amount DOUBLE DEFAULT 0, max_uses INT DEFAULT 100, used_count INT DEFAULT 0, expires_at TEXT, created_at TEXT DEFAULT CURRENT_TIMESTAMP);

CREATE TABLE coupons_004 (id INT PRIMARY KEY AUTO_INCREMENT, code TEXT UNIQUE NOT NULL, type TEXT NOT NULL, value DOUBLE NOT NULL, min_amount DOUBLE DEFAULT 0, max_uses INT DEFAULT 100, used_count INT DEFAULT 0, expires_at TEXT, created_at TEXT DEFAULT CURRENT_TIMESTAMP);

CREATE TABLE coupons_005 (id INT PRIMARY KEY AUTO_INCREMENT, code TEXT UNIQUE NOT NULL, type TEXT NOT NULL, value DOUBLE NOT NULL, min_amount DOUBLE DEFAULT 0, max_uses INT DEFAULT 100, used_count INT DEFAULT 0, expires_at TEXT, created_at TEXT DEFAULT CURRENT_TIMESTAMP);

CREATE TABLE favorites (id INT PRIMARY KEY AUTO_INCREMENT, user_id INT NOT NULL REFERENCES users(id), product_id INT NOT NULL REFERENCES products(id), created_at TEXT DEFAULT CURRENT_TIMESTAMP);

CREATE TABLE favorites_001 (id INT PRIMARY KEY AUTO_INCREMENT, user_id INT NOT NULL REFERENCES users(id), product_id INT NOT NULL REFERENCES products(id), created_at TEXT DEFAULT CURRENT_TIMESTAMP);

CREATE TABLE favorites_002 (id INT PRIMARY KEY AUTO_INCREMENT, user_id INT NOT NULL REFERENCES users(id), product_id INT NOT NULL REFERENCES products(id), created_at TEXT DEFAULT CURRENT_TIMESTAMP);

CREATE TABLE favorites_003 (id INT PRIMARY KEY AUTO_INCREMENT, user_id INT NOT NULL REFERENCES users(id), product_id INT NOT NULL REFERENCES products(id), created_at TEXT DEFAULT CURRENT_TIMESTAMP);

CREATE TABLE favorites_004 (id INT PRIMARY KEY AUTO_INCREMENT, user_id INT NOT NULL REFERENCES users(id), product_id INT NOT NULL REFERENCES products(id), created_at TEXT DEFAULT CURRENT_TIMESTAMP);

CREATE TABLE favorites_005 (id INT PRIMARY KEY AUTO_INCREMENT, user_id INT NOT NULL REFERENCES users(id), product_id INT NOT NULL REFERENCES products(id), created_at TEXT DEFAULT CURRENT_TIMESTAMP);

CREATE TABLE inventory (id INT PRIMARY KEY AUTO_INCREMENT, product_id INT NOT NULL REFERENCES products(id), warehouse TEXT, quantity INT DEFAULT 0, reserved INT DEFAULT 0, created_at TEXT DEFAULT CURRENT_TIMESTAMP);

CREATE TABLE inventory_001 (id INT PRIMARY KEY AUTO_INCREMENT, product_id INT NOT NULL REFERENCES products(id), warehouse TEXT, quantity INT DEFAULT 0, reserved INT DEFAULT 0, created_at TEXT DEFAULT CURRENT_TIMESTAMP);

CREATE TABLE inventory_002 (id INT PRIMARY KEY AUTO_INCREMENT, product_id INT NOT NULL REFERENCES products(id), warehouse TEXT, quantity INT DEFAULT 0, reserved INT DEFAULT 0, created_at TEXT DEFAULT CURRENT_TIMESTAMP);

CREATE TABLE inventory_003 (id INT PRIMARY KEY AUTO_INCREMENT, product_id INT NOT NULL REFERENCES products(id), warehouse TEXT, quantity INT DEFAULT 0, reserved INT DEFAULT 0, created_at TEXT DEFAULT CURRENT_TIMESTAMP);

CREATE TABLE inventory_004 (id INT PRIMARY KEY AUTO_INCREMENT, product_id INT NOT NULL REFERENCES products(id), warehouse TEXT, quantity INT DEFAULT 0, reserved INT DEFAULT 0, created_at TEXT DEFAULT CURRENT_TIMESTAMP);

CREATE TABLE inventory_005 (id INT PRIMARY KEY AUTO_INCREMENT, product_id INT NOT NULL REFERENCES products(id), warehouse TEXT, quantity INT DEFAULT 0, reserved INT DEFAULT 0, created_at TEXT DEFAULT CURRENT_TIMESTAMP);

CREATE TABLE logs (id INT PRIMARY KEY AUTO_INCREMENT, user_id INT REFERENCES users(id), action TEXT, target_type TEXT, target_id INT, ip_address TEXT, user_agent TEXT, detail TEXT, created_at TEXT DEFAULT CURRENT_TIMESTAMP);

CREATE TABLE logs_001 (id INT PRIMARY KEY AUTO_INCREMENT, user_id INT REFERENCES users(id), action TEXT, target_type TEXT, target_id INT, ip_address TEXT, user_agent TEXT, detail TEXT, created_at TEXT DEFAULT CURRENT_TIMESTAMP);

CREATE TABLE logs_002 (id INT PRIMARY KEY AUTO_INCREMENT, user_id INT REFERENCES users(id), action TEXT, target_type TEXT, target_id INT, ip_address TEXT, user_agent TEXT, detail TEXT, created_at TEXT DEFAULT CURRENT_TIMESTAMP);

CREATE TABLE logs_003 (id INT PRIMARY KEY AUTO_INCREMENT, user_id INT REFERENCES users(id), action TEXT, target_type TEXT, target_id INT, ip_address TEXT, user_agent TEXT, detail TEXT, created_at TEXT DEFAULT CURRENT_TIMESTAMP);

CREATE TABLE logs_004 (id INT PRIMARY KEY AUTO_INCREMENT, user_id INT REFERENCES users(id), action TEXT, target_type TEXT, target_id INT, ip_address TEXT, user_agent TEXT, detail TEXT, created_at TEXT DEFAULT CURRENT_TIMESTAMP);

CREATE TABLE logs_005 (id INT PRIMARY KEY AUTO_INCREMENT, user_id INT REFERENCES users(id), action TEXT, target_type TEXT, target_id INT, ip_address TEXT, user_agent TEXT, detail TEXT, created_at TEXT DEFAULT CURRENT_TIMESTAMP);

CREATE TABLE logs_006 (id INT PRIMARY KEY AUTO_INCREMENT, user_id INT REFERENCES users(id), action TEXT, target_type TEXT, target_id INT, ip_address TEXT, user_agent TEXT, detail TEXT, created_at TEXT DEFAULT CURRENT_TIMESTAMP);

CREATE TABLE messages (id INT PRIMARY KEY AUTO_INCREMENT, from_user_id INT REFERENCES users(id), to_user_id INT NOT NULL REFERENCES users(id), content TEXT NOT NULL, is_read INT DEFAULT 0, created_at TEXT DEFAULT CURRENT_TIMESTAMP);

CREATE TABLE messages_001 (id INT PRIMARY KEY AUTO_INCREMENT, from_user_id INT REFERENCES users(id), to_user_id INT NOT NULL REFERENCES users(id), content TEXT NOT NULL, is_read INT DEFAULT 0, created_at TEXT DEFAULT CURRENT_TIMESTAMP);

CREATE TABLE messages_002 (id INT PRIMARY KEY AUTO_INCREMENT, from_user_id INT REFERENCES users(id), to_user_id INT NOT NULL REFERENCES users(id), content TEXT NOT NULL, is_read INT DEFAULT 0, created_at TEXT DEFAULT CURRENT_TIMESTAMP);

CREATE TABLE messages_003 (id INT PRIMARY KEY AUTO_INCREMENT, from_user_id INT REFERENCES users(id), to_user_id INT NOT NULL REFERENCES users(id), content TEXT NOT NULL, is_read INT DEFAULT 0, created_at TEXT DEFAULT CURRENT_TIMESTAMP);

CREATE TABLE messages_004 (id INT PRIMARY KEY AUTO_INCREMENT, from_user_id INT REFERENCES users(id), to_user_id INT NOT NULL REFERENCES users(id), content TEXT NOT NULL, is_read INT DEFAULT 0, created_at TEXT DEFAULT CURRENT_TIMESTAMP);

CREATE TABLE messages_005 (id INT PRIMARY KEY AUTO_INCREMENT, from_user_id INT REFERENCES users(id), to_user_id INT NOT NULL REFERENCES users(id), content TEXT NOT NULL, is_read INT DEFAULT 0, created_at TEXT DEFAULT CURRENT_TIMESTAMP);

CREATE TABLE notifications (id INT PRIMARY KEY AUTO_INCREMENT, user_id INT NOT NULL REFERENCES users(id), type TEXT NOT NULL, title TEXT NOT NULL, content TEXT, is_read INT DEFAULT 0, created_at TEXT DEFAULT CURRENT_TIMESTAMP);

CREATE TABLE notifications_001 (id INT PRIMARY KEY AUTO_INCREMENT, user_id INT NOT NULL REFERENCES users(id), type TEXT NOT NULL, title TEXT NOT NULL, content TEXT, is_read INT DEFAULT 0, created_at TEXT DEFAULT CURRENT_TIMESTAMP);

CREATE TABLE notifications_002 (id INT PRIMARY KEY AUTO_INCREMENT, user_id INT NOT NULL REFERENCES users(id), type TEXT NOT NULL, title TEXT NOT NULL, content TEXT, is_read INT DEFAULT 0, created_at TEXT DEFAULT CURRENT_TIMESTAMP);

CREATE TABLE notifications_003 (id INT PRIMARY KEY AUTO_INCREMENT, user_id INT NOT NULL REFERENCES users(id), type TEXT NOT NULL, title TEXT NOT NULL, content TEXT, is_read INT DEFAULT 0, created_at TEXT DEFAULT CURRENT_TIMESTAMP);

CREATE TABLE notifications_004 (id INT PRIMARY KEY AUTO_INCREMENT, user_id INT NOT NULL REFERENCES users(id), type TEXT NOT NULL, title TEXT NOT NULL, content TEXT, is_read INT DEFAULT 0, created_at TEXT DEFAULT CURRENT_TIMESTAMP);

CREATE TABLE notifications_005 (id INT PRIMARY KEY AUTO_INCREMENT, user_id INT NOT NULL REFERENCES users(id), type TEXT NOT NULL, title TEXT NOT NULL, content TEXT, is_read INT DEFAULT 0, created_at TEXT DEFAULT CURRENT_TIMESTAMP);

CREATE TABLE order_items (
            id          INT PRIMARY KEY AUTO_INCREMENT,
            order_id    INT NOT NULL REFERENCES orders(id),
            product_id  INT NOT NULL REFERENCES products(id),
            quantity    INT NOT NULL DEFAULT 1,
            unit_price  DOUBLE NOT NULL
        );

CREATE TABLE orders (
            id              INT PRIMARY KEY AUTO_INCREMENT,
            user_id         INT NOT NULL REFERENCES users(id),
            order_number    TEXT NOT NULL UNIQUE,
            status          TEXT DEFAULT 'pending',
            total_amount    DOUBLE NOT NULL,
            shipping_addr   TEXT,
            payment_method  TEXT,
            paid_at         TEXT,
            shipped_at      TEXT,
            created_at      TEXT DEFAULT CURRENT_TIMESTAMP
        );

CREATE TABLE payments (
            id          INT PRIMARY KEY AUTO_INCREMENT,
            order_id    INT NOT NULL REFERENCES orders(id),
            method      TEXT NOT NULL,
            amount      DOUBLE NOT NULL,
            status      TEXT DEFAULT 'pending',
            paid_at     TEXT,
            trade_no    TEXT
        );

CREATE TABLE product_attributes (id INT PRIMARY KEY AUTO_INCREMENT, product_id INT NOT NULL REFERENCES products(id), attr_name TEXT NOT NULL, attr_value TEXT NOT NULL, sort_order INT DEFAULT 0, created_at TEXT DEFAULT CURRENT_TIMESTAMP);

CREATE TABLE product_attributes_001 (id INT PRIMARY KEY AUTO_INCREMENT, product_id INT NOT NULL REFERENCES products(id), attr_name TEXT NOT NULL, attr_value TEXT NOT NULL, sort_order INT DEFAULT 0, created_at TEXT DEFAULT CURRENT_TIMESTAMP);

CREATE TABLE product_attributes_002 (id INT PRIMARY KEY AUTO_INCREMENT, product_id INT NOT NULL REFERENCES products(id), attr_name TEXT NOT NULL, attr_value TEXT NOT NULL, sort_order INT DEFAULT 0, created_at TEXT DEFAULT CURRENT_TIMESTAMP);

CREATE TABLE product_attributes_003 (id INT PRIMARY KEY AUTO_INCREMENT, product_id INT NOT NULL REFERENCES products(id), attr_name TEXT NOT NULL, attr_value TEXT NOT NULL, sort_order INT DEFAULT 0, created_at TEXT DEFAULT CURRENT_TIMESTAMP);

CREATE TABLE product_attributes_004 (id INT PRIMARY KEY AUTO_INCREMENT, product_id INT NOT NULL REFERENCES products(id), attr_name TEXT NOT NULL, attr_value TEXT NOT NULL, sort_order INT DEFAULT 0, created_at TEXT DEFAULT CURRENT_TIMESTAMP);

CREATE TABLE product_attributes_005 (id INT PRIMARY KEY AUTO_INCREMENT, product_id INT NOT NULL REFERENCES products(id), attr_name TEXT NOT NULL, attr_value TEXT NOT NULL, sort_order INT DEFAULT 0, created_at TEXT DEFAULT CURRENT_TIMESTAMP);

CREATE TABLE product_images (id INT PRIMARY KEY AUTO_INCREMENT, product_id INT NOT NULL REFERENCES products(id), url TEXT NOT NULL, sort_order INT DEFAULT 0, is_primary INT DEFAULT 0, created_at TEXT DEFAULT CURRENT_TIMESTAMP);

CREATE TABLE product_images_001 (id INT PRIMARY KEY AUTO_INCREMENT, product_id INT NOT NULL REFERENCES products(id), url TEXT NOT NULL, sort_order INT DEFAULT 0, is_primary INT DEFAULT 0, created_at TEXT DEFAULT CURRENT_TIMESTAMP);

CREATE TABLE product_images_002 (id INT PRIMARY KEY AUTO_INCREMENT, product_id INT NOT NULL REFERENCES products(id), url TEXT NOT NULL, sort_order INT DEFAULT 0, is_primary INT DEFAULT 0, created_at TEXT DEFAULT CURRENT_TIMESTAMP);

CREATE TABLE product_images_003 (id INT PRIMARY KEY AUTO_INCREMENT, product_id INT NOT NULL REFERENCES products(id), url TEXT NOT NULL, sort_order INT DEFAULT 0, is_primary INT DEFAULT 0, created_at TEXT DEFAULT CURRENT_TIMESTAMP);

CREATE TABLE product_images_004 (id INT PRIMARY KEY AUTO_INCREMENT, product_id INT NOT NULL REFERENCES products(id), url TEXT NOT NULL, sort_order INT DEFAULT 0, is_primary INT DEFAULT 0, created_at TEXT DEFAULT CURRENT_TIMESTAMP);

CREATE TABLE product_images_005 (id INT PRIMARY KEY AUTO_INCREMENT, product_id INT NOT NULL REFERENCES products(id), url TEXT NOT NULL, sort_order INT DEFAULT 0, is_primary INT DEFAULT 0, created_at TEXT DEFAULT CURRENT_TIMESTAMP);

CREATE TABLE product_specs (id INT PRIMARY KEY AUTO_INCREMENT, product_id INT NOT NULL REFERENCES products(id), spec_name TEXT NOT NULL, spec_value TEXT NOT NULL, price_delta DOUBLE DEFAULT 0, created_at TEXT DEFAULT CURRENT_TIMESTAMP);

CREATE TABLE product_specs_001 (id INT PRIMARY KEY AUTO_INCREMENT, product_id INT NOT NULL REFERENCES products(id), spec_name TEXT NOT NULL, spec_value TEXT NOT NULL, price_delta DOUBLE DEFAULT 0, created_at TEXT DEFAULT CURRENT_TIMESTAMP);

CREATE TABLE product_specs_002 (id INT PRIMARY KEY AUTO_INCREMENT, product_id INT NOT NULL REFERENCES products(id), spec_name TEXT NOT NULL, spec_value TEXT NOT NULL, price_delta DOUBLE DEFAULT 0, created_at TEXT DEFAULT CURRENT_TIMESTAMP);

CREATE TABLE product_specs_003 (id INT PRIMARY KEY AUTO_INCREMENT, product_id INT NOT NULL REFERENCES products(id), spec_name TEXT NOT NULL, spec_value TEXT NOT NULL, price_delta DOUBLE DEFAULT 0, created_at TEXT DEFAULT CURRENT_TIMESTAMP);

CREATE TABLE product_specs_004 (id INT PRIMARY KEY AUTO_INCREMENT, product_id INT NOT NULL REFERENCES products(id), spec_name TEXT NOT NULL, spec_value TEXT NOT NULL, price_delta DOUBLE DEFAULT 0, created_at TEXT DEFAULT CURRENT_TIMESTAMP);

CREATE TABLE product_specs_005 (id INT PRIMARY KEY AUTO_INCREMENT, product_id INT NOT NULL REFERENCES products(id), spec_name TEXT NOT NULL, spec_value TEXT NOT NULL, price_delta DOUBLE DEFAULT 0, created_at TEXT DEFAULT CURRENT_TIMESTAMP);

CREATE TABLE products (
            id          INT PRIMARY KEY AUTO_INCREMENT,
            category_id INT NOT NULL REFERENCES categories(id),
            name        TEXT NOT NULL,
            description TEXT,
            price       DOUBLE NOT NULL,
            stock       INT DEFAULT 0,
            sku         TEXT UNIQUE,
            image_url   TEXT,
            weight      DOUBLE,
            is_active   INT DEFAULT 1,
            created_at  TEXT DEFAULT CURRENT_TIMESTAMP
        );

CREATE TABLE reviews (
            id          INT PRIMARY KEY AUTO_INCREMENT,
            user_id     INT NOT NULL REFERENCES users(id),
            product_id  INT NOT NULL REFERENCES products(id),
            rating      INT NOT NULL CHECK(rating BETWEEN 1 AND 5),
            title       TEXT,
            content     TEXT,
            is_verified INT DEFAULT 0,
            created_at  TEXT DEFAULT CURRENT_TIMESTAMP
        );

CREATE TABLE search_history (id INT PRIMARY KEY AUTO_INCREMENT, user_id INT REFERENCES users(id), keyword TEXT NOT NULL, searched_at TEXT DEFAULT CURRENT_TIMESTAMP, created_at TEXT DEFAULT CURRENT_TIMESTAMP);

CREATE TABLE search_history_001 (id INT PRIMARY KEY AUTO_INCREMENT, user_id INT REFERENCES users(id), keyword TEXT NOT NULL, searched_at TEXT DEFAULT CURRENT_TIMESTAMP, created_at TEXT DEFAULT CURRENT_TIMESTAMP);

CREATE TABLE search_history_002 (id INT PRIMARY KEY AUTO_INCREMENT, user_id INT REFERENCES users(id), keyword TEXT NOT NULL, searched_at TEXT DEFAULT CURRENT_TIMESTAMP, created_at TEXT DEFAULT CURRENT_TIMESTAMP);

CREATE TABLE search_history_003 (id INT PRIMARY KEY AUTO_INCREMENT, user_id INT REFERENCES users(id), keyword TEXT NOT NULL, searched_at TEXT DEFAULT CURRENT_TIMESTAMP, created_at TEXT DEFAULT CURRENT_TIMESTAMP);

CREATE TABLE search_history_004 (id INT PRIMARY KEY AUTO_INCREMENT, user_id INT REFERENCES users(id), keyword TEXT NOT NULL, searched_at TEXT DEFAULT CURRENT_TIMESTAMP, created_at TEXT DEFAULT CURRENT_TIMESTAMP);

CREATE TABLE search_history_005 (id INT PRIMARY KEY AUTO_INCREMENT, user_id INT REFERENCES users(id), keyword TEXT NOT NULL, searched_at TEXT DEFAULT CURRENT_TIMESTAMP, created_at TEXT DEFAULT CURRENT_TIMESTAMP);

CREATE TABLE shipping (id INT PRIMARY KEY AUTO_INCREMENT, order_id INT NOT NULL REFERENCES orders(id), company TEXT, tracking_no TEXT, status TEXT DEFAULT 'pending', estimated_at TEXT, delivered_at TEXT, created_at TEXT DEFAULT CURRENT_TIMESTAMP);

CREATE TABLE shipping_001 (id INT PRIMARY KEY AUTO_INCREMENT, order_id INT NOT NULL REFERENCES orders(id), company TEXT, tracking_no TEXT, status TEXT DEFAULT 'pending', estimated_at TEXT, delivered_at TEXT, created_at TEXT DEFAULT CURRENT_TIMESTAMP);

CREATE TABLE shipping_002 (id INT PRIMARY KEY AUTO_INCREMENT, order_id INT NOT NULL REFERENCES orders(id), company TEXT, tracking_no TEXT, status TEXT DEFAULT 'pending', estimated_at TEXT, delivered_at TEXT, created_at TEXT DEFAULT CURRENT_TIMESTAMP);

CREATE TABLE shipping_003 (id INT PRIMARY KEY AUTO_INCREMENT, order_id INT NOT NULL REFERENCES orders(id), company TEXT, tracking_no TEXT, status TEXT DEFAULT 'pending', estimated_at TEXT, delivered_at TEXT, created_at TEXT DEFAULT CURRENT_TIMESTAMP);

CREATE TABLE shipping_004 (id INT PRIMARY KEY AUTO_INCREMENT, order_id INT NOT NULL REFERENCES orders(id), company TEXT, tracking_no TEXT, status TEXT DEFAULT 'pending', estimated_at TEXT, delivered_at TEXT, created_at TEXT DEFAULT CURRENT_TIMESTAMP);

CREATE TABLE shipping_005 (id INT PRIMARY KEY AUTO_INCREMENT, order_id INT NOT NULL REFERENCES orders(id), company TEXT, tracking_no TEXT, status TEXT DEFAULT 'pending', estimated_at TEXT, delivered_at TEXT, created_at TEXT DEFAULT CURRENT_TIMESTAMP);

CREATE TABLE tags (id INT PRIMARY KEY AUTO_INCREMENT, name TEXT NOT NULL, color TEXT, sort_order INT DEFAULT 0, created_at TEXT DEFAULT CURRENT_TIMESTAMP);

CREATE TABLE tags_001 (id INT PRIMARY KEY AUTO_INCREMENT, name TEXT NOT NULL, color TEXT, sort_order INT DEFAULT 0, created_at TEXT DEFAULT CURRENT_TIMESTAMP);

CREATE TABLE tags_002 (id INT PRIMARY KEY AUTO_INCREMENT, name TEXT NOT NULL, color TEXT, sort_order INT DEFAULT 0, created_at TEXT DEFAULT CURRENT_TIMESTAMP);

CREATE TABLE tags_003 (id INT PRIMARY KEY AUTO_INCREMENT, name TEXT NOT NULL, color TEXT, sort_order INT DEFAULT 0, created_at TEXT DEFAULT CURRENT_TIMESTAMP);

CREATE TABLE tags_004 (id INT PRIMARY KEY AUTO_INCREMENT, name TEXT NOT NULL, color TEXT, sort_order INT DEFAULT 0, created_at TEXT DEFAULT CURRENT_TIMESTAMP);

CREATE TABLE tags_005 (id INT PRIMARY KEY AUTO_INCREMENT, name TEXT NOT NULL, color TEXT, sort_order INT DEFAULT 0, created_at TEXT DEFAULT CURRENT_TIMESTAMP);

CREATE TABLE user_coupons (id INT PRIMARY KEY AUTO_INCREMENT, user_id INT NOT NULL REFERENCES users(id), coupon_id INT NOT NULL REFERENCES coupons(id), used_at TEXT, order_id INT REFERENCES orders(id), created_at TEXT DEFAULT CURRENT_TIMESTAMP);

CREATE TABLE user_coupons_001 (id INT PRIMARY KEY AUTO_INCREMENT, user_id INT NOT NULL REFERENCES users(id), coupon_id INT NOT NULL REFERENCES coupons(id), used_at TEXT, order_id INT REFERENCES orders(id), created_at TEXT DEFAULT CURRENT_TIMESTAMP);

CREATE TABLE user_coupons_002 (id INT PRIMARY KEY AUTO_INCREMENT, user_id INT NOT NULL REFERENCES users(id), coupon_id INT NOT NULL REFERENCES coupons(id), used_at TEXT, order_id INT REFERENCES orders(id), created_at TEXT DEFAULT CURRENT_TIMESTAMP);

CREATE TABLE user_coupons_003 (id INT PRIMARY KEY AUTO_INCREMENT, user_id INT NOT NULL REFERENCES users(id), coupon_id INT NOT NULL REFERENCES coupons(id), used_at TEXT, order_id INT REFERENCES orders(id), created_at TEXT DEFAULT CURRENT_TIMESTAMP);

CREATE TABLE user_coupons_004 (id INT PRIMARY KEY AUTO_INCREMENT, user_id INT NOT NULL REFERENCES users(id), coupon_id INT NOT NULL REFERENCES coupons(id), used_at TEXT, order_id INT REFERENCES orders(id), created_at TEXT DEFAULT CURRENT_TIMESTAMP);

CREATE TABLE user_coupons_005 (id INT PRIMARY KEY AUTO_INCREMENT, user_id INT NOT NULL REFERENCES users(id), coupon_id INT NOT NULL REFERENCES coupons(id), used_at TEXT, order_id INT REFERENCES orders(id), created_at TEXT DEFAULT CURRENT_TIMESTAMP);

CREATE TABLE users (
            id          INT PRIMARY KEY AUTO_INCREMENT,
            email       TEXT NOT NULL UNIQUE,
            password    TEXT NOT NULL,
            nickname    TEXT,
            avatar      TEXT,
            phone       TEXT,
            status      INT DEFAULT 1,
            created_at  TEXT DEFAULT CURRENT_TIMESTAMP,
            updated_at  TEXT DEFAULT CURRENT_TIMESTAMP
        );

-- 外键约束关系:
-- addresses.user_id → users.id
-- attachments.user_id → users.id
-- attachments_001.user_id → users.id
-- attachments_002.user_id → users.id
-- attachments_003.user_id → users.id
-- attachments_004.user_id → users.id
-- attachments_005.user_id → users.id
-- carts.product_id → products.id
-- carts.user_id → users.id
-- categories.parent_id → categories.id
-- favorites.product_id → products.id
-- favorites.user_id → users.id
-- favorites_001.product_id → products.id
-- favorites_001.user_id → users.id
-- favorites_002.product_id → products.id
-- favorites_002.user_id → users.id
-- favorites_003.product_id → products.id
-- favorites_003.user_id → users.id
-- favorites_004.product_id → products.id
-- favorites_004.user_id → users.id
-- favorites_005.product_id → products.id
-- favorites_005.user_id → users.id
-- inventory.product_id → products.id
-- inventory_001.product_id → products.id
-- inventory_002.product_id → products.id
-- inventory_003.product_id → products.id
-- inventory_004.product_id → products.id
-- inventory_005.product_id → products.id
-- logs.user_id → users.id
-- logs_001.user_id → users.id
-- logs_002.user_id → users.id
-- logs_003.user_id → users.id
-- logs_004.user_id → users.id
-- logs_005.user_id → users.id
-- logs_006.user_id → users.id
-- messages.to_user_id → users.id
-- messages.from_user_id → users.id
-- messages_001.to_user_id → users.id
-- messages_001.from_user_id → users.id
-- messages_002.to_user_id → users.id
-- messages_002.from_user_id → users.id
-- messages_003.to_user_id → users.id
-- messages_003.from_user_id → users.id
-- messages_004.to_user_id → users.id
-- messages_004.from_user_id → users.id
-- messages_005.to_user_id → users.id
-- messages_005.from_user_id → users.id
-- notifications.user_id → users.id
-- notifications_001.user_id → users.id
-- notifications_002.user_id → users.id
-- notifications_003.user_id → users.id
-- notifications_004.user_id → users.id
-- notifications_005.user_id → users.id
-- order_items.product_id → products.id
-- order_items.order_id → orders.id
-- orders.user_id → users.id
-- payments.order_id → orders.id
-- product_attributes.product_id → products.id
-- product_attributes_001.product_id → products.id
-- product_attributes_002.product_id → products.id
-- product_attributes_003.product_id → products.id
-- product_attributes_004.product_id → products.id
-- product_attributes_005.product_id → products.id
-- product_images.product_id → products.id
-- product_images_001.product_id → products.id
-- product_images_002.product_id → products.id
-- product_images_003.product_id → products.id
-- product_images_004.product_id → products.id
-- product_images_005.product_id → products.id
-- product_specs.product_id → products.id
-- product_specs_001.product_id → products.id
-- product_specs_002.product_id → products.id
-- product_specs_003.product_id → products.id
-- product_specs_004.product_id → products.id
-- product_specs_005.product_id → products.id
-- products.category_id → categories.id
-- reviews.product_id → products.id
-- reviews.user_id → users.id
-- search_history.user_id → users.id
-- search_history_001.user_id → users.id
-- search_history_002.user_id → users.id
-- search_history_003.user_id → users.id
-- search_history_004.user_id → users.id
-- search_history_005.user_id → users.id
-- shipping.order_id → orders.id
-- shipping_001.order_id → orders.id
-- shipping_002.order_id → orders.id
-- shipping_003.order_id → orders.id
-- shipping_004.order_id → orders.id
-- shipping_005.order_id → orders.id
-- user_coupons.order_id → orders.id
-- user_coupons.coupon_id → coupons.id
-- user_coupons.user_id → users.id
-- user_coupons_001.order_id → orders.id
-- user_coupons_001.coupon_id → coupons.id
-- user_coupons_001.user_id → users.id
-- user_coupons_002.order_id → orders.id
-- user_coupons_002.coupon_id → coupons.id
-- user_coupons_002.user_id → users.id
-- user_coupons_003.order_id → orders.id
-- user_coupons_003.coupon_id → coupons.id
-- user_coupons_003.user_id → users.id
-- user_coupons_004.order_id → orders.id
-- user_coupons_004.coupon_id → coupons.id
-- user_coupons_004.user_id → users.id
-- user_coupons_005.order_id → orders.id
-- user_coupons_005.coupon_id → coupons.id
-- user_coupons_005.user_id → users.id
`

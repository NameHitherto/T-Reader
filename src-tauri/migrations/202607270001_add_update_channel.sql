ALTER TABLE app_settings
ADD COLUMN update_channel TEXT NOT NULL DEFAULT 'stable';

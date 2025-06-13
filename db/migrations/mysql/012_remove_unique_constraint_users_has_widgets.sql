-- migrate:up
ALTER TABLE users_has_widgets
DROP INDEX unique_widget_id_per_user;

-- migrate:down
ALTER TABLE users_has_widgets
ADD CONSTRAINT unique_widget_id_per_user UNIQUE (user_id, widget_id);

-- migrate:up
ALTER TABLE widgets
ADD COLUMN default_props JSON NULL;

-- migrate:down
ALTER TABLE widgets
DROP COLUMN default_props;

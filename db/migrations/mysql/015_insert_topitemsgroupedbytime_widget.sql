-- migrate:up
INSERT INTO widgets (name, query, default_props) 
VALUES (
  'TopItemsGroupedByTime2x2', 
  'getTopItemsGroupedByTime', 
  '{"skin": "outline", "timeRange": "week", "item": "projects"}'
);

-- migrate:down
DELETE FROM widgets WHERE name = 'TopItemsGroupedByTime2x2';

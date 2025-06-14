-- migrate:up
UPDATE widgets SET default_props = '{"skin": "outline"}' WHERE name = 'ClockWidget';

UPDATE widgets SET default_props = '{"skin": "outline", "timeRange": "week"}' WHERE name IN (
  'TotalTime',
  'TotalTime1x2',
  'TodaysActivity1x2',
  'MostActiveWeekday',
  'GoalProgressBar1x2',
  'MaxFocusStreak',
  'GoalMosaic1x2'
);

UPDATE widgets SET default_props = '{"skin": "outline", "timeRange": "week", "item": "language"}' WHERE name = 'Top3BarsChart';

-- migrate:down
UPDATE widgets SET default_props = NULL WHERE name IN (
  'ClockWidget',
  'TotalTime',
  'TotalTime1x2',
  'TodaysActivity1x2',
  'MostActiveWeekday',
  'Top3BarsChart',
  'GoalProgressBar1x2',
  'MaxFocusStreak',
  'GoalMosaic1x2'
);

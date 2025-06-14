-- migrate:up
INSERT IGNORE INTO widgets (name, query, default_props) VALUES 
('ClockWidget', NULL, '{"skin": "outline", "timeRange": "week"}'),
('TotalTime', 'getCodingTime', '{"skin": "outline", "timeRange": "week"}'),
('TotalTime1x2', 'getCodingTime', '{"skin": "outline", "timeRange": "week"}'),
('TodaysActivity1x2', 'getPulseStates', '{"skin": "outline", "timeRange": "week"}'),
('MostActiveWeekday', 'getMostActiveWeekday', '{"skin": "outline", "timeRange": "week"}'),
('Top3BarsChart', 'getTopItems', '{"skin": "outline", "timeRange": "week", "item": "language"}'),
('GoalProgressBar1x2', 'getGoalProgress', '{"skin": "outline", "timeRange": "week"}'),
('MaxFocusStreak', 'getMaxFocusStreak', '{"skin": "outline", "timeRange": "week"}'),
('GoalMosaic1x2', 'getGoalMosaic', '{"skin": "outline", "timeRange": "week"}');

-- migrate:down
DELETE FROM widgets WHERE name IN (
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

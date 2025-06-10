-- migrate:up
INSERT IGNORE INTO widgets (name, query) VALUES 
('ClockWidget', NULL),
('TotalTime', 'getCodingTime'),
('TotalTime1x2', 'getCodingTime'),
('TodaysActivity1x2', 'getPulseStates'),
('MostActiveWeekday', 'getMostActiveWeekday'),
('Top3BarsChart', 'getTopItems'),
('GoalProgressBar1x2', 'getGoalProgress'),
('MaxFocusStreak', 'getMaxFocusStreak'),
('GoalMosaic1x2', 'getGoalMosaic');

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

-- Large-map Exploration ocean travel: keep deep ocean dangerous, but reduce the
-- baseline attrition. 

UPDATE GlobalParameters
SET Value = '8'
WHERE Name = 'PLOT_WATER_DAMAGE_BASE';

UPDATE GlobalParameters
SET Value = '6'
WHERE Name = 'PLOT_WATER_DAMAGE_RAND';

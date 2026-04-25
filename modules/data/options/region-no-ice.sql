-- Disable Ice placement for cropped map section
UPDATE Features
SET PlacementClass = 'OPEN_WATERS'
WHERE FeatureType = 'FEATURE_ICE';
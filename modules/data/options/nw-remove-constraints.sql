-- nw-remove-constraints.sql
-- Loaded only when "Natural Wonders Placement on TSL Maps" is set to "Real World Only".
-- Removes adjacency and elevation placement requirements from all Natural Wonders so that
-- real-world coordinate placement has the best chance of succeeding.
--
-- Tags kept (functional, not placement constraints):
--   WATERFALL, VOLCANO, IN_LAKE, FEATURE_REEF, FEATURE_FOREST

DELETE FROM TypeTags
WHERE Type IN (
    SELECT FeatureType FROM Feature_NaturalWonders
    WHERE FeatureType NOT IN (SELECT FeatureType FROM NaturalWonderPosition WHERE PreservePlacementRule = 1)
)
  AND Tag IN (
    'ADJACENTMOUNTAIN',
    'NOTADJACENTMOUNTAIN',
    'NOTADJACENTTORIVER',
    'ADJACENTTOSAMEBIOME',
    'NOTNEARCOAST',
    'NEARCOAST',
    'ADJACENTTOLAND',
    'ADJACENTTOCOAST',
    'NOTADJACENTTOLAND',
    'ADJACENTCLIFF',
    'NOLANDOPPOSITECLIFF',
    'ADJACENTTOSAMETERRAIN',
    'NOTADJACENTTOICE',
    'SHALLOWWATER',
    'SIMALARELEVATION'
);

-- Remove elevation range restrictions from all Natural Wonders (e.g. Grand Canyon MinimumElevation=350)
UPDATE Features
SET MinimumElevation = 0,
    MaximumElevation = 0
WHERE FeatureType IN (SELECT FeatureType FROM Feature_NaturalWonders);

-- Allow Natural Wonders to be placed adjacent to rivers
UPDATE Feature_NaturalWonders
SET NoRiver = 0;

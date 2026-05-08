-- Remove base-game civilization unlock paths when YnAMP geographic unlock mode
-- is active. The YnAMP runtime will provide the available civilization set.

DELETE FROM UnlockRequirements
WHERE UnlockType LIKE 'UNLOCK_CIVILIZATION_%';

-- Also remove base civilization reward rows so the default reward surfaces do not
-- continue to enumerate vanilla civilization unlock entries.
DELETE FROM UnlockRewards
WHERE UnlockType LIKE 'UNLOCK_CIVILIZATION_%';

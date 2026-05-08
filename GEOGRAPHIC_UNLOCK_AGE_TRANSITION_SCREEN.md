# YnAMP Geographic Unlock (by custom age transition screen)

Design notes for geography-driven civilization unlocks on Earth TSL maps, using the custom Age Transition Screen.

## Plan (draft)

### Done
- config option - done
- tracking locking/unlocking - done
- age transition screen filtering the unlocked civs for geographic unlock - done
- human player popup notifications now use a YnAMP-owned queue manager and screen that mirror the base reward popup pattern without patching the base unlock manager; popup text reuses the same localized geographic weight wording as the age-transition panel
- the former add mode is now exposed as shared mode (`YNAMP_GEOGRAPHIC_UNLOCK_SHARED`) in config, runtime parsing, and localization
- popup lower panels are now hero-specific unlocker summaries: shared mode shows `Unlocked by` with all active unlockers, while strict mode shows `Unlocked by` for the leader and `Competing with` for the remaining contributors
- added a new lense that shows the unlocking area of all the next era civs
- strict mode where the civ with the higher wheight leads the unlock display, and a shared mode where multiple civs can unlock the same next civ
- when YnAMPGeographicUnlockModes is "Enabled", an option sql file is activated, that removes all civilization unlock from the base game reward events (and maybe leaders/civilization) to prevent false notification of unlock

### To Do

- edit the unlock UI screen in game
- add MP compatibility
- implement the code for those entries in the StartPosition table: 
		Leader TEXT,
		DisabledByCivilization TEXT,
		DisabledByLeader TEXT,
		AlternateStart BOOLEAN, -- changed to boolean for civ7
    to mirror the civ6 mod behavior for those, and add
		UnlockRadius INT,
		UnlockIgnoreCoast BOOLEAN,
		UnlockDisabled BOOLEAN,
    for geographical unlocks features
    
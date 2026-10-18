# Pokédex Catalogue

A public, read-only reference site for Pokémon universe data. Visitors browse without signing in.

## Language

**Visitor**:
Anyone using the catalogue. There is no account, registration, or signed-in state.
_Avoid_: User, member, account

**Catalogue**:
The whole site: browsable reference content sourced from external Pokémon data, presented in French.
_Avoid_: App, platform, database

**Game**:
A released Pokémon title in the dataset. A game acts as a **hub**: opening one filters which Pokémon, items, and locations are shown for that version.
_Avoid_: Version (use only when referring to edition pairs), title

**Pokémon**:
A species entry in the catalogue (stats, types, evolutions, etc. as exposed by the data source).
_Avoid_: Pokemon (missing accent), pokemons

**Item**:
A usable or holdable object in the games (balls, medicine, key items, etc.) as represented in the dataset.
_Avoid_: Object, product

**Region**:
A large geographic area in the Pokémon world (e.g. Kanto). Regions group **locations** for hierarchical browsing.
_Avoid_: Zone, world

**Location**:
A specific place within a region (route, city, dungeon, etc.). Location pages may show which Pokémon can appear there when the data allows.
_Avoid_: Area, map point, place

**Section**:
One of the four top-level areas of the main menu: Games, Pokémon, Items, Locations.
_Avoid_: Module, tab, category

**List view**:
A paginated browse screen for one kind of entity (or a filtered subset from a **Game** hub). Entries appear as a **grid of tiles** (cards), each showing only the v1 field set, so the first version stays fast to scan.
_Avoid_: Index page, data table

**Detail view**:
The full reference page for a single entity, including related data (moves, encounters, evolutions, etc.) when the source provides it.
_Avoid_: Profile, show page

**Search**:
Global lookup from the navbar across games, Pokémon, items, and locations by French name (and official identifiers where needed).
_Avoid_: Filter, query box

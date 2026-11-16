export { MIGRATED_TIMESTAMP, isRecord, migrate } from "./migrate";
export {
  deserializeMatch,
  loadMatch,
  saveMatch,
  serializeMatch,
} from "./matchSave";
export { ProfileRepository } from "./profile";
export type {
  CollectionEntry,
  DeckList,
  MatchResult,
  PlayerProfile,
  PlayerStats,
} from "./profile";
export { LocalStorageAdapter, MemoryStorageAdapter, tryCreateLocalStorageAdapter } from "./storage";
export { SAVE_VERSION, persistFail, persistOk } from "./types";
export type { PersistResult, PersistenceError, PersistenceErrorCode, StorageAdapter } from "./types";

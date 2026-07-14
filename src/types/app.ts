export type LibrarySort = "recent" | "title" | "progress";

export type LibrarySection = "active" | "archived" | "trash";

export type LibraryMode = "local" | "cloud";

export type CloudSyncState =
  | "idle"
  | "loading"
  | "offline"
  | "pending"
  | "syncing"
  | "synced"
  | "error";

export type CloudConnectionStatus =
  | "online"
  | "offline"
  | "syncing"
  | "pending";

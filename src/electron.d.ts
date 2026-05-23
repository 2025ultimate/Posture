// Type declarations for the API exposed by electron/preload.ts
interface Window {
  electronAPI?: {
    platform: NodeJS.Platform;
    isElectron: boolean;
  };
}

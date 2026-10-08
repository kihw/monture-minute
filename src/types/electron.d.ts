export interface ElectronAPI {
  store: {
    get: (key: string) => Promise<unknown>;
    set: (key: string, value: unknown) => Promise<void>;
    getAll: () => Promise<Record<string, unknown>>;
    export: () => Promise<Record<string, unknown>>;
    import: (data: Record<string, unknown>) => Promise<void>;
  };
  notification: {
    show: (title: string, body: string) => Promise<void>;
  };
  shell: {
    openExternal: (url: string) => Promise<void>;
  };
  window: {
    setAlwaysOnTop: (value: boolean) => Promise<void>;
    isAlwaysOnTop: () => Promise<boolean>;
    minimize: () => Promise<void>;
    hide: () => Promise<void>;
    close: () => Promise<void>;
  };
  onStoreChanged: (callback: (key: string, value: unknown) => void) => void;
}

declare global {
  interface Window {
    /** Absent hors Electron : Android et le navigateur n'exposent rien. */
    electronAPI?: ElectronAPI;
  }
}

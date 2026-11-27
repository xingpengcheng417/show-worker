import { tauriStorageAdapter, tauriWindowControls } from './tauriAdapter';
import { webStorageAdapter, webWindowControls } from './webAdapter';

export const isTauriRuntime =
  typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;

export const storageAdapter = isTauriRuntime ? tauriStorageAdapter : webStorageAdapter;
export const windowControls = isTauriRuntime ? tauriWindowControls : webWindowControls;

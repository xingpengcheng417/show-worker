import { getVersion } from '@tauri-apps/api/app';
import { relaunch } from '@tauri-apps/plugin-process';
import { check, type DownloadEvent, type Update } from '@tauri-apps/plugin-updater';
import type { UpdateInfo, UpdateProgress } from '@/core/models';
import { isTauriRuntime } from '@/services/platform';

export type UpdateCheckResult =
  | { status: 'unsupported' }
  | { status: 'up-to-date' }
  | { status: 'available'; info: UpdateInfo; handle: Update };

export function calcDownloadPercent(downloaded: number, total?: number): number {
  if (!total || total <= 0) {
    return 0;
  }
  return Math.min(100, Math.max(0, Math.round((downloaded / total) * 100)));
}

export function shouldPromptUpdate(
  newVersion: string,
  skippedVersion?: string,
): boolean {
  if (!newVersion) {
    return false;
  }
  return skippedVersion !== newVersion;
}

export async function getAppVersion(): Promise<string> {
  if (!isTauriRuntime) {
    return '0.1.0';
  }
  try {
    return await getVersion();
  } catch {
    return '0.1.0';
  }
}

export async function checkAppUpdate(): Promise<UpdateCheckResult> {
  if (!isTauriRuntime) {
    return { status: 'unsupported' };
  }

  const update = await check();
  if (!update) {
    return { status: 'up-to-date' };
  }

  return {
    status: 'available',
    info: {
      version: update.version,
      currentVersion: update.currentVersion,
      date: update.date,
      body: update.body,
    },
    handle: update,
  };
}

export async function installAppUpdate(
  updateHandle: Update,
  onProgress: (progress: UpdateProgress) => void,
): Promise<void> {
  let contentLength: number | undefined;
  let downloaded = 0;

  await updateHandle.downloadAndInstall((event: DownloadEvent) => {
    if (event.event === 'Started') {
      contentLength = event.data.contentLength;
      downloaded = 0;
      onProgress({
        downloadedBytes: 0,
        totalBytes: contentLength,
        percent: 0,
      });
    } else if (event.event === 'Progress') {
      downloaded += event.data.chunkLength;
      onProgress({
        downloadedBytes: downloaded,
        totalBytes: contentLength,
        percent: calcDownloadPercent(downloaded, contentLength),
      });
    } else if (event.event === 'Finished') {
      onProgress({
        downloadedBytes: contentLength ?? downloaded,
        totalBytes: contentLength,
        percent: 100,
      });
    }
  });

  await relaunch();
}

import { getVersion } from '@tauri-apps/api/app';
import { invoke } from '@tauri-apps/api/core';
import { relaunch } from '@tauri-apps/plugin-process';
import { check, type DownloadEvent, type Update } from '@tauri-apps/plugin-updater';
import type { UpdateInfo, UpdateProgress } from '@/core/models';
import { isTauriRuntime } from '@/services/platform';

interface GithubReleasePayload {
  version: string;
  tagName: string;
  date?: string;
  body?: string;
  releaseUrl: string;
  downloadUrl: string;
}

export type UpdateCheckResult =
  | { status: 'unsupported' }
  | { status: 'up-to-date' }
  | { status: 'available'; info: UpdateInfo; handle: Update | null };

interface ParsedSemver {
  nums: [number, number, number];
  pre: string;
}

function parseSemver(raw: string): ParsedSemver {
  const cleaned = raw.trim().replace(/^v/i, '');
  const [corePart, ...preParts] = cleaned.split('-');
  const segments = corePart.split('.').map((part) => {
    const m = /^(\d+)/.exec(part.trim());
    return m ? Number.parseInt(m[1], 10) : 0;
  });
  return {
    nums: [segments[0] ?? 0, segments[1] ?? 0, segments[2] ?? 0],
    pre: preParts.join('-').trim(),
  };
}

export function compareSemver(a: string, b: string): number {
  const pa = parseSemver(a);
  const pb = parseSemver(b);
  for (let i = 0; i < 3; i += 1) {
    if (pa.nums[i] > pb.nums[i]) return 1;
    if (pa.nums[i] < pb.nums[i]) return -1;
  }
  if (!pa.pre && pb.pre) return 1;
  if (pa.pre && !pb.pre) return -1;
  if (pa.pre === pb.pre) return 0;
  return pa.pre > pb.pre ? 1 : -1;
}

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

  try {
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
        installMode: 'native',
      },
      handle: update,
    };
  } catch {
    try {
      const [release, currentVersion] = await Promise.all([
        invoke<GithubReleasePayload | null>('check_github_latest_release'),
        getAppVersion(),
      ]);
      if (!release || compareSemver(release.version, currentVersion) <= 0) {
        return { status: 'up-to-date' };
      }
      return {
        status: 'available',
        info: {
          version: release.version,
          currentVersion,
          date: release.date,
          body: release.body,
          installMode: 'external',
          downloadUrl: release.downloadUrl,
          releaseUrl: release.releaseUrl,
        },
        handle: null,
      };
    } catch (fallbackErr) {
      const detail =
        fallbackErr instanceof Error ? fallbackErr.message : String(fallbackErr);
      throw new Error(`无法连接 GitHub 检测更新，请检查网络或代理设置（${detail}）`);
    }
  }
}

export async function openExternalUpdateUrl(url: string): Promise<void> {
  await invoke('open_external_url', { url });
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

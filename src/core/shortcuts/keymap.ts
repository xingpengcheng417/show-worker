import type { PlatformKind } from '@/core/models';

export function detectPlatform(): PlatformKind {
  if (typeof navigator === 'undefined') {
    return 'web';
  }
  const ua = navigator.userAgent.toLowerCase();
  const maxTouch = navigator.maxTouchPoints ?? 0;

  if (ua.includes('iphone') || ua.includes('ipod')) {
    return 'ios';
  }
  if (ua.includes('ipad') || (ua.includes('macintosh') && maxTouch > 1)) {
    return 'ipados';
  }
  if (ua.includes('mac os x') || ua.includes('macintosh')) {
    return 'macos';
  }
  if (ua.includes('windows')) {
    return 'windows';
  }
  return 'web';
}

export function isApplePlatform(platform: PlatformKind): boolean {
  return platform === 'macos' || platform === 'ipados' || platform === 'ios';
}

export function isModKey(
  event: Pick<KeyboardEvent, 'metaKey' | 'ctrlKey'>,
  platform: PlatformKind,
): boolean {
  if (isApplePlatform(platform)) {
    return event.metaKey || event.ctrlKey;
  }
  return event.ctrlKey;
}

/**
 * 将平台无关的快捷键描述（如 "Mod+/"、"Mod+Shift+F"）转换为对应平台显示文案。
 */
export function formatShortcut(combo: string, platform: PlatformKind): string {
  const apple = isApplePlatform(platform);
  return combo
    .replace(/Mod/g, apple ? '⌘' : 'Ctrl')
    .replace(/Alt/g, apple ? '⌥' : 'Alt')
    .replace(/Shift/g, apple ? '⇧' : 'Shift');
}

import { describe, expect, it } from 'vitest';
import {
  calcDownloadPercent,
  checkAppUpdate,
  shouldPromptUpdate,
} from '@/services/updater/updateService';

describe('自动更新辅助逻辑', () => {
  it('正确计算下载进度百分比并限制在 0~100', () => {
    expect(calcDownloadPercent(0, undefined)).toBe(0);
    expect(calcDownloadPercent(50, 0)).toBe(0);
    expect(calcDownloadPercent(256, 1024)).toBe(25);
    expect(calcDownloadPercent(1500, 1024)).toBe(100);
  });

  it('跳过指定版本时不再弹窗提醒，新版本出现后恢复提醒', () => {
    expect(shouldPromptUpdate('0.2.0', undefined)).toBe(true);
    expect(shouldPromptUpdate('0.2.0', '0.2.0')).toBe(false);
    expect(shouldPromptUpdate('0.2.1', '0.2.0')).toBe(true);
  });

  it('非 Tauri 浏览器环境下优雅返回 unsupported', async () => {
    const res = await checkAppUpdate();
    expect(res).toEqual({ status: 'unsupported' });
  });
});

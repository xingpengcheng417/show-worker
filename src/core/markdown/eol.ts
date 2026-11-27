import type { LineEnding } from '@/core/models';

/**
 * 检测文本主要换行符类型，仅新建空文件默认使用 LF。
 */
export function detectLineEnding(raw: string): LineEnding {
  const crlfMatches = raw.match(/\r\n/g);
  const crlfCount = crlfMatches ? crlfMatches.length : 0;
  if (crlfCount === 0) {
    return 'LF';
  }
  const lfOnlyCount = raw.replace(/\r\n/g, '').match(/\n/g)?.length ?? 0;
  return crlfCount >= lfOnlyCount ? 'CRLF' : 'LF';
}

/**
 * 统一转换为 LF 供编辑器内核内部处理。
 */
export function normalizeToLf(raw: string): string {
  return raw.replace(/\r\n/g, '\n');
}

/**
 * 在写回磁盘时按原文件或用户指定换行符恢复。
 */
export function applyLineEnding(content: string, eol: LineEnding): string {
  const lf = normalizeToLf(content);
  return eol === 'CRLF' ? lf.replace(/\n/g, '\r\n') : lf;
}

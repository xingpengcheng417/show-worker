import type { LineEnding } from '@/core/models';
import { applyLineEnding, normalizeToLf } from './eol';

export interface ExtractedFrontmatter {
  frontmatterRaw?: string;
  body: string;
}

/**
 * 剥离文档首部的 YAML Frontmatter（`--- ... ---`），保留原文缩进与注释，
 * 避免编辑器往返序列化破坏元数据格式。
 */
export function extractFrontmatter(raw: string): ExtractedFrontmatter {
  const normalized = normalizeToLf(raw);
  const match = normalized.match(/^---\n([\s\S]*?)\n---(?:\n+([\s\S]*))?$/);
  if (!match) {
    return {
      frontmatterRaw: undefined,
      body: normalized,
    };
  }

  return {
    frontmatterRaw: match[1],
    body: match[2] ?? '',
  };
}

/**
 * 将保留的 YAML Frontmatter 与正文无损拼接，并恢复目标换行符。
 */
export function combineFrontmatter(
  frontmatterRaw: string | undefined,
  body: string,
  eol: LineEnding,
): string {
  const normalizedBody = normalizeToLf(body);
  if (frontmatterRaw === undefined) {
    return applyLineEnding(normalizedBody, eol);
  }

  const trimmedFm = normalizeToLf(frontmatterRaw).replace(/\n+$/, '');
  const joined = normalizedBody.length > 0
    ? `---\n${trimmedFm}\n---\n\n${normalizedBody.replace(/^\n+/, '')}`
    : `---\n${trimmedFm}\n---\n`;

  return applyLineEnding(joined, eol);
}

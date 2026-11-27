import type { DocumentStats, OutlineNode, RichBlockItem } from '@/core/models';
import { normalizeToLf } from './eol';

/**
 * 从 Markdown 正文提取标题大纲，自动忽略围栏代码块内的 `#` 注释行。
 */
export function extractOutline(markdown: string): OutlineNode[] {
  const lines = normalizeToLf(markdown).split('\n');
  const nodes: OutlineNode[] = [];
  let inFence = false;
  let fenceMarker = '';
  let charOffset = 0;

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    const fenceMatch = line.match(/^\s*(`{3,}|~{3,})/);
    if (fenceMatch) {
      const marker = fenceMatch[1][0];
      if (!inFence) {
        inFence = true;
        fenceMarker = marker;
      } else if (marker === fenceMarker) {
        inFence = false;
        fenceMarker = '';
      }
      charOffset += line.length + 1;
      continue;
    }

    if (!inFence) {
      const headingMatch = line.match(/^(#{1,6})\s+(.+?)\s*#*$/);
      if (headingMatch) {
        const level = headingMatch[1].length as OutlineNode['level'];
        const text = headingMatch[2].trim();
        const slug = text
          .toLowerCase()
          .replace(/[^\w\u4e00-\u9fa5\s-]/g, '')
          .trim()
          .replace(/\s+/g, '-');
        nodes.push({
          id: `toc-${i + 1}-${slug || 'heading'}`,
          level,
          text,
          slug: slug || `heading-${i + 1}`,
          pos: charOffset,
          line: i + 1,
        });
      }
    }

    charOffset += line.length + 1;
  }

  return nodes;
}

/**
 * 统计字符数、词数（兼容中英文混排）、行数及预估阅读时长。
 */
export function computeDocumentStats(markdown: string): DocumentStats {
  const normalized = normalizeToLf(markdown);
  const lines = normalized === '' ? 1 : normalized.split('\n').length;
  const chars = normalized.replace(/\s+/g, '').length;
  const cjkCount = (normalized.match(/[\u4e00-\u9fff]/g) ?? []).length;
  const latinWords = (
    normalized.replace(/[\u4e00-\u9fff]/g, ' ').match(/[A-Za-z0-9_'-]+/g) ?? []
  ).length;
  const words = cjkCount + latinWords;
  const readingMinutes = Math.max(1, Math.ceil(words / 300));

  return {
    chars,
    words,
    lines,
    readingMinutes,
  };
}

/**
 * 统一将相对路径格式化为 POSIX 正斜杠格式，确保 Windows 与 Apple 平台互通。
 */
export function formatPosixRelativePath(
  relativePath: string,
  encodeWhitespace = false,
): string {
  const posix = relativePath.replace(/\\/g, '/').replace(/\/+/g, '/');
  return encodeWhitespace ? posix.replace(/ /g, '%20') : posix;
}

/**
 * 提取文档中的块级数学公式 (`$$...$$`) 与 Mermaid 图表块，供即时富媒体卡片渲染。
 */
export function extractRichBlocks(markdown: string): RichBlockItem[] {
  const lines = normalizeToLf(markdown).split('\n');
  const items: RichBlockItem[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i].trim();

    if (line === '$$') {
      const startLine = i + 1;
      const buf: string[] = [];
      i += 1;
      while (i < lines.length && lines[i].trim() !== '$$') {
        buf.push(lines[i]);
        i += 1;
      }
      const source = buf.join('\n').trim();
      if (source) {
        items.push({
          id: `math-${startLine}`,
          kind: 'math',
          source,
          line: startLine,
        });
      }
      i += 1;
      continue;
    }

    if (line.startsWith('```mermaid')) {
      const startLine = i + 1;
      const buf: string[] = [];
      i += 1;
      while (i < lines.length && !lines[i].trim().startsWith('```')) {
        buf.push(lines[i]);
        i += 1;
      }
      const source = buf.join('\n').trim();
      if (source) {
        items.push({
          id: `mermaid-${startLine}`,
          kind: 'mermaid',
          source,
          line: startLine,
        });
      }
      i += 1;
      continue;
    }

    i += 1;
  }

  return items;
}

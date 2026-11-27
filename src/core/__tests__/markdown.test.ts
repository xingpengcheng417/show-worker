import { describe, expect, it } from 'vitest';
import { applyLineEnding, detectLineEnding, normalizeToLf } from '@/core/markdown/eol';
import { combineFrontmatter, extractFrontmatter } from '@/core/markdown/frontmatter';
import {
  computeDocumentStats,
  extractOutline,
  extractRichBlocks,
  formatPosixRelativePath,
} from '@/core/markdown/outline';
import { formatShortcut, isApplePlatform } from '@/core/shortcuts/keymap';

describe('EOL 换行符检测与保真', () => {
  it('能正确识别 LF 与 CRLF 并原样还原', () => {
    expect(detectLineEnding('line1\nline2\n')).toBe('LF');
    expect(detectLineEnding('line1\r\nline2\r\n')).toBe('CRLF');
    expect(normalizeToLf('a\r\nb')).toBe('a\nb');
    expect(applyLineEnding('a\nb', 'CRLF')).toBe('a\r\nb');
    expect(applyLineEnding('a\r\nb', 'LF')).toBe('a\nb');
  });
});

describe('YAML Frontmatter 无损往返', () => {
  it('剥离并原样保留缩进和注释，保存时恢复目标换行符', () => {
    const raw = '---\r\ntitle: 测试文档\r\ntags:\r\n  - md\r\n---\r\n\r\n# 正文标题\r\n内容';
    const { frontmatterRaw, body } = extractFrontmatter(raw);
    expect(frontmatterRaw).toBe('title: 测试文档\ntags:\n  - md');
    expect(body).toBe('# 正文标题\n内容');

    const rebuilt = combineFrontmatter(frontmatterRaw, body, 'CRLF');
    expect(rebuilt).toBe(raw);
  });

  it('无 Frontmatter 时原样透传正文', () => {
    const raw = '# 仅标题\n段落';
    const { frontmatterRaw, body } = extractFrontmatter(raw);
    expect(frontmatterRaw).toBeUndefined();
    expect(combineFrontmatter(frontmatterRaw, body, 'LF')).toBe(raw);
  });
});

describe('大纲提取、富文本块与 POSIX 路径', () => {
  it('提取标题时自动忽略围栏代码块中的 # 注释', () => {
    const md = [
      '# 一级标题',
      '```bash',
      '# 这不是标题',
      'echo ok',
      '```',
      '## 二级标题',
      '### 三级标题',
    ].join('\n');

    const outline = extractOutline(md);
    expect(outline.map((o) => `${o.level}:${o.text}:${o.line}`)).toEqual([
      '1:一级标题:1',
      '2:二级标题:6',
      '3:三级标题:7',
    ]);
  });

  it('提取数学公式块与 Mermaid 块', () => {
    const md = '$$\nE = mc^2\n$$\n\n```mermaid\nflowchart LR\n  A --> B\n```';
    const blocks = extractRichBlocks(md);
    expect(blocks).toHaveLength(2);
    expect(blocks[0]).toMatchObject({ kind: 'math', source: 'E = mc^2' });
    expect(blocks[1]).toMatchObject({ kind: 'mermaid' });
  });

  it('统计中英文混排词数并标准化 POSIX 路径', () => {
    const stats = computeDocumentStats('你好 ShowWorker 世界');
    expect(stats.words).toBe(5);
    expect(formatPosixRelativePath('.\\assets\\my img.png', true)).toBe(
      './assets/my%20img.png',
    );
  });
});

describe('跨平台快捷键映射', () => {
  it('区分 Apple 与 Windows 修饰键文案', () => {
    expect(isApplePlatform('macos')).toBe(true);
    expect(isApplePlatform('windows')).toBe(false);
    expect(formatShortcut('Mod+Shift+F', 'macos')).toBe('⌘+⇧+F');
    expect(formatShortcut('Mod+/', 'windows')).toBe('Ctrl+/');
  });
});

import fs from 'node:fs';
import path from 'node:path';
import { Marked } from 'marked';

export interface GuideSection {
  id: string;
  title: string;
}

const slug = (s: string) =>
  s.toLowerCase().replace(/<[^>]+>/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

/** Wide tables scroll inside their own box on small screens. */
const wrapTables = (html: string) =>
  html.replace(/<table>/g, '<div class="table-wrap"><table>').replace(/<\/table>/g, '</table></div>');

/**
 * Renders content/integration-guide.md at build time. The guide is our own
 * content, so its HTML is trusted. `<!-- pipelines -->` marks where the
 * pipeline diagram (a React component) goes.
 */
export function loadGuide() {
  const md = fs.readFileSync(path.join(process.cwd(), 'content', 'integration-guide.md'), 'utf8');
  const toc: GuideSection[] = [];
  const marked = new Marked({
    gfm: true,
    renderer: {
      heading({ tokens, depth, text }) {
        const id = slug(text);
        if (depth === 2) toc.push({ id, title: text });
        return `<h${depth} id="${id}">${this.parser.parseInline(tokens)}</h${depth}>\n`;
      },
      link({ href, title, tokens }) {
        const inner = this.parser.parseInline(tokens);
        const external = /^https?:\/\//.test(href);
        return `<a href="${href}"${title ? ` title="${title}"` : ''}${external ? ' target="_blank" rel="noreferrer"' : ''}>${inner}</a>`;
      },
    },
  });
  const [before, after = ''] = md.split('<!-- pipelines -->');
  return {
    before: wrapTables(marked.parse(before) as string),
    after: wrapTables(marked.parse(after) as string),
    toc,
  };
}

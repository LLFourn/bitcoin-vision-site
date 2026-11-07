import type { Metadata } from 'next';
import SiteHeader from '@/components/SiteHeader';
import PipelineDiagram from '@/components/PipelineDiagram';
import { SiteFooter } from '@/components/Sections';
import { loadGuide } from '@/lib/guide';

export const metadata: Metadata = {
  title: 'Integration guide · bitcoin-vision',
  description:
    'How to add bitcoin-vision to a hardware or mobile wallet: the Rust API, both pipelines, the review flow users need, and a security checklist.',
};

export default function DocsPage() {
  const guide = loadGuide();
  return (
    <>
      <SiteHeader />
      <div className="frame">
        <main className="docs">
          <aside className="docs-toc">
            <nav aria-label="On this page">
              <p className="kicker">On this page</p>
              <ol>
                {guide.toc.map((s) => (
                  <li key={s.id}><a href={`#${s.id}`}>{s.title}</a></li>
                ))}
              </ol>
            </nav>
          </aside>
          <article className="docs-body">
            <p className="kicker">Docs · Integration guide</p>
            <h1 className="h1 docs-title">Integration guide</h1>
            <p className="lead">
              How to add bitcoin-vision to a hardware or mobile wallet: the Rust API, both pipelines, the review flow
              your users need, and a security checklist.
            </p>
            <p className="docs-updated">Updated 7 November 2026</p>
            <div className="prose" dangerouslySetInnerHTML={{ __html: guide.before }} />
            <PipelineDiagram />
            <div className="prose" dangerouslySetInnerHTML={{ __html: guide.after }} />
          </article>
        </main>
        <SiteFooter />
      </div>
    </>
  );
}

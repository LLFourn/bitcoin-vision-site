import SiteHeader from '@/components/SiteHeader';
import Playground from '@/components/playground/Playground';
import Integrate from '@/components/Integrate';
import { Hardware, Hero, HowItReads, Limits, ModelCard, SiteFooter } from '@/components/Sections';

export default function Home() {
  return (
    <>
      <SiteHeader />
      <div className="frame">
        <main>
          <Hero />
          <Playground />
          <ModelCard />
          <HowItReads />
          <Integrate />
          <Hardware />
          <Limits />
        </main>
        <SiteFooter />
      </div>
    </>
  );
}

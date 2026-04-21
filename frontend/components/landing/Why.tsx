import { SectionHead } from './SectionHead';
import { VALUE_POINTS, type ValuePoint } from './data';
import { WhyValueIcon } from './icons';
import { cx } from './cx';
import { useRevealOnVisible } from './useRevealOnVisible';

export function Why() {
  const { ref, visible } = useRevealOnVisible<HTMLElement>();

  return (
    <section
      ref={ref}
      id="why"
      className={cx('pb-section pb-why pb-reveal', visible && 'pb-reveal--visible')}
      aria-labelledby="why-title"
    >
      <SectionHead
        eyebrow="Why PolyBuys"
        title="A calmer way to trade with classmates."
        titleId="why-title"
      />
      <div className="pb-why__grid">
        {VALUE_POINTS.map((item) => (
          <ValueCard key={item.title} item={item} />
        ))}
      </div>
    </section>
  );
}

function ValueCard({ item }: { item: ValuePoint }) {
  return (
    <div className="pb-why__card">
      <div className="pb-why__icon" aria-hidden>
        <WhyValueIcon id={item.icon} size={24} />
      </div>
      <h3 className="pb-why__title">{item.title}</h3>
      <p className="pb-why__body">{item.body}</p>
    </div>
  );
}

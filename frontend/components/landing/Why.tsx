import { SectionHead } from './SectionHead';
import { VALUE_POINTS, type ValuePoint } from './data';

export function Why() {
  return (
    <section id="why" className="pb-section pb-why" aria-labelledby="why-title">
      <SectionHead
        eyebrow="Why PolyBuys"
        title="A calmer way to trade with classmates."
        titleId="why-title"
      />
      <div className="pb-why__grid">
        {VALUE_POINTS.map((item, i) => (
          <ValueCard key={item.title} item={item} delayMs={i * 60} />
        ))}
      </div>
    </section>
  );
}

function ValueCard({ item, delayMs }: { item: ValuePoint; delayMs: number }) {
  return (
    <div className="pb-why__card" style={{ animationDelay: `${delayMs}ms` }}>
      <div className="pb-why__icon" aria-hidden>
        {item.icon}
      </div>
      <h3 className="pb-why__title">{item.title}</h3>
      <p className="pb-why__body">{item.body}</p>
    </div>
  );
}

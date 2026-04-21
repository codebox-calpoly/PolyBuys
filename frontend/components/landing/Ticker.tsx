import { TICKER_ITEMS } from './data';

/** Infinite horizontal marquee of marketplace categories. Items duplicated for seamless loop. */
export function Ticker() {
  return (
    <div className="pb-ticker" aria-hidden>
      <div className="pb-ticker__track">
        {[...TICKER_ITEMS, ...TICKER_ITEMS].map((item, i) => (
          <span key={i} className="pb-ticker__item">
            <span className="pb-ticker__emoji">{item.emoji}</span>
            {item.label}
          </span>
        ))}
      </div>
    </div>
  );
}

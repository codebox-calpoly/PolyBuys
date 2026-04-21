import { TICKER_ITEMS } from './data';
import { TickerIcon } from './icons';

export function Ticker() {
  return (
    <div className="pb-ticker" aria-hidden>
      <div className="pb-ticker__track">
        {[...TICKER_ITEMS, ...TICKER_ITEMS].map((item, i) => (
          <span key={i} className="pb-ticker__item">
            <span className="pb-ticker__icon">
              <TickerIcon id={item.id} size={18} />
            </span>
            {item.label}
          </span>
        ))}
      </div>
    </div>
  );
}

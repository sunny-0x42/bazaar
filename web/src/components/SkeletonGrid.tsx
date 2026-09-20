export function SkeletonGrid({ count = 8 }: { count?: number }) {
  return (
    <div className="listing-grid" aria-hidden>
      {Array.from({ length: count }, (_, i) => (
        <div className="listing-card skeleton" key={i}>
          <div className="listing-card-media">
            <div className="sk sk-art" />
          </div>
          <div className="listing-card-body">
            <div className="sk sk-title" />
            <div className="sk sk-line" />
            <div className="sk sk-price" />
          </div>
          <div className="sk sk-cta" />
        </div>
      ))}
    </div>
  );
}

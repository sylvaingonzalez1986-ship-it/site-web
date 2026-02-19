type FeatureCardProps = {
  icon: string;
  title: string;
  description: string;
};

export function FeatureCard({ icon, title, description }: FeatureCardProps) {
  return (
    <article className="card-cartoon bg-cream p-6">
      <div className="mb-3 inline-flex h-12 w-12 items-center justify-center border-2 border-[#1a1a1a] bg-[#2e8b78] text-lg font-bold text-white">
        {icon}
      </div>
      <h3 className="font-display text-2xl text-ink">{title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-charcoal">{description}</p>
    </article>
  );
}

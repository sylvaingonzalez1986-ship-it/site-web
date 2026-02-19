import type { CustomSectionContent, SectionStyle } from "@/types/store";

type CustomSectionProps = {
  custom: CustomSectionContent;
  id?: string;
  variant?: "band" | "card";
  className?: string;
  zIndex?: number;
};

const styleClasses: Record<SectionStyle, string> = {
  mint: "bg-mint",
  yellow: "bg-yellow",
  cream: "bg-cream",
};

export function CustomSection({
  custom,
  id,
  variant = "band",
  className = "",
  zIndex,
}: CustomSectionProps) {
  const paragraphs = custom.body
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (variant === "card") {
    return (
      <div id={id} className={`cartoon-border ${styleClasses[custom.style]} p-8 ${className}`}>
        <h2 className="section-title text-ink">{custom.title}</h2>
        <div className="mt-4 space-y-3 text-lg leading-relaxed text-charcoal">
          {paragraphs.map((paragraph, index) => (
            <p key={`${id ?? custom.title}-card-${index}`}>{paragraph}</p>
          ))}
        </div>
      </div>
    );
  }

  return (
    <section
      id={id}
      className={`section-band ${styleClasses[custom.style]} halftone-overlay paper-grain ${className}`}
      style={zIndex ? { zIndex } : undefined}
    >
      <div className="retro-container">
        <h2 className="section-title text-ink">{custom.title}</h2>
        <div className="mt-6 max-w-3xl space-y-3 text-lg leading-relaxed text-charcoal">
          {paragraphs.map((paragraph, index) => (
            <p key={`${id ?? custom.title}-band-${index}`}>{paragraph}</p>
          ))}
        </div>
      </div>
    </section>
  );
}

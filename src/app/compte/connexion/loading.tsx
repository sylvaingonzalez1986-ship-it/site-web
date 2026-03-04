export default function LoginLoading() {
  return (
    <section className="section-band bg-yellow halftone-overlay paper-grain pt-36">
      <div className="retro-container max-w-xl">
        <div className="cartoon-border bg-cream p-8">
          <div className="h-10 w-1/2 animate-pulse rounded bg-[#e8e3da]" />
          <div className="mt-4 h-4 w-3/4 animate-pulse rounded bg-[#e8e3da]" />
          <div className="mt-8 space-y-4">
            <div className="h-4 w-1/4 animate-pulse rounded bg-[#e8e3da]" />
            <div className="h-10 w-full animate-pulse rounded bg-[#e8e3da]" />
            <div className="h-4 w-1/4 animate-pulse rounded bg-[#e8e3da]" />
            <div className="h-10 w-full animate-pulse rounded bg-[#e8e3da]" />
          </div>
          <div className="mt-6 h-12 w-full animate-pulse rounded bg-[#e8e3da]" />
        </div>
      </div>
    </section>
  );
}

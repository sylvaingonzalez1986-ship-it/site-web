"use client";

import Image from "next/image";
import { useState, type FormEvent } from "react";
import { AppScreensShowcase } from "@/components/application/AppScreensShowcase";
import { CustomSection } from "@/components/CustomSection";
import { FeatureCard } from "@/components/FeatureCard";
import { useCmsStore } from "@/hooks/useCmsStore";
import type { ApplicationSection } from "@/types/store";

export default function ApplicationPage() {
  const { store } = useCmsStore();
  const appContent = store.content.application;
  const appSections = store.sections.application.filter((section) => section.visible);
  const [newsletterEmail, setNewsletterEmail] = useState("");
  const [newsletterLoading, setNewsletterLoading] = useState(false);
  const [newsletterStatus, setNewsletterStatus] = useState<string | null>(null);
  const [newsletterError, setNewsletterError] = useState<string | null>(null);
  const appFeatures = [
    {
      icon: "FID",
      title: appContent.feature1Title,
      description: appContent.feature1Description,
    },
    {
      icon: "FAST",
      title: appContent.feature2Title,
      description: appContent.feature2Description,
    },
    {
      icon: "COM",
      title: appContent.feature3Title,
      description: appContent.feature3Description,
    },
    {
      icon: "ACTU",
      title: appContent.feature4Title,
      description: appContent.feature4Description,
    },
  ];

  const submitNewsletter = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setNewsletterError(null);
    setNewsletterStatus(null);

    const email = newsletterEmail.trim().toLowerCase();
    if (!email) {
      setNewsletterError("Ajoute ton e-mail avant validation.");
      return;
    }

    setNewsletterLoading(true);
    try {
      const response = await fetch("/api/newsletter/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          source: "application",
        }),
      });

      const data = (await response.json()) as {
        ok?: boolean;
        alreadySubscribed?: boolean;
        error?: string;
      };

      if (!response.ok || !data.ok) {
        setNewsletterError(data.error ?? "Inscription impossible.");
        return;
      }

      setNewsletterStatus(
        data.alreadySubscribed
          ? "Tu es déjà inscrit(e) à la newsletter."
          : "Inscription validée. Vérifie ton e-mail de confirmation.",
      );
      setNewsletterEmail("");
    } catch {
      setNewsletterError("Inscription impossible pour le moment.");
    } finally {
      setNewsletterLoading(false);
    }
  };

  const renderApplicationSection = (section: ApplicationSection, index: number) => {
    const spacingClass = index === 0 ? "" : "mt-10";

    switch (section.type) {
      case "hero":
        return (
          <div key={section.id} className={spacingClass}>
            <div className="hero-grid items-center gap-6">
              <div className="cartoon-border bg-cream p-8 md:p-10">
                <p className="pill-cartoon px-4 py-2 text-xs uppercase tracking-[0.12em]">
                  {appContent.eyebrow}
                </p>
                <h1 className="section-title mt-5 text-ink">{appContent.title}</h1>
                <p className="mt-4 max-w-xl text-lg leading-relaxed text-charcoal">
                  {appContent.description}
                </p>
                <div className="mt-7 flex flex-wrap gap-3">
                  <button type="button" className="btn-cartoon btn-primary">
                    {appContent.heroPrimaryButtonLabel}
                  </button>
                  <button type="button" className="btn-cartoon btn-secondary">
                    {appContent.heroSecondaryButtonLabel}
                  </button>
                </div>
              </div>
              <div className="cartoon-border relative min-h-[420px] overflow-hidden bg-cream md:min-h-[540px]">
                <Image
                  src="/charles.png"
                  alt="Charles app"
                  fill
                  className="object-contain object-bottom"
                />
              </div>
            </div>
            <div className="mt-8">
              <AppScreensShowcase />
            </div>
          </div>
        );
      case "features":
        return (
          <div key={section.id} className={spacingClass}>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {appFeatures.map((feature) => (
                <FeatureCard
                  key={feature.title}
                  icon={feature.icon}
                  title={feature.title}
                  description={feature.description}
                />
              ))}
            </div>
          </div>
        );
      case "newsletter":
        return (
          <div key={section.id} className={spacingClass}>
            <div className="cartoon-border bg-cream p-8 text-center">
              <h2 className="section-title text-ink">{appContent.newsletterTitle}</h2>
              <p className="mx-auto mt-4 max-w-2xl text-lg text-charcoal">
                {appContent.newsletterDescription}
              </p>
              <form
                className="mx-auto mt-6 flex max-w-xl flex-col gap-3 sm:flex-row"
                onSubmit={submitNewsletter}
              >
                <input
                  type="email"
                  placeholder={appContent.newsletterEmailPlaceholder}
                  className="h-12 flex-1 border-2 border-[#1a1a1a] bg-[#f7f4ee] px-4"
                  value={newsletterEmail}
                  onChange={(event) => setNewsletterEmail(event.target.value)}
                />
                <button
                  type="submit"
                  className="btn-cartoon btn-primary h-12"
                  disabled={newsletterLoading}
                >
                  {newsletterLoading ? "Envoi..." : appContent.newsletterSubmitLabel}
                </button>
              </form>
              {newsletterError && (
                <p className="mx-auto mt-3 max-w-xl text-sm font-semibold text-red-700">
                  {newsletterError}
                </p>
              )}
              {newsletterStatus && (
                <p className="mx-auto mt-3 max-w-xl text-sm font-semibold text-green-700">
                  {newsletterStatus}
                </p>
              )}
            </div>
          </div>
        );
      case "custom":
        return (
          <CustomSection
            key={section.id}
            id={section.id}
            custom={section.custom}
            variant="card"
            className={spacingClass}
          />
        );
      default:
        return null;
    }
  };

  return (
    <section className="section-band bg-yellow halftone-overlay paper-grain pt-32">
      <div className="retro-container">
        {appSections.map((section, index) => renderApplicationSection(section, index))}
      </div>
    </section>
  );
}

"use client";

import Image from "next/image";

type IPhoneMockupProps = {
  src: string;
  alt: string;
  title: string;
  caption: string;
  priority?: boolean;
  className?: string;
};

export function IPhoneMockup({
  src,
  alt,
  title,
  caption,
  priority = false,
  className = "",
}: IPhoneMockupProps) {
  return (
    <figure className={`iphone-mockup ${className}`}>
      <div className="iphone-shell">
        <div className="iphone-bezel">
          <div className="iphone-screen">
            <Image
              src={src}
              alt={alt}
              fill
              priority={priority}
              sizes="(max-width: 768px) 72vw, (max-width: 1200px) 34vw, 26vw"
              className="object-cover object-top"
            />
          </div>
          <div className="iphone-notch" aria-hidden="true" />
          <span className="iphone-side-button iphone-side-button--top" aria-hidden="true" />
          <span className="iphone-side-button iphone-side-button--bottom" aria-hidden="true" />
        </div>
      </div>
      <figcaption className="mt-4 space-y-1 text-center">
        <p className="font-display text-xl text-ink">{title}</p>
        <p className="text-sm text-charcoal">{caption}</p>
      </figcaption>
    </figure>
  );
}


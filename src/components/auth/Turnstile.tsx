"use client";

import Script from "next/script";
import { useEffect, useId, useRef, useState } from "react";

declare global {
  interface Window {
    turnstile?: {
      render: (
        container: string | HTMLElement,
        options: {
          sitekey: string;
          callback: (token: string) => void;
          "expired-callback"?: () => void;
        }
      ) => string;
    };
  }
}

const SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

/**
 * Cloudflare Turnstile CAPTCHA, guarding signup/login from bot signups that would otherwise
 * burn the shared AI-review budget. Self-contained: renders a hidden `captchaToken` input that
 * a plain `<form action={serverAction}>` picks up like any other field (same pattern as
 * PasswordField) — no client state needs lifting to the surrounding Server Component page.
 *
 * Renders nothing but the (empty) hidden input when NEXT_PUBLIC_TURNSTILE_SITE_KEY isn't set —
 * turning this on for real is a Supabase Auth dashboard setting + this env var, not a code
 * change once both are in place. See `.env.example`.
 */
export function TurnstileField({ name = "captchaToken" }: { name?: string }) {
  const rawId = useId().replace(/[^a-zA-Z0-9]/g, "");
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [scriptLoaded, setScriptLoaded] = useState(false);

  useEffect(() => {
    if (!scriptLoaded || !SITE_KEY || !containerRef.current || !window.turnstile) return;
    window.turnstile.render(containerRef.current, {
      sitekey: SITE_KEY,
      callback: (token) => {
        if (inputRef.current) inputRef.current.value = token;
      },
      "expired-callback": () => {
        if (inputRef.current) inputRef.current.value = "";
      },
    });
  }, [scriptLoaded]);

  return (
    <>
      <input ref={inputRef} type="hidden" name={name} />
      {SITE_KEY && (
        <>
          <Script
            src="https://challenges.cloudflare.com/turnstile/v0/api.js"
            strategy="afterInteractive"
            onLoad={() => setScriptLoaded(true)}
          />
          <div ref={containerRef} id={`turnstile-${rawId}`} />
        </>
      )}
    </>
  );
}

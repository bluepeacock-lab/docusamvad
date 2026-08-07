"use client";

import { useState, type FormEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";

const FEATURES: { icon: ReactNode; title: string; description: string }[] = [
  {
    icon: (
      <path d="M12 4v12m0-12l-4 4m4-4l4 4M5 20h14" strokeLinecap="round" strokeLinejoin="round" />
    ),
    title: "Upload any document",
    description: "PDFs, scans and photos — Sarvam's Doc AI extracts clean, structured text.",
  },
  {
    icon: (
      <path
        d="M21 11.5a8.5 8.5 0 01-8.5 8.5c-1.35 0-2.6-.32-3.7-.9L4 20l1.05-4.2A8.5 8.5 0 1121 11.5z"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    ),
    title: "Ask in your own language",
    description: "Hindi, Kannada, Tamil, English and more — get answers in the language you asked in.",
  },
];

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const result = await signIn("credentials", {
      username,
      password,
      redirect: false,
    });

    setLoading(false);

    if (result?.error) {
      setError("Invalid username or password.");
      return;
    }

    router.push("/");
  };

  return (
    <main className="flex min-h-screen flex-col bg-background md:flex-row">
      <section className="flex flex-col justify-center bg-surface px-8 py-12 md:w-3/4 md:px-16 lg:px-24">
        <div className="mx-auto w-full max-w-xl">
          <h1 className="font-serif text-3xl font-semibold text-heading md:text-4xl">DocuSamvad</h1>
          <p className="mt-3 text-base text-body md:text-lg">
            Chat with your documents in any Indian language.
          </p>

          <div className="mt-10 space-y-6">
            {FEATURES.map((feature) => (
              <div key={feature.title} className="flex items-start gap-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent-primary/10 text-accent-primary">
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.75"
                    className="h-5 w-5"
                  >
                    {feature.icon}
                  </svg>
                </div>
                <div>
                  <h2 className="text-sm font-semibold text-heading">{feature.title}</h2>
                  <p className="mt-0.5 text-sm text-muted">{feature.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="flex flex-1 items-center justify-center border-t border-border bg-card px-6 py-12 md:border-l md:border-t-0 md:px-10">
        <div className="w-full max-w-xs">
          <h2 className="font-serif text-xl font-semibold text-heading">Sign in</h2>
          <p className="mt-1 text-sm text-muted">Continue to DocuSamvad</p>

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <div>
              <label htmlFor="username" className="mb-1 block text-xs font-medium text-body">
                Username
              </label>
              <input
                id="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                autoFocus
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-heading outline-none focus:border-accent-primary"
              />
            </div>

            <div>
              <label htmlFor="password" className="mb-1 block text-xs font-medium text-body">
                Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-heading outline-none focus:border-accent-primary"
              />
            </div>

            {error && <p className="text-sm text-danger">{error}</p>}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-button bg-ink px-4 py-2 text-sm font-medium text-white transition-opacity disabled:opacity-60"
            >
              {loading ? "Signing in..." : "Sign In"}
            </button>
          </form>
        </div>
      </section>
    </main>
  );
}

"use client";

/**
 * Root error boundary — must define its own html/body (Next.js requirement).
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en-KE">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#f7f7f5",
          color: "#0a0a0a",
          fontFamily:
            "system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
          padding: 24,
          textAlign: "center",
        }}
      >
        <div>
          <p
            style={{
              fontSize: 11,
              letterSpacing: "0.18em",
              textTransform: "uppercase",
              opacity: 0.4,
              margin: 0,
            }}
          >
            KlikCollect
          </p>
          <h1
            style={{
              fontSize: 28,
              fontWeight: 500,
              margin: "12px 0 0",
              letterSpacing: "-0.02em",
            }}
          >
            Temporary problem
          </h1>
          <p style={{ fontSize: 14, opacity: 0.5, marginTop: 12 }}>
            {error?.digest
              ? `Reference ${error.digest}`
              : "Please try again in a moment."}
          </p>
          <button
            type="button"
            onClick={reset}
            style={{
              marginTop: 28,
              minHeight: 44,
              padding: "0 24px",
              background: "#0a0a0a",
              color: "#fff",
              border: 0,
              fontSize: 12,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              cursor: "pointer",
            }}
          >
            Reload
          </button>
        </div>
      </body>
    </html>
  );
}

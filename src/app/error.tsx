"use client";

export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body
        style={{
          minHeight: "100dvh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 16,
          background: "#fffdf8",
          color: "#17110a",
          fontFamily: "system-ui, sans-serif",
          padding: 24,
        }}
      >
        <h2 style={{ fontSize: 20, fontWeight: 600, margin: 0 }}>Something went wrong</h2>
        <p style={{ fontSize: 14, color: "#7a7060", margin: 0, textAlign: "center", maxWidth: 360 }}>
          evora hit an unexpected error. Please refresh and try again.
        </p>
        <button
          type="button"
          onClick={reset}
          style={{
            marginTop: 8,
            padding: "10px 20px",
            borderRadius: 10,
            border: "none",
            background: "#c49a30",
            color: "white",
            fontSize: 14,
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          Try again
        </button>
      </body>
    </html>
  );
}

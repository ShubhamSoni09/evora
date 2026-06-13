"use client";

export default function SponsorFooter() {
  const sponsors = [
    { name: "xAI", href: "https://x.ai", detail: "Grok" },
    { name: "Vercel", href: "https://vercel.com", detail: "Deploy" },
    { name: "Cursor", href: "https://cursor.com", detail: "Build" },
    { name: "Inngest", href: "https://inngest.com", detail: "Workflows" },
  ];

  return (
    <div
      style={{
        position: "fixed",
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 90,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 6,
        padding: "8px 16px",
        background: "rgba(255,253,245,0.92)",
        backdropFilter: "blur(10px)",
        borderTop: "1px solid rgba(0,0,0,0.05)",
        fontSize: 11,
        color: "#b0a480",
        letterSpacing: "0.02em",
      }}
    >
      <span style={{ marginRight: 4 }}>Presented by</span>
      {sponsors.map((s, i) => (
        <span key={s.name} style={{ display: "flex", alignItems: "center", gap: 6 }}>
          {i > 0 && <span style={{ opacity: 0.4 }}>·</span>}
          <a
            href={s.href}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              color: "#9a7a40",
              textDecoration: "none",
              fontWeight: 500,
            }}
            title={s.detail}
          >
            {s.name}
          </a>
        </span>
      ))}
    </div>
  );
}

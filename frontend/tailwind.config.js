/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#0f172a",
        paper: "#ffffff",
        canvas: "#f5f6f8",
        line: "#e5e7eb",
        muted: "#6b7280",
        clue: { red: "#dc2626", green: "#16a34a", yellow: "#eab308", blue: "#2563eb" },
      },
      fontFamily: {
        display: ["'Special Elite'", "ui-monospace", "monospace"],
        sans: ["Inter", "system-ui", "sans-serif"],
      },
      boxShadow: {
        case: "0 8px 24px rgba(15, 23, 42, 0.08), 0 2px 4px rgba(15, 23, 42, 0.04)",
        glow: "0 0 0 4px rgba(37, 99, 235, 0.15)",
      },
      backgroundImage: {
        "case-paper": "repeating-linear-gradient(45deg, rgba(15,23,42,0.02) 0 2px, transparent 2px 8px)",
      },
    },
  },
  plugins: [],
};

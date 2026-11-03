import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          primary: "#073783",
          blue: "#0799E6",
          green: "#20B83D",
          light: "#DCEEFF",
          dark: "#05265b",
          hover: "#09439e",
        },
        surface: "#F5F8FC",
        "surface-card": "#FFFFFF",
        "surface-border": "#E2E8F0",
        apptext: {
          primary: "#172B4D",
          secondary: "#64748B",
          muted: "#94A3B8",
        },
      },
      fontFamily: {
        sans: [
          "-apple-system",
          "BlinkMacSystemFont",
          "'Segoe UI'",
          "Roboto",
          "'Helvetica Neue'",
          "Arial",
          "sans-serif",
        ],
      },
    },
  },
  plugins: [],
};

export default config;

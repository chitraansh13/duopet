import type { Config } from "tailwindcss";

export default {
  content: ["./app/**/*.{js,ts,jsx,tsx,mdx}", "./components/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        ink: "rgb(var(--text-primary-rgb) / <alpha-value>)",
        cream: "rgb(var(--background-rgb) / <alpha-value>)",
        surface: "rgb(var(--surface-rgb) / <alpha-value>)",
        elevated: "rgb(var(--surface-elevated-rgb) / <alpha-value>)",
        subtle: "rgb(var(--surface-secondary-rgb) / <alpha-value>)",
        muted: "rgb(var(--text-secondary-rgb) / <alpha-value>)",
        line: "rgb(var(--border-rgb) / <alpha-value>)",
        accent: "rgb(var(--accent-rgb) / <alpha-value>)",
        friend: "rgb(var(--friend-rgb) / <alpha-value>)",
        luxury: "rgb(var(--luxury-rgb) / <alpha-value>)",
        "on-accent": "rgb(var(--on-accent-rgb) / <alpha-value>)",
      },
      boxShadow: {
        card: "var(--shadow-card)",
        soft: "var(--shadow-soft)",
      },
    },
  },
  plugins: [],
} satisfies Config;

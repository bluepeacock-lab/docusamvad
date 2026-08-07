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
        background: "#FFFFFF",
        card: "#FFFFFF",
        surface: "#F4F4F5",
        border: "#E4E4E7",
        heading: "#18181B",
        body: "#52525B",
        muted: "#9CA3AF",
        ink: "#18181B",
        accent: {
          primary: "#FF6B35",
          secondary: "#00C9A7",
        },
        warning: "#D97706",
        danger: "#EF4444",
      },
      borderRadius: {
        card: "16px",
        button: "9999px",
      },
      fontFamily: {
        sans: ["var(--font-inter)", "sans-serif"],
        serif: ["var(--font-serif)", "serif"],
      },
    },
  },
  plugins: [],
};
export default config;

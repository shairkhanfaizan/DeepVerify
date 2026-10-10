import type { Config } from "tailwindcss"

const config = {
  darkMode: ["class"],
  content: [
    './pages/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './app/**/*.{ts,tsx}',
    './src/**/*.{ts,tsx}',
  ],
  prefix: "",
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      colors: {
        "surface-container-lowest": "#010f1f",
        "on-secondary-container": "#00311f",
        "on-error": "#690005",
        "primary-container": "#4d8eff",
        "surface-tint": "#adc6ff",
        "tertiary-container": "#ca8100",
        "surface-container-low": "#0d1c2d",
        "on-primary-fixed": "#001a42",
        "primary-fixed-dim": "#adc6ff",
        "on-background": "#d4e4fa",
        "on-secondary-fixed": "#002113",
        "on-primary-container": "#00285d",
        "error-container": "#93000a",
        "secondary-fixed-dim": "#4edea3",
        "tertiary-fixed-dim": "#ffb95f",
        "tertiary": "#ffb95f",
        "on-tertiary-fixed": "#2a1700",
        "surface-bright": "#2c3a4c",
        "on-tertiary": "#472a00",
        "surface-container-high": "#1c2b3c",
        "error": "#ffb4ab",
        "on-error-container": "#ffdad6",
        "outline-variant": "#424754",
        "inverse-primary": "#005ac2",
        "surface-container": "#122131",
        "on-primary-fixed-variant": "#004395",
        "on-secondary": "#003824",
        "surface": "#051424",
        "on-tertiary-fixed-variant": "#653e00",
        "inverse-on-surface": "#233143",
        "tertiary-fixed": "#ffddb8",
        "outline": "#8c909f",
        "on-surface-variant": "#c2c6d6",
        "surface-variant": "#273647",
        "on-secondary-fixed-variant": "#005236",
        "on-surface": "#d4e4fa",
        "inverse-surface": "#d4e4fa",
        "secondary-container": "#00a572",
        "on-tertiary-container": "#3e2400",
        "surface-container-highest": "#273647",
        "secondary-fixed": "#6ffbbe",
        "surface-dim": "#051424",
        "primary-fixed": "#d8e2ff",
        "on-primary": "#002e6a",
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
      },
      spacing: {
        "gutter-mobile": "1rem",
        "space-lg": "1.5rem",
        "space-xs": "0.25rem",
        "gutter": "1.5rem",
        "space-md": "1rem",
        "space-sm": "0.5rem",
        "space-xl": "2.5rem",
        "margin": "2.5rem",
        "margin-mobile": "1.25rem"
      },
      fontFamily: {
        "label-lg": ["Geist"],
        "body-sm": ["Inter"],
        "display-lg-mobile": ["Geist"],
        "headline-lg-mobile": ["Geist"],
        "body-md": ["Inter"],
        "display-lg": ["Geist"],
        "label-md": ["Geist"],
        "headline-md": ["Geist"],
        "body-lg": ["Inter"],
        "label-mono": ["Geist"],
        "headline-sm": ["Geist"],
        "headline-lg": ["Geist"]
      },
      fontSize: {
        "label-lg": ["14px", { lineHeight: "20px", letterSpacing: "0.01em", fontWeight: "500" }],
        "body-sm": ["13px", { lineHeight: "18px", fontWeight: "400" }],
        "display-lg-mobile": ["32px", { lineHeight: "40px", letterSpacing: "-0.02em", fontWeight: "600" }],
        "headline-lg-mobile": ["24px", { lineHeight: "32px", letterSpacing: "-0.015em", fontWeight: "600" }],
        "body-md": ["14px", { lineHeight: "22px", fontWeight: "400" }],
        "display-lg": ["48px", { lineHeight: "56px", letterSpacing: "-0.025em", fontWeight: "600" }],
        "label-md": ["12px", { lineHeight: "16px", letterSpacing: "0.02em", fontWeight: "500" }],
        "headline-md": ["22px", { lineHeight: "28px", letterSpacing: "-0.015em", fontWeight: "500" }],
        "body-lg": ["16px", { lineHeight: "26px", letterSpacing: "-0.005em", fontWeight: "400" }],
        "label-mono": ["12px", { lineHeight: "16px", letterSpacing: "0.05em", fontWeight: "400" }],
        "headline-sm": ["18px", { lineHeight: "24px", letterSpacing: "-0.01em", fontWeight: "500" }],
        "headline-lg": ["30px", { lineHeight: "38px", letterSpacing: "-0.02em", fontWeight: "600" }]
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      keyframes: {
        "scan-sweep": {
          "0%": { transform: "translateY(-100%)" },
          "100%": { transform: "translateY(100%)" }
        },
        "scan-line": {
          "0%": { top: "0%" },
          "100%": { top: "100%" }
        }
      },
      animation: {
        "scan-sweep": "scan-sweep 2s linear infinite",
        "scan-line": "scan-line 2s linear infinite"
      }
    },
  },
  plugins: [require("tailwindcss-animate"), require("@tailwindcss/typography")],
} satisfies Config

export default config

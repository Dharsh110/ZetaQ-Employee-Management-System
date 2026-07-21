/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],

  darkMode: "class",

  theme: {
    extend: {
      colors: {
        border: "#e5e7eb",
        input: "#e5e7eb",
        ring: "#1a4fd6",
        background: "#ffffff",
        foreground: "#111827",

        brand: {
          50: "#eff6ff",
          100: "#dbeafe",
          200: "#bfdbfe",
          300: "#93c5fd",
          400: "#60a5fa",
          500: "#3b82f6",
          600: "#1a4fd6",
          700: "#1d4ed8",
          800: "#1e40af",
          900: "#0d3099",
        },

        // shadcn/ui semantic tokens, mapped onto the existing brand palette
        // so shadcn components visually match the rest of the app
        primary: {
          DEFAULT: "#1a4fd6",
          foreground: "#ffffff",
        },
        secondary: {
          DEFAULT: "#f3f4f6",
          foreground: "#111827",
        },
        destructive: {
          DEFAULT: "#dc2626",
          foreground: "#ffffff",
        },
        muted: {
          DEFAULT: "#f3f4f6",
          foreground: "#6b7280",
        },
        accent: {
          DEFAULT: "#f3f4f6",
          foreground: "#111827",
        },
        popover: {
          DEFAULT: "#ffffff",
          foreground: "#111827",
        },
        card: {
          DEFAULT: "#ffffff",
          foreground: "#111827",
        },
      },

      borderRadius: {
        lg: "0.75rem",
        md: "0.5rem",
        sm: "0.375rem",
      },

      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
      },

      boxShadow: {
        card: "0 1px 3px 0 rgba(0,0,0,0.08),0 1px 2px -1px rgba(0,0,0,0.04)",
        "card-hover":
          "0 4px 12px 0 rgba(0,0,0,0.10)",
      },

      animation: {
        "fade-in": "fadeIn .2s ease-out",
        "slide-in": "slideIn .25s ease-out",
      },

      keyframes: {
        fadeIn: {
          from: {
            opacity: "0",
            transform: "translateY(4px)",
          },
          to: {
            opacity: "1",
            transform: "translateY(0)",
          },
        },

        slideIn: {
          from: {
            opacity: "0",
            transform: "translateX(-8px)",
          },
          to: {
            opacity: "1",
            transform: "translateX(0)",
          },
        },
      },
    },
  },

  plugins: [require("tailwindcss-animate")],
};

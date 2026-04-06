/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      // ==========================================
      // shadcn/ui compatibility (HSL tokens)
      // ==========================================
      colors: {
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

        // ==========================================
        // Elyon Design System — Semantic tokens
        // Direct hex values (no CSS vars) for reliable JIT
        // ==========================================
        brand: {
          DEFAULT: "#6366f1",   // indigo-500
          dark:    "#4338ca",   // indigo-700
          secondary: "#8b5cf6", // violet-500
          accent:    "#a855f7", // purple-500
          gold:      "#f59e0b", // amber-500
        },
        success: {
          DEFAULT: "#10b981",   // emerald-500
          dark:    "#059669",   // emerald-600
        },
        warning: {
          DEFAULT: "#f59e0b",   // amber-500
          dark:    "#d97706",   // amber-600
        },
        danger:   "#ef4444",   // red-500
        info:     "#3b82f6",   // blue-500

        // Surfaces
        surface: {
          page:       "#f8fafc", // slate-50
          card:       "#ffffff",
          subtle:     "#f1f5f9", // slate-100
          "muted-bg": "#e2e8f0", // slate-200
        },

        // Indigo palette (brand scale)
        indigo: {
          50:  "#eef2ff",
          100: "#e0e7ff",
          200: "#c7d2fe",
          300: "#a5b4fc",
          400: "#818cf8",
          500: "#6366f1",
          600: "#4f46e5",
          700: "#4338ca",
          800: "#3730a3",
          900: "#312e81",
          950: "#1e1b4b",
        },
        emerald: {
          50:  "#ecfdf5",
          100: "#d1fae5",
          200: "#a7f3d0",
          300: "#6ee7b7",
          400: "#34d399",
          500: "#10b981",
          600: "#059669",
          700: "#047857",
          800: "#065f46",
          900: "#064e3b",
          950: "#022c22",
        },
        amber: {
          50:  "#fffbeb",
          100: "#fef3c7",
          200: "#fde68a",
          300: "#fcd34d",
          400: "#fbbf24",
          500: "#f59e0b",
          600: "#d97706",
          700: "#b45309",
          800: "#92400e",
          900: "#78350f",
        },
        violet: {
          50:  "#f5f3ff",
          100: "#ede9fe",
          200: "#ddd6fe",
          300: "#c4b5fd",
          400: "#a78bfa",
          500: "#8b5cf6",
          600: "#7c3aed",
          700: "#6d28d9",
          800: "#5b21b6",
          900: "#4c1d95",
        },
        slate: {
          50:  "#f8fafc",
          100: "#f1f5f9",
          200: "#e2e8f0",
          300: "#cbd5e1",
          400: "#94a3b8",
          500: "#64748b",
          600: "#475569",
          700: "#334155",
          800: "#1e293b",
          900: "#0f172a",
          950: "#020617",
        },
      },

      // ==========================================
      // Radii — use standard Tailwind defaults
      // (CSS var override breaks shadcn/ui components)
      // ==========================================

      // ==========================================
      // Font families
      // ==========================================
      fontFamily: {
        sans: ["var(--font-sans)"],
        mono: ["var(--font-mono)"],
      },

      // ==========================================
      // Box shadows
      // ==========================================
      boxShadow: {
        soft:    "var(--shadow-soft)",
        medium:  "var(--shadow-medium)",
        premium: "var(--shadow-premium)",
        "glow-primary": "var(--glow-primary)",
        "glow-success": "var(--glow-success)",
      },

      // ==========================================
      // Transitions
      // ==========================================
      transitionDuration: {
        fast:   "var(--duration-fast)",
        normal: "var(--duration-normal)",
        slow:   "var(--duration-slow)",
      },

      // ==========================================
      // Animations
      // ==========================================
      animation: {
        'spin-slow': 'spin 3s linear infinite',
        'shimmer':   'shimmer 1.5s ease-in-out infinite',
        'float':     'float 3s ease-in-out infinite',
        'fade-in':   'fade-in 0.3s ease-out',
        'scale-in':  'scale-in 0.2s ease-out',
        'badge-pulse':'badge-pulse 2s ease-in-out infinite',
      },
      keyframes: {
        shimmer: {
          '0%':   { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' }
        },
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%':      { transform: 'translateY(-4px)' }
        },
        'fade-in': {
          from: { opacity: '0', transform: 'translateY(10px)' },
          to:   { opacity: '1', transform: 'translateY(0)' }
        },
        'scale-in': {
          from: { opacity: '0', transform: 'scale(0.95)' },
          to:   { opacity: '1', transform: 'scale(1)' }
        },
        'badge-pulse': {
          '0%, 100%': { opacity: '1', transform: 'scale(1)' },
          '50%':      { opacity: '0.85', transform: 'scale(1.02)' }
        }
      }
    },
  },
  plugins: [],
}

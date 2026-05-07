/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,jsx,ts,tsx}",
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        // Budget Buddy Core Palette
        navy: {
          DEFAULT: "#1B2B4B",
          50: "#E8EDF5",
          100: "#C5D0E3",
          200: "#9AAECF",
          300: "#6F8CBB",
          400: "#4D70AB",
          500: "#2B5499",
          600: "#1B2B4B",
          700: "#152238",
          800: "#0E1926",
          900: "#070D13",
        },
        gold: {
          DEFAULT: "#F4A832",
          50: "#FEF7EC",
          100: "#FDECD0",
          200: "#FBDA9E",
          300: "#F9C96C",
          400: "#F7B847",
          500: "#F4A832",
          600: "#E08A10",
          700: "#A8670C",
          800: "#714508",
          900: "#3A2304",
        },
        emerald: {
          DEFAULT: "#10B981",
          50: "#ECFDF5",
          100: "#D1FAE5",
          500: "#10B981",
          600: "#059669",
          700: "#047857",
        },
        coral: {
          DEFAULT: "#EF4444",
          50: "#FEF2F2",
          100: "#FEE2E2",
          500: "#EF4444",
          600: "#DC2626",
        },
        teal: {
          DEFAULT: "#00B4A6",
          500: "#00B4A6",
          600: "#009E91",
        },
        surface: "#F8F9FA",
        card: "#FFFFFF",
        border: "#E8EDF5",
        muted: "#8B9CB8",
        "navy-muted": "#4A5D7A",
      },
      fontFamily: {
        sans: ["Inter_400Regular", "System"],
        medium: ["Inter_500Medium", "System"],
        semibold: ["Inter_600SemiBold", "System"],
        bold: ["Inter_700Bold", "System"],
        extrabold: ["Inter_800ExtraBold", "System"],
      },
      borderRadius: {
        "4xl": "2rem",
      },
    },
  },
  plugins: [],
};

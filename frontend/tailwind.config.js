/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#183b3a",
        teal: {
          50: "#effaf8",
          100: "#d9f2ee",
          600: "#0f766e",
          700: "#0d625c",
        },
      },
      boxShadow: {
        card: "0 12px 40px rgba(20, 62, 58, 0.06)",
      },
    },
  },
  plugins: [],
};

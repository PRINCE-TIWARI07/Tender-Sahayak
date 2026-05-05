module.exports = {
  content: ["./index.html", "./frontend/src/**/*.{js,jsx}"],
  theme: {
    extend: {
      boxShadow: {
        glow: "0 20px 60px rgba(15, 23, 42, 0.12)"
      },
      keyframes: {
        floatIn: {
          "0%": { opacity: "0", transform: "translateY(10px)" },
          "100%": { opacity: "1", transform: "translateY(0)" }
        },
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" }
        }
      },
      animation: {
        "float-in": "floatIn 420ms ease-out both",
        shimmer: "shimmer 1.8s linear infinite"
      }
    }
  },
  plugins: []
};

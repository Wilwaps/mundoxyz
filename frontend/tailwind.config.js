/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
    "./public/index.html"
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        primary: "#06e4f9",
        "background-light": "#f5f8f8",
        "background-dark": "#0B0E14",
        violet: "#a78bfa",
        accent: "#22d3ee",
        card: "#121A2B",
        text: "#E6EDF3",
        glass: "rgba(255, 255, 255, 0.1)",
        'glass-hover': "rgba(255, 255, 255, 0.15)",
        'glass-active': "rgba(255, 255, 255, 0.2)",
        'border-glass': "rgba(255, 255, 255, 0.1)",
        'fire-orange': "#FFA500",
        'fire-yellow': "#FFFF00",
        'success': "#10B981",
        'error': "#EF4444",
        'warning': "#F59E0B",
        'info': "#3B82F6"
      },
      fontFamily: {
        display: ["Space Grotesk", "system-ui", "sans-serif"],
      },
      borderRadius: {
        DEFAULT: "0.5rem",
        lg: "0.75rem",
        xl: "1rem",
        full: "9999px",
      },
      boxShadow: {
        fire: "0 0 15px 5px rgba(255, 165, 0, 0.6), 0 0 25px 10px rgba(255, 255, 0, 0.4)",
        'neon-violet': "0 0 10px #a78bfa, 0 0 20px #a78bfa, 0 0 30px #a78bfa",
        'neon-accent': "0 0 10px #22d3ee, 0 0 20px #22d3ee, 0 0 30px #22d3ee",
        'glow': "0 0 20px rgba(34, 211, 238, 0.3)",
        'card': "0 4px 6px -1px rgba(0, 0, 0, 0.3), 0 2px 4px -1px rgba(0, 0, 0, 0.2)",
        'card-hover': "0 10px 15px -3px rgba(0, 0, 0, 0.4), 0 4px 6px -2px rgba(0, 0, 0, 0.3)"
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'glow': 'glow 2s ease-in-out infinite alternate',
        'float': 'float 3s ease-in-out infinite',
        'slide-up': 'slideUp 0.3s ease-out',
        'slide-down': 'slideDown 0.3s ease-out',
        'fade-in': 'fadeIn 0.3s ease-out',
        'scale-in': 'scaleIn 0.2s ease-out',
        'spin-slow': 'spin 3s linear infinite'
      },
      keyframes: {
        glow: {
          '0%': { boxShadow: '0 0 10px #22d3ee, 0 0 20px #22d3ee' },
          '100%': { boxShadow: '0 0 20px #22d3ee, 0 0 30px #22d3ee' }
        },
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-10px)' }
        },
        slideUp: {
          '0%': { transform: 'translateY(100%)', opacity: 0 },
          '100%': { transform: 'translateY(0)', opacity: 1 }
        },
        slideDown: {
          '0%': { transform: 'translateY(-100%)', opacity: 0 },
          '100%': { transform: 'translateY(0)', opacity: 1 }
        },
        fadeIn: {
          '0%': { opacity: 0 },
          '100%': { opacity: 1 }
        },
        scaleIn: {
          '0%': { transform: 'scale(0.95)', opacity: 0 },
          '100%': { transform: 'scale(1)', opacity: 1 }
        }
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'gradient-fire': 'linear-gradient(to right, #FFA500, #FFFF00)',
        'gradient-violet': 'linear-gradient(to right, #a78bfa, #c084fc)',
        'gradient-accent': 'linear-gradient(to right, #06e4f9, #22d3ee)',
        'mesh-pattern': 'repeating-linear-gradient(45deg, transparent, transparent 10px, rgba(34, 211, 238, 0.1) 10px, rgba(34, 211, 238, 0.1) 20px)'
      }
    },
  },
  plugins: [
    require('@tailwindcss/forms')({
      strategy: 'class',
    }),
  ],
}

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './index.html',
    './src/**/*.{js,jsx,ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        siara: {
          // Navy / Blue / Orange palette (user-provided)
          primary: '#0A192F',      // Deep Navy
          secondary: '#007BFF',    // Electric Blue
          accent: '#FF6F00',       // Safety Orange
          bg: '#EEF6FF',           // Light blue background to match palette
        },
        siaraGradientStart: '#071122',
        siaraGradientEnd: '#0A192F',
        siaraBtnPrimary: '#007BFF',
        siaraBtnPrimaryHover: '#0056D6',
        siaraTextLight: '#FFFFFF',
        siaraTextDark: '#0B1722',
        siaraButtonBorder: '#007BFF',
      },
      fontFamily: {
        sans: ['Inter', 'Poppins', 'ui-sans-serif', 'system-ui'],
      },
      boxShadow: {
        'siara-lg': '0 10px 30px rgba(9, 10, 18, 0.6)',
      },
      backdropBlur: {
        sm: '4px',
      },
    },
  },
  plugins: [],
}

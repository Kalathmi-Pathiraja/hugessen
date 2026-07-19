/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        navy:       '#002957',
        navydeep:   '#011D45',
        orange:     '#F0531E',
        orangedeep: '#EA3C18',
        slate:      '#464B54',
        charcoal:   '#5F6269',
        ink:        '#32363D',
        gray300:    '#C7C9C8',
        gray200:    '#DFE1DF',
        gray100:    '#F2F2F2',
        lightgrey:  '#DFE1DF',
        offwhite:   '#F2F2F2',
        canvas:     '#F2F2F2',
        teal:       '#0E7490',
      },
      fontFamily: {
        sans:    ['Calibri', 'Open Sans', 'Segoe UI', 'system-ui', 'sans-serif'],
        display: ['Calibri Light', 'Calibri', 'Open Sans', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        card: 'none',
        popover: '0 4px 14px rgba(0,41,87,0.10), 0 1px 3px rgba(0,41,87,0.08)',
      },
    },
  },
  plugins: [],
}

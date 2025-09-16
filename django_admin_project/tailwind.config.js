/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: [
    './templates/**/*.html',
    './static/js/**/*.js',
  ],
  // Ensure dark: variant utilities are kept even if JIT misses some usages during watch/build
  safelist: [
    // Explicit most-used pairs
    'dark:bg-gray-900', 'dark:bg-gray-800', 'dark:bg-gray-700',
    'dark:text-gray-100', 'dark:text-gray-200', 'dark:text-gray-300',
    'dark:border-gray-700', 'dark:border-gray-800',
    'dark:placeholder-gray-500',
    'dark:text-blue-300', 'dark:bg-blue-900/20',
    'dark:text-emerald-300', 'dark:bg-emerald-900/20',
    'dark:text-amber-300', 'dark:bg-amber-900/20',
    // Broad pattern so we don’t miss other tones; Tailwind will generate with dark variant
    { pattern: /(bg|text|border|placeholder)-(gray|blue|emerald|amber|red|green|indigo|violet)-(50|100|200|300|400|500|600|700|800|900)/, variants: ['dark'] },
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}


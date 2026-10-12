/** Design tokens. Concept: a school register — chalkboard shell, ruled paper, chalk-yellow marker. */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  // Component classes built from variables (e.g. `btn-${variant}`) must be safelisted or Tailwind would purge them.
  safelist: [
    'btn',
    'btn-primary',
    'btn-secondary',
    'btn-danger',
    'btn-ghost',
    'btn-sm',
    'input',
    'input-invalid',
    'card',
    'th',
    'td',
  ],
  theme: {
    extend: {
      colors: {
        board: {
          DEFAULT: '#1E3A34',
          light: '#2A4F46',
          deep: '#15291F',
          ink: '#E9EFEC',
        },
        chalk: { DEFAULT: '#F2C230', soft: '#FBEFC2' },
        paper: '#F5F4EF',
        ink: '#16201D',
        muted: '#5E6D68',
        line: '#DAD8CF',
        present: '#2E7D4F',
        absent: '#B42318',
        late: '#A86A0C',
        excused: '#3B6EA5',
      },
      fontFamily: {
        sans: [
          '"Segoe UI"',
          'Inter',
          '"Noto Sans Ethiopic"',
          '"Abyssinica SIL"',
          'system-ui',
          'sans-serif',
        ],
        display: [
          '"Iowan Old Style"',
          '"Palatino Linotype"',
          'Georgia',
          '"Noto Serif Ethiopic"',
          'serif',
        ],
      },
    },
  },
  plugins: [],
}

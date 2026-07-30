/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "../backend/public/**/*.php",
    "./index.html",
    "./src/**/*.{ts,tsx,js,jsx,html}"
  ],
  theme: {
    extend: {
      fontFamily: {
        sans:    ['Mulish', 'sans-serif'],
        body:    ['Mulish', 'sans-serif'],
        heading: ['Fraunces', 'serif'],
      },
      fontSize: {
        /* compact scale */
        'caption': ['10px', { lineHeight: '1.3' }],
        'xs':      ['11px', { lineHeight: '1.35' }],
        'sm':      ['12px', { lineHeight: '1.4'  }],
        'base':    ['13px', { lineHeight: '1.4'  }],
        'md':      ['14px', { lineHeight: '1.35' }],
        'lg':      ['15px', { lineHeight: '1.3'  }],
        'xl':      ['16px', { lineHeight: '1.25' }],
        '2xl':     ['18px', { lineHeight: '1.2'  }],
        '3xl':     ['20px', { lineHeight: '1.15' }],
        '4xl':     ['22px', { lineHeight: '1.1'  }],
      },
      spacing: {
        /* tighter gap / padding tokens */
        '0.5':  '2px',
        '1':    '4px',
        '1.5':  '5px',
        '2':    '6px',
        '2.5':  '8px',
        '3':    '10px',
        '3.5':  '12px',
        '4':    '14px',
        '5':    '18px',
        '6':    '22px',
        '8':    '28px',
        '10':   '36px',
        '12':   '44px',
        '16':   '56px',
      },
    },
  },
  plugins: [],
}

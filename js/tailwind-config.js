tailwind.config = {
  theme: {
    extend: {
      keyframes: {
        'starburst': {
          '0%': { transform: 'scale(0)', opacity: '1' },
          '100%': { transform: 'scale(1.5)', opacity: '0' }
        },
        'toast-in': {
          '0%': { transform: 'translateY(100%)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' }
        },
        'toast-out': {
          '0%': { transform: 'translateY(0)', opacity: '1' },
          '100%': { transform: 'translateY(100%)', opacity: '0' }
        }
      },
      animation: {
        'starburst': 'starburst 0.5s ease-out forwards',
        'toast-in': 'toast-in 0.5s ease-out forwards',
        'toast-out': 'toast-out 0.5s ease-in forwards',
      }
    }
  }
}

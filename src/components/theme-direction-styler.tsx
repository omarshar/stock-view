import { useEffect } from 'react';
import { useTheme } from 'next-themes';
import { useLocalization } from '@/lib/localization';
import tailwindConfig from '@/../tailwind.config';

export default function ThemeAndDirectionStyler() {
  const { theme } = useTheme();
  const { direction } = useLocalization();
  
  useEffect(() => {
    // Apply RTL/LTR specific styles
    const root = document.documentElement;
    
    if (direction === 'rtl') {
      root.classList.add('rtl');
      root.classList.remove('ltr');
      root.dir = 'rtl';
      root.lang = 'ar';
      root.style.fontFamily = 'var(--font-cairo), sans-serif';
    } else {
      root.classList.add('ltr');
      root.classList.remove('rtl');
      root.dir = 'ltr';
      root.lang = 'en';
      root.style.fontFamily = 'var(--font-inter), sans-serif';
    }
    
    // Apply theme-specific styles
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    
    // Apply RTL-specific chart configurations
    if (typeof window !== 'undefined') {
      window.rtlChartDirection = direction === 'rtl';
    }
  }, [theme, direction]);
  
  return null;
}

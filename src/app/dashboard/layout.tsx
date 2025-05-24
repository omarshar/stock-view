import { ReactNode, useEffect } from 'react';
import { useLocalization } from '@/lib/localization';
import Header from '@/components/layout/header';
import Sidebar from '@/components/layout/sidebar';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';

interface DashboardLayoutProps {
  children: ReactNode;
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  const { direction, t } = useLocalization();
  const router = useRouter();
  
  useEffect(() => {
    const checkAuth = async () => {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        router.push('/auth/login');
      }
    };
    
    checkAuth();
  }, [router]);
  
  return (
    <div className={`min-h-screen bg-gray-100 dark:bg-gray-900 ${direction === 'rtl' ? 'rtl' : 'ltr'}`}>
      <Header />
      <div className="flex">
        <Sidebar />
        <main className="flex-1 p-4 md:p-6 pt-20 md:pt-24">
          {children}
        </main>
      </div>
    </div>
  );
}

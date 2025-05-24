import { ReactNode } from 'react';
import { useAuthStore } from '@/lib/store/auth';
import { useRouter } from 'next/navigation';
import { UserRole } from '@/types';

interface RoleGuardProps {
  children: ReactNode;
  allowedRoles: UserRole[];
  fallbackPath?: string;
}

export default function RoleGuard({ 
  children, 
  allowedRoles, 
  fallbackPath = '/dashboard' 
}: RoleGuardProps) {
  const { user, isAuthenticated, isLoading } = useAuthStore();
  const router = useRouter();
  
  // إذا كان التحميل جاري، نعرض شاشة تحميل
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="w-16 h-16 border-t-4 border-blue-500 border-solid rounded-full animate-spin"></div>
      </div>
    );
  }
  
  // إذا لم يكن المستخدم مسجل الدخول، نوجهه إلى صفحة تسجيل الدخول
  if (!isAuthenticated || !user) {
    router.push('/auth/login');
    return null;
  }
  
  // إذا لم يكن لدى المستخدم الصلاحية المطلوبة، نوجهه إلى المسار الافتراضي
  if (!allowedRoles.includes(user.role)) {
    router.push(fallbackPath);
    return null;
  }
  
  // إذا كان المستخدم لديه الصلاحية المطلوبة، نعرض المحتوى
  return <>{children}</>;
}

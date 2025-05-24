import { ReactNode } from 'react';
import { useAuthStore } from '@/lib/store/auth';
import { useRouter } from 'next/navigation';

interface BranchGuardProps {
  children: ReactNode;
  branchId: string;
  fallbackPath?: string;
}

export default function BranchGuard({ 
  children, 
  branchId, 
  fallbackPath = '/dashboard' 
}: BranchGuardProps) {
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
  
  // المشرف لديه وصول إلى جميع الفروع
  if (user.role === 'admin') {
    return <>{children}</>;
  }
  
  // مدير الفرع أو المستخدم يمكنه الوصول فقط إلى الفرع المخصص له
  if (user.branch_id !== branchId) {
    router.push(fallbackPath);
    return null;
  }
  
  // إذا كان المستخدم لديه الصلاحية للوصول إلى هذا الفرع، نعرض المحتوى
  return <>{children}</>;
}

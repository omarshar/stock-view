import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Branch, Product, ProductType, Category } from '@/types';
import RoleGuard from '@/components/auth/role-guard';
import { formatCurrency, formatDate } from '@/lib/utils/format';
import { Bar, Line, Pie } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';

// Register ChartJS components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend
);

export default function DashboardPage() {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [selectedBranch, setSelectedBranch] = useState<string>('all');
  const [dateRange, setDateRange] = useState<string>('month');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [kpiData, setKpiData] = useState({
    totalProducts: 0,
    totalInventoryValue: 0,
    lowStockItems: 0,
    purchasesValue: 0,
    wasteValue: 0,
    transformationsCount: 0,
  });
  const [inventoryByCategory, setInventoryByCategory] = useState<{labels: string[], data: number[]}>({
    labels: [],
    data: [],
  });
  const [inventoryByProductType, setInventoryByProductType] = useState<{labels: string[], data: number[]}>({
    labels: [],
    data: [],
  });
  const [purchasesTrend, setPurchasesTrend] = useState<{labels: string[], data: number[]}>({
    labels: [],
    data: [],
  });
  const [wasteTrend, setWasteTrend] = useState<{labels: string[], data: number[]}>({
    labels: [],
    data: [],
  });
  const router = useRouter();
  
  useEffect(() => {
    // Set default date range (current month)
    const today = new Date();
    const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const lastDayOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    
    setStartDate(firstDayOfMonth.toISOString().split('T')[0]);
    setEndDate(lastDayOfMonth.toISOString().split('T')[0]);
    
    // Fetch branches
    const fetchBranches = async () => {
      try {
        const supabase = createClient();
        
        const { data, error } = await supabase
          .from('branches')
          .select('*')
          .order('name', { ascending: true });
          
        if (error) {
          throw new Error(error.message);
        }
        
        setBranches(data || []);
      } catch (err: any) {
        setError(err.message || 'حدث خطأ أثناء جلب بيانات الفروع');
      }
    };
    
    fetchBranches();
  }, []);
  
  useEffect(() => {
    const fetchDashboardData = async () => {
      setIsLoading(true);
      setError(null);
      
      try {
        const supabase = createClient();
        
        // Fetch KPI data
        const fetchKPIs = async () => {
          // Total products count
          const { count: productsCount, error: productsError } = await supabase
            .from('products')
            .select('*', { count: 'exact', head: true });
            
          if (productsError) {
            throw new Error(productsError.message);
          }
          
          // Total inventory value
          let inventoryQuery = supabase
            .from('inventory_items')
            .select('quantity, average_cost');
            
          if (selectedBranch !== 'all') {
            inventoryQuery = inventoryQuery.eq('branch_id', selectedBranch);
          }
          
          const { data: inventoryData, error: inventoryError } = await inventoryQuery;
          
          if (inventoryError) {
            throw new Error(inventoryError.message);
          }
          
          const totalValue = inventoryData?.reduce((sum, item) => sum + (item.quantity * item.average_cost), 0) || 0;
          
          // Low stock items
          let lowStockQuery = supabase
            .from('inventory_items')
            .select('inventory_items.*, products!inner(min_stock_level)')
            .lt('quantity', 'products.min_stock_level');
            
          if (selectedBranch !== 'all') {
            lowStockQuery = lowStockQuery.eq('branch_id', selectedBranch);
          }
          
          const { data: lowStockData, error: lowStockError } = await lowStockQuery;
          
          if (lowStockError) {
            throw new Error(lowStockError.message);
          }
          
          // Purchases value in date range
          let purchasesQuery = supabase
            .from('purchase_invoices')
            .select('total_amount')
            .gte('created_at', startDate)
            .lte('created_at', endDate);
            
          if (selectedBranch !== 'all') {
            purchasesQuery = purchasesQuery.eq('branch_id', selectedBranch);
          }
          
          const { data: purchasesData, error: purchasesError } = await purchasesQuery;
          
          if (purchasesError) {
            throw new Error(purchasesError.message);
          }
          
          const purchasesValue = purchasesData?.reduce((sum, item) => sum + item.total_amount, 0) || 0;
          
          // Waste value in date range
          let wasteQuery = supabase
            .from('waste')
            .select('cost')
            .gte('created_at', startDate)
            .lte('created_at', endDate);
            
          if (selectedBranch !== 'all') {
            wasteQuery = wasteQuery.eq('branch_id', selectedBranch);
          }
          
          const { data: wasteData, error: wasteError } = await wasteQuery;
          
          if (wasteError) {
            throw new Error(wasteError.message);
          }
          
          const wasteValue = wasteData?.reduce((sum, item) => sum + item.cost, 0) || 0;
          
          // Transformations count in date range
          let transformationsQuery = supabase
            .from('transformations')
            .select('id', { count: 'exact', head: true })
            .gte('created_at', startDate)
            .lte('created_at', endDate);
            
          if (selectedBranch !== 'all') {
            transformationsQuery = transformationsQuery.eq('branch_id', selectedBranch);
          }
          
          const { count: transformationsCount, error: transformationsError } = await transformationsQuery;
          
          if (transformationsError) {
            throw new Error(transformationsError.message);
          }
          
          setKpiData({
            totalProducts: productsCount || 0,
            totalInventoryValue: totalValue,
            lowStockItems: lowStockData?.length || 0,
            purchasesValue,
            wasteValue,
            transformationsCount: transformationsCount || 0,
          });
        };
        
        // Fetch inventory by category
        const fetchInventoryByCategory = async () => {
          // Get all categories
          const { data: categories, error: categoriesError } = await supabase
            .from('categories')
            .select('*');
            
          if (categoriesError) {
            throw new Error(categoriesError.message);
          }
          
          // For each category, get inventory value
          const categoryValues = await Promise.all(
            categories.map(async (category) => {
              let query = supabase
                .from('inventory_items')
                .select('inventory_items.quantity, inventory_items.average_cost, products!inner(category_id)')
                .eq('products.category_id', category.id);
                
              if (selectedBranch !== 'all') {
                query = query.eq('branch_id', selectedBranch);
              }
              
              const { data, error } = await query;
              
              if (error) {
                throw new Error(error.message);
              }
              
              const value = data?.reduce((sum, item) => sum + (item.quantity * item.average_cost), 0) || 0;
              
              return {
                category: category.name,
                value,
              };
            })
          );
          
          // Sort by value and take top 5
          const sortedCategories = categoryValues
            .sort((a, b) => b.value - a.value)
            .slice(0, 5);
          
          setInventoryByCategory({
            labels: sortedCategories.map(item => item.category),
            data: sortedCategories.map(item => item.value),
          });
        };
        
        // Fetch inventory by product type
        const fetchInventoryByProductType = async () => {
          // Get all product types
          const { data: productTypes, error: productTypesError } = await supabase
            .from('product_types')
            .select('*');
            
          if (productTypesError) {
            throw new Error(productTypesError.message);
          }
          
          // For each product type, get inventory value
          const productTypeValues = await Promise.all(
            productTypes.map(async (productType) => {
              let query = supabase
                .from('inventory_items')
                .select('inventory_items.quantity, inventory_items.average_cost, products!inner(product_type_id)')
                .eq('products.product_type_id', productType.id);
                
              if (selectedBranch !== 'all') {
                query = query.eq('branch_id', selectedBranch);
              }
              
              const { data, error } = await query;
              
              if (error) {
                throw new Error(error.message);
              }
              
              const value = data?.reduce((sum, item) => sum + (item.quantity * item.average_cost), 0) || 0;
              
              return {
                productType: productType.name,
                value,
              };
            })
          );
          
          // Sort by value and take top 5
          const sortedProductTypes = productTypeValues
            .sort((a, b) => b.value - a.value)
            .slice(0, 5);
          
          setInventoryByProductType({
            labels: sortedProductTypes.map(item => item.productType),
            data: sortedProductTypes.map(item => item.value),
          });
        };
        
        // Fetch purchases trend
        const fetchPurchasesTrend = async () => {
          // Determine time intervals based on date range
          const start = new Date(startDate);
          const end = new Date(endDate);
          const diffDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
          
          let intervals: { label: string, startDate: string, endDate: string }[] = [];
          
          if (diffDays <= 31) {
            // Daily intervals
            for (let i = 0; i < diffDays; i++) {
              const date = new Date(start);
              date.setDate(date.getDate() + i);
              const dateStr = date.toISOString().split('T')[0];
              intervals.push({
                label: dateStr,
                startDate: dateStr,
                endDate: dateStr,
              });
            }
          } else if (diffDays <= 90) {
            // Weekly intervals
            let currentDate = new Date(start);
            while (currentDate <= end) {
              const weekStart = new Date(currentDate);
              const weekEnd = new Date(currentDate);
              weekEnd.setDate(weekEnd.getDate() + 6);
              
              if (weekEnd > end) {
                weekEnd.setTime(end.getTime());
              }
              
              intervals.push({
                label: `${formatDate(weekStart.toISOString())} - ${formatDate(weekEnd.toISOString())}`,
                startDate: weekStart.toISOString().split('T')[0],
                endDate: weekEnd.toISOString().split('T')[0],
              });
              
              currentDate.setDate(currentDate.getDate() + 7);
            }
          } else {
            // Monthly intervals
            let currentDate = new Date(start.getFullYear(), start.getMonth(), 1);
            while (currentDate <= end) {
              const monthStart = new Date(currentDate);
              const monthEnd = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
              
              if (monthEnd > end) {
                monthEnd.setTime(end.getTime());
              }
              
              const monthNames = ['يناير', 'فبراير', 'مارس', 'إبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
              
              intervals.push({
                label: `${monthNames[monthStart.getMonth()]} ${monthStart.getFullYear()}`,
                startDate: monthStart.toISOString().split('T')[0],
                endDate: monthEnd.toISOString().split('T')[0],
              });
              
              currentDate.setMonth(currentDate.getMonth() + 1);
            }
          }
          
          // Fetch purchases for each interval
          const purchasesData = await Promise.all(
            intervals.map(async (interval) => {
              let query = supabase
                .from('purchase_invoices')
                .select('total_amount')
                .gte('created_at', interval.startDate)
                .lte('created_at', interval.endDate);
                
              if (selectedBranch !== 'all') {
                query = query.eq('branch_id', selectedBranch);
              }
              
              const { data, error } = await query;
              
              if (error) {
                throw new Error(error.message);
              }
              
              const value = data?.reduce((sum, item) => sum + item.total_amount, 0) || 0;
              
              return {
                label: interval.label,
                value,
              };
            })
          );
          
          setPurchasesTrend({
            labels: purchasesData.map(item => item.label),
            data: purchasesData.map(item => item.value),
          });
        };
        
        // Fetch waste trend
        const fetchWasteTrend = async () => {
          // Determine time intervals based on date range
          const start = new Date(startDate);
          const end = new Date(endDate);
          const diffDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
          
          let intervals: { label: string, startDate: string, endDate: string }[] = [];
          
          if (diffDays <= 31) {
            // Daily intervals
            for (let i = 0; i < diffDays; i++) {
              const date = new Date(start);
              date.setDate(date.getDate() + i);
              const dateStr = date.toISOString().split('T')[0];
              intervals.push({
                label: dateStr,
                startDate: dateStr,
                endDate: dateStr,
              });
            }
          } else if (diffDays <= 90) {
            // Weekly intervals
            let currentDate = new Date(start);
            while (currentDate <= end) {
              const weekStart = new Date(currentDate);
              const weekEnd = new Date(currentDate);
              weekEnd.setDate(weekEnd.getDate() + 6);
              
              if (weekEnd > end) {
                weekEnd.setTime(end.getTime());
              }
              
              intervals.push({
                label: `${formatDate(weekStart.toISOString())} - ${formatDate(weekEnd.toISOString())}`,
                startDate: weekStart.toISOString().split('T')[0],
                endDate: weekEnd.toISOString().split('T')[0],
              });
              
              currentDate.setDate(currentDate.getDate() + 7);
            }
          } else {
            // Monthly intervals
            let currentDate = new Date(start.getFullYear(), start.getMonth(), 1);
            while (currentDate <= end) {
              const monthStart = new Date(currentDate);
              const monthEnd = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
              
              if (monthEnd > end) {
                monthEnd.setTime(end.getTime());
              }
              
              const monthNames = ['يناير', 'فبراير', 'مارس', 'إبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
              
              intervals.push({
                label: `${monthNames[monthStart.getMonth()]} ${monthStart.getFullYear()}`,
                startDate: monthStart.toISOString().split('T')[0],
                endDate: monthEnd.toISOString().split('T')[0],
              });
              
              currentDate.setMonth(currentDate.getMonth() + 1);
            }
          }
          
          // Fetch waste for each interval
          const wasteData = await Promise.all(
            intervals.map(async (interval) => {
              let query = supabase
                .from('waste')
                .select('cost')
                .gte('created_at', interval.startDate)
                .lte('created_at', interval.endDate);
                
              if (selectedBranch !== 'all') {
                query = query.eq('branch_id', selectedBranch);
              }
              
              const { data, error } = await query;
              
              if (error) {
                throw new Error(error.message);
              }
              
              const value = data?.reduce((sum, item) => sum + item.cost, 0) || 0;
              
              return {
                label: interval.label,
                value,
              };
            })
          );
          
          setWasteTrend({
            labels: wasteData.map(item => item.label),
            data: wasteData.map(item => item.value),
          });
        };
        
        // Execute all fetch functions
        await Promise.all([
          fetchKPIs(),
          fetchInventoryByCategory(),
          fetchInventoryByProductType(),
          fetchPurchasesTrend(),
          fetchWasteTrend(),
        ]);
        
      } catch (err: any) {
        setError(err.message || 'حدث خطأ أثناء جلب بيانات لوحة التحكم');
      } finally {
        setIsLoading(false);
      }
    };
    
    if (startDate && endDate) {
      fetchDashboardData();
    }
  }, [selectedBranch, startDate, endDate]);
  
  const handleDateRangeChange = (range: string) => {
    const today = new Date();
    let start: Date;
    let end: Date = today;
    
    switch (range) {
      case 'week':
        start = new Date(today);
        start.setDate(today.getDate() - 7);
        break;
      case 'month':
        start = new Date(today.getFullYear(), today.getMonth(), 1);
        end = new Date(today.getFullYear(), today.getMonth() + 1, 0);
        break;
      case 'quarter':
        const quarter = Math.floor(today.getMonth() / 3);
        start = new Date(today.getFullYear(), quarter * 3, 1);
        end = new Date(today.getFullYear(), (quarter + 1) * 3, 0);
        break;
      case 'year':
        start = new Date(today.getFullYear(), 0, 1);
        end = new Date(today.getFullYear(), 11, 31);
        break;
      default:
        start = new Date(today.getFullYear(), today.getMonth(), 1);
        end = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    }
    
    setDateRange(range);
    setStartDate(start.toISOString().split('T')[0]);
    setEndDate(end.toISOString().split('T')[0]);
  };

  return (
    <RoleGuard allowedRoles={['admin', 'branch_manager']}>
      <div className="p-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">لوحة التحكم</h1>
          
          <div className="flex flex-col md:flex-row gap-4">
            <div>
              <label htmlFor="branch" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                الفرع
              </label>
              <select
                id="branch"
                value={selectedBranch}
                onChange={(e) => setSelectedBranch(e.target.value)}
                className="w-full px-3 py-2 text-gray-900 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                dir="rtl"
              >
                <option value="all">جميع الفروع</option>
                {branches.map((branch) => (
                  <option key={branch.id} value={branch.id}>
                    {branch.name}
                  </option>
                ))}
              </select>
            </div>
            
            <div>
              <label htmlFor="dateRange" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                الفترة الزمنية
              </label>
              <select
                id="dateRange"
                value={dateRange}
                onChange={(e) => handleDateRangeChange(e.target.value)}
                className="w-full px-3 py-2 text-gray-900 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                dir="rtl"
              >
                <option value="week">آخر أسبوع</option>
                <option value="month">الشهر الحالي</option>
                <option value="quarter">الربع الحالي</option>
                <option value="year">السنة الحالية</option>
              </select>
            </div>
            
            <div>
              <label htmlFor="startDate" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                من تاريخ
              </label>
              <input
                id="startDate"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-3 py-2 text-gray-900 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                dir="rtl"
              />
            </div>
            
            <div>
              <label htmlFor="endDate" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                إلى تاريخ
              </label>
              <input
                id="endDate"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full px-3 py-2 text-gray-900 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                dir="rtl"
              />
            </div>
          </div>
        </div>
        
        {error && (
          <div className="p-4 mb-6 text-sm text-red-700 bg-red-100 rounded-lg dark:bg-red-900 dark:text-red-100">
            {error}
          </div>
        )}
        
        {isLoading ? (
          <div className="flex justify-center items-center h-64">
            <div className="w-16 h-16 border-t-4 border-blue-500 border-solid rounded-full animate-spin"></div>
          </div>
        ) : (
          <>
            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-6 mb-6">
              <div className="bg-white rounded-lg shadow-md dark:bg-gray-800 p-6">
                <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">إجمالي المنتجات</h3>
                <p className="text-3xl font-bold text-gray-900 dark:text-white">{kpiData.totalProducts}</p>
              </div>
              
              <div className="bg-white rounded-lg shadow-md dark:bg-gray-800 p-6">
                <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">قيمة المخزون</h3>
                <p className="text-3xl font-bold text-gray-900 dark:text-white">{formatCurrency(kpiData.totalInventoryValue)} ريال</p>
              </div>
              
              <div className="bg-white rounded-lg shadow-md dark:bg-gray-800 p-6">
                <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">منتجات منخفضة المخزون</h3>
                <p className="text-3xl font-bold text-red-600 dark:text-red-400">{kpiData.lowStockItems}</p>
              </div>
              
              <div className="bg-white rounded-lg shadow-md dark:bg-gray-800 p-6">
                <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">قيمة المشتريات</h3>
                <p className="text-3xl font-bold text-green-600 dark:text-green-400">{formatCurrency(kpiData.purchasesValue)} ريال</p>
              </div>
              
              <div className="bg-white rounded-lg shadow-md dark:bg-gray-800 p-6">
                <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">قيمة الهدر</h3>
                <p className="text-3xl font-bold text-red-600 dark:text-red-400">{formatCurrency(kpiData.wasteValue)} ريال</p>
              </div>
              
              <div className="bg-white rounded-lg shadow-md dark:bg-gray-800 p-6">
                <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">عمليات التصنيع</h3>
                <p className="text-3xl font-bold text-blue-600 dark:text-blue-400">{kpiData.transformationsCount}</p>
              </div>
            </div>
            
            {/* Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
              <div className="bg-white rounded-lg shadow-md dark:bg-gray-800 p-6">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">قيمة المخزون حسب التصنيف</h3>
                {inventoryByCategory.labels.length > 0 ? (
                  <div className="h-80">
                    <Pie
                      data={{
                        labels: inventoryByCategory.labels,
                        datasets: [
                          {
                            data: inventoryByCategory.data,
                            backgroundColor: [
                              'rgba(54, 162, 235, 0.6)',
                              'rgba(255, 99, 132, 0.6)',
                              'rgba(255, 206, 86, 0.6)',
                              'rgba(75, 192, 192, 0.6)',
                              'rgba(153, 102, 255, 0.6)',
                            ],
                            borderColor: [
                              'rgba(54, 162, 235, 1)',
                              'rgba(255, 99, 132, 1)',
                              'rgba(255, 206, 86, 1)',
                              'rgba(75, 192, 192, 1)',
                              'rgba(153, 102, 255, 1)',
                            ],
                            borderWidth: 1,
                          },
                        ],
                      }}
                      options={{
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: {
                          legend: {
                            position: 'right',
                            rtl: true,
                            labels: {
                              font: {
                                family: 'Cairo, sans-serif',
                              },
                            },
                          },
                          tooltip: {
                            callbacks: {
                              label: function(context) {
                                const value = context.raw as number;
                                return `${context.label}: ${formatCurrency(value)} ريال`;
                              }
                            }
                          }
                        },
                      }}
                    />
                  </div>
                ) : (
                  <div className="flex justify-center items-center h-80 text-gray-500 dark:text-gray-400">
                    لا توجد بيانات متاحة
                  </div>
                )}
              </div>
              
              <div className="bg-white rounded-lg shadow-md dark:bg-gray-800 p-6">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">قيمة المخزون حسب نوع المنتج</h3>
                {inventoryByProductType.labels.length > 0 ? (
                  <div className="h-80">
                    <Bar
                      data={{
                        labels: inventoryByProductType.labels,
                        datasets: [
                          {
                            label: 'قيمة المخزون',
                            data: inventoryByProductType.data,
                            backgroundColor: 'rgba(54, 162, 235, 0.6)',
                            borderColor: 'rgba(54, 162, 235, 1)',
                            borderWidth: 1,
                          },
                        ],
                      }}
                      options={{
                        responsive: true,
                        maintainAspectRatio: false,
                        indexAxis: 'y',
                        plugins: {
                          legend: {
                            display: false,
                          },
                          tooltip: {
                            callbacks: {
                              label: function(context) {
                                const value = context.raw as number;
                                return `${formatCurrency(value)} ريال`;
                              }
                            }
                          }
                        },
                        scales: {
                          x: {
                            ticks: {
                              callback: function(value) {
                                return formatCurrency(value as number) + ' ريال';
                              }
                            }
                          },
                          y: {
                            ticks: {
                              font: {
                                family: 'Cairo, sans-serif',
                              },
                            }
                          }
                        }
                      }}
                    />
                  </div>
                ) : (
                  <div className="flex justify-center items-center h-80 text-gray-500 dark:text-gray-400">
                    لا توجد بيانات متاحة
                  </div>
                )}
              </div>
              
              <div className="bg-white rounded-lg shadow-md dark:bg-gray-800 p-6">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">اتجاه المشتريات</h3>
                {purchasesTrend.labels.length > 0 ? (
                  <div className="h-80">
                    <Line
                      data={{
                        labels: purchasesTrend.labels,
                        datasets: [
                          {
                            label: 'قيمة المشتريات',
                            data: purchasesTrend.data,
                            fill: false,
                            backgroundColor: 'rgba(75, 192, 192, 0.6)',
                            borderColor: 'rgba(75, 192, 192, 1)',
                            tension: 0.1,
                          },
                        ],
                      }}
                      options={{
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: {
                          legend: {
                            display: false,
                          },
                          tooltip: {
                            callbacks: {
                              label: function(context) {
                                const value = context.raw as number;
                                return `${formatCurrency(value)} ريال`;
                              }
                            }
                          }
                        },
                        scales: {
                          y: {
                            ticks: {
                              callback: function(value) {
                                return formatCurrency(value as number) + ' ريال';
                              }
                            }
                          },
                          x: {
                            ticks: {
                              font: {
                                family: 'Cairo, sans-serif',
                              },
                              maxRotation: 45,
                              minRotation: 45,
                            }
                          }
                        }
                      }}
                    />
                  </div>
                ) : (
                  <div className="flex justify-center items-center h-80 text-gray-500 dark:text-gray-400">
                    لا توجد بيانات متاحة
                  </div>
                )}
              </div>
              
              <div className="bg-white rounded-lg shadow-md dark:bg-gray-800 p-6">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">اتجاه الهدر</h3>
                {wasteTrend.labels.length > 0 ? (
                  <div className="h-80">
                    <Line
                      data={{
                        labels: wasteTrend.labels,
                        datasets: [
                          {
                            label: 'قيمة الهدر',
                            data: wasteTrend.data,
                            fill: false,
                            backgroundColor: 'rgba(255, 99, 132, 0.6)',
                            borderColor: 'rgba(255, 99, 132, 1)',
                            tension: 0.1,
                          },
                        ],
                      }}
                      options={{
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: {
                          legend: {
                            display: false,
                          },
                          tooltip: {
                            callbacks: {
                              label: function(context) {
                                const value = context.raw as number;
                                return `${formatCurrency(value)} ريال`;
                              }
                            }
                          }
                        },
                        scales: {
                          y: {
                            ticks: {
                              callback: function(value) {
                                return formatCurrency(value as number) + ' ريال';
                              }
                            }
                          },
                          x: {
                            ticks: {
                              font: {
                                family: 'Cairo, sans-serif',
                              },
                              maxRotation: 45,
                              minRotation: 45,
                            }
                          }
                        }
                      }}
                    />
                  </div>
                ) : (
                  <div className="flex justify-center items-center h-80 text-gray-500 dark:text-gray-400">
                    لا توجد بيانات متاحة
                  </div>
                )}
              </div>
            </div>
            
            {/* Quick Links */}
            <div className="bg-white rounded-lg shadow-md dark:bg-gray-800 p-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">روابط سريعة</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <button
                  onClick={() => router.push('/dashboard/inventory')}
                  className="flex items-center p-4 bg-blue-50 rounded-lg hover:bg-blue-100 dark:bg-blue-900 dark:hover:bg-blue-800 transition-colors"
                >
                  <div className="p-3 bg-blue-100 rounded-full dark:bg-blue-800">
                    <svg className="w-6 h-6 text-blue-600 dark:text-blue-300" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                    </svg>
                  </div>
                  <div className="mr-4">
                    <h4 className="text-lg font-medium text-gray-900 dark:text-white">المخزون</h4>
                    <p className="text-sm text-gray-500 dark:text-gray-400">عرض وتعديل المخزون</p>
                  </div>
                </button>
                
                <button
                  onClick={() => router.push('/dashboard/purchases/add')}
                  className="flex items-center p-4 bg-green-50 rounded-lg hover:bg-green-100 dark:bg-green-900 dark:hover:bg-green-800 transition-colors"
                >
                  <div className="p-3 bg-green-100 rounded-full dark:bg-green-800">
                    <svg className="w-6 h-6 text-green-600 dark:text-green-300" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                  </div>
                  <div className="mr-4">
                    <h4 className="text-lg font-medium text-gray-900 dark:text-white">فاتورة شراء</h4>
                    <p className="text-sm text-gray-500 dark:text-gray-400">إنشاء فاتورة شراء جديدة</p>
                  </div>
                </button>
                
                <button
                  onClick={() => router.push('/dashboard/transformations/add')}
                  className="flex items-center p-4 bg-purple-50 rounded-lg hover:bg-purple-100 dark:bg-purple-900 dark:hover:bg-purple-800 transition-colors"
                >
                  <div className="p-3 bg-purple-100 rounded-full dark:bg-purple-800">
                    <svg className="w-6 h-6 text-purple-600 dark:text-purple-300" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                    </svg>
                  </div>
                  <div className="mr-4">
                    <h4 className="text-lg font-medium text-gray-900 dark:text-white">عملية تصنيع</h4>
                    <p className="text-sm text-gray-500 dark:text-gray-400">إنشاء عملية تصنيع جديدة</p>
                  </div>
                </button>
                
                <button
                  onClick={() => router.push('/dashboard/inventory-audits/add')}
                  className="flex items-center p-4 bg-yellow-50 rounded-lg hover:bg-yellow-100 dark:bg-yellow-900 dark:hover:bg-yellow-800 transition-colors"
                >
                  <div className="p-3 bg-yellow-100 rounded-full dark:bg-yellow-800">
                    <svg className="w-6 h-6 text-yellow-600 dark:text-yellow-300" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                    </svg>
                  </div>
                  <div className="mr-4">
                    <h4 className="text-lg font-medium text-gray-900 dark:text-white">جرد المخزون</h4>
                    <p className="text-sm text-gray-500 dark:text-gray-400">إنشاء جرد مخزون جديد</p>
                  </div>
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </RoleGuard>
  );
}

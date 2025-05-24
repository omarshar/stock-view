import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Branch } from '@/types';
import RoleGuard from '@/components/auth/role-guard';
import { formatCurrency, formatDate } from '@/lib/utils/format';
import { Bar, Pie } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
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
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend
);

export default function WasteReportPage() {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [selectedBranch, setSelectedBranch] = useState<string>('all');
  const [dateRange, setDateRange] = useState<string>('month');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [reportType, setReportType] = useState<string>('summary');
  const [wasteData, setWasteData] = useState<{
    totalCost: number;
    totalQuantity: number;
    recordCount: number;
    productCount: number;
    byProduct: { name: string; cost: number; quantity: number }[];
    byReason: { reason: string; cost: number }[];
    byDate: { date: string; cost: number }[];
    records: any[];
  }>({
    totalCost: 0,
    totalQuantity: 0,
    recordCount: 0,
    productCount: 0,
    byProduct: [],
    byReason: [],
    byDate: [],
    records: [],
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
    const fetchReportData = async () => {
      if (!startDate || !endDate) return;
      
      setIsLoading(true);
      setError(null);
      
      try {
        const supabase = createClient();
        
        // Base query for waste records
        let query = supabase
          .from('waste')
          .select(`
            *,
            branch:branch_id (name),
            product:product_id (name, unit),
            user:created_by (full_name)
          `)
          .gte('created_at', startDate)
          .lte('created_at', endDate);
          
        if (selectedBranch !== 'all') {
          query = query.eq('branch_id', selectedBranch);
        }
        
        const { data: records, error: recordsError } = await query;
        
        if (recordsError) {
          throw new Error(recordsError.message);
        }
        
        // Process data for report
        const totalCost = records?.reduce((sum, record) => sum + record.cost, 0) || 0;
        const totalQuantity = records?.reduce((sum, record) => sum + record.quantity, 0) || 0;
        const recordCount = records?.length || 0;
        
        // Get unique products
        const products = new Set();
        records?.forEach(record => {
          if (record.product_id) {
            products.add(record.product_id);
          }
        });
        
        // Group by product
        const productMap = new Map();
        records?.forEach(record => {
          if (record.product && record.product.name) {
            const productName = record.product.name;
            const currentData = productMap.get(productName) || { cost: 0, quantity: 0 };
            productMap.set(productName, {
              cost: currentData.cost + record.cost,
              quantity: currentData.quantity + record.quantity,
              unit: record.product.unit
            });
          }
        });
        
        const byProduct = Array.from(productMap.entries())
          .map(([name, data]) => ({ 
            name, 
            cost: (data as any).cost,
            quantity: (data as any).quantity,
            unit: (data as any).unit
          }))
          .sort((a, b) => b.cost - a.cost)
          .slice(0, 10);
        
        // Group by reason
        const reasonMap = new Map();
        records?.forEach(record => {
          if (record.reason) {
            const currentCost = reasonMap.get(record.reason) || 0;
            reasonMap.set(record.reason, currentCost + record.cost);
          }
        });
        
        const byReason = Array.from(reasonMap.entries())
          .map(([reason, cost]) => ({ reason, cost: cost as number }))
          .sort((a, b) => b.cost - a.cost);
        
        // Group by date
        const dateMap = new Map();
        records?.forEach(record => {
          const date = record.created_at.split('T')[0];
          const currentCost = dateMap.get(date) || 0;
          dateMap.set(date, currentCost + record.cost);
        });
        
        const byDate = Array.from(dateMap.entries())
          .map(([date, cost]) => ({ date, cost: cost as number }))
          .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
        
        // Format records for table display
        const formattedRecords = records?.map(record => ({
          ...record,
          branch_name: record.branch?.name || 'غير معروف',
          product_name: record.product?.name || 'غير معروف',
          product_unit: record.product?.unit || '',
          user_name: record.user?.full_name || 'غير معروف',
        })) || [];
        
        setWasteData({
          totalCost,
          totalQuantity,
          recordCount,
          productCount: products.size,
          byProduct,
          byReason,
          byDate,
          records: formattedRecords,
        });
        
      } catch (err: any) {
        setError(err.message || 'حدث خطأ أثناء جلب بيانات التقرير');
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchReportData();
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
  
  const handleExportCSV = () => {
    // Generate CSV content
    let csvContent = 'data:text/csv;charset=utf-8,';
    
    // Add headers
    csvContent += 'التاريخ,الفرع,المنتج,الكمية,الوحدة,التكلفة,السبب,بواسطة\n';
    
    // Add rows
    wasteData.records.forEach(record => {
      csvContent += `${formatDate(record.created_at)},${record.branch_name},${record.product_name},${record.quantity},${record.product_unit},${record.cost},${record.reason},${record.user_name}\n`;
    });
    
    // Create download link
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `تقرير_الهدر_${startDate}_${endDate}.csv`);
    document.body.appendChild(link);
    
    // Trigger download
    link.click();
    
    // Clean up
    document.body.removeChild(link);
  };
  
  const handlePrint = () => {
    window.print();
  };

  return (
    <RoleGuard allowedRoles={['admin', 'branch_manager']}>
      <div className="p-6 print:p-0">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4 print:hidden">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">تقرير الهدر</h1>
          
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
            
            <div>
              <label htmlFor="reportType" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                نوع التقرير
              </label>
              <select
                id="reportType"
                value={reportType}
                onChange={(e) => setReportType(e.target.value)}
                className="w-full px-3 py-2 text-gray-900 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                dir="rtl"
              >
                <option value="summary">ملخص</option>
                <option value="detailed">تفصيلي</option>
              </select>
            </div>
          </div>
        </div>
        
        <div className="print:hidden flex justify-end gap-2 mb-4">
          <button
            onClick={handleExportCSV}
            className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
          >
            تصدير CSV
          </button>
          <button
            onClick={handlePrint}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            طباعة
          </button>
        </div>
        
        {error && (
          <div className="p-4 mb-6 text-sm text-red-700 bg-red-100 rounded-lg dark:bg-red-900 dark:text-red-100 print:hidden">
            {error}
          </div>
        )}
        
        {isLoading ? (
          <div className="flex justify-center items-center h-64 print:hidden">
            <div className="w-16 h-16 border-t-4 border-blue-500 border-solid rounded-full animate-spin"></div>
          </div>
        ) : (
          <>
            <div className="print:block print:mb-8">
              <h1 className="text-2xl font-bold text-center mb-2 hidden print:block">تقرير الهدر</h1>
              <p className="text-center text-gray-600 hidden print:block">
                {selectedBranch === 'all' 
                  ? 'جميع الفروع' 
                  : `الفرع: ${branches.find(b => b.id === selectedBranch)?.name || ''}`}
                {' | '}
                الفترة: {formatDate(startDate)} - {formatDate(endDate)}
              </p>
            </div>
            
            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
              <div className="bg-white rounded-lg shadow-md dark:bg-gray-800 p-6 print:border print:border-gray-300">
                <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">إجمالي تكلفة الهدر</h3>
                <p className="text-3xl font-bold text-red-600 dark:text-red-400">{formatCurrency(wasteData.totalCost)} ريال</p>
              </div>
              
              <div className="bg-white rounded-lg shadow-md dark:bg-gray-800 p-6 print:border print:border-gray-300">
                <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">عدد سجلات الهدر</h3>
                <p className="text-3xl font-bold text-gray-900 dark:text-white">{wasteData.recordCount}</p>
              </div>
              
              <div className="bg-white rounded-lg shadow-md dark:bg-gray-800 p-6 print:border print:border-gray-300">
                <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">عدد المنتجات المهدرة</h3>
                <p className="text-3xl font-bold text-gray-900 dark:text-white">{wasteData.productCount}</p>
              </div>
              
              <div className="bg-white rounded-lg shadow-md dark:bg-gray-800 p-6 print:border print:border-gray-300">
                <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">متوسط تكلفة الهدر اليومي</h3>
                <p className="text-3xl font-bold text-gray-900 dark:text-white">
                  {wasteData.byDate.length > 0 
                    ? formatCurrency(wasteData.totalCost / wasteData.byDate.length) 
                    : '0'} ريال
                </p>
              </div>
            </div>
            
            {/* Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6 print:hidden">
              <div className="bg-white rounded-lg shadow-md dark:bg-gray-800 p-6">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">الهدر حسب المنتج (أعلى 10)</h3>
                {wasteData.byProduct.length > 0 ? (
                  <div className="h-80">
                    <Bar
                      data={{
                        labels: wasteData.byProduct.map(item => item.name),
                        datasets: [
                          {
                            label: 'تكلفة الهدر',
                            data: wasteData.byProduct.map(item => item.cost),
                            backgroundColor: 'rgba(255, 99, 132, 0.6)',
                            borderColor: 'rgba(255, 99, 132, 1)',
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
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">الهدر حسب السبب</h3>
                {wasteData.byReason.length > 0 ? (
                  <div className="h-80">
                    <Pie
                      data={{
                        labels: wasteData.byReason.map(item => item.reason),
                        datasets: [
                          {
                            data: wasteData.byReason.map(item => item.cost),
                            backgroundColor: [
                              'rgba(255, 99, 132, 0.6)',
                              'rgba(54, 162, 235, 0.6)',
                              'rgba(255, 206, 86, 0.6)',
                              'rgba(75, 192, 192, 0.6)',
                              'rgba(153, 102, 255, 0.6)',
                              'rgba(255, 159, 64, 0.6)',
                              'rgba(199, 199, 199, 0.6)',
                            ],
                            borderColor: [
                              'rgba(255, 99, 132, 1)',
                              'rgba(54, 162, 235, 1)',
                              'rgba(255, 206, 86, 1)',
                              'rgba(75, 192, 192, 1)',
                              'rgba(153, 102, 255, 1)',
                              'rgba(255, 159, 64, 1)',
                              'rgba(199, 199, 199, 1)',
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
              
              <div className="bg-white rounded-lg shadow-md dark:bg-gray-800 p-6 lg:col-span-2">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">اتجاه الهدر</h3>
                {wasteData.byDate.length > 0 ? (
                  <div className="h-80">
                    <Bar
                      data={{
                        labels: wasteData.byDate.map(item => formatDate(item.date)),
                        datasets: [
                          {
                            label: 'تكلفة الهدر',
                            data: wasteData.byDate.map(item => item.cost),
                            backgroundColor: 'rgba(255, 99, 132, 0.6)',
                            borderColor: 'rgba(255, 99, 132, 1)',
                            borderWidth: 1,
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
            
            {/* Detailed Report */}
            {reportType === 'detailed' && (
              <div className="bg-white rounded-lg shadow-md dark:bg-gray-800 p-6 print:p-0 print:shadow-none">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 print:text-black">تفاصيل سجلات الهدر</h3>
                
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700 print:border print:border-gray-300">
                    <thead className="bg-gray-50 dark:bg-gray-800 print:bg-gray-100">
                      <tr>
                        <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400 print:text-black">
                          التاريخ
                        </th>
                        <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400 print:text-black">
                          الفرع
                        </th>
                        <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400 print:text-black">
                          المنتج
                        </th>
                        <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400 print:text-black">
                          الكمية
                        </th>
                        <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400 print:text-black">
                          التكلفة
                        </th>
                        <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400 print:text-black">
                          السبب
                        </th>
                        <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400 print:text-black">
                          بواسطة
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200 dark:bg-gray-900 dark:divide-gray-700 print:bg-white">
                      {wasteData.records.map((record) => (
                        <tr key={record.id}>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400 print:text-black">
                            {formatDate(record.created_at)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400 print:text-black">
                            {record.branch_name}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400 print:text-black">
                            {record.product_name}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400 print:text-black">
                            {record.quantity} {record.product_unit}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400 print:text-black">
                            {formatCurrency(record.cost)} ريال
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400 print:text-black">
                            {record.reason}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400 print:text-black">
                            {record.user_name}
                          </td>
                        </tr>
                      ))}
                      
                      {wasteData.records.length === 0 && (
                        <tr>
                          <td colSpan={7} className="px-6 py-4 text-center text-sm text-gray-500 dark:text-gray-400 print:text-black">
                            لا توجد سجلات هدر في هذه الفترة
                          </td>
                        </tr>
                      )}
                    </tbody>
                    <tfoot className="bg-gray-50 dark:bg-gray-800 print:bg-gray-100">
                      <tr>
                        <td colSpan={3} className="px-6 py-4 text-sm font-medium text-gray-900 dark:text-white print:text-black">
                          الإجمالي
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white print:text-black">
                          {wasteData.totalQuantity}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white print:text-black">
                          {formatCurrency(wasteData.totalCost)} ريال
                        </td>
                        <td colSpan={2} className="px-6 py-4 whitespace-nowrap text-sm font-medium print:text-black"></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </RoleGuard>
  );
}

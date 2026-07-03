import { lazy, Suspense } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "@/lib/query-client";
import { BrowserRouter, Navigate, Route, Routes, useLocation } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { tokenStorage } from "@/lib/auth";
import { useCurrentUser } from "@/hooks/useCurrentUser";

// Ленивая загрузка страниц → каждый маршрут попадает в отдельный чанк и
// подгружается по требованию. Это резко уменьшает размер первичного бандла
// (тяжёлые страницы с графиками/таблицами не блокируют первый рендер).
const Index = lazy(() => import("./pages/Index.tsx"));
const ChatPage = lazy(() => import("./pages/ChatPage.tsx"));
const KnowledgeBase = lazy(() => import("./pages/KnowledgeBase.tsx"));
const DocumentAnalysis = lazy(() => import("./pages/DocumentAnalysis.tsx"));
const BidEvaluationPage = lazy(() => import("./pages/BidEvaluationPage.tsx"));
const BidCheckPage = lazy(() => import("./pages/BidCheckPage.tsx"));
const BatchCheckPage = lazy(() => import("./pages/BatchCheckPage.tsx"));
const NmckPage = lazy(() => import("./pages/NmckPage.tsx"));
const HistoryPage = lazy(() => import("./pages/HistoryPage.tsx"));
const SettingsPage = lazy(() => import("./pages/SettingsPage.tsx"));
const ProcurementsPage = lazy(() => import("./pages/ProcurementsPage.tsx"));
const ProcurementDetailPage = lazy(() => import("./pages/ProcurementDetailPage.tsx"));
const TemplatesPage = lazy(() => import("./pages/TemplatesPage.tsx"));
const CalendarPage = lazy(() => import("./pages/CalendarPage.tsx"));
const OrganizationPage = lazy(() => import("./pages/OrganizationPage.tsx"));
const BillingPage = lazy(() => import("./pages/BillingPage.tsx"));
const InstructionsPage = lazy(() => import("./pages/InstructionsPage.tsx"));
const CheckSupplierPage = lazy(() => import("./pages/CheckSupplierPage.tsx"));
const NotificationsPage = lazy(() => import("./pages/NotificationsPage.tsx"));
const LoginPage = lazy(() => import("./pages/LoginPage.tsx"));
const ForgotPasswordPage = lazy(() => import("./pages/ForgotPasswordPage.tsx"));
const ResetPasswordPage = lazy(() => import("./pages/ResetPasswordPage.tsx"));
const VerifyEmailPage = lazy(() => import("./pages/VerifyEmailPage.tsx"));
const NotFound = lazy(() => import("./pages/NotFound.tsx"));
const AdminPage = lazy(() => import("./pages/AdminPage.tsx"));
const NationalRegimePage = lazy(() => import("./pages/NationalRegimePage.tsx"));

function RouteFallback() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-muted border-t-foreground" />
    </div>
  );
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  if (!tokenStorage.isAuthenticated()) {
    return <Navigate to="/login" replace />;
  }
  return <>{children}</>;
}

function AdminRoute({ children }: { children: React.ReactNode }) {
  const { data: currentUser, isLoading } = useCurrentUser();
  if (!tokenStorage.isAuthenticated()) return <Navigate to="/login" replace />;
  if (isLoading) return null;
  if (currentUser?.role !== "admin") return <Navigate to="/" replace />;
  return <>{children}</>;
}

// Принудительно перемонтирует ChatPage при изменении query-параметров (?docId, ?procurement).
// Без этого React Router переиспользует один экземпляр компонента для разных контекстов
// и useState-значения (procurementId, docId) остаются от предыдущей навигации.
// Remounts ChatPage when search params change (?session, ?procurement, ?docId)
function ChatPageWithKey() {
  const { search } = useLocation();
  return <ChatPage key={search} />;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Suspense fallback={<RouteFallback />}>
        <Routes>
          {/* Публичные маршруты */}
          <Route path="/login" element={<LoginPage />} />
          {/* /register — точка входа по ссылке-приглашению (?invite=…) */}
          <Route path="/register" element={<LoginPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />
          <Route path="/verify-email" element={<VerifyEmailPage />} />

          {/* Защищённые маршруты */}
          <Route path="/" element={<ProtectedRoute><Index /></ProtectedRoute>} />
          <Route path="/chat" element={<ProtectedRoute><ChatPageWithKey /></ProtectedRoute>} />
          <Route path="/knowledge" element={<ProtectedRoute><KnowledgeBase /></ProtectedRoute>} />
          <Route path="/analysis" element={<ProtectedRoute><DocumentAnalysis /></ProtectedRoute>} />
          <Route path="/bid-evaluation" element={<ProtectedRoute><BidEvaluationPage /></ProtectedRoute>} />
          <Route path="/bid-check" element={<ProtectedRoute><BidCheckPage /></ProtectedRoute>} />
          <Route path="/batch-check" element={<ProtectedRoute><BatchCheckPage /></ProtectedRoute>} />
          <Route path="/nmck" element={<ProtectedRoute><NmckPage /></ProtectedRoute>} />
          <Route path="/procurements" element={<ProtectedRoute><ProcurementsPage /></ProtectedRoute>} />
          <Route path="/procurements/:id" element={<ProtectedRoute><ProcurementDetailPage /></ProtectedRoute>} />
          <Route path="/templates" element={<ProtectedRoute><TemplatesPage /></ProtectedRoute>} />
          <Route path="/calendar" element={<ProtectedRoute><CalendarPage /></ProtectedRoute>} />
          <Route path="/history" element={<ProtectedRoute><HistoryPage /></ProtectedRoute>} />
          <Route path="/settings" element={<ProtectedRoute><SettingsPage /></ProtectedRoute>} />
          <Route path="/organization" element={<ProtectedRoute><OrganizationPage /></ProtectedRoute>} />
          <Route path="/billing" element={<ProtectedRoute><BillingPage /></ProtectedRoute>} />
          <Route path="/instructions" element={<ProtectedRoute><InstructionsPage /></ProtectedRoute>} />
          <Route path="/check-supplier" element={<ProtectedRoute><CheckSupplierPage /></ProtectedRoute>} />
          <Route path="/notifications" element={<ProtectedRoute><NotificationsPage /></ProtectedRoute>} />
          <Route path="/national-regime" element={<ProtectedRoute><NationalRegimePage /></ProtectedRoute>} />
          <Route path="/admin" element={<AdminRoute><AdminPage /></AdminRoute>} />

          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
        </Suspense>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;

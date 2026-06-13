import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "@/lib/query-client";
import { BrowserRouter, Navigate, Route, Routes, useLocation } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { tokenStorage } from "@/lib/auth";
import Index from "./pages/Index.tsx";
import ChatPage from "./pages/ChatPage.tsx";
import KnowledgeBase from "./pages/KnowledgeBase.tsx";
import DocumentAnalysis from "./pages/DocumentAnalysis.tsx";
import HistoryPage from "./pages/HistoryPage.tsx";
import SettingsPage from "./pages/SettingsPage.tsx";
import ProcurementsPage from "./pages/ProcurementsPage.tsx";
import ProcurementDetailPage from "./pages/ProcurementDetailPage.tsx";
import TemplatesPage from "./pages/TemplatesPage.tsx";
import CalendarPage from "./pages/CalendarPage.tsx";
import OrganizationPage from "./pages/OrganizationPage.tsx";
import BillingPage from "./pages/BillingPage.tsx";
import InstructionsPage from "./pages/InstructionsPage.tsx";
import CheckSupplierPage from "./pages/CheckSupplierPage.tsx";
import NotificationsPage from "./pages/NotificationsPage.tsx";
import LoginPage from "./pages/LoginPage.tsx";
import ForgotPasswordPage from "./pages/ForgotPasswordPage.tsx";
import ResetPasswordPage from "./pages/ResetPasswordPage.tsx";
import VerifyEmailPage from "./pages/VerifyEmailPage.tsx";
import NotFound from "./pages/NotFound.tsx";
import AdminPage from "./pages/AdminPage.tsx";
import NationalRegimePage from "./pages/NationalRegimePage.tsx";
import { useCurrentUser } from "@/hooks/useCurrentUser";

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
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Index from "./pages/Index.tsx";
import ChatPage from "./pages/ChatPage.tsx";
import KnowledgeBase from "./pages/KnowledgeBase.tsx";
import DocumentAnalysis from "./pages/DocumentAnalysis.tsx";
import HistoryPage from "./pages/HistoryPage.tsx";
import SettingsPage from "./pages/SettingsPage.tsx";
import ProcurementsPage from "./pages/ProcurementsPage.tsx";
import TemplatesPage from "./pages/TemplatesPage.tsx";
import NotFound from "./pages/NotFound.tsx";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/chat" element={<ChatPage />} />
          <Route path="/knowledge" element={<KnowledgeBase />} />
          <Route path="/analysis" element={<DocumentAnalysis />} />
          <Route path="/procurements" element={<ProcurementsPage />} />
          <Route path="/templates" element={<TemplatesPage />} />
          <Route path="/history" element={<HistoryPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;

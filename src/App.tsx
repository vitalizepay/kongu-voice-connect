import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { LanguageProvider } from "@/contexts/LanguageContext";
import Index from "./pages/Index";
import Candidates2026 from "./pages/Candidates2026";
import Erode from "./pages/districts/Erode";
import Coimbatore from "./pages/districts/Coimbatore";
import Tiruppur from "./pages/districts/Tiruppur";
import Salem from "./pages/districts/Salem";
import Namakkal from "./pages/districts/Namakkal";
import Nilgiris from "./pages/districts/Nilgiris";
import Karur from "./pages/districts/Karur";
import Dharmapuri from "./pages/districts/Dharmapuri";
import ManageContent from "./pages/ManageContent";
import ArticlePage from "./pages/ArticlePage";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <LanguageProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/candidates-2026" element={<Candidates2026 />} />
            <Route path="/erode" element={<Erode />} />
            <Route path="/coimbatore" element={<Coimbatore />} />
            <Route path="/tiruppur" element={<Tiruppur />} />
            <Route path="/salem" element={<Salem />} />
            <Route path="/namakkal" element={<Namakkal />} />
            <Route path="/nilgiris" element={<Nilgiris />} />
            <Route path="/karur" element={<Karur />} />
            <Route path="/dharmapuri" element={<Dharmapuri />} />
            <Route path="/manage-content" element={<ManageContent />} />
            {/* Article detail pages: /:district/article/:id */}
            <Route path="/:district/article/:id" element={<ArticlePage />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </LanguageProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;

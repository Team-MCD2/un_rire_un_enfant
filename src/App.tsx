import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import Admin from "./pages/Admin";
import BottomNav from "@/components/BottomNav";
import ChatBotBubble from "@/components/ChatBotBubble";
import Index from "./pages/Index";
import Blog from "./pages/Blog";
import Chat from "./pages/Chat";
import Distribution from "./pages/Distribution";
import Support from "./pages/Support";
import Profile from "./pages/Profile";
import Login from "./pages/Login";
import ResetPassword from "./pages/ResetPassword";
import Ideas from "./pages/Ideas";
import NotFound from "./pages/NotFound";
import PrivateChat from "./pages/PrivateChat";
import ContactAdmin from "./pages/ContactAdmin";
import Authorizations from "./pages/Authorizations";
import Legal from "./pages/Legal";
import InstallPrompt from "@/components/InstallPrompt";
import CookieBanner from "@/components/CookieBanner";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/blog" element={<Blog />} />
            <Route path="/chat" element={<Chat />} />
            <Route path="/distribution" element={<Distribution />} />
            <Route path="/soutenir" element={<Support />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/login" element={<Login />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/admin" element={<Admin />} />
            <Route path="/messages" element={<PrivateChat />} />
            <Route path="/messages/:recipientId" element={<PrivateChat />} />
            <Route path="/contact" element={<ContactAdmin />} />
            <Route path="/documents" element={<Authorizations />} />
            <Route path="/legal" element={<Legal />} />
            <Route path="/ideas" element={<Ideas />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
          <BottomNav />
          <ChatBotBubble />
          <InstallPrompt />
          <CookieBanner />
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;

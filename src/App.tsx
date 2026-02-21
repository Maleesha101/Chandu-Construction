import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";

import Index from "./pages/Index";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import Expenses from "./pages/Expenses";
import NewExpense from "./pages/NewExpense";
import Approvals from "./pages/Approvals";
import QSQueue from "./pages/QSQueue";
import Reports from "./pages/Reports";
import Ledger from "./pages/Ledger";
import Sites from "./pages/Sites";
import SiteExpenses from "./pages/SiteExpenses";
import Users from "./pages/Users";
import SupervisorDetails from "./pages/SupervisorDetails";
import SetupRole from "./pages/SetupRole";
import BankManagement from "./pages/BankManagement";
import Settings from "./pages/Settings";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/setup-role" element={<SetupRole />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/expenses" element={<Expenses />} />
            <Route path="/expenses/new" element={
              <ProtectedRoute allowedRoles={['boss', 'admin']}>
                <NewExpense />
              </ProtectedRoute>
            } />
            <Route path="/expenses/edit/:id" element={
              <ProtectedRoute allowedRoles={['boss']}>
                <NewExpense />
              </ProtectedRoute>
            } />
            <Route path="/approvals" element={<Approvals />} />
            <Route path="/qs-queue" element={<QSQueue />} />
            <Route path="/reports" element={<Reports />} />
            <Route path="/ledger" element={
              <ProtectedRoute allowedRoles={['boss', 'admin']}>
                <Ledger />
              </ProtectedRoute>
            } />
            <Route path="/sites" element={<Sites />} />
            <Route path="/sites/:siteId" element={<SiteExpenses />} />
            <Route path="/users" element={<Users />} />
            <Route path="/users/:userId" element={<SupervisorDetails />} />
            <Route path="/settings/banks" element={
              <ProtectedRoute allowedRoles={['boss', 'admin']}>
                <BankManagement />
              </ProtectedRoute>
            } />
            <Route path="/settings" element={<Settings />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;

import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { HashRouter, Routes, Route, Navigate, useParams } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import Login from "./pages/Login";
import { ProjectProvider } from "@/contexts/ProjectContext";
import { StandardSuppliersProvider } from "@/contexts/StandardSuppliersContext";
import { StandardMaterialsProvider } from "@/contexts/StandardMaterialsContext";
import { ProjectMaterialsProvider } from "@/contexts/ProjectMaterialsContext";
import { PurchaseOrdersProvider } from "@/contexts/PurchaseOrdersContext";
import { TransportProvider } from "@/contexts/TransportContext";
import { ProjectProductsProvider } from "@/contexts/ProjectProductsContext";
import { CompaniesProvider } from "@/contexts/CompaniesContext";
import { EmployeesProvider } from "@/contexts/EmployeesContext";
import { CompanySettingsProvider } from "@/contexts/CompanySettingsContext";
import {
  PurchasingProvider,
  PurchasingOverview,
  RFQCreate,
  RFQDetail,
  RFQCompare,
  QuoteReviewQueue,
} from "@/features/purchasing";
import { LeadsProvider, LeadsInbox, LeadDetail } from "@/features/leads";
import Index from "./pages/Index";
import ProjectOverview from "./pages/ProjectOverview";
import Products from "./pages/Products";
import ProductDetail from "./pages/ProductDetail";
import Materials from "./pages/Materials";
import Suppliers from "./pages/Suppliers";
import Quotes from "./pages/Quotes";
import ProjectQuotes from "./pages/ProjectQuotes";
import AllQuotes from "./pages/AllQuotes";
import ProjectQuoteDetail from "./pages/ProjectQuoteDetail";
import ProjectBudgets from "./pages/ProjectBudgets";
import ProjectBudgetDetail from "./pages/ProjectBudgetDetail";
import PriceRequests from "./pages/PriceRequests";
import PriceRequestForm from "./pages/PriceRequestForm";
import PriceRequestDetail from "./pages/PriceRequestDetail";
import Budget from "./pages/Budget";
import BOM from "./pages/BOM";
import PurchaseOrders from "./pages/PurchaseOrders";
import PurchaseOrderDetail from "./pages/PurchaseOrderDetail";
import Companies from "./pages/Companies";
import Contacts from "./pages/Contacts";
import Employees from "./pages/Employees";
import Settings from "./pages/Settings";
import StandardSuppliers from "./pages/StandardSuppliers";
import StandardSupplierDetail from "./pages/StandardSupplierDetail";
import StandardMaterials from "./pages/StandardMaterials";
import MaterialDetail from "./pages/MaterialDetail";
import ProjectMaterials from "./pages/ProjectMaterials";
import ProjectMaterialsV1 from "./pages/ProjectMaterialsV1";
import ProjectMaterialDetail from "./pages/ProjectMaterialDetail";
import TestPage from "./pages/TestPage";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <ProjectProvider>
      <StandardSuppliersProvider>
        <StandardMaterialsProvider>
          <ProjectMaterialsProvider>
            <PurchaseOrdersProvider>
              <TransportProvider>
                <ProjectProductsProvider>
                  <CompaniesProvider>
                    <EmployeesProvider>
                    <CompanySettingsProvider>
                    <PurchasingProvider>
                      <LeadsProvider>
                      <TooltipProvider>
                        <Toaster />
                        <Sonner />
                        {children}
                      </TooltipProvider>
                      </LeadsProvider>
                    </PurchasingProvider>
                    </CompanySettingsProvider>
                    </EmployeesProvider>
                  </CompaniesProvider>
                </ProjectProductsProvider>
              </TransportProvider>
            </PurchaseOrdersProvider>
          </ProjectMaterialsProvider>
        </StandardMaterialsProvider>
      </StandardSuppliersProvider>
    </ProjectProvider>
  );
}

// Legacy redirect helpers — gamle /price-requests-ruter sender til /purchasing.
const PriceRequestDetailRedirect = () => {
  const { id } = useParams<{ id: string }>();
  return <Navigate to={id ? `/purchasing/rfq/${id}` : "/purchasing"} replace />;
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <HashRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <AppProviders>
                  <Index />
                </AppProviders>
              </ProtectedRoute>
            }
          />
          <Route path="/project/overview" element={<ProtectedRoute><AppProviders><ProjectOverview /></AppProviders></ProtectedRoute>} />
          <Route path="/project/products" element={<ProtectedRoute><AppProviders><Products /></AppProviders></ProtectedRoute>} />
          <Route path="/project/products/:id" element={<ProtectedRoute><AppProviders><ProductDetail /></AppProviders></ProtectedRoute>} />
          <Route path="/project/materials" element={<ProtectedRoute><AppProviders><ProjectMaterialsV1 /></AppProviders></ProtectedRoute>} />
          <Route path="/project/materials-legacy" element={<ProtectedRoute><AppProviders><ProjectMaterials /></AppProviders></ProtectedRoute>} />
          <Route path="/projects/:projectId/materials/:materialId" element={<ProtectedRoute><AppProviders><ProjectMaterialDetail /></AppProviders></ProtectedRoute>} />
          <Route path="/project/suppliers" element={<ProtectedRoute><AppProviders><Suppliers /></AppProviders></ProtectedRoute>} />
          <Route path="/project/quotes" element={<ProtectedRoute><AppProviders><ProjectQuotes /></AppProviders></ProtectedRoute>} />
          <Route path="/project/quotes/:id" element={<ProtectedRoute><AppProviders><ProjectQuoteDetail /></AppProviders></ProtectedRoute>} />
          <Route path="/project/budgets" element={<ProtectedRoute><AppProviders><ProjectBudgets /></AppProviders></ProtectedRoute>} />
          <Route path="/project/budgets/:id" element={<ProtectedRoute><AppProviders><ProjectBudgetDetail /></AppProviders></ProtectedRoute>} />
          <Route path="/project/budget" element={<ProtectedRoute><AppProviders><Budget /></AppProviders></ProtectedRoute>} />
          <Route path="/project/bom" element={<ProtectedRoute><AppProviders><BOM /></AppProviders></ProtectedRoute>} />
          <Route path="/project/purchase-orders" element={<ProtectedRoute><AppProviders><PurchaseOrders /></AppProviders></ProtectedRoute>} />
          <Route path="/project/purchase-orders/:id" element={<ProtectedRoute><AppProviders><PurchaseOrderDetail /></AppProviders></ProtectedRoute>} />
          <Route path="/project/price-requests" element={<ProtectedRoute><AppProviders><PriceRequests /></AppProviders></ProtectedRoute>} />
          <Route path="/project/price-requests/new" element={<ProtectedRoute><AppProviders><PriceRequestForm /></AppProviders></ProtectedRoute>} />
          <Route path="/project/price-requests/:id" element={<ProtectedRoute><AppProviders><PriceRequestDetail /></AppProviders></ProtectedRoute>} />
          <Route path="/project/price-requests/:id/edit" element={<ProtectedRoute><AppProviders><PriceRequestForm /></AppProviders></ProtectedRoute>} />

          {/* Global tilbudsoversigt */}
          <Route path="/quotes" element={<ProtectedRoute><AppProviders><AllQuotes /></AppProviders></ProtectedRoute>} />

          {/* Firmaer (kunder, leverandører, partnere) */}
          <Route path="/firmaer" element={<ProtectedRoute><AppProviders><Companies /></AppProviders></ProtectedRoute>} />

          {/* Kontakter (crm_contacts) */}
          <Route path="/kontakter" element={<ProtectedRoute><AppProviders><Contacts /></AppProviders></ProtectedRoute>} />

          {/* Medarbejdere (interne) */}
          <Route path="/medarbejdere" element={<ProtectedRoute><AppProviders><Employees /></AppProviders></ProtectedRoute>} />

          {/* Indstillinger */}
          <Route path="/indstillinger" element={<ProtectedRoute><AppProviders><Settings /></AppProviders></ProtectedRoute>} />

          {/* Leads (CRM) */}
          <Route path="/leads" element={<ProtectedRoute><AppProviders><LeadsInbox /></AppProviders></ProtectedRoute>} />
          <Route path="/leads/:dealId" element={<ProtectedRoute><AppProviders><LeadDetail /></AppProviders></ProtectedRoute>} />

          {/* Purchasing (RFQ) — Fase 4 wiring */}
          <Route path="/purchasing" element={<ProtectedRoute><AppProviders><PurchasingOverview /></AppProviders></ProtectedRoute>} />
          <Route path="/purchasing/rfq/new" element={<ProtectedRoute><AppProviders><RFQCreate /></AppProviders></ProtectedRoute>} />
          <Route path="/purchasing/rfq/:rfqId/compare" element={<ProtectedRoute><AppProviders><RFQCompare /></AppProviders></ProtectedRoute>} />
          <Route path="/purchasing/rfq/:rfqId" element={<ProtectedRoute><AppProviders><RFQDetail /></AppProviders></ProtectedRoute>} />
          <Route path="/purchasing/review" element={<ProtectedRoute><AppProviders><QuoteReviewQueue /></AppProviders></ProtectedRoute>} />

          {/* Legacy /price-requests redirects (top-level jf. plan §5.1) */}
          <Route path="/price-requests" element={<Navigate to="/purchasing" replace />} />
          <Route path="/price-requests/:id" element={<PriceRequestDetailRedirect />} />
          <Route path="/standard/suppliers" element={<ProtectedRoute><AppProviders><StandardSuppliers /></AppProviders></ProtectedRoute>} />
          <Route path="/standard/suppliers/:id" element={<ProtectedRoute><AppProviders><StandardSupplierDetail /></AppProviders></ProtectedRoute>} />
          <Route path="/standard/materials" element={<ProtectedRoute><AppProviders><StandardMaterials /></AppProviders></ProtectedRoute>} />
          <Route path="/standard/materials/:id" element={<ProtectedRoute><AppProviders><MaterialDetail /></AppProviders></ProtectedRoute>} />
          <Route path="/test/:id?" element={<ProtectedRoute><AppProviders><TestPage /></AppProviders></ProtectedRoute>} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </HashRouter>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;

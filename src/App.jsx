import { BrowserRouter as Router, Routes, Route } from "react-router-dom";

import { AuthProvider } from "./context/auth/AuthProvider";
import ProtectedRoute from "./components/ProtectedRoute";

// Páginas públicas generales
import PublicHomeRoute from "./pages/PublicHomeRoute";
import ReservationPage from "./pages/ReservationPage";
import UserProfilePage from "./pages/UserProfilePage";
import LoginPage from "./pages/LoginPage";
import EmailVerificationPage from "./pages/EmailVerificationPage";
import PrivacyPolicyPage from "./legal/PrivacyPolicyPage";
import TermsPage from "./legal/TermsPage";
import DataDeletionPage from "./legal/DataDeletionPage";

// Páginas para usuarios registrados particulares
import ParticularPublicationRequestPage from "./particular/pages/ParticularPublicationRequestPage";
import MyParticularPublicationRequestsPage from "./particular/pages/MyParticularPublicationRequestsPage";


// Componentes generales
import Navbar from "./components/Navbar";
import Footer from "./components/Footer";
import WhatsAppButton from "./components/WhatsAppButton";
import DynamicGallery from "./components/DynamicGallery";
import Contact from "./components/Contact";
import AccessDenied from "./components/AccessDenied";

// Administración general / heredada
import AdminDashboard from "./components/admin/AdminDashboard";
import GalleryManager from "./components/admin/GalleryManager";
import ContactMessages from "./components/admin/ContactMessages";
import Calendar from "./components/admin/calendar/Calendar";
import ReservationManagement from "./components/admin/ReservationManagement";
import TestimonialManagement from "./components/admin/TestimonialManagement";
import UserAdminPage from "./pages/UserAdminPage";

import PortalPublicationsPage from "./admin/pages/PortalPublicationsPage";
import PortalRankingConfigPage from "./admin/pages/PortalRankingConfigPage";

import ParticularPublicationRequestsAdminPage from "./particular/pages/ParticularPublicationRequestsAdminPage";
import ParticularPublicationPublicPage from "./particular/pages/ParticularPublicationPublicPage";

// Cabañas - legado
import CabanasList from "./cabanas/CabanasList";
import AdminCabanas from "./cabanas/AdminCabanas";
import CabanaForm from "./cabanas/CabanaForm";

// Inmobiliarias
import InmobiliariasLandingPage from "./inmobiliaria/pages/InmobiliariasLandingPage";
import InmobiliariaSelfRegistrationPage from "./inmobiliaria/pages/InmobiliariaSelfRegistrationPage";
import InmobiliariaLinkRequestPage from "./inmobiliaria/pages/InmobiliariaLinkRequestPage";
import InmobiliariaVerificationDocumentsPage from "./inmobiliaria/pages/InmobiliariaVerificationDocumentsPage";
import InmobiliariasVerificationReviewPage from "./inmobiliaria/pages/InmobiliariasVerificationReviewPage";
import InmobiliariaLinkRequestsAdminPage from "./inmobiliaria/pages/InmobiliariaLinkRequestsAdminPage";
import InmobiliariaInternalPermissionGuard from "./inmobiliaria/components/InmobiliariaInternalPermissionGuard";
import InmobiliariaDashboardPage from "./inmobiliaria/pages/InmobiliariaDashboardPage";
import InmobiliariaListPage from "./inmobiliaria/pages/InmobiliariaListPage";
import InmobiliariaCreatePage from "./inmobiliaria/pages/InmobiliariaCreatePage";
import InmobiliariaEditPage from "./inmobiliaria/pages/InmobiliariaEditPage";
import InmobiliariaPublicPage from "./inmobiliaria/pages/InmobiliariaPublicPage";
import InmobiliariaDomainsPage from "./inmobiliaria/pages/InmobiliariaDomainsPage";
import InmobiliariaModuleGuard from "./inmobiliaria/components/InmobiliariaModuleGuard";
import { DomainAgencyProvider } from "./inmobiliaria/context/DomainAgencyContext";
import InmobiliariaBrandingPage from "./inmobiliaria/pages/InmobiliariaBrandingPage";
import InmobiliariaUsersPage from "./inmobiliaria/pages/InmobiliariaUsersPage";
import InmobiliariaParticularRequestsPage from "./particular/pages/InmobiliariaParticularRequestsPage";

// Inmuebles
import InmuebleAdminPage from "./inmueble/pages/InmuebleAdminPage";
import InmuebleListPage from "./inmueble/pages/InmuebleListPage";
import InmuebleCreatePage from "./inmueble/pages/InmuebleCreatePage";
import InmuebleEditPage from "./inmueble/pages/InmuebleEditPage";
import InmueblePublicPage from "./inmueble/pages/InmueblePublicPage";
import InmueblePortalPage from "./inmueble/pages/InmueblePortalPage";
import InmueblePreviewPage from "./inmueble/pages/InmueblePreviewPage";
import InmuebleConsultasPage from "./inmueble/pages/InmuebleConsultasPage";
import InmuebleMarketingKitPage from "./inmueble/pages/InmuebleMarketingKitPage";
import InmuebleDistributionPage from "./inmueble/pages/InmuebleDistributionPage";
import MercadoLibreLeadsPage from "./inmueble/pages/MercadoLibreLeadsPage";
import InstagramOnopropQueuePage from "./inmueble/pages/InstagramOnopropQueuePage";
import InmuebleNetworkPage from "./inmueble/pages/InmuebleNetworkPage";
import InmuebleNetworkDetailPage from "./inmueble/pages/InmuebleNetworkDetailPage";
import InmuebleNetworkRequestsPage from "./inmueble/pages/InmuebleNetworkRequestsPage";
import InmuebleBulkImportPage from "./inmueble/pages/InmuebleBulkImportPage";

// Mapas
import MapaPortalPage from "./mapa/pages/MapaPortalPage";
import ParcelasProfessionalPage from "./mapa/pages/ParcelasProfessionalPage";

// Cuenta corriente y gestión comercial
import BillingAccountPage from "./billing/pages/BillingAccountPage";
import BillingAdminPage from "./billing/pages/BillingAdminPage";
import PublicPlansPage from "./billing/pages/PublicPlansPage";

// Emprendimientos
import EmprendimientoListPage from "./emprendimiento/pages/EmprendimientoListPage";
import EmprendimientoFormPage from "./emprendimiento/pages/EmprendimientoFormPage";
import EmprendimientoPortalPage from "./emprendimiento/pages/EmprendimientoPortalPage";
import EmprendimientoPublicPage from "./emprendimiento/pages/EmprendimientoPublicPage";
import EmprendimientoUnitsPage from "./emprendimiento/pages/EmprendimientoUnitsPage";

// Tasaciones
import TasacionListPage from "./tasacion/pages/TasacionListPage";
import TasacionFormPage from "./tasacion/pages/TasacionFormPage";
import TasacionReportPage from "./tasacion/pages/TasacionReportPage";
import TasacionVerificationPage from "./tasacion/pages/TasacionVerificationPage";

// Administración de alquileres
import RentalManagementPage from "./alquileres/pages/RentalManagementPage";
import RentalPeoplePage from "./alquileres/pages/RentalPeoplePage";
import RentalContractFormPage from "./alquileres/pages/RentalContractFormPage";
import RentalContractDetailPage from "./alquileres/pages/RentalContractDetailPage";
import RentalReceiptPage from "./alquileres/pages/RentalReceiptPage";
import RentalSettlementReceiptPage from "./alquileres/pages/RentalSettlementReceiptPage";
import RentalOwnerAccountPage from "./alquileres/pages/RentalOwnerAccountPage";
import RentalOwnerAccountsPage from "./alquileres/pages/RentalOwnerAccountsPage";
import RentalArcaInvoicePage from "./alquileres/pages/RentalArcaInvoicePage";
import ArcaAdminPage from "./alquileres/pages/ArcaAdminPage";

// Administración de consorcios
import ConsortiumManagementPage from "./consorcios/pages/ConsortiumManagementPage";
import ConsortiumFormPage from "./consorcios/pages/ConsortiumFormPage";
import ConsortiumDetailPage from "./consorcios/pages/ConsortiumDetailPage";
import ConsortiumUnitAccountPage from "./consorcios/pages/ConsortiumUnitAccountPage";
import ConsortiumReceiptPage from "./consorcios/pages/ConsortiumReceiptPage";
import ConsortiumResidentPortalPage from "./consorcios/pages/ConsortiumResidentPortalPage";

// Control tributario inmobiliario
import TaxManagementPage from "./tributos/pages/TaxManagementPage";


function App() {
  return (
    <DomainAgencyProvider>
      <AuthProvider>
        <Router>
          <div className="modern">
            <Navbar />

            <main className="flex-grow-1">

              <Routes>
                {/* =========================
                  Rutas públicas generales
                 ========================= */}

                <Route path="/" element={<PublicHomeRoute />} />
                <Route path="/access-denied" element={<AccessDenied />} />
                <Route path="/galeria" element={<DynamicGallery />} />
                <Route path="/contacto" element={<Contact />} />
                <Route path="/planes" element={<PublicPlansPage />} />
                <Route path="/reservar" element={<ReservationPage />} />
                <Route path="/login" element={<LoginPage />} />
                <Route path="/verificar-email" element={<EmailVerificationPage />} />
                <Route path="/privacidad" element={<PrivacyPolicyPage />} />
                <Route path="/terminos" element={<TermsPage />} />
                <Route
                  path="/tasaciones/verificar/:code"
                  element={<TasacionVerificationPage />}
                />
                <Route
                  path="/eliminacion-de-datos"
                  element={<DataDeletionPage />}
                />

                {/* =========================
                  Portal público inmobiliario
                 ========================= */}

                <Route path="/inmobiliarias" element={<InmobiliariasLandingPage />} />
                <Route
                  path="/inmobiliarias/alta"
                  element={<InmobiliariaSelfRegistrationPage />}
                />
                <Route
                  path="/inmobiliarias/vincular"
                  element={<InmobiliariaLinkRequestPage />}
                />
                <Route path="/inmuebles" element={<InmueblePortalPage />} />
                <Route path="/mapa" element={<MapaPortalPage />} />
                <Route path="/inmueble/:slug" element={<InmueblePublicPage />} />
                <Route path="/emprendimientos" element={<EmprendimientoPortalPage />} />
                <Route
                  path="/emprendimiento/:slug"
                  element={<EmprendimientoPublicPage />}
                />

                <Route
                  path="/inmobiliaria/:slug"
                  element={<InmobiliariaPublicPage />}
                />

                {/* =========================
                  Usuario autenticado
                 ========================= */}

                <Route
                  path="/perfil"
                  element={
                    <ProtectedRoute>
                      <UserProfilePage />
                    </ProtectedRoute>
                  }
                />

                <Route path="/publicar" element={<ParticularPublicationRequestPage />} />
                <Route
                  path="/particulares/:id"
                  element={<ParticularPublicationPublicPage />}
                />

                <Route
                  path="/mis-publicaciones"
                  element={
                    <ProtectedRoute>
                      <MyParticularPublicationRequestsPage />
                    </ProtectedRoute>
                  }
                />

                {/* =========================
                  Panel de inmobiliaria
                 ========================= */}

                <Route
                  path="/admin/inmobiliaria"
                  element={
                    <ProtectedRoute role="admin">
                      <InmobiliariaDashboardPage />
                    </ProtectedRoute>
                  }
                />

                <Route
                  path="/admin/inmobiliaria/dominios"
                  element={
                    <ProtectedRoute role="admin">
                      <InmobiliariaModuleGuard moduleId="dominios">
                        <InmobiliariaInternalPermissionGuard permission="canManageDomains">
                          <InmobiliariaDomainsPage />
                        </InmobiliariaInternalPermissionGuard>
                      </InmobiliariaModuleGuard>
                    </ProtectedRoute>
                  }
                />

                <Route
                  path="/admin/inmobiliaria/branding"
                  element={
                    <ProtectedRoute role="admin">
                      <InmobiliariaModuleGuard moduleId="branding">
                        <InmobiliariaInternalPermissionGuard permission="canManageBranding">
                          <InmobiliariaBrandingPage />
                        </InmobiliariaInternalPermissionGuard>
                      </InmobiliariaModuleGuard>
                    </ProtectedRoute>
                  }
                />

                <Route
                  path="/admin/inmobiliaria/usuarios"
                  element={
                    <ProtectedRoute role="admin">
                      <InmobiliariaModuleGuard moduleId="usuarios">
                        <InmobiliariaInternalPermissionGuard permission="canManageUsers">
                          <InmobiliariaUsersPage />
                        </InmobiliariaInternalPermissionGuard>
                      </InmobiliariaModuleGuard>
                    </ProtectedRoute>
                  }
                />

                <Route
                  path="/admin/inmobiliaria/documentacion"
                  element={
                    <ProtectedRoute role="admin">
                      <InmobiliariaVerificationDocumentsPage />
                    </ProtectedRoute>
                  }
                />

                <Route
                  path="/admin/inmobiliaria/vinculaciones"
                  element={
                    <ProtectedRoute role="admin">
                      <InmobiliariaLinkRequestsAdminPage />
                    </ProtectedRoute>
                  }
                />

                <Route
                  path="/admin/inmobiliaria/solicitudes-particulares"
                  element={
                    <ProtectedRoute role="admin">
                      <InmobiliariaModuleGuard moduleId="consultas">
                        <InmobiliariaParticularRequestsPage />
                      </InmobiliariaModuleGuard>
                    </ProtectedRoute>
                  }
                />

                <Route
                  path="/admin/inmobiliaria/cuenta-corriente"
                  element={
                    <ProtectedRoute role="admin">
                      <BillingAccountPage />
                    </ProtectedRoute>
                  }
                />

                <Route
                  path="/admin/inmobiliaria/parcelas"
                  element={
                    <ProtectedRoute>
                      <InmobiliariaModuleGuard moduleId="parcelas">
                        <ParcelasProfessionalPage />
                      </InmobiliariaModuleGuard>
                    </ProtectedRoute>
                  }
                />

                {/* =========================
                  Admin ROOT - Inmobiliarias
                 ========================= */}

                <Route
                  path="/admin/inmobiliarias"
                  element={
                    <ProtectedRoute role="root">
                      <InmobiliariaListPage />
                    </ProtectedRoute>
                  }
                />

                <Route
                  path="/admin/inmobiliarias/nueva"
                  element={
                    <ProtectedRoute role="root">
                      <InmobiliariaCreatePage />
                    </ProtectedRoute>
                  }
                />

                <Route
                  path="/admin/inmobiliarias/:id/editar"
                  element={
                    <ProtectedRoute role="admin">
                      <InmobiliariaModuleGuard moduleId="branding">
                        <InmobiliariaEditPage />
                      </InmobiliariaModuleGuard>
                    </ProtectedRoute>
                  }
                />

                <Route
                  path="/admin/inmobiliarias/verificacion"
                  element={
                    <ProtectedRoute role="root">
                      <InmobiliariasVerificationReviewPage />
                    </ProtectedRoute>
                  }
                />

                <Route
                  path="/admin/facturacion"
                  element={
                    <ProtectedRoute role="root">
                      <BillingAdminPage />
                    </ProtectedRoute>
                  }
                />

                <Route
                  path="/admin/arca"
                  element={
                    <ProtectedRoute role="root">
                      <ArcaAdminPage />
                    </ProtectedRoute>
                  }
                />

                <Route
                  path="/admin/publicaciones/particulares"
                  element={
                    <ProtectedRoute role="root">
                      <ParticularPublicationRequestsAdminPage />
                    </ProtectedRoute>
                  }
                />

                {/* =========================
                  Admin - Inmuebles
                 ========================= */}

                <Route
                  path="/admin/alquileres"
                  element={
                    <ProtectedRoute role="admin">
                      <InmobiliariaModuleGuard moduleId="alquileres">
                        <InmobiliariaInternalPermissionGuard permission="canViewRentals">
                          <RentalManagementPage />
                        </InmobiliariaInternalPermissionGuard>
                      </InmobiliariaModuleGuard>
                    </ProtectedRoute>
                  }
                />

                <Route
                  path="/admin/alquileres/personas"
                  element={
                    <ProtectedRoute role="admin">
                      <InmobiliariaModuleGuard moduleId="alquileres">
                        <InmobiliariaInternalPermissionGuard permission="canManageRentals">
                          <RentalPeoplePage />
                        </InmobiliariaInternalPermissionGuard>
                      </InmobiliariaModuleGuard>
                    </ProtectedRoute>
                  }
                />

                <Route
                  path="/admin/alquileres/cuentas-locadores"
                  element={
                    <ProtectedRoute role="admin">
                      <InmobiliariaModuleGuard moduleId="alquileres">
                        <InmobiliariaInternalPermissionGuard permission="canViewRentals">
                          <RentalOwnerAccountsPage />
                        </InmobiliariaInternalPermissionGuard>
                      </InmobiliariaModuleGuard>
                    </ProtectedRoute>
                  }
                />

                <Route
                  path="/admin/alquileres/nuevo"
                  element={
                    <ProtectedRoute role="admin">
                      <InmobiliariaModuleGuard moduleId="alquileres">
                        <InmobiliariaInternalPermissionGuard permission="canManageRentals">
                          <RentalContractFormPage />
                        </InmobiliariaInternalPermissionGuard>
                      </InmobiliariaModuleGuard>
                    </ProtectedRoute>
                  }
                />

                <Route
                  path="/admin/alquileres/:id/editar"
                  element={
                    <ProtectedRoute role="admin">
                      <InmobiliariaModuleGuard moduleId="alquileres">
                        <InmobiliariaInternalPermissionGuard permission="canManageRentals">
                          <RentalContractFormPage />
                        </InmobiliariaInternalPermissionGuard>
                      </InmobiliariaModuleGuard>
                    </ProtectedRoute>
                  }
                />

                <Route
                  path="/admin/alquileres/:id/recibos/:obligationId/:paymentId"
                  element={
                    <ProtectedRoute role="admin">
                      <InmobiliariaModuleGuard moduleId="alquileres">
                        <InmobiliariaInternalPermissionGuard permission="canViewRentals">
                          <RentalReceiptPage />
                        </InmobiliariaInternalPermissionGuard>
                      </InmobiliariaModuleGuard>
                    </ProtectedRoute>
                  }
                />

                <Route
                  path="/admin/alquileres/:id/liquidaciones/:settlementId/recibo"
                  element={
                    <ProtectedRoute role="admin">
                      <InmobiliariaModuleGuard moduleId="alquileres">
                        <InmobiliariaInternalPermissionGuard permission="canViewRentals">
                          <RentalSettlementReceiptPage />
                        </InmobiliariaInternalPermissionGuard>
                      </InmobiliariaModuleGuard>
                    </ProtectedRoute>
                  }
                />

                <Route
                  path="/admin/alquileres/:id/cuenta-corriente"
                  element={
                    <ProtectedRoute role="admin">
                      <InmobiliariaModuleGuard moduleId="alquileres">
                        <InmobiliariaInternalPermissionGuard permission="canViewRentals">
                          <RentalOwnerAccountPage />
                        </InmobiliariaInternalPermissionGuard>
                      </InmobiliariaModuleGuard>
                    </ProtectedRoute>
                  }
                />

                <Route
                  path="/admin/alquileres/:id/comprobantes/:draftId"
                  element={
                    <ProtectedRoute role="admin">
                      <InmobiliariaModuleGuard moduleId="alquileres">
                        <InmobiliariaInternalPermissionGuard permission="canViewRentals">
                          <RentalArcaInvoicePage />
                        </InmobiliariaInternalPermissionGuard>
                      </InmobiliariaModuleGuard>
                    </ProtectedRoute>
                  }
                />

                <Route
                  path="/admin/alquileres/:id"
                  element={
                    <ProtectedRoute role="admin">
                      <InmobiliariaModuleGuard moduleId="alquileres">
                        <InmobiliariaInternalPermissionGuard permission="canViewRentals">
                          <RentalContractDetailPage />
                        </InmobiliariaInternalPermissionGuard>
                      </InmobiliariaModuleGuard>
                    </ProtectedRoute>
                  }
                />

                <Route
                  path="/admin/consorcios"
                  element={
                    <ProtectedRoute role="admin">
                      <InmobiliariaModuleGuard moduleId="consorcios">
                        <InmobiliariaInternalPermissionGuard permission="canViewConsortiums">
                          <ConsortiumManagementPage />
                        </InmobiliariaInternalPermissionGuard>
                      </InmobiliariaModuleGuard>
                    </ProtectedRoute>
                  }
                />

                <Route
                  path="/admin/consorcios/nuevo"
                  element={
                    <ProtectedRoute role="admin">
                      <InmobiliariaModuleGuard moduleId="consorcios">
                        <InmobiliariaInternalPermissionGuard permission="canManageConsortiums">
                          <ConsortiumFormPage />
                        </InmobiliariaInternalPermissionGuard>
                      </InmobiliariaModuleGuard>
                    </ProtectedRoute>
                  }
                />

                <Route
                  path="/admin/consorcios/:id/editar"
                  element={
                    <ProtectedRoute role="admin">
                      <InmobiliariaModuleGuard moduleId="consorcios">
                        <InmobiliariaInternalPermissionGuard permission="canManageConsortiums">
                          <ConsortiumFormPage />
                        </InmobiliariaInternalPermissionGuard>
                      </InmobiliariaModuleGuard>
                    </ProtectedRoute>
                  }
                />

                <Route
                  path="/admin/consorcios/:id/unidades/:unitId/cuenta-corriente"
                  element={
                    <ProtectedRoute role="admin">
                      <InmobiliariaModuleGuard moduleId="consorcios">
                        <InmobiliariaInternalPermissionGuard permission="canViewConsortiums">
                          <ConsortiumUnitAccountPage />
                        </InmobiliariaInternalPermissionGuard>
                      </InmobiliariaModuleGuard>
                    </ProtectedRoute>
                  }
                />

                <Route
                  path="/admin/consorcios/:id/recibos/:paymentId"
                  element={
                    <ProtectedRoute role="admin">
                      <InmobiliariaModuleGuard moduleId="consorcios">
                        <InmobiliariaInternalPermissionGuard permission="canViewConsortiums">
                          <ConsortiumReceiptPage />
                        </InmobiliariaInternalPermissionGuard>
                      </InmobiliariaModuleGuard>
                    </ProtectedRoute>
                  }
                />

                <Route
                  path="/admin/consorcios/:id"
                  element={
                    <ProtectedRoute role="admin">
                      <InmobiliariaModuleGuard moduleId="consorcios">
                        <InmobiliariaInternalPermissionGuard permission="canViewConsortiums">
                          <ConsortiumDetailPage />
                        </InmobiliariaInternalPermissionGuard>
                      </InmobiliariaModuleGuard>
                    </ProtectedRoute>
                  }
                />

                <Route
                  path="/mi-consorcio"
                  element={
                    <ProtectedRoute>
                      <ConsortiumResidentPortalPage />
                    </ProtectedRoute>
                  }
                />

                <Route
                  path="/admin/tributos"
                  element={
                    <ProtectedRoute role="admin">
                      <InmobiliariaModuleGuard moduleId="tributos">
                        <InmobiliariaInternalPermissionGuard permission="canViewTaxes">
                          <TaxManagementPage />
                        </InmobiliariaInternalPermissionGuard>
                      </InmobiliariaModuleGuard>
                    </ProtectedRoute>
                  }
                />

                <Route
                  path="/admin/tasaciones"
                  element={
                    <ProtectedRoute role="admin">
                      <InmobiliariaModuleGuard moduleId="tasaciones">
                        <InmobiliariaInternalPermissionGuard permission="canViewTasaciones">
                          <TasacionListPage />
                        </InmobiliariaInternalPermissionGuard>
                      </InmobiliariaModuleGuard>
                    </ProtectedRoute>
                  }
                />

                <Route
                  path="/admin/tasaciones/nueva"
                  element={
                    <ProtectedRoute role="admin">
                      <InmobiliariaModuleGuard moduleId="tasaciones">
                        <InmobiliariaInternalPermissionGuard permission="canCreateTasaciones">
                          <TasacionFormPage />
                        </InmobiliariaInternalPermissionGuard>
                      </InmobiliariaModuleGuard>
                    </ProtectedRoute>
                  }
                />

                <Route
                  path="/admin/tasaciones/:id/editar"
                  element={
                    <ProtectedRoute role="admin">
                      <InmobiliariaModuleGuard moduleId="tasaciones">
                        <InmobiliariaInternalPermissionGuard permission="canEditTasaciones">
                          <TasacionFormPage />
                        </InmobiliariaInternalPermissionGuard>
                      </InmobiliariaModuleGuard>
                    </ProtectedRoute>
                  }
                />

                <Route
                  path="/admin/tasaciones/:id/informe"
                  element={
                    <ProtectedRoute role="admin">
                      <InmobiliariaModuleGuard moduleId="tasaciones">
                        <InmobiliariaInternalPermissionGuard permission="canViewTasaciones">
                          <TasacionReportPage />
                        </InmobiliariaInternalPermissionGuard>
                      </InmobiliariaModuleGuard>
                    </ProtectedRoute>
                  }
                />

                <Route
                  path="/admin/emprendimientos"
                  element={
                    <ProtectedRoute role="admin">
                      <InmobiliariaModuleGuard moduleId="inmuebles">
                        <InmobiliariaInternalPermissionGuard permission="canViewInmuebles">
                          <EmprendimientoListPage />
                        </InmobiliariaInternalPermissionGuard>
                      </InmobiliariaModuleGuard>
                    </ProtectedRoute>
                  }
                />

                <Route
                  path="/admin/emprendimientos/nuevo"
                  element={
                    <ProtectedRoute role="admin">
                      <InmobiliariaModuleGuard moduleId="inmuebles">
                        <InmobiliariaInternalPermissionGuard permission="canCreateInmuebles">
                          <EmprendimientoFormPage />
                        </InmobiliariaInternalPermissionGuard>
                      </InmobiliariaModuleGuard>
                    </ProtectedRoute>
                  }
                />

                <Route
                  path="/admin/emprendimientos/:id/editar"
                  element={
                    <ProtectedRoute role="admin">
                      <InmobiliariaModuleGuard moduleId="inmuebles">
                        <InmobiliariaInternalPermissionGuard permission="canEditInmuebles">
                          <EmprendimientoFormPage />
                        </InmobiliariaInternalPermissionGuard>
                      </InmobiliariaModuleGuard>
                    </ProtectedRoute>
                  }
                />

                <Route
                  path="/admin/emprendimientos/:id/unidades"
                  element={
                    <ProtectedRoute role="admin">
                      <InmobiliariaModuleGuard moduleId="inmuebles">
                        <InmobiliariaInternalPermissionGuard permission="canEditInmuebles">
                          <EmprendimientoUnitsPage />
                        </InmobiliariaInternalPermissionGuard>
                      </InmobiliariaModuleGuard>
                    </ProtectedRoute>
                  }
                />

                <Route
                  path="/admin/inmuebles"
                  element={
                    <ProtectedRoute role="admin">
                      <InmobiliariaModuleGuard moduleId="inmuebles">
                        <InmuebleAdminPage />
                      </InmobiliariaModuleGuard>
                    </ProtectedRoute>
                  }
                />

                <Route
                  path="/admin/inmuebles/listado"
                  element={
                    <ProtectedRoute role="admin">
                      <InmobiliariaModuleGuard moduleId="inmuebles">
                        <InmuebleListPage />
                      </InmobiliariaModuleGuard>
                    </ProtectedRoute>
                  }
                />

                <Route
                  path="/admin/inmuebles/importar"
                  element={
                    <ProtectedRoute role="admin">
                      <InmobiliariaModuleGuard moduleId="inmuebles">
                        <InmobiliariaInternalPermissionGuard permission="canCreateInmuebles">
                          <InmuebleBulkImportPage />
                        </InmobiliariaInternalPermissionGuard>
                      </InmobiliariaModuleGuard>
                    </ProtectedRoute>
                  }
                />

                <Route
                  path="/admin/inmuebles/consultas"
                  element={
                    <ProtectedRoute role="admin">
                      <InmobiliariaModuleGuard moduleId="consultas">
                        <InmobiliariaInternalPermissionGuard permission="canViewConsultas">
                          <InmuebleConsultasPage />
                        </InmobiliariaInternalPermissionGuard>
                      </InmobiliariaModuleGuard>
                    </ProtectedRoute>
                  }
                />

                <Route
                  path="/admin/red/inmuebles-compartidos"
                  element={
                    <ProtectedRoute role="admin">
                      <InmobiliariaModuleGuard moduleId="inmuebles">
                        <InmuebleNetworkPage />
                      </InmobiliariaModuleGuard>
                    </ProtectedRoute>
                  }
                />

                <Route
                  path="/admin/red/solicitudes"
                  element={
                    <ProtectedRoute role="admin">
                      <InmobiliariaModuleGuard moduleId="inmuebles">
                        <InmuebleNetworkRequestsPage />
                      </InmobiliariaModuleGuard>
                    </ProtectedRoute>
                  }
                />

                <Route
                  path="/admin/red/inmuebles-compartidos/:inmobiliariaId/:inmuebleId"
                  element={
                    <ProtectedRoute role="admin">
                      <InmobiliariaModuleGuard moduleId="inmuebles">
                        <InmuebleNetworkDetailPage />
                      </InmobiliariaModuleGuard>
                    </ProtectedRoute>
                  }
                />

                <Route
                  path="/admin/inmuebles/nuevo"
                  element={
                    <ProtectedRoute role="admin">
                      <InmobiliariaModuleGuard moduleId="inmuebles">
                        <InmobiliariaInternalPermissionGuard permission="canCreateInmuebles">
                          <InmuebleCreatePage />
                        </InmobiliariaInternalPermissionGuard>
                      </InmobiliariaModuleGuard>
                    </ProtectedRoute>
                  }
                />

                <Route
                  path="/admin/inmuebles/:id/editar"
                  element={
                    <ProtectedRoute role="admin">
                      <InmobiliariaModuleGuard moduleId="inmuebles">
                        <InmobiliariaInternalPermissionGuard permission="canEditInmuebles">
                          <InmuebleEditPage />
                        </InmobiliariaInternalPermissionGuard>
                      </InmobiliariaModuleGuard>
                    </ProtectedRoute>
                  }
                />

                <Route
                  path="/admin/inmuebles/:id/preview"
                  element={
                    <ProtectedRoute role="admin">
                      <InmobiliariaModuleGuard moduleId="inmuebles">
                        <InmueblePreviewPage />
                      </InmobiliariaModuleGuard>
                    </ProtectedRoute>
                  }
                />

                <Route
                  path="/admin/inmuebles/:id/marketing"
                  element={
                    <ProtectedRoute role="admin">
                      <InmobiliariaModuleGuard moduleId="inmuebles">
                        <InmobiliariaInternalPermissionGuard permission="canEditInmuebles">
                          <InmuebleMarketingKitPage />
                        </InmobiliariaInternalPermissionGuard>
                      </InmobiliariaModuleGuard>
                    </ProtectedRoute>
                  }
                />

                <Route
                  path="/admin/inmuebles/:id/difusion"
                  element={
                    <ProtectedRoute role="admin">
                      <InmobiliariaModuleGuard moduleId="inmuebles">
                        <InmobiliariaInternalPermissionGuard permission="canEditInmuebles">
                          <InmuebleDistributionPage />
                        </InmobiliariaInternalPermissionGuard>
                      </InmobiliariaModuleGuard>
                    </ProtectedRoute>
                  }
                />

                <Route
                  path="/admin/inmuebles/leads/mercadolibre"
                  element={
                    <ProtectedRoute role="admin">
                      <InmobiliariaModuleGuard moduleId="inmuebles">
                        <InmobiliariaInternalPermissionGuard permission="canEditInmuebles">
                          <MercadoLibreLeadsPage />
                        </InmobiliariaInternalPermissionGuard>
                      </InmobiliariaModuleGuard>
                    </ProtectedRoute>
                  }
                />

                <Route
                  path="/admin/inmuebles/instagram-onoprop"
                  element={
                    <ProtectedRoute role="root">
                      <InstagramOnopropQueuePage />
                    </ProtectedRoute>
                  }
                />

                {/* =========================
                  Admin ROOT - Usuarios / Suscripciones
                 ========================= */}

                <Route
                  path="/admin/usuarios"
                  element={
                    <ProtectedRoute role="root">
                      <UserAdminPage />
                    </ProtectedRoute>
                  }
                />

                <Route
                  path="/admin/portal/publicaciones"
                  element={
                    <ProtectedRoute role="root">
                      <PortalPublicationsPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/admin/portal/ranking"
                  element={
                    <ProtectedRoute role="root">
                      <PortalRankingConfigPage />
                    </ProtectedRoute>
                  }
                />

                {/* =========================
                  Admin - General / legado
                 ========================= */}

                <Route
                  path="/admin/dashboard"
                  element={
                    <ProtectedRoute role="admin">
                      <AdminDashboard />
                    </ProtectedRoute>
                  }
                />

                <Route
                  path="/admin/gallery"
                  element={
                    <ProtectedRoute role="admin">
                      <GalleryManager />
                    </ProtectedRoute>
                  }
                />

                <Route
                  path="/admin/contactos"
                  element={
                    <ProtectedRoute role="admin">
                      <ContactMessages />
                    </ProtectedRoute>
                  }
                />

                <Route
                  path="/admin/calendar"
                  element={
                    <ProtectedRoute role="admin">
                      <Calendar />
                    </ProtectedRoute>
                  }
                />

                <Route
                  path="/admin/reservas"
                  element={
                    <ProtectedRoute role="admin">
                      <ReservationManagement />
                    </ProtectedRoute>
                  }
                />

                <Route
                  path="/admin/testimonios"
                  element={
                    <ProtectedRoute role="admin">
                      <TestimonialManagement />
                    </ProtectedRoute>
                  }
                />

                {/* =========================
                  Admin - Cabañas / legado
                 ========================= */}

                <Route
                  path="/admin/listadocabanas"
                  element={
                    <ProtectedRoute role="admin">
                      <CabanasList />
                    </ProtectedRoute>
                  }
                />

                <Route
                  path="/admin/cabanas"
                  element={
                    <ProtectedRoute role="admin">
                      <AdminCabanas />
                    </ProtectedRoute>
                  }
                />

                <Route
                  path="/admin/cabanasform"
                  element={
                    <ProtectedRoute role="admin">
                      <CabanaForm />
                    </ProtectedRoute>
                  }
                />

                {/* =========================
                  404
                 ========================= */}

                <Route
                  path="*"
                  element={
                    <div className="container mt-4">
                      <h1>
                        Error 404 - Estás intentando ingresar a una página
                        inexistente.
                      </h1>
                      <h3>
                        Por favor, revisa la dirección o ponte en contacto con el
                        administrador.
                      </h3>
                    </div>
                  }
                />
              </Routes>

            </main>
            <Footer />
            <WhatsAppButton />
          </div>
        </Router>
      </AuthProvider>
    </DomainAgencyProvider>
  );
}

export default App;

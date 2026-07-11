import { useEffect } from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";

import { AuthProvider } from "./context/auth/AuthProvider";
import ProtectedRoute from "./components/ProtectedRoute";

// Páginas públicas generales
import PublicHomeRoute from "./pages/PublicHomeRoute";
import ReservationPage from "./pages/ReservationPage";
import UserProfilePage from "./pages/UserProfilePage";

// Componentes generales
import Navbar from "./components/Navbar";
import Footer from "./components/Footer";
import WhatsAppButton from "./components/WhatsAppButton";
import Login from "./components/auth/Login";
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

// Cabañas - legado
import CabanasList from "./cabanas/CabanasList";
import AdminCabanas from "./cabanas/AdminCabanas";
import CabanaForm from "./cabanas/CabanaForm";

// Inmobiliarias
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

// Inmuebles
import InmuebleAdminPage from "./inmueble/pages/InmuebleAdminPage";
import InmuebleListPage from "./inmueble/pages/InmuebleListPage";
import InmuebleCreatePage from "./inmueble/pages/InmuebleCreatePage";
import InmuebleEditPage from "./inmueble/pages/InmuebleEditPage";
import InmueblePublicPage from "./inmueble/pages/InmueblePublicPage";
import InmueblePortalPage from "./inmueble/pages/InmueblePortalPage";
import InmueblePreviewPage from "./inmueble/pages/InmueblePreviewPage";
import InmuebleConsultasPage from "./inmueble/pages/InmuebleConsultasPage";

function App() {
  useEffect(() => {
    // Mover el componente Login al modal cuando esté disponible.
    // Se mantiene por compatibilidad con la estructura actual.
    const loginContainer = document.getElementById("login-container");
    const loginElement = document.getElementById("login-section");

    if (loginContainer && loginElement) {
      loginContainer.appendChild(loginElement);
    }
  }, []);

  return (
    <DomainAgencyProvider>
      <AuthProvider>
        <Router>
          <div className="modern">
            <Navbar />

            <Routes>
              {/* =========================
                  Rutas públicas generales
                 ========================= */}

              <Route path="/" element={<PublicHomeRoute />} />
              <Route path="/access-denied" element={<AccessDenied />} />
              <Route path="/galeria" element={<DynamicGallery />} />
              <Route path="/contacto" element={<Contact />} />
              <Route path="/reservar" element={<ReservationPage />} />

              {/* =========================
                  Portal público inmobiliario
                 ========================= */}

              <Route path="/inmuebles" element={<InmueblePortalPage />} />
              <Route path="/inmueble/:slug" element={<InmueblePublicPage />} />

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

              {/* =========================
                  Admin - Inmuebles
                 ========================= */}

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

            {/* Login oculto que se moverá al modal */}
            <div id="login-section" style={{ display: "none" }}>
              <Login />
            </div>

            <Footer />
            <WhatsAppButton />
          </div>
        </Router>
      </AuthProvider>
    </DomainAgencyProvider>
  );
}

export default App;
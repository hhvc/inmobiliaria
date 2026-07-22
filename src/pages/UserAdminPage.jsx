import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  arrayRemove,
  arrayUnion,
  collection,
  doc,
  getDocs,
  serverTimestamp,
  updateDoc,
  writeBatch,
} from "firebase/firestore";

import { db } from "../firebase/config";
import { useAuth } from "../context/auth/useAuth";

const ALL_ROLES = ["usuario", "viewer", "editor", "admin", "root"];

const ROLE_PRIORITY = ["root", "admin", "editor", "viewer", "usuario"];

const SUBSCRIPTION_MODULES = [
  {
    id: "inmuebles",
    label: "Inmuebles",
    description: "Alta, edición, publicación y administración de propiedades.",
  },
  {
    id: "consultas",
    label: "Consultas",
    description: "Recepción y gestión de leads/consultas de inmuebles.",
  },
  {
    id: "dominios",
    label: "Dominios propios",
    description: "Administración de dominios públicos por inmobiliaria.",
  },
  {
    id: "branding",
    label: "Branding",
    description: "Logo, portada, datos públicos y estética de la inmobiliaria.",
  },
  {
    id: "usuarios",
    label: "Usuarios de inmobiliaria",
    description: "Gestión de usuarios asociados a la inmobiliaria.",
  },
  {
    id: "reportes",
    label: "Reportes",
    description: "Métricas, estadísticas y reportes comerciales.",
  },
];

const DEFAULT_MODULES = ["inmuebles", "consultas"];

const VERIFICATION_STATUS_LABELS = {
  pendiente_documentacion: "Pendiente de documentación",
  pendiente_revision: "Documentación en revisión",
  observada: "Documentación observada",
  rechazada: "Verificación rechazada",
  verificada: "Inmobiliaria verificada",
};

const VERIFICATION_STATUS_BADGES = {
  pendiente_documentacion: "text-bg-warning",
  pendiente_revision: "text-bg-info",
  observada: "text-bg-warning",
  rechazada: "text-bg-danger",
  verificada: "text-bg-success",
};

const VERIFICATION_DOCUMENT_KEYS = [
  "constanciaArca",
  "dniTitular",
  "estatutoContratoSocial",
  "dniApoderado",
  "poderApoderado",
];

const normalizeTimestamp = (value) => {
  if (!value) return null;

  if (typeof value.toDate === "function") {
    return value.toDate();
  }

  const date = new Date(value);

  return Number.isFinite(date.getTime()) ? date : null;
};

const normalizeRole = (role = "") => {
  const value = role.toString().trim();

  if (!value) return "";

  if (value === "user") return "usuario";

  return value;
};

const normalizeRoles = (roles = []) => {
  const source = Array.isArray(roles) ? roles : [];

  const normalized = source
    .map((role) => normalizeRole(role))
    .filter(Boolean);

  const unique = Array.from(new Set(normalized));

  return unique.length > 0 ? unique : ["usuario"];
};

const getPrimaryRoleFromRoles = (roles = []) => {
  const normalizedRoles = normalizeRoles(roles);

  return (
    ROLE_PRIORITY.find((role) => normalizedRoles.includes(role)) ||
    normalizedRoles[0] ||
    "usuario"
  );
};

const getRoleFlags = (user) => {
  const roles = normalizeRoles(user?.roles || []);
  const primaryRole = normalizeRole(user?.primaryRole || user?.role || "");

  return {
    isRoot:
      primaryRole === "root" || user?.role === "root" || roles.includes("root"),
    isAdmin:
      primaryRole === "admin" ||
      user?.role === "admin" ||
      roles.includes("admin"),
  };
};

const mapUserDoc = (docSnap) => {
  const raw = docSnap.data();

  const roles = normalizeRoles(
    Array.isArray(raw.roles)
      ? raw.roles
      : raw.role
        ? [raw.role]
        : ["usuario"],
  );

  const rawPrimaryRole = normalizeRole(raw.primaryRole || raw.role || "");
  const primaryRole = roles.includes(rawPrimaryRole)
    ? rawPrimaryRole
    : getPrimaryRoleFromRoles(roles);

  const inmobiliarias = Array.isArray(raw.inmobiliarias)
    ? raw.inmobiliarias
    : [];

  const inmobiliariaRoles =
    raw.inmobiliariaRoles && typeof raw.inmobiliariaRoles === "object"
      ? raw.inmobiliariaRoles
      : {};

  const activeInmobiliariaId =
    raw.activeInmobiliariaId && inmobiliarias.includes(raw.activeInmobiliariaId)
      ? raw.activeInmobiliariaId
      : inmobiliarias[0] || "";

  return {
    id: docSnap.id,
    ...raw,
    roles,
    primaryRole,
    role: primaryRole,
    inmobiliarias,
    inmobiliariaRoles,
    activeInmobiliariaId,
    _originalInmobiliarias: inmobiliarias,
    createdAt: normalizeTimestamp(raw.createdAt),
    updatedAt: normalizeTimestamp(raw.updatedAt),
  };
};

const mapInmobiliariaDoc = (docSnap) => {
  const raw = docSnap.data();

  const verificacion =
    raw.verificacion && typeof raw.verificacion === "object"
      ? raw.verificacion
      : {};

  const documentacionVerificacion =
    raw.documentacionVerificacion &&
      typeof raw.documentacionVerificacion === "object"
      ? raw.documentacionVerificacion
      : {};

  return {
    id: docSnap.id,
    ...raw,
    nombre: raw.nombre || "Sin nombre",
    slug: raw.slug || "",
    razonSocial: raw.razonSocial || "",
    cuit: raw.cuit || "",
    activa: raw.activa !== false,
    admins: Array.isArray(raw.admins) ? raw.admins : [],
    modulosSuscriptos: Array.isArray(raw.modulosSuscriptos)
      ? raw.modulosSuscriptos
      : DEFAULT_MODULES,
    verificacion: {
      estado: "pendiente_documentacion",
      estadoLabel: "Pendiente de documentación para validar",
      documentacionCompleta: false,
      documentacionAprobada: false,
      requiereDocumentacion: true,
      ...verificacion,
    },
    documentacionVerificacion,
    createdAt: normalizeTimestamp(raw.createdAt),
    updatedAt: normalizeTimestamp(raw.updatedAt),
  };
};

const getInmobiliariaLabel = (inmobiliaria) => {
  if (!inmobiliaria) return "Inmobiliaria no encontrada";

  const parts = [inmobiliaria.nombre];

  if (inmobiliaria.slug) {
    parts.push(`/${inmobiliaria.slug}`);
  }

  if (inmobiliaria.activa === false) {
    parts.push("(inactiva)");
  }

  return parts.join(" ");
};

const getVerificationEstado = (inmobiliaria) => {
  return inmobiliaria?.verificacion?.estado || "pendiente_documentacion";
};

const getVerificationLabel = (inmobiliaria) => {
  const estado = getVerificationEstado(inmobiliaria);

  return (
    inmobiliaria?.verificacion?.estadoLabel ||
    VERIFICATION_STATUS_LABELS[estado] ||
    estado
  );
};

const getVerificationBadgeClass = (inmobiliaria) => {
  const estado = getVerificationEstado(inmobiliaria);

  return VERIFICATION_STATUS_BADGES[estado] || "text-bg-secondary";
};

const getUploadedVerificationDocumentsCount = (inmobiliaria) => {
  const documents =
    inmobiliaria?.documentacionVerificacion &&
      typeof inmobiliaria.documentacionVerificacion === "object"
      ? inmobiliaria.documentacionVerificacion
      : {};

  return VERIFICATION_DOCUMENT_KEYS.filter((key) => documents[key]?.path)
    .length;
};

const getVerificationCounters = (items = []) => {
  return items.reduce(
    (acc, inmobiliaria) => {
      const estado = getVerificationEstado(inmobiliaria);

      acc.total += 1;
      acc[estado] = (acc[estado] || 0) + 1;

      return acc;
    },
    {
      total: 0,
      pendiente_documentacion: 0,
      pendiente_revision: 0,
      observada: 0,
      rechazada: 0,
      verificada: 0,
    },
  );
};

const getNextActiveInmobiliariaId = ({
  currentActiveId,
  selectedInmobiliarias,
}) => {
  if (
    currentActiveId &&
    Array.isArray(selectedInmobiliarias) &&
    selectedInmobiliarias.includes(currentActiveId)
  ) {
    return currentActiveId;
  }

  return selectedInmobiliarias[0] || "";
};

const buildInmobiliariaRoles = (user, selectedInmobiliarias = []) => {
  const currentRoles =
    user?.inmobiliariaRoles && typeof user.inmobiliariaRoles === "object"
      ? user.inmobiliariaRoles
      : {};

  return selectedInmobiliarias.reduce((acc, inmobiliariaId) => {
    acc[inmobiliariaId] = currentRoles[inmobiliariaId] || "admin";
    return acc;
  }, {});
};

const getAddedInmobiliarias = (previous = [], next = []) => {
  return next.filter((id) => !previous.includes(id));
};

const getRemovedInmobiliarias = (previous = [], next = []) => {
  return previous.filter((id) => !next.includes(id));
};

const UserAdminPage = () => {
  const { user: currentUser } = useAuth();

  const [users, setUsers] = useState([]);
  const [inmobiliarias, setInmobiliarias] = useState([]);

  const [loading, setLoading] = useState(true);
  const [savingUserId, setSavingUserId] = useState(null);
  const [savingInmobiliariaId, setSavingInmobiliariaId] = useState(null);

  const [userSearch, setUserSearch] = useState("");
  const [inmoSearch, setInmoSearch] = useState("");

  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);

  const { isRoot } = getRoleFlags(currentUser);

  const inmobiliariasById = useMemo(() => {
    return inmobiliarias.reduce((acc, inmobiliaria) => {
      acc[inmobiliaria.id] = inmobiliaria;
      return acc;
    }, {});
  }, [inmobiliarias]);

  const filteredUsers = useMemo(() => {
    const term = userSearch.trim().toLowerCase();

    if (!term) return users;

    return users.filter((u) => {
      const text = [
        u.email,
        u.displayName,
        u.primaryRole,
        ...(u.roles || []),
        ...(u.inmobiliarias || []).map(
          (id) => inmobiliariasById[id]?.nombre || id,
        ),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return text.includes(term);
    });
  }, [inmobiliariasById, userSearch, users]);

  const filteredInmobiliarias = useMemo(() => {
    const term = inmoSearch.trim().toLowerCase();

    if (!term) return inmobiliarias;

    return inmobiliarias.filter((inmobiliaria) => {
      const text = [
        inmobiliaria.nombre,
        inmobiliaria.slug,
        inmobiliaria.razonSocial,
        inmobiliaria.cuit,
        inmobiliaria.verificacion?.estado,
        inmobiliaria.verificacion?.estadoLabel,
        getVerificationLabel(inmobiliaria),
        ...(inmobiliaria.modulosSuscriptos || []),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return text.includes(term);
    });
  }, [inmoSearch, inmobiliarias]);

  const verificationCounters = useMemo(() => {
    return getVerificationCounters(inmobiliarias);
  }, [inmobiliarias]);

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        setError(null);

        const [usersSnap, inmobiliariasSnap] = await Promise.all([
          getDocs(collection(db, "users")),
          getDocs(collection(db, "inmobiliarias")),
        ]);

        setUsers(usersSnap.docs.map(mapUserDoc));
        setInmobiliarias(inmobiliariasSnap.docs.map(mapInmobiliariaDoc));
      } catch (err) {
        console.error(err);
        setError("No se pudieron cargar los datos de administración.");
      } finally {
        setLoading(false);
      }
    };

    if (isRoot) {
      loadData();
    } else {
      setLoading(false);
    }
  }, [isRoot]);

  const updateLocalUser = (id, patch) => {
    setUsers((prev) =>
      prev.map((u) => (u.id === id ? { ...u, ...patch } : u)),
    );
  };

  const updateLocalInmobiliaria = (id, patch) => {
    setInmobiliarias((prev) =>
      prev.map((inmo) => (inmo.id === id ? { ...inmo, ...patch } : inmo)),
    );
  };

  const toggleRole = (u, rawRole) => {
    const role = normalizeRole(rawRole);
    const currentRoles = normalizeRoles(u.roles);

    const nextRoles = currentRoles.includes(role)
      ? currentRoles.filter((r) => r !== role)
      : [...currentRoles, role];

    const normalizedRoles = normalizeRoles(nextRoles);
    const primaryRole = getPrimaryRoleFromRoles(normalizedRoles);

    updateLocalUser(u.id, {
      roles: normalizedRoles,
      primaryRole,
      role: primaryRole,
    });
  };

  const updatePrimaryRole = (u, rawPrimaryRole) => {
    const primaryRole = normalizeRole(rawPrimaryRole);
    const roles = normalizeRoles(
      u.roles.includes(primaryRole) ? u.roles : [...u.roles, primaryRole],
    );

    updateLocalUser(u.id, {
      roles,
      primaryRole,
      role: primaryRole,
    });
  };

  const toggleUserInmobiliaria = (u, inmobiliariaId) => {
    const current = new Set(u.inmobiliarias || []);

    if (current.has(inmobiliariaId)) {
      current.delete(inmobiliariaId);
    } else {
      current.add(inmobiliariaId);
    }

    const selectedInmobiliarias = Array.from(current);
    const activeInmobiliariaId = getNextActiveInmobiliariaId({
      currentActiveId: u.activeInmobiliariaId,
      selectedInmobiliarias,
    });

    const inmobiliariaRoles = buildInmobiliariaRoles(
      {
        ...u,
        inmobiliarias: selectedInmobiliarias,
      },
      selectedInmobiliarias,
    );

    updateLocalUser(u.id, {
      inmobiliarias: selectedInmobiliarias,
      activeInmobiliariaId,
      inmobiliariaRoles,
    });
  };

  const updateActiveInmobiliaria = (u, activeInmobiliariaId) => {
    updateLocalUser(u.id, {
      activeInmobiliariaId,
    });
  };

  const toggleInmobiliariaModule = (inmobiliaria, moduleId) => {
    const current = new Set(inmobiliaria.modulosSuscriptos || DEFAULT_MODULES);

    if (current.has(moduleId)) {
      current.delete(moduleId);
    } else {
      current.add(moduleId);
    }

    updateLocalInmobiliaria(inmobiliaria.id, {
      modulosSuscriptos: Array.from(current),
    });
  };

  const handleSaveUser = async (u) => {
    setSavingUserId(u.id);
    setError(null);
    setSuccessMessage(null);

    try {
      const selectedInmobiliarias = Array.isArray(u.inmobiliarias)
        ? u.inmobiliarias
        : [];

      const roles = normalizeRoles(u.roles);
      const primaryRole = getPrimaryRoleFromRoles(roles);

      const activeInmobiliariaId = getNextActiveInmobiliariaId({
        currentActiveId: u.activeInmobiliariaId,
        selectedInmobiliarias,
      });

      const inmobiliariaRoles = buildInmobiliariaRoles(
        {
          ...u,
          inmobiliarias: selectedInmobiliarias,
        },
        selectedInmobiliarias,
      );

      const previousInmobiliarias = Array.isArray(u._originalInmobiliarias)
        ? u._originalInmobiliarias
        : [];

      const addedInmobiliarias = getAddedInmobiliarias(
        previousInmobiliarias,
        selectedInmobiliarias,
      );

      const removedInmobiliarias = getRemovedInmobiliarias(
        previousInmobiliarias,
        selectedInmobiliarias,
      );

      const batch = writeBatch(db);
      const userRef = doc(db, "users", u.id);

      batch.update(userRef, {
        roles,
        primaryRole,
        role: primaryRole,
        inmobiliarias: selectedInmobiliarias,
        activeInmobiliariaId,
        inmobiliariaRoles,
        updatedAt: serverTimestamp(),
      });

      addedInmobiliarias.forEach((inmobiliariaId) => {
        const inmobiliariaRef = doc(db, "inmobiliarias", inmobiliariaId);

        batch.update(inmobiliariaRef, {
          admins: arrayUnion(u.id),
          updatedAt: serverTimestamp(),
        });
      });

      removedInmobiliarias.forEach((inmobiliariaId) => {
        const inmobiliariaRef = doc(db, "inmobiliarias", inmobiliariaId);

        batch.update(inmobiliariaRef, {
          admins: arrayRemove(u.id),
          updatedAt: serverTimestamp(),
        });
      });

      await batch.commit();

      updateLocalUser(u.id, {
        roles,
        primaryRole,
        role: primaryRole,
        inmobiliarias: selectedInmobiliarias,
        activeInmobiliariaId,
        inmobiliariaRoles,
        _originalInmobiliarias: selectedInmobiliarias,
      });

      setInmobiliarias((prev) =>
        prev.map((inmobiliaria) => {
          if (addedInmobiliarias.includes(inmobiliaria.id)) {
            return {
              ...inmobiliaria,
              admins: Array.from(new Set([...(inmobiliaria.admins || []), u.id])),
            };
          }

          if (removedInmobiliarias.includes(inmobiliaria.id)) {
            return {
              ...inmobiliaria,
              admins: (inmobiliaria.admins || []).filter((id) => id !== u.id),
            };
          }

          return inmobiliaria;
        }),
      );

      setSuccessMessage(`Usuario ${u.email || u.id} actualizado.`);
    } catch (err) {
      console.error(err);
      setError(
        err.message ||
        "Error guardando cambios del usuario. Revisá permisos y reglas.",
      );
    } finally {
      setSavingUserId(null);
    }
  };

  const handleSaveInmobiliariaModules = async (inmobiliaria) => {
    setSavingInmobiliariaId(inmobiliaria.id);
    setError(null);
    setSuccessMessage(null);

    try {
      const ref = doc(db, "inmobiliarias", inmobiliaria.id);

      await updateDoc(ref, {
        modulosSuscriptos: inmobiliaria.modulosSuscriptos || [],
        updatedAt: serverTimestamp(),
      });

      setSuccessMessage(
        `Módulos de ${inmobiliaria.nombre || inmobiliaria.id} actualizados.`,
      );
    } catch (err) {
      console.error(err);
      setError("Error guardando módulos de la inmobiliaria.");
    } finally {
      setSavingInmobiliariaId(null);
    }
  };

  if (!isRoot) {
    return (
      <main className="container py-5">
        <div className="alert alert-warning">
          Esta sección es exclusiva para usuarios root.
        </div>
      </main>
    );
  }

  if (loading) {
    return (
      <main className="container py-5 text-center">
        <div className="spinner-border" />
        <p className="text-muted mt-3">Cargando administración...</p>
      </main>
    );
  }

  return (
    <main className="container py-4">
      <header className="mb-4">
        <div className="d-flex flex-wrap justify-content-between align-items-start gap-3">
          <div>
            <p className="text-uppercase text-muted small mb-1">
              Administración global
            </p>
            <h1 className="h3 mb-1">Usuarios, roles y suscripciones</h1>
            <p className="text-muted mb-0">
              Root administra usuarios, roles globales, inmobiliarias asignadas
              y módulos habilitados por cliente.
            </p>
          </div>

          <div className="text-end">
            <div className="badge text-bg-dark">ROOT</div>
          </div>
        </div>
      </header>

      {error && <div className="alert alert-danger">{error}</div>}

      {successMessage && (
        <div className="alert alert-success">{successMessage}</div>
      )}

      <section className="row g-3 mb-4">
        <div className="col-md-3">
          <div className="card border-0 shadow-sm h-100">
            <div className="card-body">
              <div className="h3 mb-0">{users.length}</div>
              <div className="text-muted">Usuarios registrados</div>
            </div>
          </div>
        </div>

        <div className="col-md-3">
          <div className="card border-0 shadow-sm h-100">
            <div className="card-body">
              <div className="h3 mb-0">{inmobiliarias.length}</div>
              <div className="text-muted">Inmobiliarias creadas</div>
            </div>
          </div>
        </div>

        <div className="col-md-3">
          <div className="card border-0 shadow-sm h-100">
            <div className="card-body">
              <div className="h3 mb-0">
                {inmobiliarias.filter((inmo) => inmo.activa !== false).length}
              </div>
              <div className="text-muted">Inmobiliarias activas</div>
            </div>
          </div>
        </div>

        <div className="col-md-3">
          <div className="card border-0 shadow-sm h-100">
            <div className="card-body">
              <div className="h3 mb-0">
                {verificationCounters.pendiente_revision || 0}
              </div>
              <div className="text-muted">Documentación en revisión</div>

              <Link
                to="/admin/inmobiliarias/verificacion"
                className="btn btn-sm btn-outline-primary mt-3"
              >
                Revisar ahora
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="card border-0 shadow-sm mb-4">
        <div className="card-body p-4">
          <div className="d-flex flex-column flex-lg-row justify-content-between align-items-lg-center gap-3">
            <div>
              <p className="text-uppercase text-muted small mb-1">
                Validación documental
              </p>

              <h2 className="h4 mb-1">Control de documentación de inmobiliarias</h2>

              <p className="text-muted mb-0">
                Revisá constancias, DNI, estatutos, poderes y el estado de validación
                de cada inmobiliaria.
              </p>
            </div>

            <div className="d-flex flex-wrap gap-2">
              <Link
                to="/admin/inmobiliarias/verificacion"
                className="btn btn-primary"
              >
                Abrir panel de revisión
              </Link>

              <Link
                to="/admin/inmobiliarias"
                className="btn btn-outline-secondary"
              >
                Ver inmobiliarias
              </Link>
            </div>
          </div>

          <div className="row g-3 mt-3">
            <div className="col-6 col-lg">
              <div className="border rounded-3 p-3 bg-light h-100">
                <div className="h4 mb-0">
                  {verificationCounters.pendiente_revision || 0}
                </div>
                <div className="small text-muted">En revisión</div>
              </div>
            </div>

            <div className="col-6 col-lg">
              <div className="border rounded-3 p-3 bg-light h-100">
                <div className="h4 mb-0">
                  {verificationCounters.observada || 0}
                </div>
                <div className="small text-muted">Observadas</div>
              </div>
            </div>

            <div className="col-6 col-lg">
              <div className="border rounded-3 p-3 bg-light h-100">
                <div className="h4 mb-0">
                  {verificationCounters.pendiente_documentacion || 0}
                </div>
                <div className="small text-muted">Pendientes</div>
              </div>
            </div>

            <div className="col-6 col-lg">
              <div className="border rounded-3 p-3 bg-light h-100">
                <div className="h4 mb-0">
                  {verificationCounters.verificada || 0}
                </div>
                <div className="small text-muted">Verificadas</div>
              </div>
            </div>

            <div className="col-6 col-lg">
              <div className="border rounded-3 p-3 bg-light h-100">
                <div className="h4 mb-0">
                  {verificationCounters.rechazada || 0}
                </div>
                <div className="small text-muted">Rechazadas</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="card border-0 shadow-sm mb-4">
        <div className="card-body p-4">
          <div className="d-flex flex-wrap justify-content-between align-items-center gap-3 mb-3">
            <div>
              <h2 className="h4 mb-1">Usuarios</h2>
              <p className="text-muted mb-0">
                Asigná roles, vinculá usuarios a inmobiliarias y definí la
                inmobiliaria activa inicial.
              </p>
            </div>

            <input
              type="search"
              className="form-control"
              placeholder="Buscar usuario..."
              value={userSearch}
              onChange={(e) => setUserSearch(e.target.value)}
              style={{ maxWidth: 320 }}
            />
          </div>

          <div className="table-responsive">
            <table className="table table-hover align-middle">
              <thead className="table-light">
                <tr>
                  <th>Usuario</th>
                  <th>Rol principal</th>
                  <th>Roles</th>
                  <th>Inmobiliarias</th>
                  <th>Activa</th>
                  <th className="text-end">Acciones</th>
                </tr>
              </thead>

              <tbody>
                {filteredUsers.map((u) => {
                  const isSelf = u.id === currentUser?.uid;
                  const selectedInmobiliarias = u.inmobiliarias || [];

                  return (
                    <tr key={u.id}>
                      <td>
                        <div className="fw-semibold">{u.email || u.id}</div>
                        <div className="small text-muted">
                          {u.displayName || "Sin nombre"}
                        </div>
                        <div className="small text-muted mt-1">
                          ID: {u.id}
                        </div>
                      </td>

                      <td style={{ minWidth: 170 }}>
                        <select
                          className="form-select"
                          value={u.primaryRole}
                          disabled={isSelf}
                          onChange={(e) => updatePrimaryRole(u, e.target.value)}
                        >
                          {ALL_ROLES.map((role) => (
                            <option key={role} value={role}>
                              {role}
                            </option>
                          ))}
                        </select>

                        {isSelf && (
                          <div className="form-text">
                            No podés modificar tu propio rol.
                          </div>
                        )}
                      </td>

                      <td style={{ minWidth: 260 }}>
                        <div className="d-flex flex-wrap gap-3">
                          {ALL_ROLES.map((role) => (
                            <div key={role} className="form-check">
                              <input
                                id={`role-${u.id}-${role}`}
                                className="form-check-input"
                                type="checkbox"
                                checked={normalizeRoles(u.roles).includes(role)}
                                disabled={isSelf}
                                onChange={() => toggleRole(u, role)}
                              />
                              <label
                                className="form-check-label"
                                htmlFor={`role-${u.id}-${role}`}
                              >
                                {role}
                              </label>
                            </div>
                          ))}
                        </div>
                      </td>

                      <td style={{ minWidth: 360 }}>
                        <div className="d-flex flex-column gap-2">
                          {inmobiliarias.map((inmobiliaria) => (
                            <div
                              className="form-check"
                              key={`${u.id}-${inmobiliaria.id}`}
                            >
                              <input
                                id={`user-${u.id}-inmo-${inmobiliaria.id}`}
                                className="form-check-input"
                                type="checkbox"
                                checked={selectedInmobiliarias.includes(
                                  inmobiliaria.id,
                                )}
                                disabled={isSelf}
                                onChange={() =>
                                  toggleUserInmobiliaria(u, inmobiliaria.id)
                                }
                              />
                              <label
                                className="form-check-label"
                                htmlFor={`user-${u.id}-inmo-${inmobiliaria.id}`}
                              >
                                {getInmobiliariaLabel(inmobiliaria)}
                              </label>
                            </div>
                          ))}

                          {inmobiliarias.length === 0 && (
                            <span className="text-muted">
                              No hay inmobiliarias cargadas.
                            </span>
                          )}
                        </div>
                      </td>

                      <td style={{ minWidth: 220 }}>
                        <select
                          className="form-select"
                          value={u.activeInmobiliariaId || ""}
                          disabled={isSelf || selectedInmobiliarias.length === 0}
                          onChange={(e) =>
                            updateActiveInmobiliaria(u, e.target.value)
                          }
                        >
                          {selectedInmobiliarias.length === 0 && (
                            <option value="">Sin inmobiliaria</option>
                          )}

                          {selectedInmobiliarias.map((inmobiliariaId) => (
                            <option key={inmobiliariaId} value={inmobiliariaId}>
                              {inmobiliariasById[inmobiliariaId]?.nombre ||
                                inmobiliariaId}
                            </option>
                          ))}
                        </select>

                        {selectedInmobiliarias.length > 0 && (
                          <div className="form-text">
                            Se usa como inmobiliaria inicial del usuario.
                          </div>
                        )}
                      </td>

                      <td className="text-end">
                        <button
                          type="button"
                          className="btn btn-primary btn-sm"
                          onClick={() => handleSaveUser(u)}
                          disabled={savingUserId === u.id || isSelf}
                        >
                          {savingUserId === u.id ? "Guardando…" : "Guardar"}
                        </button>
                      </td>
                    </tr>
                  );
                })}

                {filteredUsers.length === 0 && (
                  <tr>
                    <td colSpan={6} className="text-center text-muted py-4">
                      No hay usuarios para mostrar.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="alert alert-info small mt-3 mb-0">
            Al guardar un usuario, se actualiza también{" "}
            <strong>activeInmobiliariaId</strong>,{" "}
            <strong>inmobiliariaRoles</strong> y el array{" "}
            <strong>admins</strong> de las inmobiliarias agregadas o quitadas.
          </div>
        </div>
      </section>

      <section className="card border-0 shadow-sm">
        <div className="card-body p-4">
          <div className="d-flex flex-wrap justify-content-between align-items-center gap-3 mb-3">
            <div>
              <h2 className="h4 mb-1">Suscripciones por inmobiliaria</h2>
              <p className="text-muted mb-0">
                Estos módulos definen qué funcionalidades ve y puede usar cada
                admin de inmobiliaria.
              </p>
            </div>

            <input
              type="search"
              className="form-control"
              placeholder="Buscar inmobiliaria..."
              value={inmoSearch}
              onChange={(e) => setInmoSearch(e.target.value)}
              style={{ maxWidth: 320 }}
            />
          </div>

          <div className="row g-4">
            {filteredInmobiliarias.map((inmobiliaria) => (
              <article className="col-12 col-xl-6" key={inmobiliaria.id}>
                <div className="border rounded-4 p-4 h-100 bg-white">
                  <div className="d-flex flex-wrap justify-content-between align-items-start gap-2 mb-3">
                    <div>
                      <h3 className="h5 mb-1">{inmobiliaria.nombre}</h3>
                      <div className="small text-muted">
                        {inmobiliaria.slug
                          ? `/inmobiliaria/${inmobiliaria.slug}`
                          : "Sin slug"}
                      </div>
                      <div className="small text-muted">
                        Admins: {(inmobiliaria.admins || []).length}
                      </div>
                      <div className="small text-muted">
                        Documentos cargados:{" "}
                        {getUploadedVerificationDocumentsCount(inmobiliaria)} /{" "}
                        {VERIFICATION_DOCUMENT_KEYS.length}
                      </div>

                      {inmobiliaria.verificacion?.reviewNote && (
                        <div className="small text-muted mt-1">
                          Nota revisión: {inmobiliaria.verificacion.reviewNote}
                        </div>
                      )}
                    </div>

                    <div className="d-flex flex-wrap gap-2 justify-content-xl-end">
                      <span className={`badge ${getVerificationBadgeClass(inmobiliaria)}`}>
                        {getVerificationLabel(inmobiliaria)}
                      </span>

                      <span
                        className={`badge ${inmobiliaria.activa ? "text-bg-success" : "text-bg-danger"
                          }`}
                      >
                        {inmobiliaria.activa ? "Activa" : "Inactiva"}
                      </span>
                    </div>
                  </div>

                  <div className="d-flex flex-column gap-3 mb-3">
                    {SUBSCRIPTION_MODULES.map((module) => (
                      <div className="form-check" key={module.id}>
                        <input
                          id={`module-${inmobiliaria.id}-${module.id}`}
                          className="form-check-input"
                          type="checkbox"
                          checked={(inmobiliaria.modulosSuscriptos || []).includes(
                            module.id,
                          )}
                          onChange={() =>
                            toggleInmobiliariaModule(inmobiliaria, module.id)
                          }
                        />
                        <label
                          className="form-check-label"
                          htmlFor={`module-${inmobiliaria.id}-${module.id}`}
                        >
                          <span className="fw-semibold">{module.label}</span>
                          <br />
                          <span className="small text-muted">
                            {module.description}
                          </span>
                        </label>
                      </div>
                    ))}
                  </div>

                  <div className="d-flex flex-wrap gap-2">
                    <button
                      type="button"
                      className="btn btn-primary"
                      onClick={() => handleSaveInmobiliariaModules(inmobiliaria)}
                      disabled={savingInmobiliariaId === inmobiliaria.id}
                    >
                      {savingInmobiliariaId === inmobiliaria.id
                        ? "Guardando…"
                        : "Guardar módulos"}
                    </button>

                    <Link
                      to="/admin/inmobiliarias/verificacion"
                      className="btn btn-outline-primary"
                    >
                      Revisar documentación
                    </Link>

                    {inmobiliaria.slug && (
                      <Link
                        to={`/inmobiliaria/${inmobiliaria.slug}`}
                        className="btn btn-outline-secondary"
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        Ver pública
                      </Link>
                    )}
                  </div>
                </div>
              </article>
            ))}

            {filteredInmobiliarias.length === 0 && (
              <div className="col-12">
                <div className="alert alert-light border mb-0">
                  No hay inmobiliarias para mostrar.
                </div>
              </div>
            )}
          </div>
        </div>
      </section>
    </main>
  );
};

export default UserAdminPage;
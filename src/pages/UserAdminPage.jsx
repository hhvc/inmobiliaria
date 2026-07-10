import { useEffect, useMemo, useState } from "react";
import {
  collection,
  getDocs,
  doc,
  updateDoc,
  serverTimestamp,
} from "firebase/firestore";

import { db } from "../firebase/config";
import { useAuth } from "../context/auth/useAuth";

const ALL_ROLES = ["user", "editor", "admin", "root"];

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

const normalizeTimestamp = (value) => {
  if (!value) return null;

  if (typeof value.toDate === "function") {
    return value.toDate();
  }

  const date = new Date(value);

  return Number.isFinite(date.getTime()) ? date : null;
};

const getRoleFlags = (user) => {
  const roles = user?.roles || [];
  const primaryRole = user?.primaryRole || user?.role || "";

  return {
    isRoot:
      primaryRole === "root" ||
      user?.role === "root" ||
      roles.includes("root"),
    isAdmin:
      primaryRole === "admin" ||
      user?.role === "admin" ||
      roles.includes("admin"),
  };
};

const mapUserDoc = (docSnap) => {
  const raw = docSnap.data();

  const roles = Array.isArray(raw.roles)
    ? raw.roles
    : raw.role
      ? [raw.role]
      : ["user"];

  const primaryRole =
    raw.primaryRole && roles.includes(raw.primaryRole)
      ? raw.primaryRole
      : roles[0] || "user";

  return {
    id: docSnap.id,
    ...raw,
    roles,
    primaryRole,
    inmobiliarias: Array.isArray(raw.inmobiliarias) ? raw.inmobiliarias : [],
    createdAt: normalizeTimestamp(raw.createdAt),
    updatedAt: normalizeTimestamp(raw.updatedAt),
  };
};

const mapInmobiliariaDoc = (docSnap) => {
  const raw = docSnap.data();

  return {
    id: docSnap.id,
    ...raw,
    nombre: raw.nombre || "Sin nombre",
    slug: raw.slug || "",
    activa: raw.activa !== false,
    modulosSuscriptos: Array.isArray(raw.modulosSuscriptos)
      ? raw.modulosSuscriptos
      : DEFAULT_MODULES,
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
        ...(inmobiliaria.modulosSuscriptos || []),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return text.includes(term);
    });
  }, [inmoSearch, inmobiliarias]);

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

  const toggleRole = (u, role) => {
    const roles = u.roles.includes(role)
      ? u.roles.filter((r) => r !== role)
      : [...u.roles, role];

    const normalizedRoles = roles.length > 0 ? roles : ["user"];

    updateLocalUser(u.id, {
      roles: normalizedRoles,
      primaryRole: normalizedRoles.includes(u.primaryRole)
        ? u.primaryRole
        : normalizedRoles[0],
    });
  };

  const updatePrimaryRole = (u, primaryRole) => {
    const roles = u.roles.includes(primaryRole)
      ? u.roles
      : [...u.roles, primaryRole];

    updateLocalUser(u.id, {
      roles,
      primaryRole,
    });
  };

  const toggleUserInmobiliaria = (u, inmobiliariaId) => {
    const current = new Set(u.inmobiliarias || []);

    if (current.has(inmobiliariaId)) {
      current.delete(inmobiliariaId);
    } else {
      current.add(inmobiliariaId);
    }

    updateLocalUser(u.id, {
      inmobiliarias: Array.from(current),
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
      const ref = doc(db, "users", u.id);

      await updateDoc(ref, {
        roles: u.roles,
        primaryRole: u.primaryRole,
        role: u.primaryRole,
        inmobiliarias: u.inmobiliarias || [],
        updatedAt: serverTimestamp(),
      });

      setSuccessMessage(`Usuario ${u.email || u.id} actualizado.`);
    } catch (err) {
      console.error(err);
      setError("Error guardando cambios del usuario.");
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
              Root administra todos los usuarios y define qué módulos tiene
              habilitados cada cliente inmobiliario.
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
        <div className="col-md-4">
          <div className="card border-0 shadow-sm h-100">
            <div className="card-body">
              <div className="h3 mb-0">{users.length}</div>
              <div className="text-muted">Usuarios registrados</div>
            </div>
          </div>
        </div>

        <div className="col-md-4">
          <div className="card border-0 shadow-sm h-100">
            <div className="card-body">
              <div className="h3 mb-0">{inmobiliarias.length}</div>
              <div className="text-muted">Inmobiliarias creadas</div>
            </div>
          </div>
        </div>

        <div className="col-md-4">
          <div className="card border-0 shadow-sm h-100">
            <div className="card-body">
              <div className="h3 mb-0">
                {inmobiliarias.filter((inmo) => inmo.activa !== false).length}
              </div>
              <div className="text-muted">Inmobiliarias activas</div>
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
                Asigná roles y vinculá usuarios a una o más inmobiliarias.
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
                  <th className="text-end">Acciones</th>
                </tr>
              </thead>

              <tbody>
                {filteredUsers.map((u) => {
                  const isSelf = u.id === currentUser?.uid;

                  return (
                    <tr key={u.id}>
                      <td>
                        <div className="fw-semibold">{u.email || u.id}</div>
                        <div className="small text-muted">
                          {u.displayName || "Sin nombre"}
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

                      <td style={{ minWidth: 240 }}>
                        <div className="d-flex flex-wrap gap-3">
                          {ALL_ROLES.map((role) => (
                            <div key={role} className="form-check">
                              <input
                                id={`role-${u.id}-${role}`}
                                className="form-check-input"
                                type="checkbox"
                                checked={u.roles.includes(role)}
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
                                checked={(u.inmobiliarias || []).includes(
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
                    <td colSpan={5} className="text-center text-muted py-4">
                      No hay usuarios para mostrar.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section className="card border-0 shadow-sm">
        <div className="card-body p-4">
          <div className="d-flex flex-wrap justify-content-between align-items-center gap-3 mb-3">
            <div>
              <h2 className="h4 mb-1">Suscripciones por inmobiliaria</h2>
              <p className="text-muted mb-0">
                Estos módulos van a definir qué funcionalidades ve y puede usar
                cada admin de inmobiliaria.
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
                    </div>

                    <span
                      className={`badge ${inmobiliaria.activa ? "text-bg-success" : "text-bg-danger"
                        }`}
                    >
                      {inmobiliaria.activa ? "Activa" : "Inactiva"}
                    </span>
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
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

const UserAdminPage = () => {
  const { user: currentUser } = useAuth();

  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState(null);
  const [error, setError] = useState(null);

  const isRoot = currentUser?.primaryRole === "root";

  /* =========================
     Filtrado por permisos
     ========================= */
  const visibleUsers = useMemo(() => {
    if (isRoot) return users;

    const adminInmos = currentUser?.inmobiliarias || [];

    return users.filter((u) =>
      (u.inmobiliarias || []).some((id) => adminInmos.includes(id))
    );
  }, [users, isRoot, currentUser]);

  /* =========================
     Cargar usuarios
     ========================= */
  useEffect(() => {
    const loadUsers = async () => {
      try {
        const snap = await getDocs(collection(db, "users"));

        const data = snap.docs.map((d) => {
          const raw = d.data();
          return {
            id: d.id,
            ...raw,
            roles: raw.roles || ["user"],
            primaryRole: raw.primaryRole || "user",
            inmobiliarias: raw.inmobiliarias || [],
          };
        });

        setUsers(data);
      } catch (err) {
        console.error(err);
        setError("No se pudieron cargar los usuarios");
      } finally {
        setLoading(false);
      }
    };

    loadUsers();
  }, []);

  /* =========================
     Handlers locales
     ========================= */
  const updateLocalUser = (id, patch) => {
    setUsers((prev) => prev.map((u) => (u.id === id ? { ...u, ...patch } : u)));
  };

  const toggleRole = (u, role) => {
    const roles = u.roles.includes(role)
      ? u.roles.filter((r) => r !== role)
      : [...u.roles, role];

    updateLocalUser(u.id, {
      roles,
      primaryRole: roles.includes(u.primaryRole)
        ? u.primaryRole
        : roles[0] || "user",
    });
  };

  const updateInmos = (u, value) => {
    const inmobiliarias = value
      .split(",")
      .map((v) => v.trim())
      .filter(Boolean);

    updateLocalUser(u.id, { inmobiliarias });
  };

  /* =========================
     Guardar cambios
     ========================= */
  const handleSave = async (u) => {
    setSavingId(u.id);
    setError(null);

    try {
      const ref = doc(db, "users", u.id);

      await updateDoc(ref, {
        roles: u.roles,
        primaryRole: u.primaryRole,
        inmobiliarias: u.inmobiliarias,
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      console.error(err);
      setError("Error guardando cambios");
    } finally {
      setSavingId(null);
    }
  };

  /* =========================
     Render
     ========================= */
  if (loading) {
    return (
      <div className="container py-5 text-center">
        <div className="spinner-border" />
      </div>
    );
  }

  return (
    <div className="container py-4">
      <header className="mb-4">
        <h1 className="h4">Administración de usuarios</h1>
        <p className="text-muted mb-0">Gestión de roles e inmobiliarias</p>
      </header>

      {error && <div className="alert alert-danger">{error}</div>}

      <div className="table-responsive">
        <table className="table table-bordered align-middle">
          <thead className="table-light">
            <tr>
              <th>Email</th>
              <th>Nombre</th>
              <th>Rol principal</th>
              <th>Roles</th>
              <th>Inmobiliarias</th>
              <th className="text-center">Acciones</th>
            </tr>
          </thead>

          <tbody>
            {visibleUsers.map((u) => {
              const isSelf = u.id === currentUser?.uid;
              const disabled = isSelf || (!isRoot && u.primaryRole === "root");

              return (
                <tr key={u.id}>
                  <td>{u.email}</td>
                  <td>{u.displayName || "—"}</td>

                  {/* Rol principal */}
                  <td>
                    <select
                      className="form-select"
                      value={u.primaryRole}
                      disabled={disabled}
                      onChange={(e) =>
                        updateLocalUser(u.id, {
                          primaryRole: e.target.value,
                        })
                      }
                    >
                      {u.roles.map((r) => (
                        <option key={r} value={r}>
                          {r}
                        </option>
                      ))}
                    </select>
                  </td>

                  {/* Roles */}
                  <td>
                    <div className="d-flex flex-wrap gap-2">
                      {ALL_ROLES.filter((r) => isRoot || r !== "root").map(
                        (role) => (
                          <div key={role} className="form-check">
                            <input
                              className="form-check-input"
                              type="checkbox"
                              checked={u.roles.includes(role)}
                              disabled={disabled}
                              onChange={() => toggleRole(u, role)}
                            />
                            <label className="form-check-label">{role}</label>
                          </div>
                        )
                      )}
                    </div>
                  </td>

                  {/* Inmobiliarias */}
                  <td>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="id1, id2"
                      value={u.inmobiliarias.join(", ")}
                      disabled={disabled}
                      onChange={(e) => updateInmos(u, e.target.value)}
                    />
                  </td>

                  <td className="text-center">
                    <button
                      className="btn btn-sm btn-primary"
                      onClick={() => handleSave(u)}
                      disabled={savingId === u.id || disabled}
                    >
                      {savingId === u.id ? "Guardando…" : "Guardar"}
                    </button>
                  </td>
                </tr>
              );
            })}

            {visibleUsers.length === 0 && (
              <tr>
                <td colSpan={6} className="text-center text-muted">
                  No hay usuarios disponibles
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default UserAdminPage;

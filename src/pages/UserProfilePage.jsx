import { useEffect, useState } from "react";
import { doc, getDoc, updateDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../firebase/config";
import { useAuth } from "../context/auth/useAuth";
import { useNavigate } from "react-router-dom";

const UserProfilePage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [form, setForm] = useState({
    displayName: "",
  });

  const [meta, setMeta] = useState({
    roles: [],
    primaryRole: "user",
    inmobiliarias: [],
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  /* =========================
     Cargar perfil
     ========================= */
  useEffect(() => {
    const loadProfile = async () => {
      if (!user?.uid) return;

      try {
        const ref = doc(db, "users", user.uid);
        const snap = await getDoc(ref);

        if (!snap.exists()) {
          throw new Error("No se encontró el perfil del usuario");
        }

        const data = snap.data();

        setForm({
          displayName: data.displayName || "",
        });

        setMeta({
          roles: data.roles || ["user"],
          primaryRole: data.primaryRole || "user",
          inmobiliarias: data.inmobiliarias || [],
        });
      } catch (err) {
        console.error(err);
        setError(err.message || "Error al cargar el perfil");
      } finally {
        setLoading(false);
      }
    };

    loadProfile();
  }, [user]);

  /* =========================
     Handlers
     ========================= */
  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const ref = doc(db, "users", user.uid);

      await updateDoc(ref, {
        displayName: form.displayName,
        updatedAt: serverTimestamp(),
      });

      setSuccess("Perfil actualizado correctamente");
    } catch (err) {
      console.error(err);
      setError("No se pudo actualizar el perfil");
    } finally {
      setSaving(false);
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
      <div className="row justify-content-center">
        <div className="col-md-8 col-lg-6">
          <div className="card shadow-sm">
            <div className="card-header fw-semibold">Mi perfil</div>

            <div className="card-body">
              {error && <div className="alert alert-danger">{error}</div>}
              {success && <div className="alert alert-success">{success}</div>}

              <form onSubmit={handleSubmit} className="row g-3">
                {/* Email */}
                <div className="col-12">
                  <label className="form-label">Email</label>
                  <input
                    type="email"
                    className="form-control"
                    value={user.email || ""}
                    disabled
                  />
                </div>

                {/* Nombre */}
                <div className="col-12">
                  <label className="form-label">Nombre completo</label>
                  <input
                    type="text"
                    name="displayName"
                    className="form-control"
                    value={form.displayName}
                    onChange={handleChange}
                    required
                  />
                </div>

                {/* Rol principal */}
                <div className="col-12">
                  <label className="form-label">Rol principal</label>
                  <input
                    type="text"
                    className="form-control"
                    value={meta.primaryRole}
                    disabled
                  />
                </div>

                {/* Roles */}
                <div className="col-12">
                  <label className="form-label">Roles asignados</label>
                  <div className="d-flex flex-wrap gap-2">
                    {meta.roles.length > 0 ? (
                      meta.roles.map((role) => (
                        <span key={role} className="badge bg-secondary">
                          {role}
                        </span>
                      ))
                    ) : (
                      <span className="text-muted">Sin roles</span>
                    )}
                  </div>
                </div>

                {/* Inmobiliarias */}
                <div className="col-12">
                  <label className="form-label">Inmobiliarias asociadas</label>
                  <div className="d-flex flex-wrap gap-2">
                    {meta.inmobiliarias.length > 0 ? (
                      meta.inmobiliarias.map((inmoId) => (
                        <span key={inmoId} className="badge bg-info text-dark">
                          {inmoId}
                        </span>
                      ))
                    ) : (
                      <span className="text-muted">No asignadas</span>
                    )}
                  </div>
                </div>

                {/* Acciones */}
                <div className="col-12 d-flex justify-content-end">
                  <button
                    type="submit"
                    className="btn btn-primary px-4"
                    disabled={saving}
                  >
                    {saving ? "Guardando..." : "Guardar cambios"}
                  </button>
                </div>
              </form>
            </div>

            <div className="card-footer text-end">
              <button
                type="button"
                className="btn btn-link"
                onClick={() => navigate(-1)}
              >
                Volver
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UserProfilePage;

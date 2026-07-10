import { useEffect, useMemo, useState } from "react";
import {
    collection,
    doc,
    getDocs,
    limit,
    query,
    serverTimestamp,
    updateDoc,
    where,
} from "firebase/firestore";

import { useAuth } from "../../context/auth/useAuth";
import { db } from "../../firebase/config";
import {
    getAllInmobiliarias,
    getInmobiliariasByRole,
} from "../services/inmobiliaria.service";

const DEFAULT_MODULES = ["inmuebles", "consultas"];

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

const getStoredActiveInmobiliariaId = () => {
    if (typeof window === "undefined") return null;

    return (
        window.localStorage.getItem("activeInmobiliariaId") ||
        window.localStorage.getItem("inmobiliariaActivaId") ||
        window.localStorage.getItem("activeInmobiliaria") ||
        null
    );
};

const getInitialInmobiliariaId = ({ user, inmobiliarias, isRoot }) => {
    const storedId = getStoredActiveInmobiliariaId();

    if (storedId && inmobiliarias.some((inmo) => inmo.id === storedId)) {
        return storedId;
    }

    if (!isRoot && Array.isArray(user?.inmobiliarias)) {
        const firstAllowed = user.inmobiliarias.find((id) =>
            inmobiliarias.some((inmo) => inmo.id === id),
        );

        if (firstAllowed) return firstAllowed;
    }

    return inmobiliarias[0]?.id || "";
};

const hasUsersModule = (inmobiliaria) => {
    const modules = Array.isArray(inmobiliaria?.modulosSuscriptos)
        ? inmobiliaria.modulosSuscriptos
        : DEFAULT_MODULES;

    return modules.includes("usuarios");
};

const mapUserDoc = (docSnap) => {
    const data = docSnap.data();

    const roles = Array.isArray(data.roles)
        ? data.roles
        : data.role
            ? [data.role]
            : [];

    return {
        id: docSnap.id,
        ...data,
        email: data.email || "",
        displayName: data.displayName || "",
        role: data.role || data.primaryRole || roles[0] || "user",
        primaryRole: data.primaryRole || data.role || roles[0] || "user",
        roles,
        inmobiliarias: Array.isArray(data.inmobiliarias)
            ? data.inmobiliarias
            : [],
    };
};

const isRootUser = (targetUser) => {
    return (
        targetUser?.role === "root" ||
        targetUser?.primaryRole === "root" ||
        targetUser?.roles?.includes("root")
    );
};

const InmobiliariaUsersPage = () => {
    const { user } = useAuth();

    const [inmobiliarias, setInmobiliarias] = useState([]);
    const [activeInmobiliariaId, setActiveInmobiliariaId] = useState("");

    const [teamUsers, setTeamUsers] = useState([]);
    const [emailToAdd, setEmailToAdd] = useState("");

    const [loading, setLoading] = useState(true);
    const [usersLoading, setUsersLoading] = useState(false);
    const [saving, setSaving] = useState(false);

    const [error, setError] = useState(null);
    const [successMessage, setSuccessMessage] = useState(null);

    const { isRoot, isAdmin } = getRoleFlags(user);

    const activeInmobiliaria = useMemo(() => {
        return inmobiliarias.find((inmo) => inmo.id === activeInmobiliariaId) || null;
    }, [activeInmobiliariaId, inmobiliarias]);

    const canUseUsersModule = useMemo(() => {
        if (!activeInmobiliaria) return false;
        if (isRoot) return true;

        return hasUsersModule(activeInmobiliaria);
    }, [activeInmobiliaria, isRoot]);

    const loadTeamUsers = async (inmobiliariaId) => {
        if (!inmobiliariaId) {
            setTeamUsers([]);
            return;
        }

        try {
            setUsersLoading(true);
            setError(null);

            const q = query(
                collection(db, "users"),
                where("inmobiliarias", "array-contains", inmobiliariaId),
            );

            const snap = await getDocs(q);

            const data = snap.docs
                .map(mapUserDoc)
                .sort((a, b) =>
                    (a.email || a.displayName || a.id).localeCompare(
                        b.email || b.displayName || b.id,
                    ),
                );

            setTeamUsers(data);
        } catch (err) {
            console.error("Error cargando usuarios de inmobiliaria:", err);

            if (err.code === "permission-denied") {
                setError("No tenés permisos para leer usuarios.");
            } else {
                setError("No se pudieron cargar los usuarios de esta inmobiliaria.");
            }
        } finally {
            setUsersLoading(false);
        }
    };

    useEffect(() => {
        const loadInmobiliarias = async () => {
            try {
                setLoading(true);
                setError(null);

                if (!user?.uid) {
                    setInmobiliarias([]);
                    return;
                }

                const data = isRoot
                    ? await getAllInmobiliarias()
                    : await getInmobiliariasByRole(user);

                setInmobiliarias(data);

                const initialId = getInitialInmobiliariaId({
                    user,
                    inmobiliarias: data,
                    isRoot,
                });

                setActiveInmobiliariaId(initialId);

                await loadTeamUsers(initialId);
            } catch (err) {
                console.error("Error cargando módulo de usuarios:", err);
                setError("No se pudo cargar el módulo de usuarios.");
            } finally {
                setLoading(false);
            }
        };

        if (isRoot || isAdmin) {
            loadInmobiliarias();
        } else {
            setLoading(false);
        }
    }, [isAdmin, isRoot, user]);

    const handleActiveInmobiliariaChange = async (e) => {
        const nextId = e.target.value;

        setActiveInmobiliariaId(nextId);
        setEmailToAdd("");
        setError(null);
        setSuccessMessage(null);

        if (typeof window !== "undefined") {
            window.localStorage.setItem("activeInmobiliariaId", nextId);
        }

        await loadTeamUsers(nextId);
    };

    const handleAddUserByEmail = async (e) => {
        e.preventDefault();

        if (!activeInmobiliaria) return;

        const cleanEmail = emailToAdd.trim().toLowerCase();

        if (!cleanEmail) {
            setError("Ingresá un email para buscar.");
            return;
        }

        try {
            setSaving(true);
            setError(null);
            setSuccessMessage(null);

            if (!canUseUsersModule) {
                throw new Error(
                    "Esta inmobiliaria no tiene habilitado el módulo de usuarios.",
                );
            }

            const q = query(
                collection(db, "users"),
                where("email", "==", cleanEmail),
                limit(1),
            );

            const snap = await getDocs(q);

            if (snap.empty) {
                throw new Error(
                    "No encontramos un usuario registrado con ese email. Primero debe iniciar sesión o ser creado por root.",
                );
            }

            const targetDoc = snap.docs[0];
            const targetUser = mapUserDoc(targetDoc);

            if (!isRoot && isRootUser(targetUser)) {
                throw new Error("No podés asociar usuarios root desde este módulo.");
            }

            if (targetUser.inmobiliarias.includes(activeInmobiliaria.id)) {
                throw new Error("Ese usuario ya está asociado a esta inmobiliaria.");
            }

            const nextInmobiliarias = Array.from(
                new Set([...targetUser.inmobiliarias, activeInmobiliaria.id]),
            );

            await updateDoc(doc(db, "users", targetUser.id), {
                inmobiliarias: nextInmobiliarias,
                updatedAt: serverTimestamp(),
            });

            setEmailToAdd("");
            setSuccessMessage(`Usuario ${targetUser.email} asociado correctamente.`);

            await loadTeamUsers(activeInmobiliaria.id);
        } catch (err) {
            console.error("Error asociando usuario:", err);

            if (err.code === "permission-denied") {
                setError(
                    "No tenés permisos suficientes para asociar este usuario a la inmobiliaria.",
                );
            } else {
                setError(err.message || "No se pudo asociar el usuario.");
            }
        } finally {
            setSaving(false);
        }
    };

    const handleRemoveUser = async (targetUser) => {
        if (!activeInmobiliaria) return;

        const isSelf = targetUser.id === user?.uid;

        if (isSelf) {
            setError("No podés quitarte a vos mismo de la inmobiliaria activa.");
            return;
        }

        if (!isRoot && isRootUser(targetUser)) {
            setError("No podés modificar usuarios root desde este módulo.");
            return;
        }

        const confirmed = window.confirm(
            `¿Quitar a ${targetUser.email || targetUser.id} de ${activeInmobiliaria.nombre}?`,
        );

        if (!confirmed) return;

        try {
            setSaving(true);
            setError(null);
            setSuccessMessage(null);

            if (!canUseUsersModule) {
                throw new Error(
                    "Esta inmobiliaria no tiene habilitado el módulo de usuarios.",
                );
            }

            const nextInmobiliarias = targetUser.inmobiliarias.filter(
                (id) => id !== activeInmobiliaria.id,
            );

            await updateDoc(doc(db, "users", targetUser.id), {
                inmobiliarias: nextInmobiliarias,
                updatedAt: serverTimestamp(),
            });

            setSuccessMessage(`Usuario ${targetUser.email} quitado correctamente.`);

            await loadTeamUsers(activeInmobiliaria.id);
        } catch (err) {
            console.error("Error quitando usuario:", err);

            if (err.code === "permission-denied") {
                setError(
                    "No tenés permisos suficientes para quitar este usuario de la inmobiliaria.",
                );
            } else {
                setError(err.message || "No se pudo quitar el usuario.");
            }
        } finally {
            setSaving(false);
        }
    };

    if (!isRoot && !isAdmin) {
        return (
            <main className="container py-5">
                <div className="alert alert-warning">
                    Esta sección está disponible para usuarios administradores.
                </div>
            </main>
        );
    }

    if (loading) {
        return (
            <main className="container py-5 text-center">
                <div className="spinner-border" />
                <p className="text-muted mt-3">Cargando usuarios...</p>
            </main>
        );
    }

    return (
        <main className="container py-4">
            <header className="mb-4">
                <div className="d-flex flex-wrap justify-content-between align-items-start gap-3">
                    <div>
                        <p className="text-uppercase text-muted small mb-1">
                            Panel de inmobiliaria
                        </p>

                        <h1 className="h3 mb-1">Usuarios de inmobiliaria</h1>

                        <p className="text-muted mb-0">
                            Asociá usuarios existentes a una inmobiliaria y administrá el
                            equipo visible para ese cliente.
                        </p>
                    </div>

                    {isRoot && <span className="badge text-bg-dark">ROOT</span>}
                </div>
            </header>

            {error && <div className="alert alert-danger">{error}</div>}

            {successMessage && (
                <div className="alert alert-success">{successMessage}</div>
            )}

            {inmobiliarias.length === 0 && (
                <div className="alert alert-info">
                    No hay inmobiliarias disponibles para este usuario.
                </div>
            )}

            {inmobiliarias.length > 0 && (
                <div className="row g-4">
                    <section className="col-lg-8">
                        <div className="card border-0 shadow-sm mb-4">
                            <div className="card-body p-4">
                                <div className="mb-4">
                                    <label className="form-label">Inmobiliaria</label>

                                    <select
                                        className="form-select form-select-lg"
                                        value={activeInmobiliariaId}
                                        onChange={handleActiveInmobiliariaChange}
                                    >
                                        {inmobiliarias.map((inmobiliaria) => (
                                            <option key={inmobiliaria.id} value={inmobiliaria.id}>
                                                {inmobiliaria.nombre}
                                                {inmobiliaria.slug ? ` /${inmobiliaria.slug}` : ""}
                                            </option>
                                        ))}
                                    </select>

                                    {!isRoot && (
                                        <div className="form-text">
                                            Solo ves inmobiliarias asignadas a tu usuario.
                                        </div>
                                    )}
                                </div>

                                {activeInmobiliaria && !canUseUsersModule && (
                                    <div className="alert alert-warning">
                                        Esta inmobiliaria no tiene habilitado el módulo{" "}
                                        <strong>Usuarios de inmobiliaria</strong>. Un usuario root
                                        debe habilitarlo desde Administración global.
                                    </div>
                                )}

                                <form onSubmit={handleAddUserByEmail}>
                                    <label className="form-label">
                                        Asociar usuario existente por email
                                    </label>

                                    <div className="input-group">
                                        <input
                                            type="email"
                                            className="form-control"
                                            placeholder="usuario@email.com"
                                            value={emailToAdd}
                                            onChange={(e) => {
                                                setEmailToAdd(e.target.value);
                                                setError(null);
                                                setSuccessMessage(null);
                                            }}
                                            disabled={!canUseUsersModule || saving}
                                        />

                                        <button
                                            type="submit"
                                            className="btn btn-primary"
                                            disabled={!canUseUsersModule || saving}
                                        >
                                            {saving ? "Procesando..." : "Asociar"}
                                        </button>
                                    </div>

                                    <div className="form-text">
                                        El usuario debe existir previamente en la colección users.
                                    </div>
                                </form>
                            </div>
                        </div>

                        <div className="card border-0 shadow-sm">
                            <div className="card-body p-4">
                                <div className="d-flex flex-wrap justify-content-between align-items-center gap-3 mb-3">
                                    <div>
                                        <h2 className="h4 mb-1">Equipo asociado</h2>
                                        <p className="text-muted mb-0">
                                            Usuarios actualmente vinculados a esta inmobiliaria.
                                        </p>
                                    </div>

                                    <button
                                        type="button"
                                        className="btn btn-outline-secondary btn-sm"
                                        onClick={() => loadTeamUsers(activeInmobiliariaId)}
                                        disabled={usersLoading || !activeInmobiliariaId}
                                    >
                                        Actualizar
                                    </button>
                                </div>

                                {usersLoading && (
                                    <div className="alert alert-light border">
                                        Cargando usuarios...
                                    </div>
                                )}

                                {!usersLoading && teamUsers.length === 0 && (
                                    <div className="alert alert-info">
                                        No hay usuarios asociados a esta inmobiliaria.
                                    </div>
                                )}

                                {!usersLoading && teamUsers.length > 0 && (
                                    <div className="table-responsive">
                                        <table className="table table-hover align-middle">
                                            <thead className="table-light">
                                                <tr>
                                                    <th>Usuario</th>
                                                    <th>Rol global</th>
                                                    <th>Inmobiliarias</th>
                                                    <th className="text-end">Acciones</th>
                                                </tr>
                                            </thead>

                                            <tbody>
                                                {teamUsers.map((teamUser) => {
                                                    const isSelf = teamUser.id === user?.uid;
                                                    const targetIsRoot = isRootUser(teamUser);

                                                    return (
                                                        <tr key={teamUser.id}>
                                                            <td>
                                                                <div className="fw-semibold">
                                                                    {teamUser.email || teamUser.id}
                                                                </div>

                                                                <div className="small text-muted">
                                                                    {teamUser.displayName || "Sin nombre"}
                                                                </div>
                                                            </td>

                                                            <td>
                                                                <span
                                                                    className={`badge ${targetIsRoot
                                                                        ? "text-bg-dark"
                                                                        : teamUser.primaryRole === "admin"
                                                                            ? "text-bg-primary"
                                                                            : "text-bg-secondary"
                                                                        }`}
                                                                >
                                                                    {teamUser.primaryRole || teamUser.role}
                                                                </span>
                                                            </td>

                                                            <td>
                                                                <span className="badge text-bg-light border text-dark">
                                                                    {teamUser.inmobiliarias.length}
                                                                </span>
                                                            </td>

                                                            <td className="text-end">
                                                                <button
                                                                    type="button"
                                                                    className="btn btn-outline-danger btn-sm"
                                                                    onClick={() => handleRemoveUser(teamUser)}
                                                                    disabled={
                                                                        saving ||
                                                                        isSelf ||
                                                                        (!isRoot && targetIsRoot) ||
                                                                        !canUseUsersModule
                                                                    }
                                                                >
                                                                    {isSelf ? "Usuario actual" : "Quitar"}
                                                                </button>
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </div>
                        </div>
                    </section>

                    <aside className="col-lg-4">
                        <div className="card border-0 shadow-sm mb-4">
                            <div className="card-body p-4">
                                <h2 className="h5 mb-3">Cómo funciona</h2>

                                <ul className="text-muted ps-3 mb-0">
                                    <li>Este módulo no modifica roles globales.</li>
                                    <li>Solo asocia o quita usuarios de una inmobiliaria.</li>
                                    <li>
                                        Los permisos reales se siguen controlando por rol y por
                                        módulos suscriptos.
                                    </li>
                                </ul>
                            </div>
                        </div>

                        <div className="card border-0 shadow-sm">
                            <div className="card-body p-4">
                                <h2 className="h5 mb-3">Inmobiliaria activa</h2>

                                {activeInmobiliaria ? (
                                    <>
                                        <p className="mb-1">
                                            <strong>{activeInmobiliaria.nombre}</strong>
                                        </p>

                                        <p className="text-muted small mb-0">
                                            ID: {activeInmobiliaria.id}
                                        </p>
                                    </>
                                ) : (
                                    <p className="text-muted mb-0">
                                        No hay inmobiliaria seleccionada.
                                    </p>
                                )}
                            </div>
                        </div>
                    </aside>
                </div>
            )}
        </main>
    );
};

export default InmobiliariaUsersPage;
import { useCallback, useEffect, useMemo, useState } from "react";
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

const INTERNAL_ROLE_OPTIONS = [
    {
        id: "admin",
        label: "Administrador",
        description: "Puede administrar equipo, marca, consultas e inmuebles.",
    },
    {
        id: "editor",
        label: "Editor",
        description: "Puede cargar y editar publicaciones.",
    },
    {
        id: "viewer",
        label: "Solo lectura",
        description: "Puede consultar información sin modificarla.",
    },
];

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

const getSafeInmobiliariaRoles = (data) => {
    if (
        data?.inmobiliariaRoles &&
        typeof data.inmobiliariaRoles === "object" &&
        !Array.isArray(data.inmobiliariaRoles)
    ) {
        return data.inmobiliariaRoles;
    }

    return {};
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
        inmobiliariaRoles: getSafeInmobiliariaRoles(data),
    };
};

const isRootUser = (targetUser) => {
    return (
        targetUser?.role === "root" ||
        targetUser?.primaryRole === "root" ||
        targetUser?.roles?.includes("root")
    );
};

const getInternalRole = (targetUser, inmobiliariaId) => {
    if (!targetUser || !inmobiliariaId) return "viewer";

    return targetUser.inmobiliariaRoles?.[inmobiliariaId] || "viewer";
};

const getInternalRoleLabel = (roleId) => {
    return (
        INTERNAL_ROLE_OPTIONS.find((role) => role.id === roleId)?.label ||
        "Sin rol"
    );
};

const isValidInternalRole = (roleId) => {
    return INTERNAL_ROLE_OPTIONS.some((role) => role.id === roleId);
};

const removeRoleForInmobiliaria = (roles, inmobiliariaId) => {
    const nextRoles = {
        ...(roles || {}),
    };

    delete nextRoles[inmobiliariaId];

    return nextRoles;
};

const InmobiliariaUsersPage = () => {
    const { user } = useAuth();

    const [inmobiliarias, setInmobiliarias] = useState([]);
    const [activeInmobiliariaId, setActiveInmobiliariaId] = useState("");

    const [teamUsers, setTeamUsers] = useState([]);
    const [emailToAdd, setEmailToAdd] = useState("");
    const [defaultRoleToAdd, setDefaultRoleToAdd] = useState("viewer");

    const [loading, setLoading] = useState(true);
    const [usersLoading, setUsersLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [updatingUserId, setUpdatingUserId] = useState("");

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

    const loadTeamUsers = useCallback(async (inmobiliariaId) => {
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
    }, []);

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
    }, [isAdmin, isRoot, loadTeamUsers, user]);

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

            if (!isValidInternalRole(defaultRoleToAdd)) {
                throw new Error("El rol interno seleccionado no es válido.");
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

            const alreadyAssociated = targetUser.inmobiliarias.includes(
                activeInmobiliaria.id,
            );

            const nextInmobiliarias = alreadyAssociated
                ? targetUser.inmobiliarias
                : Array.from(
                    new Set([...targetUser.inmobiliarias, activeInmobiliaria.id]),
                );

            const nextInmobiliariaRoles = {
                ...targetUser.inmobiliariaRoles,
                [activeInmobiliaria.id]: defaultRoleToAdd,
            };

            await updateDoc(doc(db, "users", targetUser.id), {
                inmobiliarias: nextInmobiliarias,
                inmobiliariaRoles: nextInmobiliariaRoles,
                updatedAt: serverTimestamp(),
            });

            setEmailToAdd("");

            setSuccessMessage(
                alreadyAssociated
                    ? `Usuario ${targetUser.email} ya estaba asociado. Se actualizó su rol interno.`
                    : `Usuario ${targetUser.email} asociado correctamente.`,
            );

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

    const handleUpdateInternalRole = async (targetUser, nextRole) => {
        if (!activeInmobiliaria) return;

        if (!isValidInternalRole(nextRole)) {
            setError("El rol interno seleccionado no es válido.");
            return;
        }

        const isSelf = targetUser.id === user?.uid;

        if (isSelf) {
            setError("No podés modificar tu propio rol interno desde este módulo.");
            return;
        }

        if (!isRoot && isRootUser(targetUser)) {
            setError("No podés modificar usuarios root desde este módulo.");
            return;
        }

        try {
            setUpdatingUserId(targetUser.id);
            setError(null);
            setSuccessMessage(null);

            if (!canUseUsersModule) {
                throw new Error(
                    "Esta inmobiliaria no tiene habilitado el módulo de usuarios.",
                );
            }

            const nextInmobiliariaRoles = {
                ...targetUser.inmobiliariaRoles,
                [activeInmobiliaria.id]: nextRole,
            };

            await updateDoc(doc(db, "users", targetUser.id), {
                inmobiliariaRoles: nextInmobiliariaRoles,
                updatedAt: serverTimestamp(),
            });

            setTeamUsers((prev) =>
                prev.map((teamUser) =>
                    teamUser.id === targetUser.id
                        ? {
                            ...teamUser,
                            inmobiliariaRoles: nextInmobiliariaRoles,
                        }
                        : teamUser,
                ),
            );

            setSuccessMessage(
                `Rol interno actualizado a ${getInternalRoleLabel(nextRole)}.`,
            );
        } catch (err) {
            console.error("Error actualizando rol interno:", err);

            if (err.code === "permission-denied") {
                setError(
                    "No tenés permisos suficientes para modificar el rol interno de este usuario.",
                );
            } else {
                setError(err.message || "No se pudo actualizar el rol interno.");
            }
        } finally {
            setUpdatingUserId("");
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

            const nextInmobiliariaRoles = removeRoleForInmobiliaria(
                targetUser.inmobiliariaRoles,
                activeInmobiliaria.id,
            );

            await updateDoc(doc(db, "users", targetUser.id), {
                inmobiliarias: nextInmobiliarias,
                inmobiliariaRoles: nextInmobiliariaRoles,
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
                            Asociá usuarios existentes y definí su rol interno dentro de cada
                            inmobiliaria.
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

                                    <div className="row g-2">
                                        <div className="col-md-7">
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
                                        </div>

                                        <div className="col-md-3">
                                            <select
                                                className="form-select"
                                                value={defaultRoleToAdd}
                                                onChange={(e) => setDefaultRoleToAdd(e.target.value)}
                                                disabled={!canUseUsersModule || saving}
                                            >
                                                {INTERNAL_ROLE_OPTIONS.map((role) => (
                                                    <option key={role.id} value={role.id}>
                                                        {role.label}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>

                                        <div className="col-md-2 d-grid">
                                            <button
                                                type="submit"
                                                className="btn btn-primary"
                                                disabled={!canUseUsersModule || saving}
                                            >
                                                {saving ? "..." : "Asociar"}
                                            </button>
                                        </div>
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
                                            Usuarios vinculados a esta inmobiliaria y rol interno.
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
                                                    <th>Rol interno</th>
                                                    <th>Inmobiliarias</th>
                                                    <th className="text-end">Acciones</th>
                                                </tr>
                                            </thead>

                                            <tbody>
                                                {teamUsers.map((teamUser) => {
                                                    const isSelf = teamUser.id === user?.uid;
                                                    const targetIsRoot = isRootUser(teamUser);
                                                    const currentInternalRole = getInternalRole(
                                                        teamUser,
                                                        activeInmobiliariaId,
                                                    );

                                                    const cannotModify =
                                                        saving ||
                                                        updatingUserId === teamUser.id ||
                                                        isSelf ||
                                                        (!isRoot && targetIsRoot) ||
                                                        !canUseUsersModule;

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

                                                            <td style={{ minWidth: 180 }}>
                                                                <select
                                                                    className="form-select form-select-sm"
                                                                    value={currentInternalRole}
                                                                    onChange={(e) =>
                                                                        handleUpdateInternalRole(
                                                                            teamUser,
                                                                            e.target.value,
                                                                        )
                                                                    }
                                                                    disabled={cannotModify}
                                                                >
                                                                    {INTERNAL_ROLE_OPTIONS.map((role) => (
                                                                        <option key={role.id} value={role.id}>
                                                                            {role.label}
                                                                        </option>
                                                                    ))}
                                                                </select>

                                                                {isSelf && (
                                                                    <div className="form-text">
                                                                        Usuario actual
                                                                    </div>
                                                                )}
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
                                                                    disabled={cannotModify}
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
                                <h2 className="h5 mb-3">Roles internos</h2>

                                <div className="vstack gap-3">
                                    {INTERNAL_ROLE_OPTIONS.map((role) => (
                                        <div key={role.id}>
                                            <div className="fw-semibold">{role.label}</div>
                                            <div className="text-muted small">{role.description}</div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>

                        <div className="card border-0 shadow-sm">
                            <div className="card-body p-4">
                                <h2 className="h5 mb-3">Dato técnico</h2>

                                <p className="text-muted mb-2">
                                    Se guarda en cada usuario dentro del mapa:
                                </p>

                                <pre className="bg-light border rounded p-3 small mb-0">
                                    {`inmobiliariaRoles: {
  "${activeInmobiliariaId || "ID_INMOBILIARIA"}": "editor"
}`}
                                </pre>
                            </div>
                        </div>
                    </aside>
                </div>
            )}
        </main>
    );
};

export default InmobiliariaUsersPage;
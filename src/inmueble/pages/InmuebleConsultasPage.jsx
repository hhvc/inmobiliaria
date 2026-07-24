import { useEffect, useMemo, useState, useCallback } from "react";
import { Link } from "react-router-dom";

import { useAuth } from "../../context/auth/useAuth";
import {
    getConsultasByInmobiliaria,
    markConsultaAsRead,
    markConsultaAsUnread,
    archiveConsulta,
    restoreConsulta,
    updateConsultaEstado,
    saveConsultaSeguimiento,
    CONSULTA_ESTADOS,
    CONSULTA_ESTADO_LABELS,
} from "../services/inmuebleConsulta.service";

const formatDate = (timestamp) => {
    if (!timestamp) return "Sin fecha";

    if (typeof timestamp.toDate === "function") {
        return timestamp.toDate().toLocaleString("es-AR");
    }

    if (timestamp instanceof Date) {
        return timestamp.toLocaleString("es-AR");
    }

    return "Sin fecha";
};

const buildPublicUrl = (slug) => {
    if (!slug) return null;
    return `/inmueble/${slug}`;
};

const normalizeWhatsappNumber = (value = "") => {
    return value.toString().replace(/\D/g, "");
};

const buildWhatsappReplyUrl = (consulta) => {
    const phone = normalizeWhatsappNumber(consulta.telefono);

    if (!phone) return null;

    const publicUrl = consulta.inmuebleSlug
        ? `${window.location.origin}/inmueble/${consulta.inmuebleSlug}`
        : "";

    const message = [
        `Hola ${consulta.nombre || ""}, te contacto por tu consulta en LaDocTaProp.`,
        consulta.inmuebleTitulo
            ? `Inmueble: ${consulta.inmuebleTitulo}`
            : "",
        consulta.inmuebleOperacion || consulta.inmuebleTipo
            ? `Referencia: ${consulta.inmuebleOperacion || ""} ${consulta.inmuebleTipo || ""}`.trim()
            : "",
        publicUrl ? `Link: ${publicUrl}` : "",
    ]
        .filter(Boolean)
        .join("\n");

    return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
};

const buildLeadClipboardText = (consulta) => {
    const publicUrl = consulta.inmuebleSlug
        ? `${window.location.origin}/inmueble/${consulta.inmuebleSlug}`
        : "";

    return [
        "Consulta de inmueble - LaDocTaProp",
        "",
        `Nombre: ${consulta.nombre || "Sin nombre"}`,
        `Email: ${consulta.email || "Sin email"}`,
        `Teléfono / WhatsApp: ${consulta.telefono || "Sin teléfono"}`,
        "",
        `Inmueble: ${consulta.inmuebleTitulo || "Sin título"}`,
        `Operación: ${consulta.inmuebleOperacion || "Sin operación"}`,
        `Tipo: ${consulta.inmuebleTipo || "Sin tipo"}`,
        publicUrl ? `Link: ${publicUrl}` : "",
        "",
        consulta.mensaje ? `Mensaje:\n${consulta.mensaje}` : "Mensaje: Sin mensaje",
    ]
        .filter(Boolean)
        .join("\n");
};

const buildEmailReplyUrl = (consulta) => {
    if (!consulta.email) return null;

    const publicUrl = consulta.inmuebleSlug
        ? `${window.location.origin}/inmueble/${consulta.inmuebleSlug}`
        : "";

    const subject = consulta.inmuebleTitulo
        ? `Consulta por ${consulta.inmuebleTitulo}`
        : "Consulta de inmueble";

    const body = [
        `Hola ${consulta.nombre || ""},`,
        "",
        "Te contacto por tu consulta en LaDocTaProp.",
        "",
        consulta.inmuebleTitulo
            ? `Inmueble: ${consulta.inmuebleTitulo}`
            : "",
        consulta.inmuebleOperacion || consulta.inmuebleTipo
            ? `Referencia: ${consulta.inmuebleOperacion || ""} ${consulta.inmuebleTipo || ""}`.trim()
            : "",
        publicUrl ? `Link: ${publicUrl}` : "",
        "",
        "Quedo atento a tu respuesta.",
    ]
        .filter(Boolean)
        .join("\n");

    return `mailto:${consulta.email}?subject=${encodeURIComponent(
        subject,
    )}&body=${encodeURIComponent(body)}`;
};

const escapeCsvValue = (value = "") => {
    const normalizedValue = value
        .toString()
        .replace(/\r?\n|\r/g, " ")
        .trim();

    return `"${normalizedValue.replace(/"/g, '""')}"`;
};

const buildConsultasCsv = (consultas) => {
    const headers = [
        "Fecha",
        "Estado",
        "Nombre",
        "Email",
        "Telefono",
        "Inmueble",
        "Operacion",
        "Tipo",
        "Mensaje",
        "Link",
    ];

    const rows = consultas.map((consulta) => {
        const publicUrl = consulta.inmuebleSlug
            ? `${window.location.origin}/inmueble/${consulta.inmuebleSlug}`
            : "";

        return [
            formatDate(consulta.createdAt),
            consulta.estado || "",
            consulta.nombre || "",
            consulta.email || "",
            consulta.telefono || "",
            consulta.inmuebleTitulo || "",
            consulta.inmuebleOperacion || "",
            consulta.inmuebleTipo || "",
            consulta.mensaje || "",
            publicUrl,
        ].map(escapeCsvValue);
    });

    return [headers.map(escapeCsvValue), ...rows]
        .map((row) => row.join(";"))
        .join("\n");
};

const CONSULTA_FILTERS = [
    { value: "activas", label: "Activas" },
    { value: CONSULTA_ESTADOS.NUEVA, label: "Nuevas" },
    { value: CONSULTA_ESTADOS.CONTACTADA, label: "Contactadas" },
    { value: CONSULTA_ESTADOS.VISITA, label: "Visitas" },
    { value: CONSULTA_ESTADOS.INTERESADA, label: "Interesadas" },
    { value: CONSULTA_ESTADOS.CERRADA, label: "Cerradas" },
    { value: CONSULTA_ESTADOS.DESCARTADA, label: "Descartadas" },
    { value: CONSULTA_ESTADOS.ARCHIVADA, label: "Archivadas" },
];

const KANBAN_COLUMNS = [
    CONSULTA_ESTADOS.NUEVA,
    CONSULTA_ESTADOS.CONTACTADA,
    CONSULTA_ESTADOS.VISITA,
    CONSULTA_ESTADOS.INTERESADA,
    CONSULTA_ESTADOS.CERRADA,
    CONSULTA_ESTADOS.DESCARTADA,
];

const isArchivedConsulta = (consulta) => {
    return (
        consulta.archivada === true ||
        consulta.estado === CONSULTA_ESTADOS.ARCHIVADA
    );
};

const normalizeConsultaEstado = (consulta = {}) => {
    if (isArchivedConsulta(consulta)) {
        return CONSULTA_ESTADOS.ARCHIVADA;
    }

    if (consulta.estado === "leida") {
        return CONSULTA_ESTADOS.CONTACTADA;
    }

    if (CONSULTA_ESTADO_LABELS[consulta.estado]) {
        return consulta.estado;
    }

    return consulta.leida
        ? CONSULTA_ESTADOS.CONTACTADA
        : CONSULTA_ESTADOS.NUEVA;
};

const getConsultaEstadoBadgeClass = (estado) => {
    if (estado === CONSULTA_ESTADOS.NUEVA) {
        return "badge text-bg-primary";
    }

    if (estado === CONSULTA_ESTADOS.CONTACTADA) {
        return "badge text-bg-info";
    }

    if (estado === CONSULTA_ESTADOS.VISITA) {
        return "badge text-bg-warning";
    }

    if (estado === CONSULTA_ESTADOS.INTERESADA) {
        return "badge text-bg-success";
    }

    if (estado === CONSULTA_ESTADOS.CERRADA) {
        return "badge text-bg-dark";
    }

    if (estado === CONSULTA_ESTADOS.DESCARTADA) {
        return "badge text-bg-secondary";
    }

    if (estado === CONSULTA_ESTADOS.ARCHIVADA) {
        return "badge text-bg-dark";
    }

    return "badge text-bg-secondary";
};

const normalizeText = (value = "") => {
    return value
        .toString()
        .trim()
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");
};

const consultaMatchesSearch = (consulta, searchTerm) => {
    const normalizedSearch = normalizeText(searchTerm);

    if (!normalizedSearch) return true;

    const searchableText = [
        consulta.nombre,
        consulta.email,
        consulta.telefono,
        consulta.inmuebleTitulo,
        consulta.inmuebleOperacion,
        consulta.inmuebleTipo,
        consulta.mensaje,
        consulta.estado,
    ]
        .filter(Boolean)
        .join(" ");

    return normalizeText(searchableText).includes(normalizedSearch);
};

const getConsultaStats = (consultas) => {
    return consultas.reduce(
        (acc, consulta) => {
            const estado = normalizeConsultaEstado(consulta);
            const isArchived = estado === CONSULTA_ESTADOS.ARCHIVADA;

            if (isArchived) {
                acc[CONSULTA_ESTADOS.ARCHIVADA] += 1;
                return acc;
            }

            acc.activas += 1;

            if (acc[estado] !== undefined) {
                acc[estado] += 1;
            }

            return acc;
        },
        {
            activas: 0,
            [CONSULTA_ESTADOS.NUEVA]: 0,
            [CONSULTA_ESTADOS.CONTACTADA]: 0,
            [CONSULTA_ESTADOS.VISITA]: 0,
            [CONSULTA_ESTADOS.INTERESADA]: 0,
            [CONSULTA_ESTADOS.CERRADA]: 0,
            [CONSULTA_ESTADOS.DESCARTADA]: 0,
            [CONSULTA_ESTADOS.ARCHIVADA]: 0,
        },
    );
};

const InmuebleConsultasPage = () => {
    const { user, activeInmobiliariaId } = useAuth();

    const [consultas, setConsultas] = useState([]);
    const [loading, setLoading] = useState(true);
    const [actionLoadingId, setActionLoadingId] = useState(null);
    const [consultaFilter, setConsultaFilter] = useState("activas");
    const [searchTerm, setSearchTerm] = useState("");
    const [viewMode, setViewMode] = useState("list");
    const [seguimientoValues, setSeguimientoValues] = useState({});
    const [error, setError] = useState(null);

    const fetchConsultas = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);

            if (!user?.uid) {
                setConsultas([]);
                return;
            }

            if (!activeInmobiliariaId) {
                setConsultas([]);
                setError("No hay inmobiliaria activa seleccionada");
                return;
            }

            const data = await getConsultasByInmobiliaria(activeInmobiliariaId, {
                includeArchived: true,
                pageSize: 100,
            });

            setConsultas(data);
        } catch (err) {
            console.error("Error cargando consultas:", err);

            if (err.code === "permission-denied") {
                setError("No tenés permisos para ver estas consultas");
            } else {
                setError(err.message || "No se pudieron cargar las consultas");
            }
        } finally {
            setLoading(false);
        }
    }, [user?.uid, activeInmobiliariaId]);

    useEffect(() => {
        fetchConsultas();
    }, [fetchConsultas]);

    const stats = useMemo(() => {
        return getConsultaStats(consultas);
    }, [consultas]);

    const filteredConsultas = useMemo(() => {
        return consultas.filter((consulta) => {
            if (!consultaMatchesSearch(consulta, searchTerm)) {
                return false;
            }

            const estado = normalizeConsultaEstado(consulta);
            const isArchived = estado === CONSULTA_ESTADOS.ARCHIVADA;

            if (consultaFilter === CONSULTA_ESTADOS.ARCHIVADA) {
                return isArchived;
            }

            if (isArchived) {
                return false;
            }

            if (consultaFilter !== "activas") {
                return estado === consultaFilter;
            }

            return true;
        });
    }, [consultas, consultaFilter, searchTerm]);

    const kanbanConsultas = useMemo(() => {
        return KANBAN_COLUMNS.reduce((acc, estado) => {
            acc[estado] = filteredConsultas.filter((consulta) => {
                return normalizeConsultaEstado(consulta) === estado;
            });

            return acc;
        }, {});
    }, [filteredConsultas]);

    const unreadVisibleConsultas = useMemo(() => {
        return filteredConsultas.filter(
            (consulta) => !consulta.leida && !isArchivedConsulta(consulta),
        );
    }, [filteredConsultas]);

    const archivableVisibleConsultas = useMemo(() => {
        return filteredConsultas.filter((consulta) => !isArchivedConsulta(consulta));
    }, [filteredConsultas]);

    const handleUpdateEstado = async (consulta, nextEstado) => {
        const currentEstado = normalizeConsultaEstado(consulta);

        if (!nextEstado || nextEstado === currentEstado) return;

        try {
            setActionLoadingId(consulta.id);

            await updateConsultaEstado(consulta.id, nextEstado);

            setConsultas((prev) =>
                prev.map((item) =>
                    item.id === consulta.id
                        ? {
                            ...item,
                            estado: nextEstado,
                            leida: nextEstado !== CONSULTA_ESTADOS.NUEVA,
                            archivada: nextEstado === CONSULTA_ESTADOS.ARCHIVADA,
                        }
                        : item,
                ),
            );
        } catch (err) {
            console.error("Error actualizando etapa de consulta:", err);
            alert(err.message || "No se pudo actualizar la etapa de la consulta");
        } finally {
            setActionLoadingId(null);
        }
    };

    const handleSeguimientoChange = (consultaId, value) => {
        setSeguimientoValues((prev) => ({
            ...prev,
            [consultaId]: value,
        }));
    };

    const getSeguimientoValue = (consulta) => {
        if (!consulta?.id) return "";

        if (Object.prototype.hasOwnProperty.call(seguimientoValues, consulta.id)) {
            return seguimientoValues[consulta.id];
        }

        return consulta.notaInterna || "";
    };

    const handleSaveSeguimiento = async (consulta) => {
        if (!consulta?.id) return;

        try {
            setActionLoadingId(`seguimiento-${consulta.id}`);

            const notaInterna = getSeguimientoValue(consulta);

            await saveConsultaSeguimiento(consulta.id, {
                notaInterna,
                userId: user.uid,
            });

            const now = new Date();

            setConsultas((prev) =>
                prev.map((item) =>
                    item.id === consulta.id
                        ? {
                            ...item,
                            notaInterna,
                            lastContactAt: now,
                            lastContactBy: user.uid,
                        }
                        : item,
                ),
            );

            setSeguimientoValues((prev) => {
                const next = { ...prev };
                delete next[consulta.id];
                return next;
            });
        } catch (err) {
            console.error("Error guardando seguimiento de consulta:", err);
            alert(err.message || "No se pudo guardar el seguimiento");
        } finally {
            setActionLoadingId(null);
        }
    };

    const handleMarkAsRead = async (consulta) => {
        try {
            setActionLoadingId(consulta.id);

            await markConsultaAsRead(consulta.id);

            setConsultas((prev) =>
                prev.map((item) =>
                    item.id === consulta.id
                        ? { ...item, leida: true, estado: "leida" }
                        : item,
                ),
            );
        } catch (err) {
            console.error("Error marcando consulta como leída:", err);
            alert(err.message || "No se pudo marcar la consulta como leída");
        } finally {
            setActionLoadingId(null);
        }
    };

    const handleMarkVisibleAsRead = async () => {
        if (unreadVisibleConsultas.length === 0) {
            alert("No hay consultas nuevas visibles para marcar como leídas.");
            return;
        }

        const total = unreadVisibleConsultas.length;

        if (
            !window.confirm(
                `¿Marcar ${total} consulta${total === 1 ? "" : "s"} visible${total === 1 ? "" : "s"
                } como leída${total === 1 ? "" : "s"}?`,
            )
        ) {
            return;
        }

        try {
            setActionLoadingId("bulk-read");

            const ids = unreadVisibleConsultas.map((consulta) => consulta.id);

            await Promise.all(ids.map((id) => markConsultaAsRead(id)));

            setConsultas((prev) =>
                prev.map((item) =>
                    ids.includes(item.id)
                        ? {
                            ...item,
                            leida: true,
                            estado: "leida",
                        }
                        : item,
                ),
            );
        } catch (err) {
            console.error("Error marcando consultas visibles como leídas:", err);
            alert(err.message || "No se pudieron marcar las consultas como leídas");
        } finally {
            setActionLoadingId(null);
        }
    };

    const handleMarkAsUnread = async (consulta) => {
        try {
            setActionLoadingId(consulta.id);

            await markConsultaAsUnread(consulta.id);

            setConsultas((prev) =>
                prev.map((item) =>
                    item.id === consulta.id
                        ? { ...item, leida: false, estado: "nueva" }
                        : item,
                ),
            );
        } catch (err) {
            console.error("Error marcando consulta como no leída:", err);
            alert(err.message || "No se pudo marcar la consulta como no leída");
        } finally {
            setActionLoadingId(null);
        }
    };

    const handleArchive = async (consulta) => {
        if (!window.confirm("¿Archivar esta consulta?")) return;

        try {
            setActionLoadingId(consulta.id);

            await archiveConsulta(consulta.id);

            setConsultas((prev) => prev.filter((item) => item.id !== consulta.id));
        } catch (err) {
            console.error("Error archivando consulta:", err);
            alert(err.message || "No se pudo archivar la consulta");
        } finally {
            setActionLoadingId(null);
        }
    };

    const handleArchiveVisible = async () => {
        if (archivableVisibleConsultas.length === 0) {
            alert("No hay consultas visibles para archivar.");
            return;
        }

        const total = archivableVisibleConsultas.length;

        if (
            !window.confirm(
                `¿Archivar ${total} consulta${total === 1 ? "" : "s"} visible${total === 1 ? "" : "s"
                }?`,
            )
        ) {
            return;
        }

        try {
            setActionLoadingId("bulk-archive");

            const ids = archivableVisibleConsultas.map((consulta) => consulta.id);

            await Promise.all(ids.map((id) => archiveConsulta(id)));

            setConsultas((prev) =>
                prev.map((item) =>
                    ids.includes(item.id)
                        ? {
                            ...item,
                            archivada: true,
                            estado: "archivada",
                        }
                        : item,
                ),
            );
        } catch (err) {
            console.error("Error archivando consultas visibles:", err);
            alert(err.message || "No se pudieron archivar las consultas visibles");
        } finally {
            setActionLoadingId(null);
        }
    };

    const handleRestore = async (consulta) => {
        try {
            setActionLoadingId(consulta.id);

            await restoreConsulta(consulta.id);

            setConsultas((prev) =>
                prev.map((item) =>
                    item.id === consulta.id
                        ? {
                            ...item,
                            archivada: false,
                            estado: "leida",
                            leida: true,
                        }
                        : item,
                ),
            );
        } catch (err) {
            console.error("Error restaurando consulta:", err);
            alert(err.message || "No se pudo restaurar la consulta");
        } finally {
            setActionLoadingId(null);
        }
    };

    const handleCopyLeadData = async (consulta) => {
        try {
            await navigator.clipboard.writeText(buildLeadClipboardText(consulta));
            alert("Datos del lead copiados.");
        } catch (err) {
            console.error("Error copiando datos del lead:", err);
            alert("No se pudieron copiar los datos del lead.");
        }
    };

    const handleExportCsv = () => {
        try {
            if (filteredConsultas.length === 0) {
                alert("No hay consultas para exportar.");
                return;
            }

            const csv = buildConsultasCsv(filteredConsultas);
            const blob = new Blob([`\uFEFF${csv}`], {
                type: "text/csv;charset=utf-8;",
            });

            const url = URL.createObjectURL(blob);
            const link = document.createElement("a");

            const date = new Date().toISOString().slice(0, 10);
            const fileName = `consultas-inmuebles-${consultaFilter}-${date}.csv`;

            link.href = url;
            link.download = fileName;
            link.click();

            URL.revokeObjectURL(url);
        } catch (err) {
            console.error("Error exportando consultas:", err);
            alert("No se pudieron exportar las consultas.");
        }
    };

    if (loading) {
        return (
            <section className="container py-4">
                <p className="text-muted">Cargando consultas...</p>
            </section>
        );
    }

    if (error) {
        return (
            <section className="container py-4">
                <div className="alert alert-danger">{error}</div>
            </section>
        );
    }

    return (
        <section className="container py-4">
            <header className="mb-4 d-flex flex-wrap justify-content-between align-items-center gap-3">
                <div>
                    <h1 className="h3 mb-1">Consultas de inmuebles</h1>
                    <p className="text-muted mb-0">
                        Leads recibidos desde las fichas públicas del portal.
                    </p>
                </div>

                <div className="d-flex flex-wrap gap-2">

                    <div className="btn-group" role="group" aria-label="Modo de vista">
                        <button
                            type="button"
                            className={
                                viewMode === "list"
                                    ? "btn btn-primary"
                                    : "btn btn-outline-primary"
                            }
                            onClick={() => setViewMode("list")}
                        >
                            Lista
                        </button>

                        <button
                            type="button"
                            className={
                                viewMode === "kanban"
                                    ? "btn btn-primary"
                                    : "btn btn-outline-primary"
                            }
                            onClick={() => setViewMode("kanban")}
                        >
                            Kanban
                        </button>
                    </div>

                    <button
                        type="button"
                        className="btn btn-outline-primary"
                        onClick={handleMarkVisibleAsRead}
                        disabled={
                            unreadVisibleConsultas.length === 0 ||
                            actionLoadingId === "bulk-read"
                        }
                    >
                        {actionLoadingId === "bulk-read"
                            ? "Marcando..."
                            : `Marcar visibles como leídas${unreadVisibleConsultas.length > 0
                                ? ` (${unreadVisibleConsultas.length})`
                                : ""
                            }`}
                    </button>

                    <button
                        type="button"
                        className="btn btn-outline-danger"
                        onClick={handleArchiveVisible}
                        disabled={
                            archivableVisibleConsultas.length === 0 ||
                            actionLoadingId === "bulk-archive"
                        }
                    >
                        {actionLoadingId === "bulk-archive"
                            ? "Archivando..."
                            : `Archivar visibles${archivableVisibleConsultas.length > 0
                                ? ` (${archivableVisibleConsultas.length})`
                                : ""
                            }`}
                    </button>

                    <button
                        type="button"
                        className="btn btn-outline-success"
                        onClick={handleExportCsv}
                        disabled={filteredConsultas.length === 0}
                    >
                        Exportar CSV
                    </button>

                    <button
                        type="button"
                        className="btn btn-outline-secondary"
                        onClick={fetchConsultas}
                    >
                        Actualizar
                    </button>
                </div>
            </header>

            <section className="mb-4">
                <div className="row g-3 align-items-end">
                    <div className="col-12 col-lg-6">
                        <label className="form-label">Buscar consulta</label>
                        <input
                            type="search"
                            className="form-control"
                            placeholder="Nombre, email, teléfono, inmueble, mensaje..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>

                    <div className="col-12 col-lg-6">
                        <div className="d-flex flex-wrap gap-2 justify-content-lg-end">
                            {CONSULTA_FILTERS.map((filter) => (
                                <button
                                    key={filter.value}
                                    type="button"
                                    className={
                                        consultaFilter === filter.value
                                            ? "btn btn-primary btn-sm"
                                            : "btn btn-outline-primary btn-sm"
                                    }
                                    onClick={() => setConsultaFilter(filter.value)}
                                >
                                    {filter.label}{" "}
                                    <span className="badge text-bg-light ms-1">
                                        {stats[filter.value] ?? 0}
                                    </span>
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                {searchTerm && (
                    <div className="mt-2">
                        <button
                            type="button"
                            className="btn btn-link btn-sm p-0"
                            onClick={() => setSearchTerm("")}
                        >
                            Limpiar búsqueda
                        </button>
                    </div>
                )}
            </section>

            {consultas.length === 0 ? (
                <div className="alert alert-info">
                    Todavía no hay consultas para esta inmobiliaria.
                </div>
            ) : filteredConsultas.length === 0 ? (
                <div className="alert alert-info">
                    No hay consultas para el filtro seleccionado.
                </div>
            ) : viewMode === "kanban" ? (
                <div className="row g-3 align-items-start">
                    {KANBAN_COLUMNS.map((estado) => {
                        const columnConsultas = kanbanConsultas[estado] || [];
                        const columnLabel = CONSULTA_ESTADO_LABELS[estado] || estado;

                        return (
                            <section className="col-12 col-xl-4 col-xxl-2" key={estado}>
                                <div className="card border-0 shadow-sm h-100">
                                    <div className="card-header bg-white d-flex justify-content-between align-items-center gap-2">
                                        <div>
                                            <div className="fw-semibold">{columnLabel}</div>
                                            <div className="small text-muted">
                                                {columnConsultas.length} consulta
                                                {columnConsultas.length === 1 ? "" : "s"}
                                            </div>
                                        </div>

                                        <span className={getConsultaEstadoBadgeClass(estado)}>
                                            {columnConsultas.length}
                                        </span>
                                    </div>

                                    <div
                                        className="card-body bg-light"
                                        style={{ minHeight: 280 }}
                                    >
                                        {columnConsultas.length === 0 ? (
                                            <div className="text-muted small">
                                                Sin consultas en esta etapa.
                                            </div>
                                        ) : (
                                            <div className="d-flex flex-column gap-3">
                                                {columnConsultas.map((consulta) => {
                                                    const publicUrl = buildPublicUrl(
                                                        consulta.inmuebleSlug,
                                                    );
                                                    const whatsappReplyUrl =
                                                        buildWhatsappReplyUrl(consulta);
                                                    const emailReplyUrl =
                                                        buildEmailReplyUrl(consulta);
                                                    const isLoading =
                                                        actionLoadingId === consulta.id;
                                                    const normalizedEstado =
                                                        normalizeConsultaEstado(consulta);
                                                    const seguimientoValue =
                                                        getSeguimientoValue(consulta);

                                                    return (
                                                        <article
                                                            className="card border-0 shadow-sm"
                                                            key={consulta.id}
                                                        >
                                                            <div className="card-body p-3">
                                                                <div className="d-flex justify-content-between gap-2 mb-2">
                                                                    <div className="overflow-hidden">
                                                                        <h3 className="h6 mb-1 text-truncate">
                                                                            {consulta.nombre ||
                                                                                "Consulta sin nombre"}
                                                                        </h3>

                                                                        <div className="small text-muted">
                                                                            {formatDate(
                                                                                consulta.createdAt,
                                                                            )}
                                                                        </div>
                                                                    </div>

                                                                    <span
                                                                        className={getConsultaEstadoBadgeClass(
                                                                            normalizedEstado,
                                                                        )}
                                                                    >
                                                                        {
                                                                            CONSULTA_ESTADO_LABELS[
                                                                            normalizedEstado
                                                                            ]
                                                                        }
                                                                    </span>
                                                                </div>

                                                                <div className="small mb-2">
                                                                    <strong>Inmueble:</strong>{" "}
                                                                    {consulta.inmuebleTitulo ||
                                                                        "Sin título"}
                                                                </div>

                                                                {(consulta.telefono ||
                                                                    consulta.email) && (
                                                                        <div className="small text-muted mb-2">
                                                                            {consulta.telefono ||
                                                                                consulta.email}
                                                                        </div>
                                                                    )}

                                                                {consulta.mensaje && (
                                                                    <p
                                                                        className="small mb-2"
                                                                        style={{
                                                                            display: "-webkit-box",
                                                                            WebkitLineClamp: 3,
                                                                            WebkitBoxOrient:
                                                                                "vertical",
                                                                            overflow: "hidden",
                                                                        }}
                                                                    >
                                                                        {consulta.mensaje}
                                                                    </p>
                                                                )}

                                                                {seguimientoValue && (
                                                                    <div className="border rounded-3 bg-light p-2 small mb-2">
                                                                        <div className="text-muted mb-1">
                                                                            Último seguimiento
                                                                        </div>
                                                                        <div
                                                                            style={{
                                                                                display:
                                                                                    "-webkit-box",
                                                                                WebkitLineClamp: 3,
                                                                                WebkitBoxOrient:
                                                                                    "vertical",
                                                                                overflow:
                                                                                    "hidden",
                                                                            }}
                                                                        >
                                                                            {seguimientoValue}
                                                                        </div>
                                                                    </div>
                                                                )}

                                                                <select
                                                                    className="form-select form-select-sm mb-2"
                                                                    value={normalizedEstado}
                                                                    disabled={isLoading}
                                                                    onChange={(e) =>
                                                                        handleUpdateEstado(
                                                                            consulta,
                                                                            e.target.value,
                                                                        )
                                                                    }
                                                                >
                                                                    <option
                                                                        value={
                                                                            CONSULTA_ESTADOS.NUEVA
                                                                        }
                                                                    >
                                                                        Nueva
                                                                    </option>
                                                                    <option
                                                                        value={
                                                                            CONSULTA_ESTADOS.CONTACTADA
                                                                        }
                                                                    >
                                                                        Contactada
                                                                    </option>
                                                                    <option
                                                                        value={
                                                                            CONSULTA_ESTADOS.VISITA
                                                                        }
                                                                    >
                                                                        Visita coordinada
                                                                    </option>
                                                                    <option
                                                                        value={
                                                                            CONSULTA_ESTADOS.INTERESADA
                                                                        }
                                                                    >
                                                                        Interesada
                                                                    </option>
                                                                    <option
                                                                        value={
                                                                            CONSULTA_ESTADOS.CERRADA
                                                                        }
                                                                    >
                                                                        Cerrada
                                                                    </option>
                                                                    <option
                                                                        value={
                                                                            CONSULTA_ESTADOS.DESCARTADA
                                                                        }
                                                                    >
                                                                        Descartada
                                                                    </option>
                                                                    <option
                                                                        value={
                                                                            CONSULTA_ESTADOS.ARCHIVADA
                                                                        }
                                                                    >
                                                                        Archivada
                                                                    </option>
                                                                </select>

                                                                <div className="d-flex flex-wrap gap-2">
                                                                    {whatsappReplyUrl && (
                                                                        <a
                                                                            href={
                                                                                whatsappReplyUrl
                                                                            }
                                                                            target="_blank"
                                                                            rel="noopener noreferrer"
                                                                            className="btn btn-sm btn-success"
                                                                        >
                                                                            WhatsApp
                                                                        </a>
                                                                    )}

                                                                    {emailReplyUrl && (
                                                                        <a
                                                                            href={emailReplyUrl}
                                                                            className="btn btn-sm btn-outline-primary"
                                                                        >
                                                                            Email
                                                                        </a>
                                                                    )}

                                                                    {publicUrl && (
                                                                        <Link
                                                                            to={publicUrl}
                                                                            target="_blank"
                                                                            className="btn btn-sm btn-outline-secondary"
                                                                        >
                                                                            Publicación
                                                                        </Link>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        </article>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </section>
                        );
                    })}
                </div>
            ) : (
                <div className="row g-3">
                    {filteredConsultas.map((consulta) => {
                        const publicUrl = buildPublicUrl(consulta.inmuebleSlug);
                        const whatsappReplyUrl = buildWhatsappReplyUrl(consulta);
                        const emailReplyUrl = buildEmailReplyUrl(consulta);
                        const isLoading = actionLoadingId === consulta.id;
                        const isSavingSeguimiento = actionLoadingId === `seguimiento-${consulta.id}`;
                        const seguimientoValue = getSeguimientoValue(consulta);
                        const isArchived = isArchivedConsulta(consulta);
                        const normalizedEstado = normalizeConsultaEstado(consulta);
                        const estadoLabel =
                            CONSULTA_ESTADO_LABELS[normalizedEstado] || normalizedEstado || "Nueva";

                        return (
                            <article className="col-12" key={consulta.id}>
                                <div
                                    className={`card ${isArchived
                                        ? "border-secondary"
                                        : consulta.leida
                                            ? "border-light"
                                            : "border-primary"
                                        }`}
                                >
                                    <div className="card-body">
                                        <div className="d-flex flex-wrap justify-content-between gap-3">
                                            <div>
                                                <div className="d-flex flex-wrap align-items-center gap-2 mb-2">
                                                    <h2 className="h5 mb-0">
                                                        {consulta.nombre || "Consulta sin nombre"}
                                                    </h2>

                                                    <span className={getConsultaEstadoBadgeClass(normalizedEstado)}>
                                                        {estadoLabel}
                                                    </span>
                                                </div>

                                                <p className="text-muted mb-1">
                                                    {formatDate(consulta.createdAt)}
                                                </p>

                                                <p className="mb-1">
                                                    <strong>Inmueble:</strong>{" "}
                                                    {consulta.inmuebleTitulo || "Sin título"}
                                                </p>

                                                <p className="mb-1">
                                                    <strong>Operación:</strong>{" "}
                                                    {consulta.inmuebleOperacion || "Sin operación"} ·{" "}
                                                    {consulta.inmuebleTipo || "Sin tipo"}
                                                </p>
                                            </div>

                                            <div className="text-md-end">
                                                {publicUrl && (
                                                    <Link
                                                        to={publicUrl}
                                                        target="_blank"
                                                        className="btn btn-sm btn-outline-primary"
                                                    >
                                                        Ver publicación
                                                    </Link>
                                                )}
                                            </div>
                                        </div>

                                        <hr />

                                        <div className="row g-3">
                                            <div className="col-md-4">
                                                <div className="small text-muted">Email</div>
                                                {consulta.email ? (
                                                    <div className="d-flex flex-column align-items-start gap-2">
                                                        <a href={`mailto:${consulta.email}`}>
                                                            {consulta.email}
                                                        </a>

                                                        {emailReplyUrl && (
                                                            <a
                                                                href={emailReplyUrl}
                                                                className="btn btn-sm btn-outline-primary"
                                                            >
                                                                Responder por email
                                                            </a>
                                                        )}
                                                    </div>
                                                ) : (
                                                    <span className="text-muted">Sin email</span>
                                                )}
                                            </div>

                                            <div className="col-md-4">
                                                <div className="small text-muted">
                                                    Teléfono / WhatsApp
                                                </div>
                                                {consulta.telefono ? (
                                                    <div className="d-flex flex-column align-items-start gap-2">
                                                        <a href={`tel:${consulta.telefono}`}>
                                                            {consulta.telefono}
                                                        </a>

                                                        {whatsappReplyUrl && (
                                                            <a
                                                                href={whatsappReplyUrl}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                className="btn btn-sm btn-success"
                                                            >
                                                                Responder por WhatsApp
                                                            </a>
                                                        )}
                                                    </div>
                                                ) : (
                                                    <span className="text-muted">Sin teléfono</span>
                                                )}
                                            </div>

                                            <div className="col-md-4">
                                                <label className="small text-muted">Etapa comercial</label>

                                                <select
                                                    className="form-select form-select-sm"
                                                    value={normalizedEstado}
                                                    disabled={isLoading}
                                                    onChange={(e) => handleUpdateEstado(consulta, e.target.value)}
                                                >
                                                    <option value={CONSULTA_ESTADOS.NUEVA}>Nueva</option>
                                                    <option value={CONSULTA_ESTADOS.CONTACTADA}>Contactada</option>
                                                    <option value={CONSULTA_ESTADOS.VISITA}>Visita coordinada</option>
                                                    <option value={CONSULTA_ESTADOS.INTERESADA}>Interesada</option>
                                                    <option value={CONSULTA_ESTADOS.CERRADA}>Cerrada</option>
                                                    <option value={CONSULTA_ESTADOS.DESCARTADA}>Descartada</option>
                                                    <option value={CONSULTA_ESTADOS.ARCHIVADA}>Archivada</option>
                                                </select>
                                            </div>
                                        </div>

                                        {consulta.mensaje && (
                                            <div className="mt-3">
                                                <div className="small text-muted">Mensaje</div>
                                                <p className="mb-0" style={{ whiteSpace: "pre-line" }}>
                                                    {consulta.mensaje}
                                                </p>
                                            </div>
                                        )}

                                        <div className="mt-3 border rounded-3 p-3 bg-light">
                                            <div className="d-flex flex-wrap justify-content-between gap-2 mb-2">
                                                <div>
                                                    <label className="form-label fw-semibold mb-1">
                                                        Seguimiento interno
                                                    </label>

                                                    <div className="small text-muted">
                                                        Visible sólo para la inmobiliaria. No se muestra al interesado.
                                                    </div>
                                                </div>

                                                {consulta.lastContactAt && (
                                                    <div className="small text-muted text-md-end">
                                                        Último seguimiento: {formatDate(consulta.lastContactAt)}
                                                    </div>
                                                )}
                                            </div>

                                            <textarea
                                                className="form-control"
                                                rows={3}
                                                value={seguimientoValue}
                                                onChange={(e) =>
                                                    handleSeguimientoChange(consulta.id, e.target.value)
                                                }
                                                placeholder="Ej: Se respondió por WhatsApp. Quiere coordinar visita el viernes. Pendiente enviar ubicación exacta..."
                                                disabled={isSavingSeguimiento}
                                            />

                                            <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mt-2">
                                                <div className="small text-muted">
                                                    Máximo recomendado: 3000 caracteres.
                                                </div>

                                                <button
                                                    type="button"
                                                    className="btn btn-sm btn-primary"
                                                    disabled={isSavingSeguimiento}
                                                    onClick={() => handleSaveSeguimiento(consulta)}
                                                >
                                                    {isSavingSeguimiento ? "Guardando..." : "Guardar seguimiento"}
                                                </button>
                                            </div>
                                        </div>

                                        <div className="d-flex flex-wrap gap-2 mt-4">
                                            <button
                                                type="button"
                                                className="btn btn-sm btn-outline-dark"
                                                disabled={isLoading}
                                                onClick={() => handleCopyLeadData(consulta)}
                                            >
                                                Copiar datos del lead
                                            </button>

                                            {isArchived ? (
                                                <button
                                                    type="button"
                                                    className="btn btn-sm btn-outline-primary"
                                                    disabled={isLoading}
                                                    onClick={() => handleRestore(consulta)}
                                                >
                                                    Restaurar
                                                </button>
                                            ) : (
                                                <>
                                                    {consulta.leida ? (
                                                        <button
                                                            type="button"
                                                            className="btn btn-sm btn-outline-secondary"
                                                            disabled={isLoading}
                                                            onClick={() => handleMarkAsUnread(consulta)}
                                                        >
                                                            Marcar como nueva
                                                        </button>
                                                    ) : (
                                                        <button
                                                            type="button"
                                                            className="btn btn-sm btn-outline-success"
                                                            disabled={isLoading}
                                                            onClick={() => handleMarkAsRead(consulta)}
                                                        >
                                                            Marcar como leída
                                                        </button>
                                                    )}

                                                    <button
                                                        type="button"
                                                        className="btn btn-sm btn-outline-danger"
                                                        disabled={isLoading}
                                                        onClick={() => handleArchive(consulta)}
                                                    >
                                                        Archivar
                                                    </button>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </article>
                        );
                    })}
                </div>
            )}
        </section>
    );
};

export default InmuebleConsultasPage;
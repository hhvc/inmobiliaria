const ACTIVITY_LABELS = {
    created: "Solicitud creada",
    status_updated: "Estado actualizado",
    conversion_started: "Conversión iniciada",
    conversion_failed: "Conversión fallida",
    converted: "Solicitud convertida",
    publication_visible: "Publicación visible",
    publication_hidden: "Publicación en revisión",
    note: "Nota",
};

const ACTIVITY_BADGES = {
    created: "text-bg-primary",
    status_updated: "text-bg-info",
    conversion_started: "text-bg-warning",
    conversion_failed: "text-bg-danger",
    converted: "text-bg-success",
    publication_visible: "text-bg-success",
    publication_hidden: "text-bg-secondary",
    note: "text-bg-light border",
};

const PUBLIC_ACTIVITY_TYPES = [
    "created",
    "status_updated",
    "converted",
    "publication_visible",
    "publication_hidden",
];

const PUBLIC_ACTIVITY_COPY = {
    created: {
        title: "Solicitud recibida",
        message: "Recibimos tu solicitud de publicación.",
    },
    status_updated: {
        title: "Estado actualizado",
        message: "Tu solicitud tuvo una actualización de estado.",
    },
    converted: {
        title: "Publicación creada",
        message:
            "Tu solicitud ya fue convertida en una publicación y está siendo revisada.",
    },
    publication_visible: {
        title: "Publicación visible",
        message: "Tu publicación ya está visible en el portal.",
    },
    publication_hidden: {
        title: "Publicación en revisión",
        message: "La publicación sigue en revisión antes de mostrarse públicamente.",
    },
};

const formatDate = (value) => {
    if (!value) return "Sin fecha";

    const date = value instanceof Date ? value : new Date(value);

    if (Number.isNaN(date.getTime())) return "Sin fecha";

    return date.toLocaleString("es-AR", {
        dateStyle: "short",
        timeStyle: "short",
    });
};

const getSortedActivity = (activityLog = [], publicView = false) => {
    if (!Array.isArray(activityLog)) return [];

    return [...activityLog]
        .filter(Boolean)
        .filter((item) => {
            if (!publicView) return true;

            return PUBLIC_ACTIVITY_TYPES.includes(item.type);
        })
        .sort((a, b) => {
            const dateA = new Date(a.createdAt || 0).getTime();
            const dateB = new Date(b.createdAt || 0).getTime();

            return dateB - dateA;
        });
};

const getDisplayItem = (item, publicView = false) => {
    if (!publicView) return item;

    const publicCopy = PUBLIC_ACTIVITY_COPY[item.type];

    if (!publicCopy) return item;

    return {
        ...item,
        title: publicCopy.title,
        message: publicCopy.message,
    };
};

const PublicationRequestActivityLog = ({
    activityLog = [],
    title = "Historial de actividad",
    emptyMessage = "Todavía no hay actividad registrada.",
    showActor = false,
    maxItems = 8,
    publicView = false,
}) => {
    const sortedActivity = getSortedActivity(activityLog, publicView).slice(
        0,
        maxItems,
    );

    if (sortedActivity.length === 0) {
        return (
            <section className="card border-0 bg-light mb-3">
                <div className="card-body">
                    <h3 className="h6 mb-2">{title}</h3>
                    <p className="small text-muted mb-0">{emptyMessage}</p>
                </div>
            </section>
        );
    }

    return (
        <section className="card border-0 bg-light mb-3">
            <div className="card-body">
                <div className="d-flex justify-content-between align-items-center gap-2 mb-3">
                    <h3 className="h6 mb-0">{title}</h3>

                    <span className="badge text-bg-light border">
                        {sortedActivity.length} evento
                        {sortedActivity.length === 1 ? "" : "s"}
                    </span>
                </div>

                <div className="d-flex flex-column gap-3">
                    {sortedActivity.map((rawItem, index) => {
                        const item = getDisplayItem(rawItem, publicView);
                        const badgeClass =
                            ACTIVITY_BADGES[item.type] || ACTIVITY_BADGES.note;
                        const fallbackTitle =
                            ACTIVITY_LABELS[item.type] || ACTIVITY_LABELS.note;

                        return (
                            <div
                                key={item.id || `${item.type || "activity"}-${index}`}
                                className="border-start border-3 ps-3"
                            >
                                <div className="d-flex flex-wrap align-items-center gap-2 mb-1">
                                    <span className={`badge ${badgeClass}`}>
                                        {item.title || fallbackTitle}
                                    </span>

                                    <span className="small text-muted">
                                        {formatDate(item.createdAt)}
                                    </span>
                                </div>

                                {item.message && (
                                    <div className="small text-muted">{item.message}</div>
                                )}

                                {!publicView &&
                                    showActor &&
                                    (item.createdByEmail || item.createdByName) && (
                                        <div className="small text-muted mt-1">
                                            Usuario:{" "}
                                            <strong>
                                                {item.createdByName || item.createdByEmail}
                                            </strong>
                                        </div>
                                    )}
                            </div>
                        );
                    })}
                </div>
            </div>
        </section>
    );
};

export default PublicationRequestActivityLog;
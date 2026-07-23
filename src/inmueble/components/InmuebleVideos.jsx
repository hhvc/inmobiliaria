import { useMemo, useState } from "react";

import {
    INMUEBLE_MAX_VIDEOS,
    VIDEO_TYPES,
    buildInmuebleVideo,
    normalizeInmuebleVideos,
} from "../utils/inmuebleVideos.helpers";

const INITIAL_FORM = {
    url: "",
    title: "",
    description: "",
    type: "recorrido",
};

const InmuebleVideos = ({ videos = [], onChange }) => {
    const [form, setForm] = useState(INITIAL_FORM);
    const [error, setError] = useState("");

    const normalizedVideos = useMemo(() => {
        return normalizeInmuebleVideos(videos);
    }, [videos]);

    const remainingVideos = Math.max(
        INMUEBLE_MAX_VIDEOS - normalizedVideos.length,
        0,
    );

    const emitChange = (nextVideos) => {
        if (typeof onChange !== "function") return;

        onChange(normalizeInmuebleVideos(nextVideos));
    };

    const handleFormChange = (field, value) => {
        setForm((prev) => ({
            ...prev,
            [field]: value,
        }));

        setError("");
    };

    const handleAddVideo = () => {
        if (normalizedVideos.length >= INMUEBLE_MAX_VIDEOS) {
            setError(`Máximo ${INMUEBLE_MAX_VIDEOS} videos por inmueble.`);
            return;
        }

        try {
            const nextVideo = buildInmuebleVideo({
                ...form,
                order: normalizedVideos.length,
                visible: true,
                featured: normalizedVideos.length === 0,
            });

            emitChange([...normalizedVideos, nextVideo]);
            setForm(INITIAL_FORM);
            setError("");
        } catch (err) {
            setError(err.message || "No se pudo agregar el video.");
        }
    };

    const handleRemoveVideo = (videoId) => {
        const ok = window.confirm("¿Eliminar este video del inmueble?");

        if (!ok) return;

        emitChange(normalizedVideos.filter((video) => video.id !== videoId));
    };

    const handleUpdateVideo = (videoId, field, value) => {
        emitChange(
            normalizedVideos.map((video) =>
                video.id === videoId
                    ? {
                        ...video,
                        [field]: value,
                    }
                    : video,
            ),
        );
    };

    const handleSetFeatured = (videoId) => {
        emitChange(
            normalizedVideos.map((video) => ({
                ...video,
                featured: video.id === videoId,
            })),
        );
    };

    const handleToggleVisible = (videoId) => {
        emitChange(
            normalizedVideos.map((video) =>
                video.id === videoId
                    ? {
                        ...video,
                        visible: !video.visible,
                    }
                    : video,
            ),
        );
    };

    const handleMove = (fromIndex, toIndex) => {
        if (fromIndex === toIndex) return;
        if (toIndex < 0 || toIndex >= normalizedVideos.length) return;

        const reordered = [...normalizedVideos];
        const [moved] = reordered.splice(fromIndex, 1);
        reordered.splice(toIndex, 0, moved);

        emitChange(
            reordered.map((video, index) => ({
                ...video,
                order: index,
            })),
        );
    };

    return (
        <section className="inmueble-videos">
            <header className="mb-3">
                <h3 className="h5 mb-1">Videos</h3>
                <p className="text-muted mb-1">
                    Agregá links de YouTube o Vimeo. No se suben archivos de video a ONO
                    Prop.
                </p>
                <p className="small text-muted mb-0">
                    Hasta {INMUEBLE_MAX_VIDEOS} videos por inmueble · podés marcar uno
                    como principal.
                </p>
            </header>

            {error && <div className="alert alert-danger">{error}</div>}

            <div className="card border mb-3">
                <div className="card-body row g-3">
                    <div className="col-12 col-lg-5">
                        <label className="form-label">Link de YouTube o Vimeo</label>
                        <input
                            className="form-control"
                            placeholder="https://www.youtube.com/watch?v=..."
                            value={form.url}
                            disabled={remainingVideos === 0}
                            onChange={(e) => handleFormChange("url", e.target.value)}
                        />
                    </div>

                    <div className="col-12 col-lg-3">
                        <label className="form-label">Título</label>
                        <input
                            className="form-control"
                            placeholder="Ej: Recorrido principal"
                            value={form.title}
                            disabled={remainingVideos === 0}
                            onChange={(e) => handleFormChange("title", e.target.value)}
                        />
                    </div>

                    <div className="col-12 col-lg-2">
                        <label className="form-label">Tipo</label>
                        <select
                            className="form-select"
                            value={form.type}
                            disabled={remainingVideos === 0}
                            onChange={(e) => handleFormChange("type", e.target.value)}
                        >
                            {VIDEO_TYPES.map((type) => (
                                <option key={type.id} value={type.id}>
                                    {type.label}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className="col-12 col-lg-2 d-flex align-items-end">
                        <button
                            type="button"
                            className="btn btn-secondary w-100"
                            disabled={remainingVideos === 0}
                            onClick={handleAddVideo}
                        >
                            Agregar
                        </button>
                    </div>

                    <div className="col-12">
                        <label className="form-label">Descripción breve</label>
                        <input
                            className="form-control"
                            placeholder="Opcional"
                            value={form.description}
                            disabled={remainingVideos === 0}
                            onChange={(e) => handleFormChange("description", e.target.value)}
                        />
                    </div>
                </div>
            </div>

            {remainingVideos === 0 && (
                <div className="alert alert-warning">
                    Ya alcanzaste el máximo de {INMUEBLE_MAX_VIDEOS} videos para este
                    inmueble.
                </div>
            )}

            {normalizedVideos.length === 0 ? (
                <p className="text-muted mb-0">Todavía no hay videos cargados.</p>
            ) : (
                <div className="list-group">
                    {normalizedVideos.map((video, index) => {
                        const typeLabel =
                            VIDEO_TYPES.find((item) => item.id === video.type)?.label ||
                            "Video";

                        return (
                            <div className="list-group-item" key={video.id}>
                                <div className="row g-3 align-items-center">
                                    <div className="col-12 col-lg-4">
                                        <div className="ratio ratio-16x9 bg-light rounded overflow-hidden">
                                            <iframe
                                                src={video.embedUrl}
                                                title={video.title || `Video ${index + 1}`}
                                                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                                                allowFullScreen
                                            />
                                        </div>
                                    </div>

                                    <div className="col-12 col-lg-5">
                                        <div className="d-flex flex-wrap gap-2 mb-2">
                                            <span className="badge text-bg-light border">
                                                {video.providerLabel || video.provider}
                                            </span>
                                            <span className="badge text-bg-light border">
                                                {typeLabel}
                                            </span>
                                            {video.featured && (
                                                <span className="badge bg-primary">Principal</span>
                                            )}
                                            {video.visible === false && (
                                                <span className="badge bg-secondary">Oculto</span>
                                            )}
                                        </div>

                                        <label className="form-label small mb-1">Título</label>
                                        <input
                                            className="form-control form-control-sm mb-2"
                                            value={video.title || ""}
                                            onChange={(e) =>
                                                handleUpdateVideo(video.id, "title", e.target.value)
                                            }
                                        />

                                        <label className="form-label small mb-1">
                                            Descripción
                                        </label>
                                        <input
                                            className="form-control form-control-sm"
                                            value={video.description || ""}
                                            onChange={(e) =>
                                                handleUpdateVideo(
                                                    video.id,
                                                    "description",
                                                    e.target.value,
                                                )
                                            }
                                        />
                                    </div>

                                    <div className="col-12 col-lg-3">
                                        <div className="d-flex flex-wrap gap-2 justify-content-lg-end">
                                            <button
                                                type="button"
                                                className="btn btn-sm btn-outline-secondary"
                                                disabled={index === 0}
                                                onClick={() => handleMove(index, index - 1)}
                                            >
                                                ↑
                                            </button>

                                            <button
                                                type="button"
                                                className="btn btn-sm btn-outline-secondary"
                                                disabled={index === normalizedVideos.length - 1}
                                                onClick={() => handleMove(index, index + 1)}
                                            >
                                                ↓
                                            </button>

                                            <button
                                                type="button"
                                                className="btn btn-sm btn-outline-primary"
                                                disabled={video.featured}
                                                onClick={() => handleSetFeatured(video.id)}
                                            >
                                                Principal
                                            </button>

                                            <button
                                                type="button"
                                                className="btn btn-sm btn-outline-secondary"
                                                onClick={() => handleToggleVisible(video.id)}
                                            >
                                                {video.visible === false ? "Mostrar" : "Ocultar"}
                                            </button>

                                            <button
                                                type="button"
                                                className="btn btn-sm btn-outline-danger"
                                                onClick={() => handleRemoveVideo(video.id)}
                                            >
                                                Eliminar
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </section>
    );
};

export default InmuebleVideos;
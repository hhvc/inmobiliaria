import { useEffect, useMemo, useState } from "react";

import {
    VIDEO_TYPES,
    getVisibleInmuebleVideos,
} from "../utils/inmuebleVideos.helpers";

const getVideoTypeLabel = (type = "") => {
    return VIDEO_TYPES.find((item) => item.id === type)?.label || "Video";
};

const InmuebleVideoSection = ({ videos = [], title = "Videos del inmueble" }) => {
    const visibleVideos = useMemo(() => {
        return getVisibleInmuebleVideos(videos).sort((a, b) => {
            if (a.featured !== b.featured) {
                return a.featured ? -1 : 1;
            }

            return (a.order ?? 0) - (b.order ?? 0);
        });
    }, [videos]);

    const [selectedVideoId, setSelectedVideoId] = useState("");

    useEffect(() => {
        if (visibleVideos.length === 0) {
            setSelectedVideoId("");
            return;
        }

        setSelectedVideoId((prev) => {
            const stillExists = visibleVideos.some((video) => video.id === prev);

            return stillExists ? prev : visibleVideos[0].id;
        });
    }, [visibleVideos]);

    if (visibleVideos.length === 0) {
        return null;
    }

    const selectedVideo =
        visibleVideos.find((video) => video.id === selectedVideoId) ||
        visibleVideos[0];

    return (
        <section className="card border-0 shadow-sm mb-4" id="videos">
            <div className="card-body">
                <div className="d-flex flex-wrap justify-content-between align-items-start gap-3 mb-3">
                    <div>
                        <p className="text-uppercase text-muted small mb-1">
                            Recorridos y videos
                        </p>

                        <h2 className="h4 mb-1">{title}</h2>

                        <p className="text-muted mb-0">
                            Mirá el inmueble en video antes de coordinar una visita.
                        </p>
                    </div>

                    <span className="badge text-bg-primary">
                        {visibleVideos.length} video{visibleVideos.length === 1 ? "" : "s"}
                    </span>
                </div>

                <div className="ratio ratio-16x9 rounded overflow-hidden bg-dark mb-3">
                    <iframe
                        src={selectedVideo.embedUrl}
                        title={selectedVideo.title || "Video del inmueble"}
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                        allowFullScreen
                    />
                </div>

                <div className="d-flex flex-wrap align-items-center gap-2 mb-3">
                    <span className="badge text-bg-light border">
                        {selectedVideo.providerLabel || selectedVideo.provider}
                    </span>

                    <span className="badge text-bg-light border">
                        {getVideoTypeLabel(selectedVideo.type)}
                    </span>

                    {selectedVideo.featured && (
                        <span className="badge bg-primary">Video principal</span>
                    )}
                </div>

                {(selectedVideo.title || selectedVideo.description) && (
                    <div className="mb-3">
                        {selectedVideo.title && (
                            <h3 className="h5 mb-1">{selectedVideo.title}</h3>
                        )}

                        {selectedVideo.description && (
                            <p className="text-muted mb-0">{selectedVideo.description}</p>
                        )}
                    </div>
                )}

                {visibleVideos.length > 1 && (
                    <div className="row g-3">
                        {visibleVideos.map((video, index) => {
                            const isActive = video.id === selectedVideo.id;

                            return (
                                <div className="col-12 col-md-6 col-lg-4" key={video.id}>
                                    <button
                                        type="button"
                                        className={`btn w-100 text-start border ${isActive ? "btn-primary" : "btn-light"
                                            }`}
                                        onClick={() => setSelectedVideoId(video.id)}
                                    >
                                        <div className="fw-semibold">
                                            {video.title || `Video ${index + 1}`}
                                        </div>

                                        <div className={isActive ? "small" : "small text-muted"}>
                                            {video.providerLabel || video.provider} ·{" "}
                                            {getVideoTypeLabel(video.type)}
                                        </div>
                                    </button>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </section>
    );
};

export default InmuebleVideoSection;
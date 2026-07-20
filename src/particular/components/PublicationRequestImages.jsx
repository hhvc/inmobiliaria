const getSortedImages = (images = []) => {
    if (!Array.isArray(images)) return [];

    return [...images]
        .filter((image) => image?.url)
        .sort((a, b) => {
            const orderA = Number.isFinite(Number(a.order)) ? Number(a.order) : 0;
            const orderB = Number.isFinite(Number(b.order)) ? Number(b.order) : 0;

            return orderA - orderB;
        });
};

const PublicationRequestImages = ({
    images = [],
    title = "Fotos cargadas",
    emptyMessage = "",
}) => {
    const sortedImages = getSortedImages(images);

    if (sortedImages.length === 0) {
        if (!emptyMessage) return null;

        return (
            <div className="alert alert-light border small">
                {emptyMessage}
            </div>
        );
    }

    return (
        <section className="mb-3">
            <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-2">
                <h3 className="h6 mb-0">{title}</h3>

                <span className="badge text-bg-light border">
                    {sortedImages.length} foto{sortedImages.length === 1 ? "" : "s"}
                </span>
            </div>

            <div className="row g-3">
                {sortedImages.map((image, index) => (
                    <div className="col-6 col-md-4 col-xl-3" key={image.id || image.url}>
                        <a
                            href={image.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-decoration-none text-reset"
                            title="Abrir imagen"
                        >
                            <div className="border rounded-3 overflow-hidden bg-light h-100">
                                <div className="ratio ratio-4x3">
                                    <img
                                        src={image.url}
                                        alt={image.name || `Foto ${index + 1}`}
                                        className="w-100 h-100 object-fit-cover"
                                        loading="lazy"
                                    />
                                </div>

                                <div className="p-2">
                                    <div className="small text-muted text-truncate">
                                        {image.name || `Foto ${index + 1}`}
                                    </div>
                                </div>
                            </div>
                        </a>
                    </div>
                ))}
            </div>
        </section>
    );
};

export default PublicationRequestImages;
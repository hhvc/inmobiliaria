import { useCallback, useEffect, useMemo, useState } from "react";

const getImageKey = (image = {}, index) => {
    return image.id || image.storagePath || image.thumbnailPath || image.url || index;
};

const getImageUrl = (image = {}) => {
    return image.url || image.thumbnailUrl || "";
};

const getThumbUrl = (image = {}) => {
    return image.thumbnailUrl || image.url || "";
};

const normalizeIndex = (index, length) => {
    if (!length) return 0;
    if (index < 0) return length - 1;
    if (index >= length) return 0;

    return index;
};

const InmuebleMediaGallery = ({
    images = [],
    title = "Inmueble",
    selectedIndex,
    onSelectedIndexChange,
    mainImageHeight = 520,
    emptyMessage = "Sin imagen disponible",
}) => {
    const [internalSelectedIndex, setInternalSelectedIndex] = useState(0);
    const [lightboxOpen, setLightboxOpen] = useState(false);

    const normalizedImages = useMemo(() => {
        if (!Array.isArray(images)) return [];

        return [...images]
            .filter((image) => getImageUrl(image))
            .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    }, [images]);

    const isControlled = Number.isInteger(selectedIndex);

    const currentIndex = normalizeIndex(
        isControlled ? selectedIndex : internalSelectedIndex,
        normalizedImages.length,
    );

    const selectedImage =
        normalizedImages[currentIndex] || normalizedImages[0] || null;

    const setCurrentIndex = useCallback(
        (nextIndex) => {
            if (normalizedImages.length === 0) return;

            const safeIndex = normalizeIndex(nextIndex, normalizedImages.length);

            if (isControlled) {
                if (typeof onSelectedIndexChange === "function") {
                    onSelectedIndexChange(safeIndex);
                }

                return;
            }

            setInternalSelectedIndex(safeIndex);
        },
        [isControlled, normalizedImages.length, onSelectedIndexChange],
    );

    const showPrevious = useCallback(() => {
        setCurrentIndex(currentIndex - 1);
    }, [currentIndex, setCurrentIndex]);

    const showNext = useCallback(() => {
        setCurrentIndex(currentIndex + 1);
    }, [currentIndex, setCurrentIndex]);

    const openLightbox = () => {
        if (!selectedImage) return;
        setLightboxOpen(true);
    };

    const closeLightbox = () => {
        setLightboxOpen(false);
    };

    useEffect(() => {
        if (normalizedImages.length === 0) {
            setInternalSelectedIndex(0);
            return;
        }

        if (currentIndex > normalizedImages.length - 1) {
            setCurrentIndex(0);
        }
    }, [currentIndex, normalizedImages.length, setCurrentIndex]);

    useEffect(() => {
        if (!lightboxOpen || typeof window === "undefined") return undefined;

        const handleKeyDown = (event) => {
            if (event.key === "Escape") {
                closeLightbox();
            }

            if (event.key === "ArrowLeft") {
                showPrevious();
            }

            if (event.key === "ArrowRight") {
                showNext();
            }
        };

        window.addEventListener("keydown", handleKeyDown);

        return () => {
            window.removeEventListener("keydown", handleKeyDown);
        };
    }, [lightboxOpen, showNext, showPrevious]);

    useEffect(() => {
        if (!lightboxOpen || typeof document === "undefined") return undefined;

        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = "hidden";

        return () => {
            document.body.style.overflow = previousOverflow;
        };
    }, [lightboxOpen]);

    if (normalizedImages.length === 0) {
        return (
            <div
                className="bg-light rounded-4 d-flex align-items-center justify-content-center text-muted"
                style={{ height: mainImageHeight }}
            >
                {emptyMessage}
            </div>
        );
    }

    return (
        <>
            <div className="position-relative">
                <button
                    type="button"
                    className="border-0 bg-transparent p-0 w-100 text-start"
                    onClick={openLightbox}
                    aria-label="Abrir galería de fotos"
                >
                    <img
                        src={selectedImage.url}
                        alt={title}
                        className="img-fluid rounded-4 w-100"
                        style={{
                            height: mainImageHeight,
                            objectFit: "cover",
                        }}
                    />
                </button>

                <div className="position-absolute top-0 start-0 m-3 d-flex flex-wrap gap-2">
                    <span className="badge text-bg-dark bg-opacity-75">
                        {currentIndex + 1} / {normalizedImages.length}
                    </span>

                    <button
                        type="button"
                        className="btn btn-sm btn-light shadow-sm"
                        onClick={openLightbox}
                    >
                        Ver fotos
                    </button>
                </div>

                {normalizedImages.length > 1 && (
                    <>
                        <div className="position-absolute top-50 start-0 translate-middle-y ms-2 d-none d-md-block">
                            <button
                                type="button"
                                className="btn btn-light rounded-circle shadow-sm"
                                onClick={showPrevious}
                                aria-label="Imagen anterior"
                            >
                                ‹
                            </button>
                        </div>

                        <div className="position-absolute top-50 end-0 translate-middle-y me-2 d-none d-md-block">
                            <button
                                type="button"
                                className="btn btn-light rounded-circle shadow-sm"
                                onClick={showNext}
                                aria-label="Imagen siguiente"
                            >
                                ›
                            </button>
                        </div>
                    </>
                )}
            </div>

            {normalizedImages.length > 1 && (
                <div className="d-flex gap-2 mt-3 overflow-auto pb-1">
                    {normalizedImages.map((image, index) => {
                        const thumbUrl = getThumbUrl(image);
                        const active = currentIndex === index;

                        return (
                            <button
                                key={getImageKey(image, index)}
                                type="button"
                                className={`border rounded-3 p-0 overflow-hidden ${active ? "border-primary border-3" : "border-light"
                                    }`}
                                onClick={() => setCurrentIndex(index)}
                                style={{
                                    width: 92,
                                    height: 70,
                                    flex: "0 0 auto",
                                    background: "transparent",
                                }}
                                aria-label={`Ver imagen ${index + 1}`}
                            >
                                <img
                                    src={thumbUrl}
                                    alt={`${title} - imagen ${index + 1}`}
                                    className="w-100 h-100"
                                    style={{ objectFit: "cover" }}
                                    loading="lazy"
                                />
                            </button>
                        );
                    })}
                </div>
            )}

            {lightboxOpen && (
                <div
                    className="position-fixed top-0 start-0 w-100 h-100 bg-dark bg-opacity-75 d-flex align-items-center justify-content-center"
                    style={{ zIndex: 1080 }}
                    role="dialog"
                    aria-modal="true"
                    aria-label="Galería de imágenes"
                >
                    <div className="position-absolute top-0 start-0 m-3">
                        <span className="badge text-bg-light">
                            {currentIndex + 1} / {normalizedImages.length}
                        </span>
                    </div>

                    <button
                        type="button"
                        className="btn btn-light position-absolute top-0 end-0 m-3"
                        onClick={closeLightbox}
                        aria-label="Cerrar galería"
                    >
                        Cerrar
                    </button>

                    {normalizedImages.length > 1 && (
                        <button
                            type="button"
                            className="btn btn-light rounded-circle position-absolute start-0 top-50 translate-middle-y ms-3"
                            onClick={showPrevious}
                            aria-label="Imagen anterior"
                        >
                            ‹
                        </button>
                    )}

                    <img
                        src={selectedImage.url}
                        alt={`${title} - imagen ${currentIndex + 1}`}
                        className="img-fluid rounded-4 shadow"
                        style={{
                            maxHeight: "86vh",
                            maxWidth: "86vw",
                            objectFit: "contain",
                        }}
                    />

                    {normalizedImages.length > 1 && (
                        <button
                            type="button"
                            className="btn btn-light rounded-circle position-absolute end-0 top-50 translate-middle-y me-3"
                            onClick={showNext}
                            aria-label="Imagen siguiente"
                        >
                            ›
                        </button>
                    )}
                </div>
            )}
        </>
    );
};

export default InmuebleMediaGallery;
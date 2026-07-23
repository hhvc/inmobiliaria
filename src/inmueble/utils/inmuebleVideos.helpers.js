export const INMUEBLE_MAX_VIDEOS = 5;

export const VIDEO_TYPES = [
    { id: "recorrido", label: "Recorrido" },
    { id: "tour_360", label: "Tour 360" },
    { id: "drone", label: "Drone" },
    { id: "entorno", label: "Entorno" },
    { id: "institucional", label: "Institucional" },
    { id: "otro", label: "Otro" },
];

const createVideoId = () => {
    if (typeof crypto !== "undefined" && crypto.randomUUID) {
        return crypto.randomUUID();
    }

    return `video-${Date.now()}-${Math.random().toString(36).slice(2)}`;
};

const normalizeText = (value = "") => value.toString().trim();

const getYoutubeId = (url = "") => {
    try {
        const parsedUrl = new URL(url);

        if (parsedUrl.hostname.includes("youtu.be")) {
            return parsedUrl.pathname.replace("/", "").split("?")[0] || "";
        }

        if (parsedUrl.hostname.includes("youtube.com")) {
            if (parsedUrl.pathname.startsWith("/watch")) {
                return parsedUrl.searchParams.get("v") || "";
            }

            if (parsedUrl.pathname.startsWith("/embed/")) {
                return parsedUrl.pathname.replace("/embed/", "").split("/")[0] || "";
            }

            if (parsedUrl.pathname.startsWith("/shorts/")) {
                return parsedUrl.pathname.replace("/shorts/", "").split("/")[0] || "";
            }
        }

        return "";
    } catch {
        return "";
    }
};

const getVimeoId = (url = "") => {
    try {
        const parsedUrl = new URL(url);

        if (!parsedUrl.hostname.includes("vimeo.com")) {
            return "";
        }

        if (parsedUrl.hostname.includes("player.vimeo.com")) {
            return parsedUrl.pathname.replace("/video/", "").split("/")[0] || "";
        }

        return parsedUrl.pathname.replace("/", "").split("/")[0] || "";
    } catch {
        return "";
    }
};

export const parseVideoUrl = (url = "") => {
    const cleanUrl = normalizeText(url);

    if (!cleanUrl) {
        return null;
    }

    const youtubeId = getYoutubeId(cleanUrl);

    if (youtubeId) {
        return {
            provider: "youtube",
            providerLabel: "YouTube",
            videoId: youtubeId,
            url: cleanUrl,
            embedUrl: `https://www.youtube.com/embed/${youtubeId}`,
            thumbnailUrl: `https://img.youtube.com/vi/${youtubeId}/hqdefault.jpg`,
        };
    }

    const vimeoId = getVimeoId(cleanUrl);

    if (vimeoId) {
        return {
            provider: "vimeo",
            providerLabel: "Vimeo",
            videoId: vimeoId,
            url: cleanUrl,
            embedUrl: `https://player.vimeo.com/video/${vimeoId}`,
            thumbnailUrl: "",
        };
    }

    return null;
};

export const buildInmuebleVideo = ({
    url,
    title = "",
    description = "",
    type = "recorrido",
    order = 0,
    visible = true,
    featured = false,
} = {}) => {
    const parsedVideo = parseVideoUrl(url);

    if (!parsedVideo) {
        throw new Error("Pegá un link válido de YouTube o Vimeo.");
    }

    return {
        id: createVideoId(),
        ...parsedVideo,
        title: normalizeText(title),
        description: normalizeText(description),
        type: type || "recorrido",
        order,
        visible: Boolean(visible),
        featured: Boolean(featured),
        createdAt: new Date().toISOString(),
    };
};

export const normalizeInmuebleVideos = (videos = []) => {
    if (!Array.isArray(videos)) return [];

    return videos
        .filter((video) => video?.url && video?.embedUrl)
        .sort((a, b) => {
            const orderA = Number.isFinite(Number(a.order)) ? Number(a.order) : 0;
            const orderB = Number.isFinite(Number(b.order)) ? Number(b.order) : 0;

            return orderA - orderB;
        })
        .slice(0, INMUEBLE_MAX_VIDEOS)
        .map((video, index) => {
            const parsedVideo = parseVideoUrl(video.url) || {};

            return {
                id: video.id || createVideoId(),
                provider: video.provider || parsedVideo.provider || "",
                providerLabel:
                    video.providerLabel || parsedVideo.providerLabel || "",
                videoId: video.videoId || parsedVideo.videoId || "",
                url: video.url || "",
                embedUrl: video.embedUrl || parsedVideo.embedUrl || "",
                thumbnailUrl: video.thumbnailUrl || parsedVideo.thumbnailUrl || "",
                title: video.title || "",
                description: video.description || "",
                type: video.type || "recorrido",
                order: index,
                visible: video.visible !== false,
                featured: Boolean(video.featured),
                createdAt: video.createdAt || new Date().toISOString(),
            };
        })
        .map((video, index, array) => ({
            ...video,
            featured:
                array.some((item) => item.featured) ? Boolean(video.featured) : index === 0,
        }));
};

export const getVisibleInmuebleVideos = (videos = []) =>
    normalizeInmuebleVideos(videos).filter((video) => video.visible !== false);
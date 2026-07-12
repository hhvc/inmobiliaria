// src/components/SEO.jsx
import { useEffect } from "react";

const DEFAULT_TITLE = "LaDoctaProp | Portal inmobiliario";
const DEFAULT_DESCRIPTION =
    "Portal inmobiliario para publicar, administrar y consultar propiedades.";
const DEFAULT_IMAGE = "/assets/img/Logo.png";
const DEFAULT_SITE_NAME = "LaDoctaProp";

const upsertMeta = (selector, attributes) => {
    let element = document.head.querySelector(selector);

    if (!element) {
        element = document.createElement("meta");
        document.head.appendChild(element);
    }

    Object.entries(attributes).forEach(([key, value]) => {
        element.setAttribute(key, value);
    });

    return element;
};

const upsertLink = (selector, attributes) => {
    let element = document.head.querySelector(selector);

    if (!element) {
        element = document.createElement("link");
        document.head.appendChild(element);
    }

    Object.entries(attributes).forEach(([key, value]) => {
        element.setAttribute(key, value);
    });

    return element;
};

const normalizeUrl = (value) => {
    if (!value || typeof window === "undefined") return "";

    try {
        return new URL(value, window.location.origin).toString();
    } catch {
        return "";
    }
};

const SEO = ({
    title = DEFAULT_TITLE,
    description = DEFAULT_DESCRIPTION,
    image = DEFAULT_IMAGE,
    url,
    type = "website",
    siteName = DEFAULT_SITE_NAME,
    jsonLd,
    noIndex = false,
}) => {
    useEffect(() => {
        const safeTitle = title || DEFAULT_TITLE;
        const safeDescription = description || DEFAULT_DESCRIPTION;
        const safeUrl =
            normalizeUrl(url) ||
            (typeof window !== "undefined" ? window.location.href : "");
        const safeImage = normalizeUrl(image) || normalizeUrl(DEFAULT_IMAGE);

        document.title = safeTitle;

        upsertMeta('meta[name="description"]', {
            name: "description",
            content: safeDescription,
        });

        upsertMeta('meta[name="robots"]', {
            name: "robots",
            content: noIndex ? "noindex,nofollow" : "index,follow",
        });

        upsertLink('link[rel="canonical"]', {
            rel: "canonical",
            href: safeUrl,
        });

        upsertMeta('meta[property="og:title"]', {
            property: "og:title",
            content: safeTitle,
        });

        upsertMeta('meta[property="og:description"]', {
            property: "og:description",
            content: safeDescription,
        });

        upsertMeta('meta[property="og:type"]', {
            property: "og:type",
            content: type,
        });

        upsertMeta('meta[property="og:url"]', {
            property: "og:url",
            content: safeUrl,
        });

        upsertMeta('meta[property="og:site_name"]', {
            property: "og:site_name",
            content: siteName,
        });

        if (safeImage) {
            upsertMeta('meta[property="og:image"]', {
                property: "og:image",
                content: safeImage,
            });
        }

        upsertMeta('meta[name="twitter:card"]', {
            name: "twitter:card",
            content: safeImage ? "summary_large_image" : "summary",
        });

        upsertMeta('meta[name="twitter:title"]', {
            name: "twitter:title",
            content: safeTitle,
        });

        upsertMeta('meta[name="twitter:description"]', {
            name: "twitter:description",
            content: safeDescription,
        });

        if (safeImage) {
            upsertMeta('meta[name="twitter:image"]', {
                name: "twitter:image",
                content: safeImage,
            });
        }

        const existingJsonLd = document.head.querySelector(
            'script[data-seo-jsonld="true"]',
        );

        if (existingJsonLd) {
            existingJsonLd.remove();
        }

        if (jsonLd) {
            const script = document.createElement("script");
            script.type = "application/ld+json";
            script.setAttribute("data-seo-jsonld", "true");
            script.textContent = JSON.stringify(jsonLd);
            document.head.appendChild(script);
        }
    }, [description, image, jsonLd, noIndex, siteName, title, type, url]);

    return null;
};

export default SEO;
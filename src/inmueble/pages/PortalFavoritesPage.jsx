import { Link } from "react-router-dom";

import SEO from "../../components/SEO";
import { usePortalFavorites } from "../hooks/usePortalFavorites";

const PortalFavoritesPage = () => {
    const { favorites, removeFavorite } = usePortalFavorites();

    return (
        <main className="portal-home">
            <SEO
                title="Mis inmuebles favoritos | ONO Prop"
                description="Inmuebles guardados en este dispositivo."
                url="https://onoprop.com/favoritos"
                type="website"
                siteName="ONO Prop"
                noIndex
            />

            <section className="portal-section">
                <div className="container">
                    <div className="d-flex flex-wrap justify-content-between align-items-end gap-3 mb-4">
                        <div>
                            <p className="portal-eyebrow mb-1">Tu selección</p>
                            <h1 className="portal-section-title mb-2">Inmuebles favoritos</h1>
                            <p className="text-muted mb-0">
                                Se guardan solamente en este dispositivo y no requieren iniciar sesión.
                            </p>
                        </div>

                        <Link to="/inmuebles" className="btn btn-primary">
                            Buscar inmuebles
                        </Link>
                    </div>

                    {favorites.length === 0 ? (
                        <div className="card border-0 shadow-sm">
                            <div className="card-body p-4 p-lg-5 text-center">
                                <div className="portal-favorites-empty-heart" aria-hidden="true">♡</div>
                                <h2 className="h4">Todavía no guardaste inmuebles</h2>
                                <p className="text-muted">
                                    Usá el corazón de cada publicación para armar tu selección.
                                </p>
                                <Link to="/inmuebles" className="btn btn-outline-primary">
                                    Explorar publicaciones
                                </Link>
                            </div>
                        </div>
                    ) : (
                        <div className="row g-4">
                            {favorites.map((favorite) => (
                                <article className="col-12 col-md-6 col-xl-4" key={favorite.key}>
                                    <div className="card h-100 border-0 shadow-sm overflow-hidden">
                                        <Link
                                            to={favorite.publicPath}
                                            state={{ performanceSource: "favorites" }}
                                            className="text-decoration-none"
                                        >
                                            {favorite.coverImageUrl ? (
                                                <img
                                                    src={favorite.coverImageUrl}
                                                    alt={favorite.titulo}
                                                    className="portal-favorite-card-image"
                                                    loading="lazy"
                                                />
                                            ) : (
                                                <div className="portal-favorite-card-image-empty">Sin imagen</div>
                                            )}
                                        </Link>

                                        <div className="card-body d-flex flex-column p-4">
                                            <div className="small text-muted mb-2">{favorite.sourceLabel}</div>
                                            <Link
                                                to={favorite.publicPath}
                                                state={{ performanceSource: "favorites" }}
                                                className="text-decoration-none text-dark"
                                            >
                                                <h2 className="h5">{favorite.titulo}</h2>
                                            </Link>
                                            <p className="small text-muted mb-3">📍 {favorite.locationLabel}</p>
                                            <div className="h5 text-primary mb-4">{favorite.priceLabel}</div>

                                            <div className="mt-auto d-flex gap-2">
                                                <Link
                                                    to={favorite.publicPath}
                                                    state={{ performanceSource: "favorites" }}
                                                    className="btn btn-primary flex-grow-1"
                                                >
                                                    Ver publicación
                                                </Link>
                                                <button
                                                    type="button"
                                                    className="btn btn-outline-danger"
                                                    onClick={() => removeFavorite(favorite.key)}
                                                    aria-label={`Quitar ${favorite.titulo} de favoritos`}
                                                >
                                                    Quitar
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </article>
                            ))}
                        </div>
                    )}
                </div>
            </section>
        </main>
    );
};

export default PortalFavoritesPage;

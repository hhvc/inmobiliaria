import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";

import SEO from "../../components/SEO";
import { useAuth } from "../../context/auth/useAuth";
import {
  createEmprendimiento,
  getEmprendimientoById,
  updateEmprendimiento,
} from "../services/emprendimiento.service";
import {
  EMPRENDIMIENTO_ESTADOS,
  EMPRENDIMIENTO_ESTADOS_OBRA,
  EMPRENDIMIENTO_TIPOS,
  emprendimientoInitialValues,
  normalizeEmprendimiento,
  validateEmprendimiento,
} from "../utils/emprendimientoSchema";
import {
  deleteEmprendimientoImages,
  uploadEmprendimientoImages,
} from "../helpers/emprendimientoImages";

const cloneInitialValues = () => ({
  ...emprendimientoInitialValues,
  direccion: { ...emprendimientoInitialValues.direccion },
  financiacion: { ...emprendimientoInitialValues.financiacion },
  amenities: [],
  servicios: [],
  images: [],
});

const listToText = (items = []) =>
  Array.isArray(items) ? items.join("\n") : items?.toString?.() || "";

const EmprendimientoFormPage = () => {
  const { id } = useParams();
  const isEditMode = Boolean(id);
  const navigate = useNavigate();
  const { activeInmobiliariaId } = useAuth();

  const [values, setValues] = useState(cloneInitialValues);
  const [originalImages, setOriginalImages] = useState([]);
  const [newFiles, setNewFiles] = useState([]);
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(isEditMode);
  const [saving, setSaving] = useState(false);
  const [pageError, setPageError] = useState("");

  useEffect(() => {
    if (!isEditMode) {
      setValues((current) => ({
        ...current,
        inmobiliariaId: activeInmobiliariaId || current.inmobiliariaId,
      }));
      setLoading(false);
      return;
    }

    let active = true;

    const load = async () => {
      if (!activeInmobiliariaId) {
        setPageError("No hay una inmobiliaria activa seleccionada.");
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setPageError("");
        const data = await getEmprendimientoById(activeInmobiliariaId, id);

        if (!data) throw new Error("No se encontró el emprendimiento");
        if (!active) return;

        const normalized = normalizeEmprendimiento(data);
        setValues(normalized);
        setOriginalImages(normalized.images);
      } catch (error) {
        if (active) setPageError(error.message || "No se pudo cargar");
      } finally {
        if (active) setLoading(false);
      }
    };

    load();
    return () => {
      active = false;
    };
  }, [activeInmobiliariaId, id, isEditMode]);

  const title = isEditMode ? "Editar emprendimiento" : "Nuevo emprendimiento";
  const imagePreviewUrls = useMemo(
    () =>
      newFiles.map((file) => ({
        name: file.name,
        url: URL.createObjectURL(file),
      })),
    [newFiles],
  );

  useEffect(
    () => () => imagePreviewUrls.forEach((image) => URL.revokeObjectURL(image.url)),
    [imagePreviewUrls],
  );

  const change = (event) => {
    const { name, value, type, checked } = event.target;
    setValues((current) => ({
      ...current,
      [name]: type === "checkbox" ? checked : value,
    }));
    setErrors((current) => ({ ...current, [name]: undefined }));
  };

  const changeNested = (group, field, value) => {
    setValues((current) => ({
      ...current,
      [group]: { ...(current[group] || {}), [field]: value },
    }));
    setErrors((current) => ({ ...current, [field]: undefined }));
  };

  const removeCurrentImage = (index) => {
    setValues((current) => ({
      ...current,
      images: current.images.filter((_, imageIndex) => imageIndex !== index),
    }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    const inmobiliariaId = values.inmobiliariaId || activeInmobiliariaId;
    const payload = normalizeEmprendimiento({ ...values, inmobiliariaId });
    const nextErrors = validateEmprendimiento(payload);

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }

    try {
      setSaving(true);
      setPageError("");

      let emprendimientoId = id;
      let slug = values.slug || "";

      if (isEditMode) {
        await updateEmprendimiento(inmobiliariaId, id, payload);
      } else {
        const created = await createEmprendimiento(inmobiliariaId, payload);
        emprendimientoId = created.id;
        slug = created.slug;
      }

      let nextImages = payload.images;

      if (newFiles.length > 0) {
        const uploaded = await uploadEmprendimientoImages({
          inmobiliariaId,
          emprendimientoId,
          files: newFiles,
          startOrder: nextImages.length,
        });
        nextImages = [...nextImages, ...uploaded];

        await updateEmprendimiento(inmobiliariaId, emprendimientoId, {
          ...payload,
          slug,
          images: nextImages,
        });
      }

      const retainedPaths = new Set(
        nextImages.map((image) => image?.storagePath).filter(Boolean),
      );
      const removedImages = originalImages.filter(
        (image) => image?.storagePath && !retainedPaths.has(image.storagePath),
      );

      if (removedImages.length > 0) {
        await deleteEmprendimientoImages(removedImages);
      }

      navigate("/admin/emprendimientos", { replace: true });
    } catch (error) {
      console.error("Error guardando emprendimiento:", error);
      setPageError(error.message || "No se pudo guardar el emprendimiento");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <main className="container py-5 text-center">Cargando...</main>;
  }

  return (
    <main className="container py-4" style={{ maxWidth: 1050 }}>
      <SEO title={`${title} | ONO Prop`} noIndex />

      <header className="d-flex justify-content-between align-items-start gap-3 mb-4">
        <div>
          <p className="text-uppercase text-muted small mb-1">Emprendimientos</p>
          <h1 className="h3 mb-1">{title}</h1>
          <p className="text-muted mb-0">
            Información general del proyecto; sus unidades se administran como inmuebles.
          </p>
        </div>
        <Link className="btn btn-outline-secondary" to="/admin/emprendimientos">
          Volver
        </Link>
      </header>

      {pageError && <div className="alert alert-danger">{pageError}</div>}

      <form onSubmit={handleSubmit}>
        <section className="card border-0 shadow-sm mb-4">
          <div className="card-header fw-semibold">Identidad del proyecto</div>
          <div className="card-body row g-3">
            <div className="col-md-8">
              <label className="form-label">Nombre *</label>
              <input
                name="nombre"
                className={`form-control ${errors.nombre ? "is-invalid" : ""}`}
                value={values.nombre}
                onChange={change}
              />
              {errors.nombre && <div className="invalid-feedback">{errors.nombre}</div>}
            </div>
            <div className="col-md-4">
              <label className="form-label">Tipo *</label>
              <select name="tipo" className="form-select" value={values.tipo} onChange={change}>
                {EMPRENDIMIENTO_TIPOS.map((item) => (
                  <option key={item.id} value={item.id}>{item.label}</option>
                ))}
              </select>
            </div>
            <div className="col-12">
              <label className="form-label">Descripción *</label>
              <textarea
                name="descripcion"
                rows={6}
                className={`form-control ${errors.descripcion ? "is-invalid" : ""}`}
                value={values.descripcion}
                onChange={change}
              />
              {errors.descripcion && <div className="invalid-feedback">{errors.descripcion}</div>}
            </div>
            <div className="col-md-6">
              <label className="form-label">Desarrollista</label>
              <input name="desarrollista" className="form-control" value={values.desarrollista} onChange={change} />
            </div>
            <div className="col-md-3">
              <label className="form-label">Estado de obra</label>
              <select name="estadoObra" className="form-select" value={values.estadoObra} onChange={change}>
                {EMPRENDIMIENTO_ESTADOS_OBRA.map((item) => (
                  <option key={item.id} value={item.id}>{item.label}</option>
                ))}
              </select>
            </div>
            <div className="col-md-3">
              <label className="form-label">Avance (%)</label>
              <input name="avanceObra" type="number" min="0" max="100" className="form-control" value={values.avanceObra} onChange={change} />
            </div>
            <div className="col-md-4">
              <label className="form-label">Entrega estimada</label>
              <input name="fechaEntrega" type="month" className="form-control" value={values.fechaEntrega} onChange={change} />
            </div>
          </div>
        </section>

        <section className="card border-0 shadow-sm mb-4">
          <div className="card-header fw-semibold">Ubicación</div>
          <div className="card-body row g-3">
            {[
              ["calle", "Calle", "col-md-5"],
              ["numero", "Número", "col-md-2"],
              ["barrio", "Barrio", "col-md-5"],
              ["ciudad", "Ciudad *", "col-md-5"],
              ["provincia", "Provincia", "col-md-4"],
              ["pais", "País", "col-md-3"],
            ].map(([field, label, className]) => (
              <div className={className} key={field}>
                <label className="form-label">{label}</label>
                <input
                  className={`form-control ${field === "ciudad" && errors.ciudad ? "is-invalid" : ""}`}
                  value={values.direccion?.[field] || ""}
                  onChange={(event) => changeNested("direccion", field, event.target.value)}
                />
                {field === "ciudad" && errors.ciudad && <div className="invalid-feedback">{errors.ciudad}</div>}
              </div>
            ))}
          </div>
        </section>

        <section className="card border-0 shadow-sm mb-4">
          <div className="card-header fw-semibold">Financiación</div>
          <div className="card-body row g-3">
            <div className="col-12">
              <div className="form-check form-switch">
                <input
                  id="financiacionDisponible"
                  className="form-check-input"
                  type="checkbox"
                  checked={Boolean(values.financiacion?.disponible)}
                  onChange={(event) => changeNested("financiacion", "disponible", event.target.checked)}
                />
                <label className="form-check-label" htmlFor="financiacionDisponible">Ofrece financiación</label>
              </div>
            </div>
            <div className="col-md-4">
              <label className="form-label">Anticipo</label>
              <input className="form-control" placeholder="Ej: 30%" value={values.financiacion?.anticipo || ""} onChange={(event) => changeNested("financiacion", "anticipo", event.target.value)} />
            </div>
            <div className="col-md-4">
              <label className="form-label">Cuotas</label>
              <input className="form-control" placeholder="Ej: 24 cuotas ajustadas por CAC" value={values.financiacion?.cuotas || ""} onChange={(event) => changeNested("financiacion", "cuotas", event.target.value)} />
            </div>
            <div className="col-12">
              <label className="form-label">Detalle de financiación</label>
              <textarea className="form-control" rows={3} value={values.financiacion?.descripcion || ""} onChange={(event) => changeNested("financiacion", "descripcion", event.target.value)} />
            </div>
          </div>
        </section>

        <section className="card border-0 shadow-sm mb-4">
          <div className="card-header fw-semibold">Características generales</div>
          <div className="card-body row g-3">
            <div className="col-md-6">
              <label className="form-label">Amenities</label>
              <textarea name="amenities" className="form-control" rows={6} value={listToText(values.amenities)} onChange={change} placeholder="Uno por línea: piscina, SUM, seguridad..." />
            </div>
            <div className="col-md-6">
              <label className="form-label">Servicios</label>
              <textarea name="servicios" className="form-control" rows={6} value={listToText(values.servicios)} onChange={change} placeholder="Uno por línea: agua, gas, cloacas..." />
            </div>
          </div>
        </section>

        <section className="card border-0 shadow-sm mb-4">
          <div className="card-header fw-semibold">Imágenes y renders</div>
          <div className="card-body">
            <input
              type="file"
              className="form-control mb-3"
              accept="image/jpeg,image/png,image/webp"
              multiple
              onChange={(event) => setNewFiles(Array.from(event.target.files || []))}
            />
            <div className="form-text mb-3">JPG, PNG o WebP. Máximo 10 MB por archivo.</div>

            {(values.images.length > 0 || imagePreviewUrls.length > 0) && (
              <div className="row g-3">
                {values.images.map((image, index) => (
                  <div className="col-6 col-md-3" key={image.storagePath || image.url}>
                    <div className="card h-100">
                      <img src={image.url} alt={`Imagen ${index + 1}`} className="card-img-top" style={{ height: 140, objectFit: "cover" }} />
                      <button type="button" className="btn btn-sm btn-outline-danger m-2" onClick={() => removeCurrentImage(index)}>Quitar</button>
                    </div>
                  </div>
                ))}
                {imagePreviewUrls.map((image) => (
                  <div className="col-6 col-md-3" key={image.url}>
                    <div className="card h-100">
                      <img src={image.url} alt={image.name} className="card-img-top" style={{ height: 140, objectFit: "cover" }} />
                      <div className="small text-muted p-2 text-truncate">Nueva: {image.name}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        <section className="card border-0 shadow-sm mb-4">
          <div className="card-header fw-semibold">Publicación</div>
          <div className="card-body row g-3 align-items-end">
            <div className="col-md-4">
              <label className="form-label">Estado</label>
              <select name="estado" className="form-select" value={values.estado} onChange={change}>
                {EMPRENDIMIENTO_ESTADOS.map((estado) => <option key={estado} value={estado}>{estado}</option>)}
              </select>
            </div>
            {[
              ["destacado", "Destacado"],
              ["publicarEnPortal", "Publicar en portal"],
              ["noIndex", "No indexar en Google"],
              ["mostrarUnidadesVendidas", "Mostrar unidades vendidas"],
            ].map(([name, label]) => (
              <div className="col-md-2 col-lg-3" key={name}>
                <div className="form-check">
                  <input id={name} name={name} type="checkbox" className="form-check-input" checked={Boolean(values[name])} onChange={change} />
                  <label className="form-check-label" htmlFor={name}>{label}</label>
                </div>
              </div>
            ))}
            <div className="col-12">
              <div className="form-text">
                Si no activás “Mostrar unidades vendidas”, sólo se mostrarán en
                la ficha pública las unidades publicadas que todavía no estén
                vendidas.
              </div>
            </div>
          </div>
        </section>

        <div className="d-flex justify-content-end gap-2">
          <Link className="btn btn-outline-secondary" to="/admin/emprendimientos">Cancelar</Link>
          <button type="submit" className="btn btn-primary px-4" disabled={saving || !activeInmobiliariaId}>
            {saving ? "Guardando..." : isEditMode ? "Actualizar" : "Crear emprendimiento"}
          </button>
        </div>
      </form>
    </main>
  );
};

export default EmprendimientoFormPage;

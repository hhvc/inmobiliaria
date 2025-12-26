import { useState, useEffect } from "react";
import {
  collection,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  orderBy,
  query,
} from "firebase/firestore";
import { db } from "../../../firebase/config";
import { useAuth } from "../../../context/auth/useAuth";
import CabanaForm from "./CabanaForm";

const AdminCabanas = () => {
  const { hasRole } = useAuth();
  const [cabanas, setCabanas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingCabana, setEditingCabana] = useState(null);
  const [formLoading, setFormLoading] = useState(false);

  useEffect(() => {
    fetchCabanas();
  }, []);

  const fetchCabanas = async () => {
    try {
      const q = query(collection(db, "cabanas"), orderBy("orden", "asc"));
      const querySnapshot = await getDocs(q);
      const cabanasData = querySnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setCabanas(cabanasData);
    } catch (error) {
      console.error("Error cargando cabañas:", error);
      alert("Error al cargar las cabañas");
    } finally {
      setLoading(false);
    }
  };

  const handleSaveCabana = async (cabanaData) => {
    setFormLoading(true);
    try {
      if (editingCabana) {
        // Actualizar cabaña existente
        await updateDoc(doc(db, "cabanas", editingCabana.id), cabanaData);
      } else {
        // Crear nueva cabaña
        await addDoc(collection(db, "cabanas"), cabanaData);
      }

      resetForm();
      fetchCabanas();
      alert(
        editingCabana
          ? "✅ Cabaña actualizada correctamente"
          : "🏡 Cabaña creada correctamente"
      );
    } catch (error) {
      console.error("Error guardando cabaña:", error);
      alert("❌ Error al guardar la cabaña");
    } finally {
      setFormLoading(false);
    }
  };

  const handleEdit = (cabana) => {
    setEditingCabana(cabana);
    setShowForm(true);
  };

  const handleDelete = async (id, nombre) => {
    if (
      window.confirm(
        `¿Estás seguro de que quieres eliminar la cabaña "${nombre}"? Esta acción no se puede deshacer.`
      )
    ) {
      try {
        await deleteDoc(doc(db, "cabanas", id));
        fetchCabanas();
        alert("🗑️ Cabaña eliminada correctamente");
      } catch (error) {
        console.error("Error eliminando cabaña:", error);
        alert("❌ Error al eliminar la cabaña");
      }
    }
  };

  const handleToggleDisponibilidad = async (cabana) => {
    try {
      await updateDoc(doc(db, "cabanas", cabana.id), {
        disponible: !cabana.disponible,
        updatedAt: new Date(),
      });
      fetchCabanas();
      alert(
        `✅ Cabaña ${
          !cabana.disponible
            ? "marcada como disponible"
            : "marcada como no disponible"
        }`
      );
    } catch (error) {
      console.error("Error actualizando disponibilidad:", error);
      alert("❌ Error al actualizar la disponibilidad");
    }
  };

  const handleToggleDestacada = async (cabana) => {
    try {
      await updateDoc(doc(db, "cabanas", cabana.id), {
        destacada: !cabana.destacada,
        updatedAt: new Date(),
      });
      fetchCabanas();
      alert(
        `⭐ Cabaña ${
          !cabana.destacada ? "marcada como destacada" : "ya no es destacada"
        }`
      );
    } catch (error) {
      console.error("Error actualizando estado destacado:", error);
      alert("❌ Error al actualizar el estado destacado");
    }
  };

  const resetForm = () => {
    setEditingCabana(null);
    setShowForm(false);
  };

  const handleAddNew = () => {
    setEditingCabana(null);
    setShowForm(true);
  };

  // Función para obtener información de capacidad formateada
  const getInfoCapacidad = (cabana) => {
    if (cabana.capacidad && typeof cabana.capacidad === "object") {
      // Nuevo formato
      return `${cabana.capacidad.maxPersonas}p (${cabana.capacidad.maxAdultos}a + ${cabana.capacidad.maxMenores}m)`;
    } else {
      // Formato antiguo
      return cabana.capacidad || "No especificada";
    }
  };

  // Función para obtener información de precios formateada
  const getInfoPrecios = (cabana) => {
    if (cabana.precios && cabana.precios.base) {
      const precios = cabana.precios;
      const tieneAdicionales =
        precios.adicionalAdulto > 0 ||
        precios.adicionalMenor > 0 ||
        precios.adicionalMenor3 > 0;
      const tieneTemporadas =
        precios.temporadas && precios.temporadas.length > 0;

      return {
        base: `$${precios.base}`,
        tieneAdicionales,
        tieneTemporadas,
        adicionalAdulto: precios.adicionalAdulto,
        adicionalMenor: precios.adicionalMenor,
        adicionalMenor3: precios.adicionalMenor3,
      };
    } else if (cabana.precioNoche) {
      return {
        base: `$${cabana.precioNoche}`,
        tieneAdicionales: false,
        tieneTemporadas: false,
      };
    } else {
      return {
        base: "No especificado",
        tieneAdicionales: false,
        tieneTemporadas: false,
      };
    }
  };

  if (!hasRole("admin")) {
    return (
      <div className="container mt-4">
        <div className="alert alert-danger text-center">
          <h4>🚫 Acceso Denegado</h4>
          <p>No tienes permisos para acceder a esta sección.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mt-4">
      {/* Header */}
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h2 className="mb-1">🏠 Administrar Cabañas</h2>
          <p className="text-muted mb-0">
            Gestiona todas las cabañas disponibles en el sistema
          </p>
        </div>
        <button
          className="btn btn-primary"
          onClick={handleAddNew}
          disabled={formLoading}
        >
          ➕ Agregar Cabaña
        </button>
      </div>

      {/* Formulario */}
      {showForm && (
        <div className="mb-4">
          <CabanaForm
            cabanaExistente={editingCabana}
            onSave={handleSaveCabana}
            onCancel={resetForm}
            loading={formLoading}
          />
        </div>
      )}

      {/* Estadísticas */}
      <div className="row mb-4">
        <div className="col-md-3">
          <div className="card bg-primary text-white">
            <div className="card-body text-center">
              <h4 className="mb-0">{cabanas.length}</h4>
              <small>Total Cabañas</small>
            </div>
          </div>
        </div>
        <div className="col-md-3">
          <div className="card bg-success text-white">
            <div className="card-body text-center">
              <h4 className="mb-0">
                {cabanas.filter((c) => c.disponible).length}
              </h4>
              <small>Disponibles</small>
            </div>
          </div>
        </div>
        <div className="col-md-3">
          <div className="card bg-warning text-white">
            <div className="card-body text-center">
              <h4 className="mb-0">
                {cabanas.filter((c) => c.destacada).length}
              </h4>
              <small>Destacadas</small>
            </div>
          </div>
        </div>
        <div className="col-md-3">
          <div className="card bg-danger text-white">
            <div className="card-body text-center">
              <h4 className="mb-0">
                {cabanas.filter((c) => !c.disponible).length}
              </h4>
              <small>No Disponibles</small>
            </div>
          </div>
        </div>
      </div>

      {/* Estadísticas adicionales de precios y capacidades */}
      {cabanas.length > 0 && (
        <div className="row mb-4">
          <div className="col-12">
            <div className="card bg-light">
              <div className="card-body py-3">
                <div className="row text-center">
                  <div className="col-md-3">
                    <small className="text-muted">Precio promedio</small>
                    <div className="fw-bold text-primary">
                      $
                      {Math.round(
                        cabanas.reduce((sum, c) => {
                          const precio = c.precios?.base || c.precioNoche || 0;
                          return sum + precio;
                        }, 0) / cabanas.length
                      )}
                    </div>
                  </div>
                  <div className="col-md-3">
                    <small className="text-muted">
                      Con precios adicionales
                    </small>
                    <div className="fw-bold text-info">
                      {
                        cabanas.filter(
                          (c) =>
                            c.precios?.adicionalAdulto > 0 ||
                            c.precios?.adicionalMenor > 0 ||
                            c.precios?.adicionalMenor3 > 0
                        ).length
                      }
                    </div>
                  </div>
                  <div className="col-md-3">
                    <small className="text-muted">Con temporadas</small>
                    <div className="fw-bold text-warning">
                      {
                        cabanas.filter(
                          (c) =>
                            c.precios?.temporadas &&
                            c.precios.temporadas.length > 0
                        ).length
                      }
                    </div>
                  </div>
                  <div className="col-md-3">
                    <small className="text-muted">Formato nuevo</small>
                    <div className="fw-bold text-success">
                      {
                        cabanas.filter(
                          (c) => c.capacidad && typeof c.capacidad === "object"
                        ).length
                      }
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Lista de Cabañas */}
      <div className="card">
        <div className="card-header bg-light">
          <h5 className="mb-0">📋 Lista de Cabañas</h5>
        </div>
        <div className="card-body">
          {loading ? (
            <div className="text-center py-4">
              <div className="spinner-border text-primary" role="status">
                <span className="visually-hidden">Cargando...</span>
              </div>
              <p className="mt-2 mb-0">Cargando cabañas...</p>
            </div>
          ) : cabanas.length === 0 ? (
            <div className="text-center py-5">
              <div className="alert alert-info">
                <h5>🏠 No hay cabañas registradas</h5>
                <p className="mb-0">
                  Comienza agregando tu primera cabaña usando el botón "Agregar
                  Cabaña"
                </p>
              </div>
            </div>
          ) : (
            <div className="table-responsive">
              <table className="table table-hover">
                <thead className="table-dark">
                  <tr>
                    <th>Orden</th>
                    <th>Imagen</th>
                    <th>Nombre</th>
                    <th>Capacidad</th>
                    <th>Precio Base</th>
                    <th>Adicionales</th>
                    <th>Estado</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {cabanas.map((cabana) => {
                    const infoPrecios = getInfoPrecios(cabana);
                    return (
                      <tr
                        key={cabana.id}
                        className={!cabana.disponible ? "table-secondary" : ""}
                      >
                        <td>
                          <strong>#{cabana.orden}</strong>
                        </td>
                        <td>
                          <img
                            src={cabana.imagenes[0]}
                            alt={cabana.nombre}
                            className="rounded"
                            style={{
                              width: "60px",
                              height: "40px",
                              objectFit: "cover",
                            }}
                            onError={(e) => {
                              e.target.src =
                                "https://via.placeholder.com/60x40/6c757d/ffffff?text=Imagen";
                            }}
                          />
                        </td>
                        <td>
                          <div>
                            <strong>{cabana.nombre}</strong>
                            {cabana.destacada && (
                              <span className="badge bg-warning ms-1">
                                ⭐ Destacada
                              </span>
                            )}
                            <br />
                            <small className="text-muted">
                              {cabana.metrosCuadrados}m² • {cabana.dormitorios}{" "}
                              dorm.
                            </small>
                          </div>
                        </td>
                        <td>
                          <div>
                            <strong>{getInfoCapacidad(cabana)}</strong>
                            <br />
                            <small className="text-muted">
                              {cabana.capacidad &&
                              typeof cabana.capacidad === "object"
                                ? `${cabana.capacidad.maxAdultos} adultos + ${cabana.capacidad.maxMenores} menores`
                                : "Formato antiguo"}
                            </small>
                          </div>
                        </td>
                        <td>
                          <div>
                            <strong>{infoPrecios.base}</strong>
                            {infoPrecios.tieneTemporadas && (
                              <span
                                className="badge bg-info ms-1"
                                title="Tiene temporadas configuradas"
                              >
                                📅
                              </span>
                            )}
                          </div>
                        </td>
                        <td>
                          {infoPrecios.tieneAdicionales ? (
                            <div className="small">
                              <div>👨 +${infoPrecios.adicionalAdulto}</div>
                              <div>👦 +${infoPrecios.adicionalMenor}</div>
                              <div>👶 +${infoPrecios.adicionalMenor3}</div>
                            </div>
                          ) : (
                            <span className="text-muted small">
                              No configurados
                            </span>
                          )}
                        </td>
                        <td>
                          <div className="d-flex flex-column gap-1">
                            <button
                              className={`btn btn-sm ${
                                cabana.disponible ? "btn-success" : "btn-danger"
                              }`}
                              onClick={() => handleToggleDisponibilidad(cabana)}
                              title={
                                cabana.disponible
                                  ? "Marcar como no disponible"
                                  : "Marcar como disponible"
                              }
                            >
                              {cabana.disponible
                                ? "✅ Disponible"
                                : "❌ No Disponible"}
                            </button>
                            <button
                              className={`btn btn-sm ${
                                cabana.destacada
                                  ? "btn-warning"
                                  : "btn-outline-warning"
                              }`}
                              onClick={() => handleToggleDestacada(cabana)}
                              title={
                                cabana.destacada
                                  ? "Quitar como destacada"
                                  : "Marcar como destacada"
                              }
                            >
                              {cabana.destacada ? "⭐ Destacada" : "⚪ Normal"}
                            </button>
                          </div>
                        </td>
                        <td>
                          <div className="btn-group btn-group-sm">
                            <button
                              className="btn btn-outline-primary"
                              onClick={() => handleEdit(cabana)}
                              title="Editar cabaña"
                              disabled={formLoading}
                            >
                              ✏️ Editar
                            </button>
                            <button
                              className="btn btn-outline-danger"
                              onClick={() =>
                                handleDelete(cabana.id, cabana.nombre)
                              }
                              title="Eliminar cabaña"
                              disabled={formLoading}
                            >
                              🗑️ Eliminar
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Vista previa en tarjetas (opcional) */}
      {cabanas.length > 0 && (
        <div className="mt-5">
          <h5 className="mb-3">👀 Vista Previa</h5>
          <div className="row">
            {cabanas.slice(0, 3).map((cabana) => {
              const infoPrecios = getInfoPrecios(cabana);
              const infoCapacidad = getInfoCapacidad(cabana);

              return (
                <div key={cabana.id} className="col-md-4 mb-3">
                  <div className="card h-100">
                    <img
                      src={cabana.imagenes[0]}
                      className="card-img-top"
                      alt={cabana.nombre}
                      style={{ height: "200px", objectFit: "cover" }}
                      onError={(e) => {
                        e.target.src =
                          "https://via.placeholder.com/300x200/6c757d/ffffff?text=Imagen+No+Disponible";
                      }}
                    />
                    <div className="card-body">
                      <h6 className="card-title">{cabana.nombre}</h6>
                      <p className="card-text small mb-1">
                        {infoCapacidad} • {cabana.metrosCuadrados}m² •{" "}
                        {cabana.dormitorios} dorm.
                      </p>
                      <div className="mb-2">
                        <strong className="text-success">
                          {infoPrecios.base}
                        </strong>
                        {infoPrecios.tieneAdicionales && (
                          <small className="text-muted d-block">
                            + adicionales por persona
                          </small>
                        )}
                        {infoPrecios.tieneTemporadas && (
                          <small className="text-info d-block">
                            📅 Temporadas configuradas
                          </small>
                        )}
                      </div>
                      <div className="d-flex justify-content-between align-items-center">
                        <div>
                          {cabana.disponible ? (
                            <span className="badge bg-success">Disponible</span>
                          ) : (
                            <span className="badge bg-danger">
                              No Disponible
                            </span>
                          )}
                          {cabana.destacada && (
                            <span className="badge bg-warning ms-1">
                              Destacada
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          {cabanas.length > 3 && (
            <div className="text-center mt-3">
              <small className="text-muted">
                Mostrando 3 de {cabanas.length} cabañas. Usa la tabla para
                gestionar todas.
              </small>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default AdminCabanas;

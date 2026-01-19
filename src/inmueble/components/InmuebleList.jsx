import React, { useMemo, useState } from "react";
import { useInmuebleList } from "../hooks/useInmuebleList";

const OPERACIONES_OPCIONES = [
  { id: "", label: "Todas" },
  { id: "venta", label: "Venta" },
  { id: "alquiler", label: "Alquiler" },
  { id: "alquiler_temporal", label: "Alquiler Temporal" },
  { id: "compra", label: "Compra" },
  { id: "tasacion", label: "Tasación" },
];

const TIPOS_INMUEBLE_OPCIONES = [
  { id: "", label: "Todos" },
  { id: "casa", label: "Casa" },
  { id: "departamento", label: "Departamento" },
  { id: "terreno", label: "Terreno" },
  { id: "local", label: "Local" },
  { id: "oficina", label: "Oficina" },
  { id: "cochera", label: "Cochera" },
  { id: "deposito", label: "Depósito" },
  { id: "quinta", label: "Quinta" },
  { id: "campo", label: "Campo" },
];

const InmuebleList = () => {
  const { inmuebles, loading, error, deleteInmueble } = useInmuebleList();

  const [filtros, setFiltros] = useState({
    texto: "",
    tipo: "",
    operacion: "",
    estado: "",
  });

  const inmueblesFiltrados = useMemo(() => {
    return inmuebles
      .filter((i) =>
        filtros.texto
          ? i.titulo?.toLowerCase().includes(filtros.texto.toLowerCase()) ||
            i.localidad?.toLowerCase().includes(filtros.texto.toLowerCase())
          : true
      )
      .filter((i) => (filtros.tipo ? i.tipo === filtros.tipo : true))
      .filter((i) =>
        filtros.operacion ? i.operacion === filtros.operacion : true
      )
      .filter((i) => (filtros.estado ? i.estado === filtros.estado : true))
      .sort((a, b) => b.createdAt?.seconds - a.createdAt?.seconds);
  }, [inmuebles, filtros]);

  const handleChange = (e) => {
    setFiltros({
      ...filtros,
      [e.target.name]: e.target.value,
    });
  };

  if (loading) return <p>Cargando inmuebles...</p>;
  if (error) return <p style={{ color: "red" }}>{error}</p>;

  return (
    <section className="inmueble-list">
      <header className="list-header">
        <h2>Inmuebles</h2>
        <p>{inmueblesFiltrados.length} resultados</p>
      </header>

      {/* Filtros */}
      <div className="filtros">
        <input
          type="text"
          name="texto"
          placeholder="Buscar por título o localidad"
          value={filtros.texto}
          onChange={handleChange}
        />

        <select name="tipo" value={filtros.tipo} onChange={handleChange}>
          {TIPOS_INMUEBLE_OPCIONES.map((op) => (
            <option key={op.id} value={op.id}>
              {op.label}
            </option>
          ))}
        </select>

        <select
          name="operacion"
          value={filtros.operacion}
          onChange={handleChange}
        >
          {OPERACIONES_OPCIONES.map((op) => (
            <option key={op.id} value={op.id}>
              {op.label}
            </option>
          ))}
        </select>

        <select name="estado" value={filtros.estado} onChange={handleChange}>
          <option value="">Todos</option>
          <option value="activo">Activo</option>
          <option value="reservado">Reservado</option>
          <option value="vendido">Vendido</option>
        </select>
      </div>

      {/* Tabla */}
      {inmueblesFiltrados.length === 0 ? (
        <p>No hay inmuebles que coincidan con los filtros.</p>
      ) : (
        <table className="inmueble-table">
          <thead>
            <tr>
              <th>Título</th>
              <th>Tipo</th>
              <th>Operación</th>
              <th>Precio</th>
              <th>Localidad</th>
              <th>Estado</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {inmueblesFiltrados.map((i) => (
              <tr key={i.id}>
                <td>{i.titulo}</td>
                <td>{i.tipo}</td>
                <td>{i.operacion}</td>
                <td>
                  {i.precio
                    ? `$ ${Number(i.precio).toLocaleString("es-AR")}`
                    : "-"}
                </td>
                <td>{i.localidad || "-"}</td>
                <td>
                  <span className={`estado estado-${i.estado || "activo"}`}>
                    {i.estado || "activo"}
                  </span>
                </td>
                <td className="acciones">
                  <button onClick={() => console.log("editar", i.id)}>
                    Editar
                  </button>
                  <button
                    onClick={() => deleteInmueble(i.id)}
                    className="danger"
                  >
                    Eliminar
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
};

export default InmuebleList;

const About = () => {
  return (
    <section id="about" className="py-5 bg-light">
      <div className="container">
        {/* Header Section */}
        <div className="row text-center mb-5">
          <div className="col-lg-12">
            <h1 className="display-4 fw-bold text-primary mb-3">
              El contacto con la naturaleza
              <br />y la tranquilidad de las sierras 🌄
            </h1>
            <p className="lead fs-4 text-muted">
              Un espacio ideal para compartir con la familia, tu pareja o amigos
            </p>
          </div>
        </div>

        <div className="row">
          {/* Left Column */}
          <div className="col-lg-6 mb-4">
            <div className="card border-0 shadow-sm h-100">
              <div className="card-body p-4">
                <div className="d-flex align-items-center mb-3">
                  <div className="bg-primary text-white rounded-circle p-3 me-3">
                    <i className="fas fa-home fs-4"></i>
                  </div>
                  <h2 className="h3 text-primary mb-0">Sobre Cañada al Lago</h2>
                </div>

                <p className="fs-5 text-justify">
                  <strong>Cañada al Lago</strong> es un complejo turístico único
                  formado por casas y cabañas hogareñas ubicado en la pintoresca
                  localidad de
                  <strong> Villa Parque Siquiman</strong>, con vistas
                  privilegiadas al
                  <strong> Lago San Roque</strong> en el corazón del{" "}
                  <strong>Valle de Punilla</strong>.
                </p>

                <div className="bg-primary bg-opacity-10 p-3 rounded mb-3">
                  <h3 className="h5 text-primary mb-2">
                    📍 Ubicación Estratégica
                  </h3>
                  <p className="mb-0">Llegás por la Ruta 38, ubicado a solo:</p>
                  <ul className="list-unstyled mt-2">
                    <li className="mb-1">
                      🚗 <strong>10 km</strong> de Carlos Paz
                    </li>
                    <li className="mb-1">
                      🚗 <strong>12 km</strong> de Tanti
                    </li>
                    <li className="mb-1">
                      🚗 <strong>15 km</strong> de Cosquín
                    </li>
                  </ul>
                </div>

                <p className="fs-5 text-justify">
                  Este valle es el más elegido por los turistas que visitan las
                  <strong> Sierras de Córdoba</strong>, y nuestro complejo es el
                  punto de partida perfecto para explorar todas las maravillas
                  de la región.
                </p>
              </div>
            </div>
          </div>

          {/* Right Column */}
          <div className="col-lg-6 mb-4">
            <div className="card border-0 shadow-sm h-100">
              <div className="card-body p-4">
                <div className="d-flex align-items-center mb-3">
                  <div className="bg-success text-white rounded-circle p-3 me-3">
                    <i className="fas fa-tree fs-4"></i>
                  </div>
                  <h2 className="h3 text-success mb-0">Experiencias Únicas</h2>
                </div>

                <div className="mb-4">
                  <h3 className="h5 text-success mb-3">
                    🏞 Actividades en la Naturaleza
                  </h3>
                  <div className="row">
                    <div className="col-6">
                      <ul className="list-unstyled">
                        <li className="mb-2">🚴‍♀️ Mountain bike</li>
                        <li className="mb-2">🐎 Cabalgatas</li>
                        <li className="mb-2">🥾 Trekking</li>
                        <li className="mb-2">🏖️ Día de playa</li>
                      </ul>
                    </div>
                    <div className="col-6">
                      <ul className="list-unstyled">
                        <li className="mb-2">🚤 Deportes náuticos</li>
                        <li className="mb-2">🌅 Atardeceres únicos</li>
                        <li className="mb-2">📸 Paisajes increíbles</li>
                        <li className="mb-2">💧 Río Las Mojarras</li>
                      </ul>
                    </div>
                  </div>
                </div>

                <div className="bg-success bg-opacity-10 p-3 rounded mb-3">
                  <h3 className="h5 text-success mb-2">🏖️ Parador del Lago</h3>
                  <p className="mb-0">
                    A pocos pasos, podés disfrutar del parador sobre el Lago San
                    Roque, donde ofrecen deliciosos licuados de fruta y alquiler
                    de
                    <strong> motos de agua y lanchas</strong>.
                  </p>
                </div>

                <div>
                  <h3 className="h5 text-success mb-2">
                    🏙️ Cercanía a Atracciones
                  </h3>
                  <p className="mb-0">
                    La proximidad con <strong>Carlos Paz</strong> te permite
                    disfrutar de teatros, restaurantes y casinos. También tenés
                    cerca
                    <strong>
                      {" "}
                      Mayu Sumaj, Icho Cruz, La Falda, Cabalango
                    </strong>{" "}
                    y muchas localidades más para explorar el Valle de Punilla.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom CTA */}
        <div className="row mt-4">
          <div className="col-lg-12">
            <div className="card border-0 bg-primary text-white">
              <div className="card-body p-4 text-center">
                <h3 className="h2 mb-3">
                  ✨ Tu Escape Perfecto en las Sierras
                </h3>
                <p className="fs-5 mb-0">
                  En <strong>Cañada al Lago</strong> te invitamos a desconectar
                  de la rutina y reconectar con la naturaleza, creando recuerdos
                  inolvidables en un entorno de paz y belleza natural.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default About;

const Activities = () => {
  return (
    <section id="actividades" className="py-5">
      <div className="container">
        <div className="row text-center mb-4">
          <div className="col-lg-12">
            <h1 className="mb-3">Actividades y recreación</h1>
            <p>
              La cercanía con Carlos Paz te permite disfrutar todas sus
              opciones: visitar sus teatros, restaurantes, casinos, etc.
              También, a muy pocos minutos, tendrás otras localidades como
              Cosquín, La Falda, Tanti, Cabalango, entre tantas, que te permiten
              conocer más y disfrutar de las bondades del Valle de Punilla.
            </p>
          </div>
        </div>
        <div className="row">
          <div className="col-md-4 mb-4">
            <div className="card h-100">
              <div className="card-body text-center">
                <i className="fa fa-users fa-3x mb-3"></i>
                <h3 className="card-title">En las cabañas</h3>
                <ul className="list-unstyled">
                  <li>
                    <em>
                      Cada cabaña cuenta con distinto equipamiento para que
                      puedas elegir lo que más te guste.
                    </em>
                  </li>
                </ul>
              </div>
            </div>
          </div>
          <div className="col-md-4 mb-4">
            <div className="card h-100">
              <div className="card-body text-center">
                <i className="fa fa-cutlery fa-3x mb-3"></i>
                <h3 className="card-title">En la Villa</h3>
                <ul className="list-unstyled">
                  <li>
                    <em>Trekking, Mountain Bike y Cabalgatas</em>
                  </li>
                  <li>
                    <em>Parques de diversiones y Kartings</em>
                  </li>
                  <li>
                    <em>Playas y balnearios</em>
                  </li>
                  <li>
                    <em>Pesca y deportes náuticos</em>
                  </li>
                  <li>
                    <em>Opciones gastronómicas</em>
                  </li>
                </ul>
              </div>
            </div>
          </div>
          <div className="col-md-4 mb-4">
            <div className="card h-100">
              <div className="card-body text-center">
                <i className="fa fa-users fa-3x mb-3"></i>
                <h3 className="card-title">En Carlos Paz</h3>
                <ul className="list-unstyled">
                  <li>
                    <em>Teatros y espectáculos</em>
                  </li>
                  <li>
                    <em>Bares, boliches y restaurantes</em>
                  </li>
                  <li>
                    <em>Eventos culturales</em>
                  </li>
                  <li>
                    <em>Playas y paradores</em>
                  </li>
                  <li>
                    <em>Actividades turísticas</em>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Activities;

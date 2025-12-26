const Header = () => {
  return (
    <header
      style={{
        backgroundImage: "url('src/assets/img/bgTop2.jpg')",
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
        height: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        textAlign: "center",
      }}
    >
      {/* <div className="intro-content">
        <img
          src="/src/assets/img/profile@2x.png"
          className="img-fluid"
          alt="LaDocTaProp"
          style={{
            maxWidth: "300px",
            height: "auto",
          }}
        />
      </div> */}
    </header>
  );
};

export default Header;

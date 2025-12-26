import Header from "../components/components/Header";
import About from "../components/components/About";
import CabanasList from "../components/components/cabanas/CabanasList";
import Activities from "../components/components/Activities";
import Contact from "../components/components/Contact";
import Testimonials from "../components/components/Testimonials";
import DynamicGallery from "../components/components/DynamicGallery";

const HomePage = () => {
  return (
    <>
      <Header />
      <About />
      <CabanasList />
      <DynamicGallery />
      <Activities />
      <Contact />
      <Testimonials />
    </>
  );
};

export default HomePage;

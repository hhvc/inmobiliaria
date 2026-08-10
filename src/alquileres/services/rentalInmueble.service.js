import { getInmueblesByInmobiliaria } from "../../inmueble/services/inmueble.service";

export const getAllInmueblesForRental = async (inmobiliariaId) => {
  if (!inmobiliariaId) return [];
  const items = [];
  let lastDoc = null;
  let pages = 0;
  do {
    const result = await getInmueblesByInmobiliaria(inmobiliariaId, {
      pageSize: 200,
      lastDoc,
    });
    items.push(...(result?.data || []));
    lastDoc = result?.lastDoc || null;
    pages += 1;
  } while (lastDoc && pages < 20);
  return items.filter((item) => item.deleted !== true);
};

export const getRentalInmuebleAddress = (inmueble = {}) => [
  inmueble.direccion?.calle || inmueble.calle,
  inmueble.direccion?.numero || inmueble.numero,
  inmueble.direccion?.barrio || inmueble.barrio,
  inmueble.direccion?.ciudad || inmueble.ciudad,
].filter(Boolean).join(" · ");

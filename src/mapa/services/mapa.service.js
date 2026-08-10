import { getPublicInmuebles } from "../../inmueble/services/inmueble.service";

export const getAllPublicInmueblesForMap = async ({
  maxPages = 10,
  pageSize = 200,
} = {}) => {
  const items = [];
  let lastDoc = null;
  let page = 0;

  do {
    const result = await getPublicInmuebles({ pageSize, lastDoc });
    items.push(...(result?.data || []));
    lastDoc = result?.lastDoc || null;
    page += 1;
  } while (lastDoc && page < maxPages);

  return items;
};

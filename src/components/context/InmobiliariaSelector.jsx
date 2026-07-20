import { useEffect, useMemo, useState } from "react";
import { doc, getDoc, serverTimestamp, updateDoc } from "firebase/firestore";

import { db } from "../../firebase/config";
import { useAuth } from "../../context/auth/useAuth";

const ACTIVE_INMOBILIARIA_EVENT = "onoprop:activeInmobiliariaChanged";

const normalizeInmobiliaria = (docSnap) => {
  if (!docSnap?.exists?.()) return null;

  const data = docSnap.data();

  return {
    id: docSnap.id,
    nombre: data.nombre || data.razonSocial || docSnap.id,
    slug: data.slug || "",
    activa: data.activa !== false,
  };
};

const getInitialActiveId = (user) => {
  const inmobiliarias = Array.isArray(user?.inmobiliarias)
    ? user.inmobiliarias
    : [];

  if (user?.activeInmobiliariaId && inmobiliarias.includes(user.activeInmobiliariaId)) {
    return user.activeInmobiliariaId;
  }

  const stored =
    localStorage.getItem("activeInmobiliariaId") ||
    localStorage.getItem("onoprop.activeInmobiliariaId") ||
    "";

  if (stored && inmobiliarias.includes(stored)) {
    return stored;
  }

  return inmobiliarias[0] || "";
};

const InmobiliariaSelector = () => {
  const { user } = useAuth();

  const userInmobiliarias = useMemo(() => {
    return Array.isArray(user?.inmobiliarias) ? user.inmobiliarias : [];
  }, [user?.inmobiliarias]);

  const [activeId, setActiveId] = useState(() => getInitialActiveId(user));
  const [inmobiliarias, setInmobiliarias] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setActiveId(getInitialActiveId(user));
  }, [user]);

  useEffect(() => {
    let mounted = true;

    const fetchInmobiliarias = async () => {
      if (userInmobiliarias.length === 0) {
        setInmobiliarias([]);
        return;
      }

      try {
        setLoading(true);

        const docs = await Promise.all(
          userInmobiliarias.map(async (inmobiliariaId) => {
            const ref = doc(db, "inmobiliarias", inmobiliariaId);
            const snap = await getDoc(ref);

            return normalizeInmobiliaria(snap);
          }),
        );

        if (!mounted) return;

        const data = docs
          .filter(Boolean)
          .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));

        setInmobiliarias(data);
      } catch (error) {
        console.error("Error cargando inmobiliarias del selector:", error);
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    fetchInmobiliarias();

    return () => {
      mounted = false;
    };
  }, [userInmobiliarias]);

  const handleChange = async (e) => {
    const nextId = e.target.value;

    if (!nextId || nextId === activeId) return;

    setActiveId(nextId);
    setSaving(true);

    localStorage.setItem("activeInmobiliariaId", nextId);
    localStorage.setItem("onoprop.activeInmobiliariaId", nextId);

    window.dispatchEvent(
      new CustomEvent(ACTIVE_INMOBILIARIA_EVENT, {
        detail: {
          inmobiliariaId: nextId,
        },
      }),
    );

    try {
      if (user?.uid) {
        await updateDoc(doc(db, "users", user.uid), {
          activeInmobiliariaId: nextId,
          updatedAt: serverTimestamp(),
        });
      }
    } catch (error) {
      console.warn(
        "No se pudo persistir activeInmobiliariaId en Firestore. Se mantiene el cambio local.",
        error,
      );
    } finally {
      setSaving(false);
    }
  };

  if (!user || userInmobiliarias.length <= 1) {
    return null;
  }

  return (
    <div className="d-flex align-items-center gap-2">
      <span className="text-white-50 small d-none d-xl-inline">
        Inmobiliaria
      </span>

      <select
        className="form-select form-select-sm"
        value={activeId}
        onChange={handleChange}
        disabled={loading || saving}
        style={{
          maxWidth: 240,
          minWidth: 190,
        }}
        aria-label="Seleccionar inmobiliaria activa"
      >
        {userInmobiliarias.map((inmobiliariaId) => {
          const inmobiliaria = inmobiliarias.find(
            (item) => item.id === inmobiliariaId,
          );

          return (
            <option key={inmobiliariaId} value={inmobiliariaId}>
              {inmobiliaria?.nombre || inmobiliariaId}
            </option>
          );
        })}
      </select>
    </div>
  );
};

export default InmobiliariaSelector;
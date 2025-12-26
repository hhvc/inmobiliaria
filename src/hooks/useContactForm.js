import { useState } from "react";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../firebase/config";

export const useContactForm = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  const submitContactForm = async (formData) => {
    setLoading(true);
    setError(null);
    setSuccess(false);

    try {
      // Guardar en Firestore
      const docRef = await addDoc(collection(db, "contactMessages"), {
        ...formData,
        status: "nuevo",
        createdAt: serverTimestamp(),
        read: false,
      });

      console.log("Mensaje guardado con ID:", docRef.id);

      // Opcional: Aquí podrías llamar a tu Cloud Function para enviar el email
      // await sendEmailNotification(formData);

      setSuccess(true);
      return true;
    } catch (err) {
      console.error("Error guardando mensaje:", err);
      setError("Error al enviar el mensaje. Por favor, intente nuevamente.");
      return false;
    } finally {
      setLoading(false);
    }
  };

  return {
    loading,
    error,
    success,
    submitContactForm,
  };
};

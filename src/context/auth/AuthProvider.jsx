import { useEffect, useState, useRef, useCallback } from "react";
import {
  signInWithPopup,
  signOut,
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  updateProfile,
  signInWithPhoneNumber,
  onAuthStateChanged,
  RecaptchaVerifier,
} from "firebase/auth";
import { auth, db } from "../../firebase/config";
import { AuthContext } from "./AuthContext";
import { doc, setDoc, getDoc, updateDoc } from "firebase/firestore";

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [confirmationResult, setConfirmationResult] = useState(null);
  const [recaptchaReady, setRecaptchaReady] = useState(false);

  const recaptchaVerifierRef = useRef(null);

  // Función de error simple - memoizada correctamente
  const handleError = useCallback((error, defaultMessage) => {
    console.error("❌ Error:", error);
    if (error.code) {
      switch (error.code) {
        case "auth/network-request-failed":
          return "Error de red. Verifica tu conexión.";
        case "auth/email-already-in-use":
          return "El email ya está registrado.";
        case "auth/wrong-password":
        case "auth/user-not-found":
          return "Credenciales inválidas.";
        case "auth/invalid-email":
          return "Email inválido.";
        case "auth/too-many-requests":
          return "Demasiados intentos. Espera un momento.";
        case "auth/popup-closed-by-user":
          return "Ventana cerrada.";
        default:
          return defaultMessage;
      }
    }
    return error.message || defaultMessage;
  }, []);

  // Función para crear/actualizar usuario en Firestore - memoizada
  const createUserInFirestore = useCallback(
    async (userData, additionalData = {}) => {
      try {
        const userRef = doc(db, "users", userData.uid);
        const userSnap = await getDoc(userRef);

        if (!userSnap.exists()) {
          await setDoc(userRef, {
            uid: userData.uid,
            email: userData.email,
            displayName:
              userData.displayName || additionalData.displayName || "",
            photoURL: userData.photoURL || "",
            role: "usuario",
            status: "activo",
            createdAt: new Date(),
            lastLogin: new Date(),
            ...additionalData,
          });
          console.log("✅ Usuario creado en Firestore con rol 'usuario'");
        } else {
          await updateDoc(userRef, {
            lastLogin: new Date(),
          });
        }
      } catch (error) {
        console.error("❌ Error en createUserInFirestore:", error);
        throw error;
      }
    },
    []
  );

  // Función para obtener datos completos del usuario - memoizada CORRECTAMENTE
  const getUserWithRole = useCallback(
    async (firebaseUser) => {
      if (!firebaseUser) return null;

      try {
        const userRef = doc(db, "users", firebaseUser.uid);
        const userSnap = await getDoc(userRef);

        if (userSnap.exists()) {
          const userData = userSnap.data();
          return {
            ...firebaseUser,
            role: userData.role || "usuario",
            status: userData.status || "activo",
            userData: userData,
          };
        } else {
          await createUserInFirestore(firebaseUser);
          return {
            ...firebaseUser,
            role: "usuario",
            status: "activo",
            userData: {},
          };
        }
      } catch (error) {
        console.error("❌ Error obteniendo datos del usuario:", error);
        return {
          ...firebaseUser,
          role: "usuario",
          status: "activo",
          userData: {},
        };
      }
    },
    [createUserInFirestore]
  );

  // Funciones de autenticación - memoizadas correctamente
  const signInWithGoogle = useCallback(async () => {
    const provider = new GoogleAuthProvider();
    try {
      const result = await signInWithPopup(auth, provider);
      const userWithRole = await getUserWithRole(result.user);
      setUser(userWithRole);
      return userWithRole;
    } catch (error) {
      throw new Error(
        handleError(error, "Error al iniciar sesión con Google.")
      );
    }
  }, [getUserWithRole, handleError]);

  const signUpWithEmail = useCallback(
    async (email, password, displayName) => {
      try {
        const userCredential = await createUserWithEmailAndPassword(
          auth,
          email,
          password
        );

        if (displayName) {
          await updateProfile(userCredential.user, { displayName });
        }

        const userWithRole = await getUserWithRole(userCredential.user);
        setUser(userWithRole);
        return userWithRole;
      } catch (error) {
        throw new Error(handleError(error, "Error al registrarse."));
      }
    },
    [getUserWithRole, handleError]
  );

  const signInWithEmail = useCallback(
    async (email, password) => {
      try {
        const userCredential = await signInWithEmailAndPassword(
          auth,
          email,
          password
        );
        const userWithRole = await getUserWithRole(userCredential.user);
        setUser(userWithRole);
        return userWithRole;
      } catch (error) {
        throw new Error(handleError(error, "Error al iniciar sesión."));
      }
    },
    [getUserWithRole, handleError]
  );

  const resetPassword = useCallback(
    async (email) => {
      try {
        await sendPasswordResetEmail(auth, email);
        return true;
      } catch (error) {
        throw new Error(
          handleError(error, "Error al enviar email de recuperación.")
        );
      }
    },
    [handleError]
  );

  const setupPhoneAuth = useCallback(
    async (elementId) => {
      try {
        if (!auth) throw new Error("Firebase auth no está disponible");

        console.log("🔄 Inicializando RecaptchaVerifier...");

        if (recaptchaVerifierRef.current) {
          try {
            recaptchaVerifierRef.current.clear();
          } catch (e) {
            console.warn("Error al limpiar verificador existente:", e);
          }
          recaptchaVerifierRef.current = null;
        }

        const waitForRecaptchaEnterprise = () => {
          return new Promise((resolve, reject) => {
            let attempts = 0;
            const maxAttempts = 50;
            const checkInterval = setInterval(() => {
              if (window.grecaptcha && window.grecaptcha.enterprise) {
                clearInterval(checkInterval);
                resolve();
              } else {
                attempts++;
                if (attempts >= maxAttempts) {
                  clearInterval(checkInterval);
                  reject(
                    new Error("Timeout: reCAPTCHA Enterprise no se cargó.")
                  );
                }
              }
            }, 100);
          });
        };

        await waitForRecaptchaEnterprise();

        const verifier = new RecaptchaVerifier(auth, elementId, {
          size: "invisible",
          callback: () => {
            setRecaptchaReady(true);
          },
          "expired-callback": () => {
            recaptchaVerifierRef.current?.clear();
            setRecaptchaReady(false);
          },
          "error-callback": () => {
            setRecaptchaReady(false);
          },
        });

        recaptchaVerifierRef.current = verifier;
        await verifier.render();
        return verifier;
      } catch (error) {
        console.error("❌ Error en setupPhoneAuth:", error);
        setRecaptchaReady(false);
        throw new Error(
          handleError(
            error,
            "Error al configurar la verificación de seguridad."
          )
        );
      }
    },
    [handleError]
  );

  const sendSMSCode = useCallback(
    async (phoneNumber) => {
      try {
        const cleanedPhone = phoneNumber.replace(/\s+/g, "");
        if (!cleanedPhone.startsWith("+")) {
          throw new Error("El número debe incluir el código de país");
        }

        const currentVerifier = recaptchaVerifierRef.current;
        if (!currentVerifier || !recaptchaReady) {
          throw new Error(
            "Verificación de seguridad no lista. Recarga la página."
          );
        }

        const result = await signInWithPhoneNumber(
          auth,
          cleanedPhone,
          currentVerifier
        );
        setConfirmationResult(result);
        return true;
      } catch (error) {
        throw new Error(handleError(error, "Error al enviar el código SMS."));
      }
    },
    [recaptchaReady, handleError]
  );

  // ✅ CORREGIDO: parámetro 'error' eliminado
  const cancelPhoneAuth = useCallback(() => {
    try {
      if (recaptchaVerifierRef.current) {
        recaptchaVerifierRef.current.clear();
      }
    } catch {
      console.warn("Error al limpiar recaptchaVerifierRef");
    }
    recaptchaVerifierRef.current = null;
    setRecaptchaReady(false);
    setConfirmationResult(null);
  }, []);

  const verifySMSCode = useCallback(
    async (code) => {
      try {
        if (!confirmationResult) {
          throw new Error("No hay una verificación de teléfono en curso.");
        }

        const result = await confirmationResult.confirm(code.trim());
        const userWithRole = await getUserWithRole(result.user);
        setUser(userWithRole);
        setConfirmationResult(null);
        cancelPhoneAuth();
        return userWithRole;
      } catch (error) {
        throw new Error(handleError(error, "Error al verificar el código."));
      }
    },
    [confirmationResult, getUserWithRole, cancelPhoneAuth, handleError]
  );

  const logout = useCallback(async () => {
    cancelPhoneAuth();
    await signOut(auth);
  }, [cancelPhoneAuth]);

  const updateUserRole = useCallback(
    async (userId, newRole, newStatus = "activo") => {
      try {
        const userRef = doc(db, "users", userId);
        await updateDoc(userRef, {
          role: newRole,
          status: newStatus,
          updatedAt: new Date(),
        });

        if (user && user.uid === userId) {
          const updatedUser = await getUserWithRole(user);
          setUser(updatedUser);
        }
        return true;
      } catch (error) {
        throw new Error("Error al actualizar el rol del usuario.", error);
      }
    },
    [user, getUserWithRole]
  );

  const hasRole = useCallback(
    (requiredRole) => {
      if (!user) return false;
      if (user.role === "admin") return true;

      const rolesHierarchy = { usuario: 1, colaborador: 2, admin: 3 };
      return rolesHierarchy[user.role] >= rolesHierarchy[requiredRole];
    },
    [user]
  );

  const isActive = useCallback(() => {
    return user && user.status === "activo";
  }, [user]);

  // useEffect principal - CON DEPENDENCIAS CORRECTAS
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        const userWithRole = await getUserWithRole(currentUser);
        setUser(userWithRole);
      } else {
        setUser(null);
      }
      setLoading(false);
    });
    return unsubscribe;
  }, [getUserWithRole]);

  // useEffect de limpieza
  useEffect(() => {
    return () => {
      cancelPhoneAuth();
    };
  }, [cancelPhoneAuth]);

  const value = {
    user,
    signInWithGoogle,
    signUpWithEmail,
    signInWithEmail,
    resetPassword,
    setupPhoneAuth,
    sendSMSCode,
    verifySMSCode,
    cancelPhoneAuth,
    logout,
    loading,
    confirmationResult,
    recaptchaReady,
    updateUserRole,
    hasRole,
    isActive,
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
};

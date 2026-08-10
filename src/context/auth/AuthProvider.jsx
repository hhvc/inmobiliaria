import { useEffect, useState, useRef, useCallback } from "react";
import {
  signInWithPopup,
  signOut,
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  reload,
  sendEmailVerification,
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
import {
  validateActiveInmobiliariaId,
  clearActiveInmobiliariaId,
} from "../../inmobiliaria/helpers/activeInmobiliaria.helper";
import {
  getPrimaryAuthProviderId,
  isEmailVerificationPending,
  isFreshPasswordAccount,
} from "./auth.helpers";

const buildUserWithRole = (firebaseUser, userData = {}) => {
  const role = userData.role || "usuario";
  const roles = Array.isArray(userData.roles) ? userData.roles : [role];
  const inmobiliarias = Array.isArray(userData.inmobiliarias)
    ? userData.inmobiliarias
    : [];
  return {
    ...firebaseUser,
    role,
    status: userData.status || "activo",
    roles,
    primaryRole: userData.primaryRole || role,
    inmobiliarias,
    inmobiliariaId: inmobiliarias.length === 1 ? inmobiliarias[0] : null,
    emailVerified: firebaseUser.emailVerified === true,
    emailVerificationRequired: userData.emailVerificationRequired === true,
    emailVerificationPending: isEmailVerificationPending(firebaseUser, userData),
    authProvider: userData.authProvider || getPrimaryAuthProviderId(firebaseUser),
    userData,
  };
};

const getVerificationContinueUrl = () => {
  const siteUrl = import.meta.env.VITE_PUBLIC_SITE_URL || "https://onoprop.com";
  return `${siteUrl.replace(/\/$/, "")}/verificar-email?comprobar=1`;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [confirmationResult, setConfirmationResult] = useState(null);
  const [recaptchaReady, setRecaptchaReady] = useState(false);
  const [activeInmobiliariaId, setActiveInmobiliariaId] = useState(null);

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
        case "auth/invalid-phone-number":
          return "El número de celular no es válido.";
        case "auth/invalid-verification-code":
          return "El código ingresado no es correcto.";
        case "auth/code-expired":
          return "El código venció. Solicitá uno nuevo.";
        case "auth/operation-not-allowed":
          return "Este método de acceso todavía no está habilitado.";
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
        if (!userData?.uid) {
          throw new Error("UID de usuario requerido");
        }

        const userRef = doc(db, "users", userData.uid);
        const userSnap = await getDoc(userRef);

        const now = new Date();

        // Normalización segura
        const role = additionalData.role || "usuario";
        const roles = Array.isArray(additionalData.roles)
          ? additionalData.roles
          : [role];

        const inmobiliarias = Array.isArray(additionalData.inmobiliarias)
          ? additionalData.inmobiliarias
          : [];

        if (!userSnap.exists()) {
          const authProvider = additionalData.authProvider ||
            getPrimaryAuthProviderId(userData);
          const emailVerificationRequired =
            additionalData.emailVerificationRequired === true;
          const createdUserData = {
            /* =========================
             IDENTIDAD
             ========================= */

            uid: userData.uid,
            email: userData.email || null,
            displayName:
              userData.displayName || additionalData.displayName || "",
            photoURL: userData.photoURL || "",
            authProvider,
            emailVerificationRequired,
            emailVerificationRequestedAt: emailVerificationRequired ? now : null,

            /* =========================
             ROLES (retro + nuevo)
             ========================= */

            role, // legacy / UX
            roles, // permisos reales
            primaryRole: role,

            /* =========================
             INMOBILIARIAS
             ========================= */

            inmobiliarias,

            /* =========================
             METADATA
             ========================= */

            status: "activo",
            createdAt: now,
            lastLogin: now,
          };
          await setDoc(userRef, createdUserData);

          console.log(
            "✅ Usuario creado en Firestore (roles + inmobiliarias normalizadas)",
          );
          return createdUserData;
        } else {
          const existingData = userSnap.data() || {};
          if (
            additionalData.emailVerificationRequired === true &&
            existingData.emailVerificationRequired !== true
          ) {
            const verificationData = {
              emailVerificationRequired: true,
              emailVerificationRequestedAt: now,
              authProvider: "password",
            };
            await updateDoc(userRef, verificationData);
            return { ...existingData, ...verificationData };
          }
          if (!isEmailVerificationPending(userData, existingData)) {
            await updateDoc(userRef, { lastLogin: now });
          }
          return existingData;
        }
      } catch (error) {
        console.error("❌ Error en createUserInFirestore:", error);
        throw error;
      }
    },
    [],
  );

  // Función para obtener datos completos del usuario - memoizada
  const getUserWithRole = useCallback(
    async (firebaseUser) => {
      if (!firebaseUser?.uid) return null;

      try {
        const userRef = doc(db, "users", firebaseUser.uid);
        const userSnap = await getDoc(userRef);

        // =========================
        // Usuario existe en Firestore
        // =========================
        if (userSnap.exists()) {
          const userData = userSnap.data();

          return buildUserWithRole(firebaseUser, userData);
        }

        // =========================
        // Usuario NO existe → crear
        // =========================
        const createdData = await createUserInFirestore(firebaseUser, {
          authProvider: getPrimaryAuthProviderId(firebaseUser),
          emailVerificationRequired: isFreshPasswordAccount(firebaseUser),
        });
        return buildUserWithRole(firebaseUser, createdData);
      } catch (error) {
        console.error("❌ Error obteniendo datos del usuario:", error);

        // =========================
        // Fallback ultra seguro
        // =========================
        const fallbackData = {
          emailVerificationRequired: isFreshPasswordAccount(firebaseUser),
          authProvider: getPrimaryAuthProviderId(firebaseUser),
        };
        return buildUserWithRole(firebaseUser, fallbackData);
      }
    },
    [createUserInFirestore],
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
        handleError(error, "Error al iniciar sesión con Google."),
      );
    }
  }, [getUserWithRole, handleError]);

  const signUpWithEmail = useCallback(
    async (email, password, displayName) => {
      try {
        const userCredential = await createUserWithEmailAndPassword(
          auth,
          email,
          password,
        );

        if (displayName) {
          await updateProfile(userCredential.user, { displayName });
        }

        const createdData = await createUserInFirestore(userCredential.user, {
          displayName,
          authProvider: "password",
          emailVerificationRequired: true,
        });
        auth.languageCode = "es";
        let verificationEmailSent = true;
        try {
          await sendEmailVerification(userCredential.user, {
            url: getVerificationContinueUrl(),
          });
        } catch (verificationError) {
          verificationEmailSent = false;
          console.error("No se pudo enviar el email de verificación:", verificationError);
        }
        const userWithRole = {
          ...buildUserWithRole(userCredential.user, createdData),
          verificationEmailSent,
        };
        setUser(userWithRole);
        return userWithRole;
      } catch (error) {
        throw new Error(handleError(error, "Error al registrarse."));
      }
    },
    [createUserInFirestore, handleError],
  );

  const resendVerificationEmail = useCallback(async () => {
    const currentUser = auth.currentUser;
    if (!currentUser?.email) {
      throw new Error("No hay una cuenta de email activa.");
    }
    try {
      auth.languageCode = "es";
      await sendEmailVerification(currentUser, {
        url: getVerificationContinueUrl(),
      });
      return true;
    } catch (error) {
      throw new Error(
        handleError(error, "No se pudo reenviar el email de verificación."),
      );
    }
  }, [handleError]);

  const refreshEmailVerification = useCallback(async () => {
    const currentUser = auth.currentUser;
    if (!currentUser) throw new Error("La sesión ya no está activa.");
    try {
      await reload(currentUser);
      const refreshedUser = auth.currentUser;
      if (refreshedUser?.emailVerified) {
        await refreshedUser.getIdToken(true);
      }
      const userWithRole = await getUserWithRole(refreshedUser);
      setUser(userWithRole);
      return userWithRole.emailVerificationPending !== true;
    } catch (error) {
      throw new Error(
        handleError(error, "No se pudo comprobar la verificación."),
      );
    }
  }, [getUserWithRole, handleError]);

  const signInWithEmail = useCallback(
    async (email, password) => {
      try {
        const userCredential = await signInWithEmailAndPassword(
          auth,
          email,
          password,
        );
        const userWithRole = await getUserWithRole(userCredential.user);
        setUser(userWithRole);
        return userWithRole;
      } catch (error) {
        throw new Error(handleError(error, "Error al iniciar sesión."));
      }
    },
    [getUserWithRole, handleError],
  );

  const resetPassword = useCallback(
    async (email) => {
      try {
        await sendPasswordResetEmail(auth, email);
        return true;
      } catch (error) {
        throw new Error(
          handleError(error, "Error al enviar email de recuperación."),
        );
      }
    },
    [handleError],
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

        auth.languageCode = "es";
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
        setRecaptchaReady(true);
        return verifier;
      } catch (error) {
        console.error("❌ Error en setupPhoneAuth:", error);
        setRecaptchaReady(false);
        throw new Error(
          handleError(
            error,
            "Error al configurar la verificación de seguridad.",
          ),
        );
      }
    },
    [handleError],
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
            "Verificación de seguridad no lista. Recarga la página.",
          );
        }

        const result = await signInWithPhoneNumber(
          auth,
          cleanedPhone,
          currentVerifier,
        );
        setConfirmationResult(result);
        return true;
      } catch (error) {
        throw new Error(handleError(error, "Error al enviar el código SMS."));
      }
    },
    [recaptchaReady, handleError],
  );

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
    [confirmationResult, getUserWithRole, cancelPhoneAuth, handleError],
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
          role: newRole, // compatibilidad legacy
          primaryRole: newRole, // nuevo esquema
          roles: [newRole], // mínimo seguro
          status: newStatus,
          updatedAt: new Date(),
        });

        if (user && user.uid === userId) {
          const updatedUser = await getUserWithRole(user);
          setUser(updatedUser);
        }

        return true;
      } catch (error) {
        console.error("❌ Error actualizando rol:", error);
        throw new Error("Error al actualizar el rol del usuario.");
      }
    },
    [user, getUserWithRole],
  );

  const hasRole = useCallback(
    (requiredRole) => {
      if (!user) return false;

      // Soporte nuevo esquema
      if (Array.isArray(user.roles)) {
        return user.roles.includes(requiredRole);
      }

      // Fallback legacy
      if (user.role === "admin") return true;

      const rolesHierarchy = {
        usuario: 1,
        colaborador: 2,
        admin: 3,
      };

      return rolesHierarchy[user.role] >= rolesHierarchy[requiredRole];
    },
    [user],
  );

  const isActive = useCallback(() => {
    return user && user.status === "activo";
  }, [user]);

  // useEffect principal
  useEffect(() => {
    let isMounted = true;

    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (!isMounted) return;

      if (currentUser) {
        const userWithRole = await getUserWithRole(currentUser);
        if (isMounted) setUser(userWithRole);
      } else {
        setUser(null);
      }

      if (isMounted) setLoading(false);
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, [getUserWithRole]);

  // useEffect de limpieza
  useEffect(() => {
    return () => {
      cancelPhoneAuth();
    };
  }, [cancelPhoneAuth]);

  const prevUserRef = useRef(null);

  useEffect(() => {
    // Evitar ejecuciones redundantes
    if (prevUserRef.current === user) return;
    prevUserRef.current = user;

    if (!user) {
      clearActiveInmobiliariaId();
      setActiveInmobiliariaId(null);
      return;
    }

    const validInmobiliariaId = validateActiveInmobiliariaId(user);

    setActiveInmobiliariaId(validInmobiliariaId);
  }, [user, setActiveInmobiliariaId]);

  const setActiveInmobiliaria = useCallback(
    (inmobiliariaId) => {
      if (!user) return;

      if (!user.inmobiliarias.includes(inmobiliariaId)) {
        console.warn(
          "⛔ Intento de setear inmobiliaria no permitida",
          inmobiliariaId,
        );
        return;
      }

      setActiveInmobiliariaId(inmobiliariaId);
    },
    [user],
  );

  const value = {
    user,

    // 🔑 Inmobiliaria activa
    activeInmobiliariaId,
    setActiveInmobiliaria,

    signInWithGoogle,
    signUpWithEmail,
    signInWithEmail,
    resendVerificationEmail,
    refreshEmailVerification,
    resetPassword,
    setupPhoneAuth,
    sendSMSCode,
    verifySMSCode,
    cancelPhoneAuth,
    logout,
    loading,
    confirmationResult,
    recaptchaReady,
    emailVerificationPending: user?.emailVerificationPending === true,
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

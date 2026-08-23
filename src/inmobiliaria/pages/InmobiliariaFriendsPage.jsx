import { useCallback, useEffect, useMemo, useState } from "react";
import { doc, getDoc } from "firebase/firestore";
import { useAuth } from "../../context/auth/useAuth";
import { db } from "../../firebase/config";
import {
  answerAgencyFriendInvitation, createAgencyFriendGroup, getAgencyFriendGroups,
  getAgencyFriendMemberships, getFriendGroupMembers, inviteAgencyToFriendGroup,
  removeAgencyFriendMember, getPublicAgenciesForNetwork,
} from "../services/agencyNetwork.service";

export default function InmobiliariaFriendsPage() {
  const { activeInmobiliariaId } = useAuth();
  const [agency, setAgency] = useState(null); const [agencies, setAgencies] = useState([]);
  const [groups, setGroups] = useState([]); const [memberships, setMemberships] = useState([]);
  const [membersByGroup, setMembersByGroup] = useState({}); const [groupName, setGroupName] = useState("");
  const [inviteSelections, setInviteSelections] = useState({}); const [loading, setLoading] = useState(true);
  const [error, setError] = useState(""); const [message, setMessage] = useState("");
  const pending = useMemo(() => memberships.filter((item) => item.status === "pending"), [memberships]);

  const load = useCallback(async () => {
    if (!activeInmobiliariaId) return; setLoading(true); setError("");
    try {
      const [agencySnap, allAgencies, nextGroups, nextMemberships] = await Promise.all([
        getDoc(doc(db, "inmobiliarias", activeInmobiliariaId)), getPublicAgenciesForNetwork(),
        getAgencyFriendGroups(activeInmobiliariaId), getAgencyFriendMemberships(activeInmobiliariaId),
      ]);
      const currentAgency = agencySnap.exists() ? { id: agencySnap.id, ...agencySnap.data() } : null;
      setAgency(currentAgency); setAgencies((allAgencies || []).filter((item) => item.id !== activeInmobiliariaId && item.activa !== false));
      setGroups(nextGroups); setMemberships(nextMemberships);
      const pairs = await Promise.all(nextGroups.map(async (group) => [group.id, await getFriendGroupMembers(group.id)]));
      setMembersByGroup(Object.fromEntries(pairs));
    } catch (err) { setError(err.message || "No se pudo cargar la red de amigas."); }
    finally { setLoading(false); }
  }, [activeInmobiliariaId]);
  useEffect(() => { load(); }, [load]);

  if (loading) return <main className="container py-5">Cargando red de inmobiliarias...</main>;
  return <main className="container py-4">
    <header className="mb-4"><p className="text-uppercase text-muted small mb-1">Red privada</p><h1 className="h3">Inmobiliarias amigas</h1><p className="text-muted">Las invitaciones deben ser aceptadas. Los grupos definen con quién puede compartirse cada inmueble.</p></header>
    {error && <div className="alert alert-danger">{error}</div>}{message && <div className="alert alert-success">{message}</div>}
    {pending.length > 0 && <section className="card border-warning mb-4"><div className="card-body"><h2 className="h5">Invitaciones pendientes</h2>{pending.map((item) => <div className="d-flex justify-content-between align-items-center border-top py-3" key={item.id}><div><strong>{item.groupName || "Grupo privado"}</strong><div className="small text-muted">Invita {item.ownerAgencyName || "otra inmobiliaria"}</div></div><div className="d-flex gap-2"><button className="btn btn-sm btn-success" onClick={async () => { await answerAgencyFriendInvitation(item.id, "accepted"); await load(); }}>Aceptar</button><button className="btn btn-sm btn-outline-danger" onClick={async () => { await answerAgencyFriendInvitation(item.id, "rejected"); await load(); }}>Rechazar</button></div></div>)}</div></section>}
    <form className="card border-0 shadow-sm mb-4" onSubmit={async (e) => { e.preventDefault(); try { await createAgencyFriendGroup({ agencyId: activeInmobiliariaId, agencyName: agency?.nombre, name: groupName }); setGroupName(""); setMessage("Grupo creado."); await load(); } catch (err) { setError(err.message); } }}><div className="card-body p-4"><h2 className="h5">Crear grupo</h2><div className="input-group"><input className="form-control" value={groupName} onChange={(e) => setGroupName(e.target.value)} placeholder="Ej.: Corredores de confianza" required /><button className="btn btn-primary">Crear</button></div></div></form>
    <div className="row g-4">{groups.map((group) => <section className="col-lg-6" key={group.id}><div className="card h-100 border-0 shadow-sm"><div className="card-body p-4"><div className="d-flex justify-content-between"><h2 className="h5">{group.name}</h2><span className="badge text-bg-light">{group.ownerAgencyId === activeInmobiliariaId ? "Administrás" : "Integrás"}</span></div>
      <ul className="list-group list-group-flush mb-3">{(membersByGroup[group.id] || []).filter((item) => item.status !== "rejected").map((member) => <li className="list-group-item px-0 d-flex justify-content-between" key={member.id}><span>{member.agencyName || member.agencyId}</span><span><span className={`badge ${member.status === "accepted" || member.status === "owner" ? "text-bg-success" : "text-bg-warning"}`}>{member.status === "owner" ? "Titular" : member.status === "accepted" ? "Aceptada" : "Pendiente"}</span>{group.ownerAgencyId === activeInmobiliariaId && member.status !== "owner" && <button className="btn btn-link btn-sm text-danger" onClick={async () => { await removeAgencyFriendMember(member.id); await load(); }}>Quitar</button>}</span></li>)}</ul>
      {group.ownerAgencyId === activeInmobiliariaId && <div className="input-group"><select className="form-select" value={inviteSelections[group.id] || ""} onChange={(e) => setInviteSelections({ ...inviteSelections, [group.id]: e.target.value })}><option value="">Elegir inmobiliaria...</option>{agencies.map((item) => <option value={item.id} key={item.id}>{item.nombre || item.razonSocial}</option>)}</select><button type="button" className="btn btn-outline-primary" onClick={async () => { const selected = agencies.find((item) => item.id === inviteSelections[group.id]); if (!selected) return; await inviteAgencyToFriendGroup({ group, agency: selected }); setMessage("Invitación enviada."); await load(); }}>Invitar</button></div>}
    </div></div></section>)}</div>
  </main>;
}

import {
  Bell,
  CalendarClock,
  CheckCircle2,
  Download,
  LogOut,
  Mail,
  MapPin,
  MessageCircle,
  Phone,
  Plus,
  Search,
  Video,
  XCircle,
} from 'lucide-react';
import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityType, clearSession, CrmLead, crmApi, CrmUser, CreateCrmLeadInput, getSessionUser, setSession } from './lib/api';

type Status = CrmLead['status'];

type LeadForm = Omit<CreateCrmLeadInput, 'revenue'> & {
  revenue: string;
};

const projects = ['Memory Connect', 'DocuEase', 'SmartDrive', 'Staff Beacon', 'School System'];
const statuses: Status[] = ['New', 'Contacted', 'Waiting', 'Demo Booked', 'Customer', 'Lost'];
const provinces = [
  'Eastern Cape',
  'Free State',
  'Gauteng',
  'KwaZulu-Natal',
  'Limpopo',
  'Mpumalanga',
  'Northern Cape',
  'North West',
  'Western Cape',
];

const emptyForm: LeadForm = {
  project: 'Memory Connect',
  funeralHome: '',
  province: 'Free State',
  town: '',
  owner: '',
  phone: '',
  whatsapp: '',
  email: '',
  website: '',
  facebook: '',
  source: 'Google Maps',
  status: 'New',
  revenue: '',
  followUpDate: '',
  demoDate: '',
  notes: '',
};

function formatTime(value: string) {
  return new Intl.DateTimeFormat('en-ZA', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }).format(
    new Date(value)
  );
}

function currency(value: number) {
  return new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR', maximumFractionDigits: 0 }).format(value);
}

function normalizePhone(value: string) {
  const digits = value.replace(/\D/g, '');
  if (digits.startsWith('0')) return `27${digits.slice(1)}`;
  return digits;
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return 'An unexpected error occurred';
}

function App() {
  const [user, setUser] = useState<CrmUser | null>(() => getSessionUser());
  const [leads, setLeads] = useState<CrmLead[]>([]);
  const [activeLeadId, setActiveLeadId] = useState('');
  const [form, setForm] = useState<LeadForm>(emptyForm);
  const [query, setQuery] = useState('');
  const [projectFilter, setProjectFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');
  const [activityNote, setActivityNote] = useState('');
  const [loading, setLoading] = useState(false);
  const [saveState, setSaveState] = useState<'saved' | 'saving'>('saved');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState<string | null>(null);
  const [loginLoading, setLoginLoading] = useState(false);

  const errorTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingPatches = useRef<Map<string, Partial<CreateCrmLeadInput>>>(new Map());
  const flushTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const activeLead = leads.find((lead) => lead.id === activeLeadId) ?? leads[0];

  function showError(message: string) {
    setError(message);
    if (errorTimer.current) clearTimeout(errorTimer.current);
    errorTimer.current = setTimeout(() => setError(null), 8000);
  }

  function showNotice(message: string) {
    setNotice(message);
    if (noticeTimer.current) clearTimeout(noticeTimer.current);
    noticeTimer.current = setTimeout(() => setNotice(null), 4000);
  }

  async function loadLeads() {
    setLoading(true);
    try {
      const data = await crmApi.listLeads();
      setLeads(data);
      setActiveLeadId((current) => (data.some((lead) => lead.id === current) ? current : data[0]?.id ?? ''));
    } catch (error) {
      if ((error as Error & { status?: number }).status === 401) {
        clearSession();
        setUser(null);
      } else {
        showError(`Failed to load leads: ${errorMessage(error)}`);
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (user) {
      loadLeads();
    }
    return () => {
      if (errorTimer.current) clearTimeout(errorTimer.current);
      if (noticeTimer.current) clearTimeout(noticeTimer.current);
      flushTimers.current.forEach((timer) => clearTimeout(timer));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const filteredLeads = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return leads.filter((lead) => {
      const matchesProject = projectFilter === 'All' || lead.project === projectFilter;
      const matchesStatus = statusFilter === 'All' || lead.status === statusFilter;
      const haystack = `${lead.funeralHome} ${lead.province} ${lead.town ?? ''} ${lead.owner ?? ''} ${lead.notes ?? ''}`.toLowerCase();
      return matchesProject && matchesStatus && (!needle || haystack.includes(needle));
    });
  }, [leads, projectFilter, query, statusFilter]);

  const report = useMemo(() => {
    const now = new Date();
    const month = now.getMonth();
    const year = now.getFullYear();
    const monthLeads = leads.filter((lead) => {
      const added = new Date(lead.dateAdded);
      return added.getMonth() === month && added.getFullYear() === year;
    });
    const monthActivities = leads.flatMap((lead) =>
      lead.activities.filter((activity) => {
        const date = new Date(activity.at);
        return date.getMonth() === month && date.getFullYear() === year;
      })
    );
    const sales = leads.filter((lead) => lead.status === 'Customer').length;
    return {
      prospects: monthLeads.length,
      emails: monthActivities.filter((activity) => activity.type === 'Email').length,
      whatsapps: monthActivities.filter((activity) => activity.type === 'WhatsApp').length,
      calls: monthActivities.filter((activity) => activity.type === 'Call').length,
      followUps: monthActivities.filter((activity) => activity.type === 'Follow-up').length,
      demos: monthActivities.filter((activity) => activity.type === 'Demo').length,
      sales,
      conversion: monthLeads.length ? (sales / monthLeads.length) * 100 : 0,
      revenue: leads.reduce((sum, lead) => sum + (lead.status === 'Customer' ? lead.revenue : 0), 0),
    };
  }, [leads]);

  const today = new Date().toISOString().slice(0, 10);
  const todayFollowUps = leads.filter((lead) => lead.followUpDate === today && lead.status !== 'Customer' && lead.status !== 'Lost');
  const todayDemos = leads.filter((lead) => lead.demoDate === today);
  const newLeads = leads.filter((lead) => lead.status === 'New');

  function markSavedIdle() {
    if (pendingPatches.current.size === 0 && flushTimers.current.size === 0) {
      setSaveState('saved');
    }
  }

  async function flushSave(id: string) {
    const patch = pendingPatches.current.get(id);
    if (!patch) return;
    pendingPatches.current.delete(id);
    flushTimers.current.delete(id);
    try {
      const saved = await crmApi.updateLead(id, patch);
      setLeads((prev) => prev.map((lead) => (lead.id === id ? saved : lead)));
    } catch (error) {
      showError(`Failed to save ${savedName(id, patch)}: ${errorMessage(error)}`);
      try {
        const fresh = await crmApi.getLead(id);
        setLeads((prev) => prev.map((lead) => (lead.id === id ? fresh : lead)));
      } catch {
        // ignore resync failure; next reload reconciles
      }
    } finally {
      markSavedIdle();
    }
  }

  function savedName(id: string, patch: Partial<CreateCrmLeadInput>): string {
    const lead = leads.find((item) => item.id === id);
    return patch.funeralHome || lead?.funeralHome || 'lead';
  }

  function queueSave(id: string, patch: Partial<CreateCrmLeadInput>) {
    const merged = { ...(pendingPatches.current.get(id) || {}), ...patch };
    pendingPatches.current.set(id, merged);
    setSaveState('saving');
    const timer = flushTimers.current.get(id);
    if (timer) clearTimeout(timer);
    flushTimers.current.set(id, setTimeout(() => flushSave(id), 700));
  }

  function updateLead(id: string, patch: Partial<CreateCrmLeadInput>) {
    setLeads((prev) => prev.map((lead) => (lead.id === id ? { ...lead, ...patch } : lead)));
    queueSave(id, patch);
  }

  async function addLead(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!form.funeralHome.trim()) return;

    try {
      const lead = await crmApi.createLead({
        ...form,
        revenue: Number(form.revenue || 0),
        funeralHome: form.funeralHome.trim(),
      });
      setLeads((prev) => [lead, ...prev]);
      setActiveLeadId(lead.id);
      setForm(emptyForm);
      showNotice(`Lead created and saved`);
    } catch (error) {
      showError(`Failed to create lead: ${errorMessage(error)}`);
    }
  }

  async function addActivity(type: ActivityType) {
    if (!activeLead) return;
    try {
      const result = await crmApi.addActivity(activeLead.id, { type, note: activityNote.trim() || null });
      setLeads((prev) => prev.map((lead) => (lead.id === activeLead.id ? result.lead : lead)));
      setActivityNote('');
    } catch (error) {
      showError(`Failed to log activity: ${errorMessage(error)}`);
    }
  }

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoginError(null);
    setLoginLoading(true);
    try {
      const result = await crmApi.login(loginEmail, loginPassword);
      setSession(result.accessToken, result.user);
      setUser(result.user);
      setLoginPassword('');
    } catch (error) {
      setLoginError(errorMessage(error));
    } finally {
      setLoginLoading(false);
    }
  }

  function handleLogout() {
    clearSession();
    setUser(null);
    setLeads([]);
    setActiveLeadId('');
    setNotice(null);
    setError(null);
  }

  function exportCsv() {
    const rows = [
      ['Project', 'Funeral Home', 'Province', 'Town', 'Owner', 'Phone', 'Email', 'Status', 'Follow-up', 'Demo', 'Revenue', 'Notes'],
      ...leads.map((lead) => [
        lead.project,
        lead.funeralHome,
        lead.province,
        lead.town ?? '',
        lead.owner ?? '',
        lead.phone ?? '',
        lead.email ?? '',
        lead.status,
        lead.followUpDate ?? '',
        lead.demoDate ?? '',
        String(lead.revenue),
        lead.notes ?? '',
      ]),
    ];
    const csv = rows.map((row) => row.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(',')).join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `smartsales-crm-${today}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  if (!user) {
    return (
      <main className="app-shell login-shell">
        <section className="hero">
          <div>
            <p className="eyebrow">Personal sales operating system</p>
            <h1>SmartSales CRM</h1>
            <p className="hero-copy">Track calls, WhatsApps, demos, follow-ups, and sales for every project from your phone.</p>
          </div>
        </section>
        <section className="add-panel login-panel">
          <div className="section-title">
            <h2>Sign in</h2>
          </div>
          <form onSubmit={handleLogin} className="field-grid">
            <label>
              Email
              <input
                type="email"
                required
                autoComplete="email"
                value={loginEmail}
                onChange={(event) => setLoginEmail(event.target.value)}
              />
            </label>
            <label>
              Password
              <input
                type="password"
                required
                autoComplete="current-password"
                value={loginPassword}
                onChange={(event) => setLoginPassword(event.target.value)}
              />
            </label>
            {loginError && <p className="form-error">{loginError}</p>}
            <button className="primary-button" type="submit" disabled={loginLoading}>
              {loginLoading ? 'Signing in...' : 'Sign in'}
            </button>
          </form>
          <p className="empty">Use your Memory Connect account credentials.</p>
        </section>
      </main>
    );
  }

  return (
    <main className="app-shell">
      <section className="hero">
        <div>
          <p className="eyebrow">Personal sales operating system</p>
          <h1>SmartSales CRM</h1>
          <p className="hero-copy">Track calls, WhatsApps, demos, follow-ups, and sales for every project from your phone.</p>
        </div>
        <div className="hero-actions">
          <span className="save-indicator" title={saveState === 'saving' ? 'Saving changes...' : 'All changes saved'}>
            {saveState === 'saving' ? 'Saving...' : 'Saved'}
          </span>
          <span className="user-chip" title={user.email}>
            {user.name}
          </span>
          <button className="icon-button" type="button" aria-label="Log out" onClick={handleLogout}>
            <LogOut size={20} />
          </button>
          <button className="icon-button" type="button" aria-label="Export CSV" onClick={exportCsv}>
            <Download size={20} />
          </button>
        </div>
      </section>

      {error && (
        <section className="alert-strip error-strip" role="alert">
          <XCircle size={18} />
          <span>{error}</span>
          <button type="button" className="dismiss-button" aria-label="Dismiss" onClick={() => setError(null)}>
            ×
          </button>
        </section>
      )}
      {notice && (
        <section className="alert-strip notice-strip" role="status">
          <CheckCircle2 size={18} />
          <span>{notice}</span>
        </section>
      )}

      <section className="alert-strip">
        <Bell size={18} />
        <span>{todayFollowUps.length} follow-ups today</span>
        <span>{todayDemos.length} demos today</span>
        <span>{newLeads.length} new leads</span>
      </section>

      <section className="metric-grid" aria-label="Dashboard">
        <Metric label="Today's Calls" value={String(leads.flatMap((lead) => lead.activities).filter((a) => a.type === 'Call' && a.at.slice(0, 10) === today).length)} />
        <Metric label="Emails Sent" value={String(report.emails)} />
        <Metric label="WhatsApps Sent" value={String(report.whatsapps)} />
        <Metric label="Follow-ups Due" value={String(todayFollowUps.length)} />
        <Metric label="Demos Scheduled" value={String(todayDemos.length)} />
        <Metric label="Revenue This Month" value={currency(report.revenue)} />
      </section>

      {loading ? (
        <section className="workspace">
          <p className="empty">Loading leads...</p>
        </section>
      ) : (
        <section className="workspace">
          <aside className="lead-list">
            <div className="search-box">
              <Search size={18} />
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search town, funeral home, status..." />
            </div>
            <div className="filter-row">
              <select value={projectFilter} onChange={(event) => setProjectFilter(event.target.value)}>
                <option>All</option>
                {projects.map((project) => (
                  <option key={project}>{project}</option>
                ))}
              </select>
              <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
                <option>All</option>
                {statuses.map((status) => (
                  <option key={status}>{status}</option>
                ))}
              </select>
            </div>
            <div className="lead-scroll">
              {filteredLeads.map((lead) => (
                <button
                  className={`lead-card ${lead.id === activeLead?.id ? 'active' : ''}`}
                  key={lead.id}
                  type="button"
                  onClick={() => setActiveLeadId(lead.id)}
                >
                  <strong>{lead.funeralHome}</strong>
                  <span>{lead.project}</span>
                  <small>
                    {lead.town || 'No town'} · {lead.status}
                  </small>
                </button>
              ))}
            </div>
          </aside>

          <section className="detail-panel">
            {activeLead ? (
              <>
                <div className="detail-heading">
                  <div>
                    <p className="eyebrow">{activeLead.project}</p>
                    <h2>{activeLead.funeralHome}</h2>
                    <p>
                      {activeLead.town || 'Town not set'}, {activeLead.province}
                    </p>
                  </div>
                  <select value={activeLead.status} onChange={(event) => updateLead(activeLead.id, { status: event.target.value as Status })}>
                    {statuses.map((status) => (
                      <option key={status}>{status}</option>
                    ))}
                  </select>
                </div>

                <div className="quick-actions">
                  <a className="action" href={`mailto:${activeLead.email ?? ''}`} onClick={() => addActivity('Email')}>
                    <Mail size={18} />
                    Email
                  </a>
                  <a className="action" href={`https://wa.me/${normalizePhone(activeLead.whatsapp || activeLead.phone || '')}`} onClick={() => addActivity('WhatsApp')}>
                    <MessageCircle size={18} />
                    WhatsApp
                  </a>
                  <a className="action" href={`tel:${activeLead.phone ?? ''}`} onClick={() => addActivity('Call')}>
                    <Phone size={18} />
                    Call
                  </a>
                  <button className="action" type="button" onClick={() => addActivity('Follow-up')}>
                    <CalendarClock size={18} />
                    Follow-up
                  </button>
                  <button className="action" type="button" onClick={() => addActivity('Demo')}>
                    <Video size={18} />
                    Demo
                  </button>
                  <button className="action success" type="button" onClick={() => addActivity('Closed Sale')}>
                    <CheckCircle2 size={18} />
                    Closed
                  </button>
                  <button className="action danger" type="button" onClick={() => addActivity('Not Interested')}>
                    <XCircle size={18} />
                    Lost
                  </button>
                </div>

                <textarea
                  className="note-input"
                  value={activityNote}
                  onChange={(event) => setActivityNote(event.target.value)}
                  placeholder="Quick note for the next action..."
                />

                <div className="field-grid">
                  <label>
                    Owner
                    <input value={activeLead.owner ?? ''} onChange={(event) => updateLead(activeLead.id, { owner: event.target.value })} />
                  </label>
                  <label>
                    Phone
                    <input value={activeLead.phone ?? ''} onChange={(event) => updateLead(activeLead.id, { phone: event.target.value })} />
                  </label>
                  <label>
                    WhatsApp
                    <input value={activeLead.whatsapp ?? ''} onChange={(event) => updateLead(activeLead.id, { whatsapp: event.target.value })} />
                  </label>
                  <label>
                    Email
                    <input value={activeLead.email ?? ''} onChange={(event) => updateLead(activeLead.id, { email: event.target.value })} />
                  </label>
                  <label>
                    Follow-up
                    <input type="date" value={activeLead.followUpDate ?? ''} onChange={(event) => updateLead(activeLead.id, { followUpDate: event.target.value })} />
                  </label>
                  <label>
                    Demo
                    <input type="date" value={activeLead.demoDate ?? ''} onChange={(event) => updateLead(activeLead.id, { demoDate: event.target.value })} />
                  </label>
                  <label>
                    Revenue
                    <input type="number" value={activeLead.revenue} onChange={(event) => updateLead(activeLead.id, { revenue: Number(event.target.value) })} />
                  </label>
                  <label>
                    Notes
                    <textarea value={activeLead.notes ?? ''} onChange={(event) => updateLead(activeLead.id, { notes: event.target.value })} />
                  </label>
                </div>

                <div className="timeline">
                  <h3>Activity Timeline</h3>
                  {activeLead.activities.length ? (
                    activeLead.activities.map((activity) => (
                      <article key={activity.id}>
                        <span>{activity.type}</span>
                        <time>{formatTime(activity.at)}</time>
                        {activity.note && <p>{activity.note}</p>}
                      </article>
                    ))
                  ) : (
                    <p className="empty">No activity yet. Use the quick actions above.</p>
                  )}
                </div>
              </>
            ) : (
              <p className="empty">Add your first lead to begin.</p>
            )}
          </section>
        </section>
      )}

      <section className="bottom-grid">
        <form className="add-panel" onSubmit={addLead}>
          <div className="section-title">
            <Plus size={18} />
            <h2>Add Lead</h2>
          </div>
          <div className="field-grid">
            <label>
              Funeral Home
              <input required value={form.funeralHome} onChange={(event) => setForm({ ...form, funeralHome: event.target.value })} />
            </label>
            <label>
              Project
              <select value={form.project} onChange={(event) => setForm({ ...form, project: event.target.value })}>
                {projects.map((project) => (
                  <option key={project}>{project}</option>
                ))}
              </select>
            </label>
            <label>
              Province
              <select value={form.province} onChange={(event) => setForm({ ...form, province: event.target.value })}>
                {provinces.map((province) => (
                  <option key={province}>{province}</option>
                ))}
              </select>
            </label>
            <label>
              Town
              <input value={form.town ?? ''} onChange={(event) => setForm({ ...form, town: event.target.value })} />
            </label>
            <label>
              Owner
              <input value={form.owner ?? ''} onChange={(event) => setForm({ ...form, owner: event.target.value })} />
            </label>
            <label>
              Phone
              <input value={form.phone ?? ''} onChange={(event) => setForm({ ...form, phone: event.target.value })} />
            </label>
            <label>
              WhatsApp
              <input value={form.whatsapp ?? ''} onChange={(event) => setForm({ ...form, whatsapp: event.target.value })} />
            </label>
            <label>
              Email
              <input type="email" value={form.email ?? ''} onChange={(event) => setForm({ ...form, email: event.target.value })} />
            </label>
            <label>
              Notes
              <textarea value={form.notes ?? ''} onChange={(event) => setForm({ ...form, notes: event.target.value })} />
            </label>
          </div>
          <button className="primary-button" type="submit">
            Save Lead
          </button>
        </form>

        <section className="report-panel">
          <div className="section-title">
            <MapPin size={18} />
            <h2>{new Intl.DateTimeFormat('en-ZA', { month: 'long', year: 'numeric' }).format(new Date())}</h2>
          </div>
          <ReportRow label="Prospects Added" value={report.prospects} />
          <ReportRow label="Emails" value={report.emails} />
          <ReportRow label="WhatsApps" value={report.whatsapps} />
          <ReportRow label="Calls" value={report.calls} />
          <ReportRow label="Follow-ups" value={report.followUps} />
          <ReportRow label="Demos" value={report.demos} />
          <ReportRow label="Sales" value={report.sales} />
          <ReportRow label="Conversion" value={`${report.conversion.toFixed(1)}%`} />
          <ReportRow label="Revenue" value={currency(report.revenue)} />
          <div className="project-summary">
            {projects.map((project) => {
              const projectLeads = leads.filter((lead) => lead.project === project);
              return (
                <span key={project}>
                  {project}: {projectLeads.length} leads, {projectLeads.filter((lead) => lead.status === 'Customer').length} customers
                </span>
              );
            })}
          </div>
        </section>
      </section>
    </main>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <article className="metric-card">
      <span>{label}</span>
      <strong>{value}</strong>
    </article>
  );
}

function ReportRow({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="report-row">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

export default App;

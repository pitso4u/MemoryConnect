import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  Activity, ArrowLeft, Building2, CheckCircle2, Clock3, CreditCard, Eye, FileText,
  RefreshCw, ShieldAlert, Users, WalletCards,
} from 'lucide-react';
import {
  api, PlatformAnalytics, PlatformAuditLog, PlatformFuneralHome, PlatformFuneralHomeDetail,
  PlatformPayment, PlatformSummary, PlatformSupport, PlatformUser,
} from '../lib/api';

const money = (cents = 0) => new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR' }).format(cents / 100);
const date = (value?: string | null) => value ? new Intl.DateTimeFormat('en-ZA', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)) : 'Never';
const label = (value: string) => value.replaceAll('_', ' ').toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase());

function PageHeader({ title, description, action }: { title: string; description: string; action?: React.ReactNode }) {
  return (
    <header className="flex flex-col gap-4 border-b border-ink/10 bg-white px-5 py-6 sm:flex-row sm:items-end sm:justify-between lg:px-8">
      <div>
        <p className="mb-1 text-xs font-semibold uppercase tracking-widest text-sage">Platform operations</p>
        <h1 className="font-display text-3xl font-semibold text-ink">{title}</h1>
        <p className="mt-1 text-sm text-muted">{description}</p>
      </div>
      {action}
    </header>
  );
}

function Stat({ label: statLabel, value, note, icon: Icon }: { label: string; value: string | number; note?: string; icon: React.ElementType }) {
  return (
    <div className="border border-ink/10 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-medium text-muted">{statLabel}</p>
        <Icon size={18} className="text-sage" />
      </div>
      <p className="mt-3 text-3xl font-semibold text-ink">{value}</p>
      {note && <p className="mt-1 text-xs text-muted">{note}</p>}
    </div>
  );
}

function Status({ value }: { value: string }) {
  const good = ['ACTIVE', 'SUCCESS', 'PAID', 'PUBLISHED', 'ACCEPTED'].includes(value.toUpperCase());
  const warning = ['PENDING', 'DRAFT', 'UNPAID'].includes(value.toUpperCase());
  return <span className={`inline-flex px-2 py-1 text-xs font-semibold ${good ? 'bg-emerald-50 text-emerald-700' : warning ? 'bg-amber-50 text-amber-700' : 'bg-red-50 text-red-700'}`}>{label(value)}</span>;
}

function Loading() {
  return <div className="grid min-h-64 place-items-center text-sm text-muted"><RefreshCw className="mb-2 animate-spin" />Loading platform data...</div>;
}

function ErrorMessage({ message }: { message: string }) {
  return <div role="alert" className="m-8 border border-red-200 bg-red-50 p-4 text-sm text-red-700">{message}</div>;
}

function Table({ children }: { children: React.ReactNode }) {
  return <div className="overflow-x-auto border border-ink/10 bg-white"><table className="w-full min-w-[760px] text-left text-sm">{children}</table></div>;
}

function Head({ children }: { children: React.ReactNode }) {
  return <thead className="border-b border-ink/10 bg-parchment/60 text-xs uppercase text-muted"><tr>{children}</tr></thead>;
}

const Th = ({ children }: { children: React.ReactNode }) => <th className="px-4 py-3 font-semibold">{children}</th>;
const Td = ({ children }: { children: React.ReactNode }) => <td className="border-t border-ink/8 px-4 py-3 align-top">{children}</td>;

export function PlatformDashboardPage() {
  const [summary, setSummary] = useState<PlatformSummary | null>(null);
  const [users, setUsers] = useState<PlatformUser[]>([]);
  const [error, setError] = useState('');
  useEffect(() => {
    Promise.all([api.getPlatformSummary(), api.getPlatformUsers()])
      .then(([summaryData, userData]) => { setSummary(summaryData); setUsers(userData); })
      .catch((err: Error) => setError(err.message));
  }, []);
  const roleCount = (role: string) => users.filter((user) => user.role === role).length;
  if (error) return <ErrorMessage message={error} />;
  if (!summary) return <Loading />;
  return (
    <>
      <PageHeader title="Platform Overview" description="Live operating picture across Memory Connect." />
      <div className="space-y-8 p-5 lg:p-8">
        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase text-muted">Registrations</h2>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Stat label="Funeral homes" value={summary.registrations.total} note={`${summary.registrations.today} joined today`} icon={Building2} />
            <Stat label="New this month" value={summary.registrations.month} icon={Activity} />
            <Stat label="Active" value={summary.registrations.active} icon={CheckCircle2} />
            <Stat label="Pending / inactive" value={summary.registrations.pending + summary.registrations.inactive} icon={Clock3} />
          </div>
        </section>
        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase text-muted">Revenue and memorials</h2>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Stat label="Total revenue" value={money(summary.payments.totalRevenueCents)} note={`${summary.payments.successful} successful payments`} icon={WalletCards} />
            <Stat label="Revenue this month" value={money(summary.payments.monthRevenueCents)} note={`${money(summary.payments.todayRevenueCents)} today`} icon={CreditCard} />
            <Stat label="Memorials" value={summary.memorials.total} note={`${summary.memorials.published} published`} icon={FileText} />
            <Stat label="Public views" value={summary.totalPublicViews.toLocaleString()} icon={Eye} />
          </div>
        </section>
        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase text-muted">User accounts</h2>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Stat label="Total users" value={summary.users.total} icon={Users} />
            <Stat label="Funeral home team" value={roleCount('FUNERAL_HOME_ADMIN') + roleCount('FUNERAL_HOME_STAFF')} note={`${roleCount('FUNERAL_HOME_ADMIN')} admins`} icon={Building2} />
            <Stat label="Family users" value={roleCount('FAMILY_MANAGER') + roleCount('FAMILY_CONTRIBUTOR')} note={`${roleCount('FAMILY_MANAGER')} managers`} icon={Users} />
            <Stat label="Password not set" value={summary.users.withoutPassword} icon={ShieldAlert} />
          </div>
        </section>
      </div>
    </>
  );
}

export function PlatformFuneralHomesPage() {
  const [homes, setHomes] = useState<PlatformFuneralHome[] | null>(null);
  const [error, setError] = useState('');
  useEffect(() => { api.getPlatformFuneralHomes().then(setHomes).catch((err: Error) => setError(err.message)); }, []);
  if (error) return <ErrorMessage message={error} />;
  if (!homes) return <Loading />;
  return (
    <>
      <PageHeader title="Funeral Homes" description={`${homes.length} registered organisations and their platform activity.`} />
      <div className="p-5 lg:p-8"><Table><Head><Th>Funeral home</Th><Th>Contact</Th><Th>Registered</Th><Th>Memorials</Th><Th>Payments</Th><Th>Last activity</Th><Th>Status</Th><Th>Action</Th></Head>
        <tbody>{homes.map((home) => <tr key={home.id}><Td><strong>{home.name}</strong><div className="text-xs text-muted">{home.ownerName || 'No admin assigned'}</div></Td><Td>{home.email}<div className="text-xs text-muted">{home.phone || 'No phone'}</div></Td><Td>{date(home.registeredAt)}</Td><Td>{home.memorialCount}</Td><Td>{money(home.paymentsTotalCents)}</Td><Td>{date(home.lastActivityAt)}</Td><Td><Status value={home.status} /></Td><Td><Link className="font-semibold text-sage hover:underline" to={`/admin-owner/funeral-homes/${home.id}`}>View details</Link></Td></tr>)}</tbody>
      </Table></div>
    </>
  );
}

export function PlatformPaymentsPage() {
  const [payments, setPayments] = useState<PlatformPayment[] | null>(null);
  const [error, setError] = useState('');
  useEffect(() => { api.getPlatformPayments().then(setPayments).catch((err: Error) => setError(err.message)); }, []);
  const total = useMemo(() => payments?.filter((payment) => ['SUCCESS', 'PAID', 'VERIFIED'].includes(payment.status.toUpperCase())).reduce((sum, payment) => sum + payment.amountCents, 0) || 0, [payments]);
  if (error) return <ErrorMessage message={error} />;
  if (!payments) return <Loading />;
  return (
    <>
      <PageHeader title="Payments" description="Paystack references and funeral publication payment history." />
      <div className="space-y-5 p-5 lg:p-8"><div className="grid gap-3 sm:grid-cols-3"><Stat label="Recorded payments" value={payments.length} icon={CreditCard} /><Stat label="Successful revenue" value={money(total)} icon={WalletCards} /><Stat label="Needs attention" value={payments.filter((payment) => payment.status !== 'SUCCESS').length} icon={ShieldAlert} /></div>
      <Table><Head><Th>Date</Th><Th>Funeral home</Th><Th>Memorial</Th><Th>Reference</Th><Th>Amount</Th><Th>Status</Th></Head><tbody>{payments.map((payment) => <tr key={payment.id}><Td>{date(payment.createdAt)}</Td><Td>{payment.funeralHome.name}</Td><Td>{payment.memorial.deceasedName}</Td><Td><span className="font-mono text-xs">{payment.paystackReference}</span></Td><Td>{money(payment.amountCents)}</Td><Td><Status value={payment.status} /></Td></tr>)}</tbody></Table></div>
    </>
  );
}

export function PlatformUsersPage() {
  const [users, setUsers] = useState<PlatformUser[] | null>(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  useEffect(() => { api.getPlatformUsers().then(setUsers).catch((err: Error) => setError(err.message)); }, []);
  const sendReset = async (user: PlatformUser) => {
    if (!confirm(`Generate a password reset link for ${user.email}?`)) return;
    try {
      const result = await api.sendPlatformPasswordReset(user.id);
      await navigator.clipboard.writeText(result.resetUrl);
      setMessage(`Reset link copied for ${result.email}`);
    } catch (err) { setError((err as Error).message); }
  };
  if (error) return <ErrorMessage message={error} />;
  if (!users) return <Loading />;
  return (
    <>
      <PageHeader title="Users" description="Account readiness, roles, and recent access across the platform." />
      <div className="space-y-4 p-5 lg:p-8">{message && <div className="border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">{message}</div>}<Table><Head><Th>User</Th><Th>Role</Th><Th>Funeral home</Th><Th>Password</Th><Th>Reset requests</Th><Th>Last login</Th><Th>Action</Th></Head><tbody>{users.map((user) => <tr key={user.id}><Td><strong>{user.name}</strong><div className="text-xs text-muted">{user.email}</div></Td><Td>{label(user.role)}</Td><Td>{user.funeralHome?.name || 'Platform / family'}</Td><Td>{user.passwordSetAt ? 'Set' : 'Not set'}</Td><Td>{user.passwordResetTokens.length}</Td><Td>{date(user.lastLoginAt)}</Td><Td><button type="button" onClick={() => sendReset(user)} className="font-semibold text-sage hover:underline">Send reset link</button></Td></tr>)}</tbody></Table></div>
    </>
  );
}

export function PlatformSupportPage() {
  const [support, setSupport] = useState<PlatformSupport | null>(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  useEffect(() => { api.getPlatformSupport().then(setSupport).catch((err: Error) => setError(err.message)); }, []);
  const reset = async (id: string) => {
    try { const result = await api.sendPlatformPasswordReset(id); await navigator.clipboard.writeText(result.resetUrl); setMessage('Reset link copied'); }
    catch (err) { setError((err as Error).message); }
  };
  if (error) return <ErrorMessage message={error} />;
  if (!support) return <Loading />;
  return (
    <>
      <PageHeader title="Support" description="Signals that may need owner assistance." />
      <div className="space-y-6 p-5 lg:p-8">{message && <div className="border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">{message}</div>}<div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><Stat label="Open reset requests" value={support.resetRequests.length} icon={ShieldAlert} /><Stat label="Recent failed logins" value={support.failedLogins.length} icon={Activity} /><Stat label="Pending invitations" value={support.pendingInvites} icon={Clock3} /><Stat label="Expired invitations" value={support.expiredInvites} icon={ShieldAlert} /></div>
      <section><h2 className="mb-3 text-lg font-semibold">Users needing help</h2><Table><Head><Th>User</Th><Th>Role</Th><Th>Funeral home</Th><Th>Action</Th></Head><tbody>{support.usersWithoutPasswords.map((user) => <tr key={user.id}><Td>{user.name}<div className="text-xs text-muted">{user.email}</div></Td><Td>{label(user.role)}</Td><Td>{user.funeralHome?.name || 'Family account'}</Td><Td><button type="button" onClick={() => reset(user.id)} className="font-semibold text-sage hover:underline">Generate reset link</button></Td></tr>)}</tbody></Table></section>
      <section><h2 className="mb-3 text-lg font-semibold">Failed login attempts</h2><Table><Head><Th>Email</Th><Th>Attempted</Th></Head><tbody>{support.failedLogins.map((attempt) => <tr key={attempt.id}><Td>{attempt.email}</Td><Td>{date(attempt.createdAt)}</Td></tr>)}</tbody></Table></section></div>
    </>
  );
}

export function PlatformAnalyticsPage() {
  const [analytics, setAnalytics] = useState<PlatformAnalytics | null>(null);
  const [error, setError] = useState('');
  useEffect(() => { api.getPlatformAnalytics().then(setAnalytics).catch((err: Error) => setError(err.message)); }, []);
  if (error) return <ErrorMessage message={error} />;
  if (!analytics) return <Loading />;
  return (
    <>
      <PageHeader title="Analytics" description="Unique public reach and organisation performance." />
      <div className="space-y-6 p-5 lg:p-8"><div className="grid gap-3 sm:grid-cols-2"><Stat label="Total public views" value={analytics.totalViews.toLocaleString()} icon={Eye} /><Stat label="Views today" value={analytics.viewsToday.toLocaleString()} icon={Activity} /></div>
      <div className="grid gap-6 xl:grid-cols-3"><Ranking title="Most viewed memorials" rows={analytics.mostViewedMemorials.map((item) => ({ name: item.deceasedName, context: item.funeralHome.name, value: item.viewCount.toLocaleString() }))} /><Ranking title="Top by memorial count" rows={analytics.topHomesByMemorials.map((item) => ({ name: item.name, value: String(item.memorialCount) }))} /><Ranking title="Top by revenue" rows={analytics.topHomesByRevenue.map((item) => ({ name: item.name, value: money(item.revenueCents) }))} /></div></div>
    </>
  );
}

function Ranking({ title, rows }: { title: string; rows: Array<{ name: string; context?: string; value: string }> }) {
  return <section className="border border-ink/10 bg-white p-5"><h2 className="mb-4 font-semibold">{title}</h2><ol className="space-y-3">{rows.map((row, index) => <li key={`${row.name}-${index}`} className="flex items-center gap-3 border-b border-ink/8 pb-3 last:border-0"><span className="grid size-7 place-items-center bg-parchment text-xs font-bold">{index + 1}</span><span className="min-w-0 flex-1"><strong className="block truncate text-sm">{row.name}</strong>{row.context && <span className="block truncate text-xs text-muted">{row.context}</span>}</span><span className="font-semibold">{row.value}</span></li>)}</ol></section>;
}

export function PlatformAuditLogsPage() {
  const [logs, setLogs] = useState<PlatformAuditLog[] | null>(null);
  const [error, setError] = useState('');
  useEffect(() => { api.getPlatformAuditLogs().then(setLogs).catch((err: Error) => setError(err.message)); }, []);
  if (error) return <ErrorMessage message={error} />;
  if (!logs) return <Loading />;
  return <><PageHeader title="Audit Logs" description="Immutable record of platform owner activity." /><div className="p-5 lg:p-8"><Table><Head><Th>Time</Th><Th>Actor</Th><Th>Action</Th><Th>Target</Th><Th>Funeral home</Th></Head><tbody>{logs.map((log) => <tr key={log.id}><Td>{date(log.createdAt)}</Td><Td>{log.actor.name}<div className="text-xs text-muted">{log.actor.email}</div></Td><Td>{label(log.action)}</Td><Td>{label(log.targetType)}<div className="font-mono text-xs text-muted">{log.targetId}</div></Td><Td>{log.funeralHome?.name || '-'}</Td></tr>)}</tbody></Table></div></>;
}

export function PlatformFuneralHomeDetailPage() {
  const { id = '' } = useParams();
  const [home, setHome] = useState<PlatformFuneralHomeDetail | null>(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const load = () => api.getPlatformFuneralHome(id).then(setHome).catch((err: Error) => setError(err.message));
  useEffect(() => { void load(); }, [id]);
  const toggleStatus = async () => {
    if (!home) return;
    const suspend = home.status === 'ACTIVE';
    if (!confirm(`${suspend ? 'Suspend' : 'Reactivate'} ${home.name}?`)) return;
    try { suspend ? await api.suspendPlatformFuneralHome(home.id) : await api.reactivatePlatformFuneralHome(home.id); setMessage(`${home.name} ${suspend ? 'suspended' : 'reactivated'}`); load(); }
    catch (err) { setError((err as Error).message); }
  };
  const reset = async (user: PlatformUser) => {
    if (!confirm(`Generate a password reset link for ${user.email}?`)) return;
    try { const result = await api.sendPlatformPasswordReset(user.id); await navigator.clipboard.writeText(result.resetUrl); setMessage(`Reset link copied for ${user.email}`); }
    catch (err) { setError((err as Error).message); }
  };
  const resend = async (inviteId: string) => {
    if (!confirm('Resend this family invitation?')) return;
    try { const invite = await api.resendPlatformInvite(inviteId); if (invite.inviteUrl) await navigator.clipboard.writeText(invite.inviteUrl); setMessage('Fresh invitation link copied'); load(); }
    catch (err) { setError((err as Error).message); }
  };
  const verify = async (payment: PlatformPayment) => {
    if (!confirm(`Manually verify payment ${payment.paystackReference}? This action is audited.`)) return;
    try { await api.verifyPlatformPayment(payment.id); setMessage('Payment marked verified'); load(); }
    catch (err) { setError((err as Error).message); }
  };
  const removeMemorial = async (memorialId: string, deceasedName: string) => {
    if (!confirm(`Permanently delete the memorial for ${deceasedName}? This action cannot be undone and will be audited.`)) return;
    try { await api.deletePlatformMemorial(memorialId); setMessage('Memorial deleted'); load(); }
    catch (err) { setError((err as Error).message); }
  };
  if (error) return <ErrorMessage message={error} />;
  if (!home) return <Loading />;
  return (
    <>
      <PageHeader title={home.name} description={`Registered ${date(home.createdAt)}`} action={<div className="flex gap-3"><Link to="/admin-owner/funeral-homes" className="inline-flex items-center gap-2 border border-ink/15 bg-white px-4 py-2 text-sm font-semibold"><ArrowLeft size={16} />Back</Link><button type="button" onClick={toggleStatus} className={`px-4 py-2 text-sm font-semibold text-white ${home.status === 'ACTIVE' ? 'bg-red-700' : 'bg-emerald-700'}`}>{home.status === 'ACTIVE' ? 'Suspend' : 'Reactivate'}</button></div>} />
      <div className="space-y-7 p-5 lg:p-8">{message && <div className="border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">{message}</div>}
        <section className="grid gap-4 border border-ink/10 bg-white p-5 sm:grid-cols-2 lg:grid-cols-4"><Detail label="Status"><Status value={home.status} /></Detail><Detail label="Email">{home.email}</Detail><Detail label="Phone">{home.phone || 'Not supplied'}</Detail><Detail label="Brand">{home.tradingName || home.name}</Detail></section>
        <section><h2 className="mb-3 text-lg font-semibold">Users</h2><Table><Head><Th>Name</Th><Th>Role</Th><Th>Password</Th><Th>Last login</Th><Th>Action</Th></Head><tbody>{home.users.map((user) => <tr key={user.id}><Td>{user.name}<div className="text-xs text-muted">{user.email}</div></Td><Td>{label(user.role)}</Td><Td>{user.passwordSetAt ? 'Set' : 'Not set'}</Td><Td>{date(user.lastLoginAt)}</Td><Td><button type="button" onClick={() => reset(user)} className="font-semibold text-sage hover:underline">Send reset link</button></Td></tr>)}</tbody></Table></section>
        <section><h2 className="mb-3 text-lg font-semibold">Memorials</h2><Table><Head><Th>Memorial</Th><Th>Created</Th><Th>Status</Th><Th>Payment</Th><Th>Action</Th></Head><tbody>{home.memorials.map((memorial) => <tr key={memorial.id}><Td>{memorial.deceasedName}</Td><Td>{date(memorial.createdAt)}</Td><Td><Status value={memorial.deletedAt ? 'DELETED' : memorial.status} /></Td><Td>{memorial.paymentStatus}</Td><Td><button type="button" onClick={() => removeMemorial(memorial.id, memorial.deceasedName)} className="font-semibold text-red-700 hover:underline">Delete</button></Td></tr>)}</tbody></Table></section>
        <section><h2 className="mb-3 text-lg font-semibold">Payments</h2><Table><Head><Th>Reference</Th><Th>Memorial</Th><Th>Amount</Th><Th>Status</Th><Th>Action</Th></Head><tbody>{home.payments.map((payment) => <tr key={payment.id}><Td><span className="font-mono text-xs">{payment.paystackReference}</span></Td><Td>{payment.memorial.deceasedName}</Td><Td>{money(payment.amountCents)}</Td><Td><Status value={payment.status} /></Td><Td>{payment.status !== 'SUCCESS' && <button type="button" onClick={() => verify(payment)} className="font-semibold text-sage hover:underline">Mark verified</button>}</Td></tr>)}</tbody></Table></section>
        <section><h2 className="mb-3 text-lg font-semibold">Family invitations</h2><Table><Head><Th>Invitee</Th><Th>Memorial</Th><Th>Role</Th><Th>Expires</Th><Th>Action</Th></Head><tbody>{home.familyInvitations.map((invite) => <tr key={invite.id}><Td>{invite.name}<div className="text-xs text-muted">{invite.email || invite.phone || 'No contact'}</div></Td><Td>{invite.memorial.deceasedName}</Td><Td>{label(invite.role)}</Td><Td>{date(invite.expiresAt)}</Td><Td><button type="button" onClick={() => resend(invite.id)} className="font-semibold text-sage hover:underline">Resend invite</button></Td></tr>)}</tbody></Table></section>
      </div>
    </>
  );
}

function Detail({ label: detailLabel, children }: { label: string; children: React.ReactNode }) {
  return <div><p className="text-xs font-semibold uppercase text-muted">{detailLabel}</p><div className="mt-1 text-sm font-medium">{children}</div></div>;
}

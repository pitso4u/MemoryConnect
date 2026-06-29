import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Check, CreditCard, ExternalLink, ShieldCheck, Sparkles, Zap } from 'lucide-react';
import { api, BillingStatus, PaymentKind, PlanCode } from '../lib/api';

function money(cents: number) {
  return `R${(cents / 100).toFixed(2)}`;
}

function friendlyStatus(status?: string) {
  if (!status) return 'Not active';
  return status.replace('-', ' ').replace(/^./, (letter) => letter.toUpperCase());
}

function paymentTitle(kind: string, planCode?: string) {
  if (kind === 'extra_memorial') return 'Extra funeral memorial';
  if (planCode) return `${planCode[0].toUpperCase()}${planCode.slice(1)} subscription`;
  return 'Subscription';
}

export default function BillingPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const [billing, setBilling] = useState<BillingStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [checkout, setCheckout] = useState<{ kind: PaymentKind; planCode?: PlanCode } | null>(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setBilling(await api.getBillingStatus());
  }, []);

  useEffect(() => {
    const reference = searchParams.get('reference') || searchParams.get('trxref');

    const finish = async () => {
      try {
        if (reference) {
          setMessage('Confirming your payment with Paystack...');
          setBilling(await api.verifyPayment(reference));
          setMessage('Payment confirmed. Your Memory Connect account is ready.');
          setSearchParams({ payment: 'success' }, { replace: true });
          window.setTimeout(() => navigate('/'), 1200);
        } else {
          await load();
          if (searchParams.get('payment') === 'success') {
            setMessage('Payment confirmed. Your Memory Connect account is ready.');
          }
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Could not confirm payment');
        await load().catch(() => undefined);
      } finally {
        setLoading(false);
      }
    };
    finish();
  }, [load, searchParams, setSearchParams]);

  const beginCheckout = async (kind: PaymentKind, planCode?: PlanCode) => {
    setError('');
    setMessage('');
    setCheckout({ kind, planCode });
    try {
      const paystackCheckout = await api.initializePayment(kind, planCode);
      window.location.assign(paystackCheckout.authorization_url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not start checkout');
      setCheckout(null);
    }
  };

  if (loading) return <div className="p-8 text-muted">Preparing your billing details...</div>;
  if (!billing) return <div className="p-8 text-red-700">Billing details are unavailable.</div>;

  const active = billing.subscription?.status === 'active' || billing.subscription?.status === 'non-renewing';
  const activePlanCode = active ? billing.subscription?.planCode : undefined;
  const totalAvailable = billing.usage.unlimited ? null : billing.usage.memorialLimit + billing.usage.extraCredits;
  const usagePercent = totalAvailable && totalAvailable > 0
    ? Math.min(100, Math.round((billing.usage.memorialsUsed / totalAvailable) * 100))
    : billing.usage.unlimited ? 18 : 0;
  const activePlan = billing.plans.find((plan) => plan.code === activePlanCode) || billing.plan;

  return (
    <div className="mx-auto max-w-7xl p-8">
      <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.22em] text-gold-dark">Commercial activation</p>
          <h1 className="font-display text-4xl text-ink">Choose your monthly funeral package.</h1>
          <p className="mt-2 max-w-2xl text-muted">
            A funeral means one published memorial/event page. Drafts are free to prepare; only published funerals count against your monthly allowance.
          </p>
        </div>
        <span className={`w-fit rounded-full px-4 py-2 text-sm font-semibold ${active ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
          {friendlyStatus(billing.subscription?.status)}
        </span>
      </div>

      {message && (
        <div className="mb-6 flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          <Check size={18} /> {message}
        </div>
      )}
      {error && (
        <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
        <section className="grid gap-5 lg:grid-cols-3">
          {billing.plans.map((plan) => {
            const isActivePlan = activePlanCode === plan.code;
            const busy = checkout?.kind === 'subscription' && checkout.planCode === plan.code;
            const highlights = plan.fairUseUnlimited
              ? ['Unlimited published funerals/memorials', 'QR code and programme', 'GPS directions and map pins', 'No extra funeral charge']
              : [
                `${plan.memorialLimit} published funerals/memorials each month`,
                `${money(plan.extraMemorialAmount)} per extra funeral after limit`,
                'QR code, programme and gallery',
                'GPS directions and tribute wall',
              ];
            return (
              <article
                key={plan.code}
                className={`relative overflow-hidden rounded-3xl border p-6 shadow-sm transition ${
                  isActivePlan
                    ? 'border-gold bg-ink text-parchment shadow-[0_24px_70px_rgba(26,26,46,0.18)]'
                    : 'border-parchment-dark bg-white text-ink hover:-translate-y-1 hover:shadow-[0_18px_45px_rgba(26,26,46,0.10)]'
                }`}
              >
                {plan.code === 'professional' && !isActivePlan && (
                  <div className="absolute right-5 top-5 rounded-full bg-gold px-3 py-1 text-xs font-semibold text-ink">Best value</div>
                )}
                <div className={isActivePlan ? 'absolute -right-20 -top-20 h-56 w-56 rounded-full bg-gold/15 blur-3xl' : 'absolute -right-20 -top-20 h-56 w-56 rounded-full bg-gold/10 blur-3xl'} />
                <div className="relative">
                  <div className={`mb-5 inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold uppercase tracking-wide ${
                    isActivePlan ? 'bg-white/10 text-gold-light' : 'bg-parchment text-gold-dark'
                  }`}>
                    {plan.code === 'unlimited' ? <Zap size={14} /> : <Sparkles size={14} />} {plan.code}
                  </div>
                  <h2 className="font-display text-4xl">
                    {money(plan.amount)}
                    <span className={`font-body text-base ${isActivePlan ? 'text-parchment/55' : 'text-muted'}`}> / month</span>
                  </h2>
                  <p className={`mt-2 text-sm ${isActivePlan ? 'text-parchment/65' : 'text-muted'}`}>
                    {plan.name}
                  </p>

                  <div className={`my-6 h-px ${isActivePlan ? 'bg-white/10' : 'bg-parchment-dark'}`} />
                  <div className="space-y-3">
                    {highlights.map((item) => (
                      <div key={item} className={`flex items-start gap-2.5 text-sm ${isActivePlan ? 'text-parchment/85' : 'text-muted'}`}>
                        <Check size={16} className={`mt-0.5 shrink-0 ${isActivePlan ? 'text-gold-light' : 'text-sage'}`} /> {item}
                      </div>
                    ))}
                  </div>

                  <button
                    onClick={() => beginCheckout('subscription', plan.code)}
                    disabled={busy || isActivePlan || !plan.checkoutAvailable}
                    className={`mt-7 inline-flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${
                      isActivePlan
                        ? 'bg-white/10 text-parchment'
                        : 'bg-ink text-parchment hover:bg-gold hover:text-ink'
                    }`}
                  >
                    <CreditCard size={17} />
                    {isActivePlan ? 'Current plan' : busy ? 'Opening Paystack...' : `Choose ${plan.code}`}
                  </button>
                  {!plan.checkoutAvailable && (
                    <p className={`mt-3 text-xs ${isActivePlan ? 'text-amber-100' : 'text-amber-700'}`}>
                      Awaiting this plan's Paystack code.
                    </p>
                  )}
                </div>
              </article>
            );
          })}
        </section>

        <aside className="rounded-3xl border border-parchment-dark bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">This period</p>
              <h2 className="mt-1 font-display text-2xl text-ink">Funeral usage</h2>
            </div>
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-parchment text-gold-dark">
              <ShieldCheck size={21} />
            </div>
          </div>

          <div className="mt-8 flex items-end justify-between">
            <div>
              <span className="font-display text-5xl text-ink">{billing.usage.memorialsUsed}</span>
              <span className="text-muted"> / {billing.usage.unlimited ? 'unlimited' : totalAvailable}</span>
            </div>
            <span className="text-sm font-medium text-sage">
              {billing.usage.unlimited ? 'Unlimited' : `${billing.usage.remaining} funerals left`}
            </span>
          </div>
          <div className="mt-4 h-2 overflow-hidden rounded-full bg-parchment">
            <div className="h-full rounded-full bg-gold transition-all" style={{ width: `${usagePercent}%` }} />
          </div>
          <div className="mt-5 space-y-2 text-sm text-muted">
            <div className="flex justify-between"><span>Active plan</span><span className="font-medium text-ink">{active ? activePlan.name.replace('Memory Connect ', '') : 'Demo only'}</span></div>
            <div className="flex justify-between"><span>Included funerals</span><span className="font-medium text-ink">{billing.usage.unlimited ? 'Unlimited' : billing.usage.memorialLimit}</span></div>
            <div className="flex justify-between"><span>Extra funerals paid</span><span className="font-medium text-ink">{billing.usage.extraCredits}</span></div>
            {billing.subscription?.currentPeriodEnd && (
              <div className="flex justify-between"><span>Renews</span><span className="font-medium text-ink">{new Date(billing.subscription.currentPeriodEnd).toLocaleDateString('en-ZA')}</span></div>
            )}
          </div>
          <button
            onClick={() => beginCheckout('extra_memorial')}
            disabled={!active || billing.usage.unlimited || checkout !== null}
            className="mt-7 w-full rounded-xl border border-parchment-dark px-4 py-3 text-sm font-semibold text-ink transition hover:border-gold hover:bg-parchment/60 disabled:cursor-not-allowed disabled:opacity-45"
          >
            {checkout?.kind === 'extra_memorial'
              ? 'Opening Paystack...'
              : billing.usage.unlimited
                ? 'Extra funerals not needed'
                : `Pay for one extra funeral - ${money(activePlan.extraMemorialAmount)}`}
          </button>
          {!active && (
            <p className="mt-3 text-xs text-muted">Without an active subscription, staff can prepare one demo/draft memorial only.</p>
          )}
          {active && (
            <Link to="/create" className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gold px-4 py-3 text-sm font-semibold text-ink transition hover:bg-gold-light">
              Create a memorial <ExternalLink size={16} />
            </Link>
          )}
        </aside>
      </div>

      <section className="mt-8 rounded-2xl border border-parchment-dark bg-white p-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-display text-2xl text-ink">Payment history</h2>
            <p className="mt-1 text-sm text-muted">Your latest Paystack transactions.</p>
          </div>
          <span className="text-xs text-muted">Securely processed by Paystack</span>
        </div>
        {billing.payments.length === 0 ? (
          <div className="mt-6 rounded-xl bg-parchment/60 px-4 py-8 text-center text-sm text-muted">No payments yet.</div>
        ) : (
          <div className="mt-6 divide-y divide-parchment-dark">
            {billing.payments.map((payment) => (
              <div key={payment.id} className="grid grid-cols-[1fr_auto] gap-4 py-4 sm:grid-cols-[1fr_0.6fr_0.5fr_auto] sm:items-center">
                <div>
                  <p className="text-sm font-semibold text-ink">{paymentTitle(payment.kind, billing.subscription?.planCode)}</p>
                  <p className="mt-0.5 text-xs text-muted">{payment.paystackReference}</p>
                </div>
                <p className="hidden text-sm text-muted sm:block">{new Date(payment.paidAt || payment.createdAt).toLocaleDateString('en-ZA')}</p>
                <span className={`hidden w-fit rounded-full px-2.5 py-1 text-xs font-semibold capitalize sm:block ${payment.status === 'success' ? 'bg-emerald-50 text-emerald-700' : payment.status === 'failed' ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-700'}`}>{payment.status}</span>
                <p className="text-sm font-semibold text-ink">{money(payment.amount)}</p>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

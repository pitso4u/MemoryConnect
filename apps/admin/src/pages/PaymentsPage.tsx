import { useEffect, useState } from 'react';
import { CheckCircle2, Copy, CreditCard, MessageCircleHeart, ShieldCheck } from 'lucide-react';
import { api, PublishPayment } from '../lib/api';

type PaymentRow = PublishPayment & { memorial: { deceasedName: string } };

const familyExplanation = `Your funeral home will create a private draft of the digital funeral programme. We’ll add the obituary, service programme, photographs and directions for you to review.

When everything is ready, the funeral home pays the once-off publishing fee—there is no payment required from the family. The memorial then becomes available through a link and QR code for 30 days, making it easy for relatives and guests to access on their phones.

After 30 days, public viewing ends. Videos are removed, and after 90 days the memorial and its remaining media are permanently deleted to protect the family’s privacy.`;

export default function PaymentsPage() {
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    api.getPayments().then(setPayments).finally(() => setLoading(false));
  }, []);

  const copyFamilyExplanation = async () => {
    await navigator.clipboard.writeText(familyExplanation);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-5xl">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold-dark">Pay per funeral</p>
        <h1 className="mt-3 font-display text-4xl text-ink">Publishing payments</h1>
        <p className="mt-2 max-w-2xl text-muted">Drafts are free. Pay only when a funeral is ready to become public.</p>

        <section className="mt-8 overflow-hidden rounded-3xl bg-ink text-parchment shadow-xl">
          <div className="grid gap-8 p-7 sm:grid-cols-[1fr_auto] sm:items-center sm:p-9">
            <div>
              <p className="text-sm font-semibold text-gold-light">Publish each funeral for R299.99</p>
              <p className="mt-3 font-display text-5xl">R299.99</p>
              <p className="mt-3 max-w-xl text-sm leading-6 text-parchment/60">One secure Paystack payment unlocks the public memorial, QR code, and sharing link for 30 days.</p>
            </div>
            <div className="space-y-3 text-sm text-parchment/75">
              <p className="flex items-center gap-2"><CheckCircle2 size={17} className="text-gold-light" /> Unlimited free drafts</p>
              <p className="flex items-center gap-2"><CheckCircle2 size={17} className="text-gold-light" /> 30 days of public viewing</p>
              <p className="flex items-center gap-2"><ShieldCheck size={17} className="text-gold-light" /> Verified by Paystack</p>
            </div>
          </div>
        </section>

        <section className="mt-8 overflow-hidden rounded-2xl border border-gold/25 bg-[#fbf7ef]">
          <div className="grid gap-6 p-6 sm:p-8 lg:grid-cols-[auto_1fr]">
            <div className="grid h-12 w-12 place-items-center rounded-full bg-gold/15 text-gold-dark">
              <MessageCircleHeart size={23} aria-hidden="true" />
            </div>
            <div>
              <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gold-dark">Family conversation</p>
                  <h2 className="mt-2 font-display text-3xl text-ink">How to explain the process</h2>
                  <p className="mt-2 text-sm text-muted">A gentle, ready-to-use explanation for funeral-home staff.</p>
                </div>
                <button
                  type="button"
                  onClick={copyFamilyExplanation}
                  className="inline-flex w-full shrink-0 items-center justify-center gap-2 rounded-full border border-ink/15 bg-white px-4 py-2 text-sm font-semibold text-ink transition hover:border-gold hover:text-gold-dark xl:w-auto"
                >
                  {copied ? <CheckCircle2 size={16} /> : <Copy size={16} />}
                  {copied ? 'Copied' : 'Copy wording'}
                </button>
              </div>
              <div className="mt-6 space-y-4 border-l-2 border-gold/35 pl-5 text-[15px] leading-7 text-ink/70">
                <p>“Your funeral home will create a private draft of the digital funeral programme. We’ll add the obituary, service programme, photographs and directions for you to review.</p>
                <p>When everything is ready, the funeral home pays the once-off publishing fee—there is no payment required from the family. The memorial becomes available through a link and QR code for 30 days.</p>
                <p>After 30 days, public viewing ends. Videos are removed, and after 90 days the memorial and its remaining media are permanently deleted to protect the family’s privacy.”</p>
              </div>
            </div>
          </div>
        </section>

        <section className="mt-8 rounded-2xl border border-parchment-dark bg-white p-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="font-display text-2xl text-ink">Payment history</h2>
              <p className="mt-1 text-sm text-muted">Every publishing payment is linked to one funeral.</p>
            </div>
            <CreditCard className="text-gold-dark" />
          </div>
          {loading ? (
            <p className="py-10 text-center text-sm text-muted">Loading payments...</p>
          ) : payments.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted">No publishing payments yet.</p>
          ) : (
            <div className="mt-6 divide-y divide-parchment-dark">
              {payments.map((payment) => (
                <div key={payment.id} className="grid gap-2 py-4 sm:grid-cols-[1fr_auto_auto] sm:items-center sm:gap-6">
                  <div>
                    <p className="font-medium text-ink">{payment.memorial.deceasedName}</p>
                    <p className="mt-0.5 text-xs text-muted">{payment.paystackReference}</p>
                  </div>
                  <p className="text-sm font-semibold text-ink">R299.99</p>
                  <span className={`w-fit rounded-full px-2.5 py-1 text-xs font-semibold ${payment.status === 'SUCCESS' ? 'bg-emerald-50 text-emerald-700' : payment.status === 'FAILED' ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-700'}`}>
                    {payment.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

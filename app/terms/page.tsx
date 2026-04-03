export default function TermsPage() {
  return (
    <main className="min-h-screen bg-black text-white px-6 py-12">
      <div className="max-w-2xl mx-auto space-y-8">
        <div>
          <h1 className="text-2xl font-bold">Terms of Service</h1>
          <p className="text-zinc-400 text-sm mt-1">Last updated: April 2026</p>
        </div>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">1. Acceptance of Terms</h2>
          <p className="text-zinc-300 text-sm leading-relaxed">
            By accessing or using iMYNTED ("the Platform"), you agree to be bound by these Terms of
            Service. If you do not agree, do not use the Platform.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">2. Not Investment Advice</h2>
          <p className="text-zinc-300 text-sm leading-relaxed">
            iMYNTED is a financial data and analytics platform provided for <strong>informational
            purposes only</strong>. Nothing on this Platform constitutes investment advice, a
            solicitation, or a recommendation to buy or sell any security or financial instrument.
            You are solely responsible for your own investment decisions.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">3. Risk Disclosure</h2>
          <p className="text-zinc-300 text-sm leading-relaxed">
            Trading and investing in securities involves <strong>significant risk of loss</strong>,
            including the possible loss of your entire investment. Past performance is not indicative
            of future results. Market data, news, and analytics displayed on the Platform may be
            delayed, incomplete, or inaccurate. Do not make trading decisions based solely on
            information from this Platform.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">4. Beta Service</h2>
          <p className="text-zinc-300 text-sm leading-relaxed">
            iMYNTED is currently in beta. Features may change, be removed, or be unavailable at any
            time. We make no guarantees regarding uptime, accuracy, or reliability of the service
            during the beta period.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">5. Invite-Only Access</h2>
          <p className="text-zinc-300 text-sm leading-relaxed">
            Access to the Platform during the beta period requires a valid invite code. Sharing your
            invite code or credentials with unauthorized individuals is prohibited.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">6. Limitation of Liability</h2>
          <p className="text-zinc-300 text-sm leading-relaxed">
            To the fullest extent permitted by law, iMYNTED and its operators shall not be liable for
            any financial losses, trading losses, or other damages arising from your use of the
            Platform or reliance on any data or content provided herein.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">7. Changes to Terms</h2>
          <p className="text-zinc-300 text-sm leading-relaxed">
            We reserve the right to update these Terms at any time. Continued use of the Platform
            after changes constitutes acceptance of the revised Terms.
          </p>
        </section>

        <div className="pt-4 border-t border-zinc-800">
          <a href="/login" className="text-sm text-zinc-400 hover:text-white underline">
            Back to sign in
          </a>
        </div>
      </div>
    </main>
  );
}

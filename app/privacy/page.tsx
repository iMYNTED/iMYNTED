export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-black text-white px-6 py-12">
      <div className="max-w-2xl mx-auto space-y-8">
        <div>
          <h1 className="text-2xl font-bold">Privacy Policy</h1>
          <p className="text-zinc-400 text-sm mt-1">Last updated: April 2026</p>
        </div>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">1. Information We Collect</h2>
          <p className="text-zinc-300 text-sm leading-relaxed">
            We collect only your email address for the purpose of authentication via magic link. We
            do not collect payment information, phone numbers, or personal identification documents.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">2. How We Use Your Information</h2>
          <p className="text-zinc-300 text-sm leading-relaxed">
            Your email address is used solely to send authentication links and to identify your
            account. We do not sell, rent, or share your email address with third parties for
            marketing purposes.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">3. Third-Party Services</h2>
          <p className="text-zinc-300 text-sm leading-relaxed">
            iMYNTED uses Supabase for authentication and data storage. By using the Platform, you
            also agree to Supabase's privacy practices. Market data is sourced from third-party
            providers including Finnhub and Alpaca. These providers may have their own data
            collection practices.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">4. Data Storage</h2>
          <p className="text-zinc-300 text-sm leading-relaxed">
            Account data is stored securely via Supabase. Preferences such as your last viewed
            symbol and workspace layout are stored locally in your browser's localStorage and are
            not transmitted to our servers.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">5. Financial Data Risk</h2>
          <p className="text-zinc-300 text-sm leading-relaxed">
            Market data, stock quotes, scanner results, and news displayed on iMYNTED may be
            delayed, inaccurate, or incomplete. We do not guarantee the accuracy or timeliness of
            any data. Use of this data for trading decisions is at your own risk.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">6. Cookies and Local Storage</h2>
          <p className="text-zinc-300 text-sm leading-relaxed">
            We use authentication cookies managed by Supabase to maintain your session. We use
            browser localStorage to remember your preferences across sessions. No advertising or
            tracking cookies are used.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">7. Contact</h2>
          <p className="text-zinc-300 text-sm leading-relaxed">
            For privacy-related questions, contact us through the Platform's support channel.
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

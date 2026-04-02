export default function RiskDisclosurePage() {
  return (
    <div className="max-w-3xl mx-auto px-4 md:px-6 py-8 md:py-12 text-white/80">
      <div className="flex items-center gap-2 mb-6">
        <span className="text-[10px] font-bold tracking-[0.14em] text-emerald-400/80 uppercase">iMYNTED</span>
        <span className="text-white/15">|</span>
        <h1 className="text-[18px] md:text-[22px] font-bold text-white tracking-wide">Risk Disclosure Statement</h1>
      </div>

      <p className="text-[12px] text-white/40 mb-8">Effective Date: March 31, 2026</p>

      <div className="space-y-8 text-[13px] leading-relaxed">

        <section>
          <h2 className="text-[14px] font-bold text-white mb-2">1. Educational &amp; Informational Purpose Only</h2>
          <p className="mb-3">iMYNTED provides analytical tools, market commentary, data visualization, and informational content for <strong className="text-white">educational and informational purposes only</strong>.</p>
          <p className="mb-2">Nothing on this platform constitutes:</p>
          <ul className="list-disc pl-5 space-y-1 text-white/70">
            <li>Investment advice</li>
            <li>Financial advice</li>
            <li>Trading advice</li>
            <li>Legal advice</li>
            <li>Tax advice</li>
          </ul>
        </section>

        <section>
          <h2 className="text-[14px] font-bold text-white mb-2">2. Not an Investment Advisor</h2>
          <p className="mb-3">iMYNTED is not registered with the U.S. Securities and Exchange Commission (SEC) as an investment advisor.</p>
          <p className="mb-2">We do not:</p>
          <ul className="list-disc pl-5 space-y-1 text-white/70">
            <li>Provide personalized investment recommendations</li>
            <li>Manage client funds</li>
            <li>Act as fiduciaries</li>
          </ul>
        </section>

        <section>
          <h2 className="text-[14px] font-bold text-white mb-2">3. Market Risk &amp; Volatility</h2>
          <p className="mb-2">Trading securities involves substantial risk, including:</p>
          <ul className="list-disc pl-5 space-y-1 text-white/70">
            <li>Loss of principal</li>
            <li>Extreme volatility</li>
            <li>Liquidity risk</li>
            <li>Microcap dilution risk</li>
            <li>Market manipulation risk</li>
          </ul>
          <p className="mt-3"><strong className="text-white">Users may lose some or all of their capital.</strong></p>
        </section>

        <section>
          <h2 className="text-[14px] font-bold text-white mb-2">4. Cryptocurrency Risk</h2>
          <p className="mb-2">Cryptocurrency markets carry additional risks, including:</p>
          <ul className="list-disc pl-5 space-y-1 text-white/70">
            <li>Extreme price volatility</li>
            <li>Regulatory uncertainty</li>
            <li>Exchange and counterparty risk</li>
            <li>Irreversible transactions</li>
            <li>Lack of FDIC or SIPC protection</li>
          </ul>
        </section>

        <section>
          <h2 className="text-[14px] font-bold text-white mb-2">5. Futures &amp; Derivatives Risk</h2>
          <p className="mb-2">Futures and derivatives trading involves:</p>
          <ul className="list-disc pl-5 space-y-1 text-white/70">
            <li>High leverage that can amplify gains and losses</li>
            <li>Margin calls and forced liquidation</li>
            <li>Potential for losses exceeding initial investment</li>
            <li>Complex pricing and expiration mechanics</li>
          </ul>
        </section>

        <section>
          <h2 className="text-[14px] font-bold text-white mb-2">6. No Guarantees</h2>
          <p className="mb-2">We do not guarantee:</p>
          <ul className="list-disc pl-5 space-y-1 text-white/70">
            <li>Accuracy of data</li>
            <li>Market outcomes</li>
            <li>Profitability</li>
            <li>Future performance</li>
          </ul>
          <p className="mt-3"><strong className="text-white">Past performance does not guarantee future results.</strong></p>
        </section>

        <section>
          <h2 className="text-[14px] font-bold text-white mb-2">7. Data &amp; Information Disclaimer</h2>
          <p>Market data, quotes, charts, and analytics displayed on iMYNTED are sourced from third-party providers and may be delayed, inaccurate, or incomplete. iMYNTED does not warrant the accuracy, completeness, or timeliness of any data. Users should verify all information independently before making any trading decisions.</p>
        </section>

        <section>
          <h2 className="text-[14px] font-bold text-white mb-2">8. User Responsibility</h2>
          <p className="mb-2">You agree:</p>
          <ul className="list-disc pl-5 space-y-1 text-white/70">
            <li>To conduct your own due diligence</li>
            <li>To consult licensed professionals where appropriate</li>
            <li>That you assume full responsibility for all trading decisions</li>
            <li>That any reliance on information from iMYNTED is at your own risk</li>
          </ul>
        </section>

        <section>
          <h2 className="text-[14px] font-bold text-white mb-2">9. Assumption of Risk</h2>
          <p><strong className="text-white">Use of iMYNTED is at your own risk.</strong> By using the Platform, you acknowledge that you understand the risks involved in trading securities, cryptocurrencies, futures, and other financial instruments, and you accept full responsibility for any losses incurred.</p>
        </section>

        <section>
          <h2 className="text-[14px] font-bold text-white mb-2">10. Contact</h2>
          <p>For questions about this Risk Disclosure, contact us at <span className="text-emerald-400/70">legal@imynted.com</span></p>
        </section>

      </div>
    </div>
  );
}

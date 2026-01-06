import NewsFeed from "@/app/components/NewsFeed";

function Card({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border bg-background p-4">
      <div className="mb-3 text-sm font-medium">{title}</div>
      {children}
    </section>
  );
}

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      {/* Title row */}
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            Unified Monitoring • Read-only aggregation (Phase 1)
          </p>
        </div>

        <div className="text-sm">
          <span className="rounded-full border px-3 py-1">
            🟢 Feeds Live
          </span>
        </div>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card title="Alerts (24h)">
          <div className="text-3xl font-semibold">0</div>
          <div className="text-sm text-muted-foreground">
            Hooking rules engine next
          </div>
        </Card>

        <Card title="Connected Platforms">
          <div className="text-3xl font-semibold">0</div>
          <div className="text-sm text-muted-foreground">
            Connect page will populate this
          </div>
        </Card>

        <Card title="Exposure Snapshot">
          <div className="text-3xl font-semibold">—</div>
          <div className="text-sm text-muted-foreground">
            Read-only positions coming next
          </div>
        </Card>
      </div>

      {/* Main grid */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* News */}
        <div className="lg:col-span-2">
          <Card title="Market News">
            <NewsFeed />
          </Card>
        </div>

        {/* Right column */}
        <div className="space-y-4">
          <Card title="System Status">
            <ul className="space-y-2 text-sm">
              <li className="flex items-center justify-between">
                <span className="text-muted-foreground">Auth</span>
                <span>✅ OK</span>
              </li>
              <li className="flex items-center justify-between">
                <span className="text-muted-foreground">News</span>
                <span>✅ Live</span>
              </li>
              <li className="flex items-center justify-between">
                <span className="text-muted-foreground">Alerts</span>
                <span>⏳ Next</span>
              </li>
              <li className="flex items-center justify-between">
                <span className="text-muted-foreground">Accounts</span>
                <span>⏳ Next</span>
              </li>
            </ul>
          </Card>

          <Card title="Quick Actions">
            <div className="grid gap-2">
              <a
                className="rounded-lg border px-3 py-2 text-sm hover:bg-muted"
                href="/alerts"
              >
                View Alerts
              </a>
              <a
                className="rounded-lg border px-3 py-2 text-sm hover:bg-muted"
                href="/accounts"
              >
                Manage Accounts
              </a>
              <a
                className="rounded-lg border px-3 py-2 text-sm hover:bg-muted"
                href="/settings"
              >
                Settings
              </a>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}



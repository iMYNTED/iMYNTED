import Sidebar from "../components/Sidebar";

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-dvh flex">
      <Sidebar />

      <div className="flex-1 flex flex-col">
        <header className="h-14 border-b flex items-center justify-between px-6 bg-background">
          <span className="text-sm text-muted-foreground">
            Command Center
          </span>
          <span className="text-sm">🟢 All systems nominal</span>
        </header>

        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}

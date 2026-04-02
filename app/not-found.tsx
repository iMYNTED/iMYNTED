export default function NotFound() {
  return (
    <div style={{ background: "#000", color: "#fff", minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "monospace" }}>
      <div style={{ textAlign: "center" }}>
        <p style={{ color: "rgba(52,211,153,0.7)", fontSize: 11, letterSpacing: "0.14em", marginBottom: 8 }}>iMYNTED</p>
        <h1 style={{ fontSize: 48, fontWeight: 900, margin: "0 0 8px" }}>404</h1>
        <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 13 }}>Page not found</p>
      </div>
    </div>
  );
}

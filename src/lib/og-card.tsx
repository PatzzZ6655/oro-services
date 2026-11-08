export function OgCard() {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        background: "#0B0F19",
        color: "#FFFFFF",
        padding: "72px",
      }}
    >
      <div
        style={{
          display: "flex",
          fontSize: 28,
          letterSpacing: 4,
          color: "#FDBA74",
        }}
      >
        ORO SERVICES
      </div>
      <div style={{ display: "flex", flexDirection: "column" }}>
        <div style={{ display: "flex", fontSize: 72, lineHeight: 1.05 }}>
          Building and plumbing
        </div>
        <div
          style={{
            display: "flex",
            marginTop: 20,
            fontSize: 32,
            color: "#E2E8F0",
          }}
        >
          Emoro Building and Emporo Plumbing
        </div>
      </div>
      <div style={{ display: "flex", fontSize: 24, color: "#CBD5E1" }}>
        www.orosvc.com
      </div>
    </div>
  );
}

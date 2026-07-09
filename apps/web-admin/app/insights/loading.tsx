// Skeleton shown while the (heavier) insights analytics compute on the server.
export default function InsightsLoading() {
  return (
    <>
      <div className="page-head">
        <div className="sk sk-title" style={{ width: "34%", height: 22 }} />
        <div className="sk sk-line" style={{ width: "60%" }} />
      </div>
      <div className="card" style={{ marginBottom: 16, height: 96 }}>
        <div className="sk sk-num" style={{ width: "45%", marginTop: 8 }} />
      </div>
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="sk sk-title" />
        {Array.from({ length: 6 }).map((_, i) => (
          <div className="sk sk-line" key={i} style={{ width: `${90 - i * 8}%` }} />
        ))}
      </div>
      <div className="grid grid-2">
        {[0, 1].map((c) => (
          <div className="card" key={c}>
            <div className="sk sk-title" />
            <div className="sk sk-chart" />
          </div>
        ))}
      </div>
    </>
  );
}

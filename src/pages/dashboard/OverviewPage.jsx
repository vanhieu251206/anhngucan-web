export default function OverviewPage() {
  return (
    <div className="admin-card">
      <h2>Tổng quan</h2>
      <div className="admin-empty-state">
        <span className="admin-empty-state-icon" aria-hidden="true">📊</span>
        <p className="admin-empty-state-title">Chưa có số liệu tổng hợp</p>
        <p className="admin-muted-text">
          Số bài học, số học sinh đang hoạt động... sẽ hiện ở đây khi tính năng theo dõi tiến độ
          học sinh (Phase 3) được triển khai.
        </p>
      </div>
    </div>
  );
}

import useStore from '../store';
import { calcProjectCost, fmt, getBottleneck } from '../calc';
import AuthButton from './AuthButton';

export default function Header() {
  const projects = useStore((s) => s.projects);
  const platforms = useStore((s) => s.platforms);
  const globalConfig = useStore((s) => s.globalConfig);
  const roles = useStore((s) => s.roles);

  const totalCost = projects.reduce(
    (sum, p) => sum + calcProjectCost(p, platforms, globalConfig, roles).total,
    0
  );
  const bottleneck = getBottleneck(projects, roles);

  return (
    <div className="hd">
      <div>
        <div className="hd-title">制作成本核算器</div>
        <div className="hd-sub">Gleam Studio · AI短剧</div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <div className="hd-badges">
          <span className="badge b-gray">项目 {projects.length} 个</span>
          <span className="badge b-amber">总成本 {fmt(totalCost)}</span>
          <span className={`badge ${bottleneck ? 'b-red' : 'b-green'}`}>
            {bottleneck ? '瓶颈: ' + bottleneck : '资源充足'}
          </span>
        </div>
        <AuthButton />
      </div>
    </div>
  );
}

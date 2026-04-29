import useStore from '../../store';
import { calcProjectCost, fmt } from '../../calc';

export default function PoolTab() {
  const projects = useStore(s => s.projects);
  const platforms = useStore(s => s.platforms);
  const roles = useStore(s => s.roles);
  const globalConfig = useStore(s => s.globalConfig);

  const maxDays = Math.max(...projects.map(p => p.days), 1);
  const costs = projects.map(p => calcProjectCost(p, platforms, globalConfig, roles));
  const totalCost = costs.reduce((a, c) => a + c.total, 0);
  const totalRev = costs.reduce((a, c) => a + c.rev, 0);
  const net = totalRev - totalCost;
  const totalHr = roles.reduce((a, r) => a + r.count * r.salary * (maxDays / 30), 0);

  return (
    <div>
      <div className="g4" style={{ marginBottom: 14 }}>
        <div className="mc"><div className="ml">并行项目</div><div className="mv">{projects.length}</div><div className="ms">个</div></div>
        <div className="mc"><div className="ml">总人力成本</div><div className="mv warn">{fmt(totalHr)}</div><div className="ms">全周期</div></div>
        <div className="mc"><div className="ml">汇总总成本</div><div className="mv bad">{fmt(totalCost)}</div><div className="ms">所有项目</div></div>
        <div className="mc"><div className="ml">汇总净利润</div><div className={`mv ${net >= 0 ? 'ok' : 'bad'}`}>{net >= 0 ? '+' : ''}{fmt(net)}</div><div className="ms">预估</div></div>
      </div>

      <div className="card">
        <div className="stitle">岗位资源调度（所有项目汇总）</div>
        <div style={{ fontSize: 12, color: '#999', marginBottom: 10 }}>
          供给 = 人数 × 日工时 × 最长项目周期 &nbsp;|&nbsp; 需求 = 各项目集数 × 每集工时 合计
        </div>
        {roles.length === 0 && <div style={{ fontSize: 13, color: '#aaa', padding: '8px 0' }}>暂无岗位数据，请在全局配置中添加</div>}
        {roles.map((r, i) => {
          const demand = projects.reduce((a, p) => a + r.hrsPerEp * p.eps, 0);
          const supply = r.count * r.dayHrs * maxDays;
          const ratio = supply > 0 ? demand / supply : 0;
          const pct = Math.min(ratio * 100, 100);
          const over = ratio > 1, tight = ratio > 0.8;
          const barColor = over ? '#E24B4A' : tight ? '#BA7517' : '#639922';
          const cl = over ? 'cap-bad' : tight ? 'cap-warn' : 'cap-ok';
          const lbl = over ? `超载 ${((ratio - 1) * 100).toFixed(0)}%` : tight ? `紧张 ${(ratio * 100).toFixed(0)}%` : `充足 ${(ratio * 100).toFixed(0)}%`;
          return (
            <div className="pool-row" key={i}>
              <div style={{ minWidth: 100, fontSize: 13 }}>
                {r.name} <span style={{ color: '#bbb', fontSize: 11 }}>({r.count}人)</span>
              </div>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#999' }}>
                  <span>需 {Math.round(demand)}h</span><span>供 {Math.round(supply)}h</span>
                </div>
                <div className="bar-bg">
                  <div className="bar-fill" style={{ width: pct.toFixed(1) + '%', background: barColor }} />
                </div>
              </div>
              <div style={{ minWidth: 80, textAlign: 'right', marginLeft: 10 }}>
                <span className={cl}>{lbl}</span>
              </div>
              <div style={{ minWidth: 100, textAlign: 'right', fontSize: 11, color: '#A32D2D' }}>
                {over ? `需加 ${Math.ceil((demand - supply) / r.dayHrs / maxDays)} 人` : ''}
              </div>
            </div>
          );
        })}
      </div>

      <div className="card">
        <div className="stitle">人力成本跨项目分摊（按工时比例）</div>
        {(!projects.length || !roles.length)
          ? <div style={{ fontSize: 13, color: '#aaa', padding: '8px 0' }}>暂无数据</div>
          : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', tableLayout: 'fixed', fontSize: 12 }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #e8e8e8' }}>
                    <th style={{ textAlign: 'left', padding: '5px 6px', fontWeight: 400, color: '#aaa', width: 100 }}>岗位</th>
                    {projects.map((p, i) => (
                      <th key={i} style={{ textAlign: 'right', padding: '5px 6px', fontWeight: 400, color: '#aaa' }}>{p.name}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {roles.map((r, ri) => {
                    const totalD = projects.reduce((a, p) => a + r.hrsPerEp * p.eps, 0);
                    return (
                      <tr key={ri} style={{ borderBottom: '1px solid #f5f5f5' }}>
                        <td style={{ padding: '5px 6px', color: '#888' }}>{r.name}</td>
                        {projects.map((p, pi) => {
                          const hrs = r.hrsPerEp * p.eps;
                          const ratio = totalD > 0 ? hrs / totalD : 0;
                          const cost = r.count * r.salary * (p.days / 30) * ratio;
                          return (
                            <td key={pi} style={{ textAlign: 'right', padding: '5px 6px' }}>
                              {fmt(cost)} <span style={{ color: '#bbb', fontSize: 10 }}>{(ratio * 100).toFixed(0)}%</span>
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                  <tr style={{ fontWeight: 500, borderTop: '1px solid #e8e8e8' }}>
                    <td style={{ padding: '6px 6px' }}>人力合计</td>
                    {projects.map((p, pi) => (
                      <td key={pi} style={{ textAlign: 'right', padding: '6px 6px' }}>
                        {fmt(calcProjectCost(p, platforms, globalConfig, roles).hrCost)}
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
          )
        }
      </div>
    </div>
  );
}

import { useState, useRef, useEffect } from 'react';
import { Chart } from 'chart.js/auto';
import useStore from '../../store';
import { calcProjectCost, fmt } from '../../calc';

export default function CurveTab() {
  const projects = useStore(s => s.projects);
  const platforms = useStore(s => s.platforms);
  const roles = useStore(s => s.roles);
  const globalConfig = useStore(s => s.globalConfig);

  const [selIdx, setSelIdx] = useState(0);
  const [seriesVis, setSeriesVis] = useState({ tot: true, ai: true, hr: true, fix: false });

  const curveRef = useRef(null);
  const pieRef = useRef(null);
  const curveInst = useRef(null);
  const pieInst = useRef(null);

  const idx = Math.min(selIdx, Math.max(projects.length - 1, 0));
  const p = projects[idx];
  const c = p ? calcProjectCost(p, platforms, globalConfig, roles) : null;

  useEffect(() => {
    if (!p || !c || !curveRef.current || !pieRef.current) return;

    if (curveInst.current) curveInst.current.destroy();
    if (pieInst.current) pieInst.current.destroy();

    const maxEp = Math.max(p.eps * 2, 40);
    const labels = [];
    const dTot = [], dAi = [], dHr = [], dFix = [];
    for (let e = 1; e <= maxEp; e++) {
      const cc = calcProjectCost({ ...p, eps: e }, platforms, globalConfig, roles);
      labels.push(e);
      dTot.push(Math.round(cc.total / e));
      dAi.push(Math.round(cc.aiCost / e));
      dHr.push(Math.round(cc.hrCost / e));
      dFix.push(Math.round(cc.fixCost / e));
    }

    curveInst.current = new Chart(curveRef.current, {
      type: 'line',
      data: {
        labels,
        datasets: [
          { label: '总/集', data: dTot, borderColor: '#185FA5', backgroundColor: 'rgba(55,138,221,0.06)', fill: true, tension: 0.3, pointRadius: 0, hidden: !seriesVis.tot },
          { label: 'AI/集', data: dAi, borderColor: '#3B6D11', fill: false, tension: 0.3, pointRadius: 0, hidden: !seriesVis.ai },
          { label: '人力/集', data: dHr, borderColor: '#BA7517', borderDash: [5, 3], fill: false, tension: 0.3, pointRadius: 0, hidden: !seriesVis.hr },
          { label: '固定/集', data: dFix, borderColor: '#993556', borderDash: [2, 5], fill: false, tension: 0.3, pointRadius: 0, hidden: !seriesVis.fix },
        ],
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: { mode: 'index', intersect: false, callbacks: { label: ctx => `${ctx.dataset.label}: ¥${ctx.parsed.y.toLocaleString()}` } },
        },
        scales: {
          x: { grid: { display: false }, ticks: { maxTicksLimit: 10, font: { size: 11 } }, title: { display: true, text: '集数', font: { size: 11 } } },
          y: { grid: { color: 'rgba(0,0,0,0.05)' }, ticks: { font: { size: 11 }, callback: v => '¥' + v.toLocaleString() } },
        },
      },
    });

    const pd = [Math.round(c.aiCost), Math.round(c.scriptCost), Math.round(c.hrCost), Math.round(c.fixCost)];
    const pl = ['AI积分', '脚本', '人力', '固定'];
    const pc = ['#185FA5', '#378ADD', '#BA7517', '#3B6D11'];
    const pt = pd.reduce((a, b) => a + b, 0);

    pieInst.current = new Chart(pieRef.current, {
      type: 'doughnut',
      data: { labels: pl, datasets: [{ data: pd, backgroundColor: pc, borderWidth: 0 }] },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: { callbacks: { label: ctx => `${ctx.label}: ${pt > 0 ? (ctx.raw / pt * 100).toFixed(1) : 0}%` } },
        },
        cutout: '58%',
      },
    });

    return () => {
      if (curveInst.current) { curveInst.current.destroy(); curveInst.current = null; }
      if (pieInst.current) { pieInst.current.destroy(); pieInst.current = null; }
    };
  }, [idx, seriesVis, projects, platforms, roles, globalConfig]);

  if (!p || !c) return <div className="card" style={{ textAlign: 'center', color: '#aaa', padding: 20 }}>暂无项目，请先在「项目管理」中添加</div>;

  const items = [
    { l: 'AI积分（分镜+图像）', v: c.aiCost, cl: '#185FA5' },
    { l: '脚本外包', v: c.scriptCost, cl: '#378ADD' },
    { l: '人力成本', v: c.hrCost, cl: '#BA7517' },
    { l: '固定成本', v: c.fixCost, cl: '#3B6D11' },
  ];
  const pd = items.map(it => Math.round(it.v));
  const pt = pd.reduce((a, b) => a + b, 0);
  const pl = ['AI积分', '脚本', '人力', '固定'];
  const pc = ['#185FA5', '#378ADD', '#BA7517', '#3B6D11'];

  const toggleSeries = (k) => setSeriesVis(prev => ({ ...prev, [k]: !prev[k] }));

  return (
    <div>
      <div className="fld" style={{ marginBottom: 14, maxWidth: 260 }}>
        <label>选择分析项目</label>
        <select value={idx} onChange={e => setSelIdx(Number(e.target.value))}>
          {projects.map((proj, i) => <option key={i} value={i}>{proj.name}</option>)}
        </select>
      </div>

      <div className="g4" style={{ marginBottom: 14 }}>
        <div className="mc"><div className="ml">总成本</div><div className="mv">{fmt(c.total)}</div><div className="ms">全季</div></div>
        <div className="mc"><div className="ml">单集均摊</div><div className="mv warn">{fmt(c.total / Math.max(p.eps, 1))}</div><div className="ms">元/集</div></div>
        <div className="mc"><div className="ml">AI积分占比</div><div className="mv">{c.total > 0 ? (c.aiCost / c.total * 100).toFixed(1) + '%' : '—'}</div><div className="ms">分镜+图像</div></div>
        <div className="mc"><div className="ml">净利润</div><div className={`mv ${c.net >= 0 ? 'ok' : 'bad'}`}>{(c.net >= 0 ? '+' : '') + fmt(c.net)}</div><div className="ms">预估</div></div>
      </div>

      <div className="card">
        <div className="stitle">成本构成</div>
        {items.map((it, i) => (
          <div className="trow" key={i}>
            <span className="lb">{it.l}</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 80, height: 4, borderRadius: 2, background: '#eee', overflow: 'hidden' }}>
                <div style={{ width: `${c.total > 0 ? (it.v / c.total * 100).toFixed(1) : 0}%`, height: '100%', background: it.cl, borderRadius: 2 }} />
              </div>
              <span style={{ fontSize: 11, color: '#999', width: 36, textAlign: 'right' }}>
                {c.total > 0 ? (it.v / c.total * 100).toFixed(1) : 0}%
              </span>
              <span style={{ fontWeight: 500, minWidth: 72, textAlign: 'right' }}>{fmt(it.v)}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <div className="stitle" style={{ margin: 0 }}>单集成本 vs 集数</div>
          <div>
            {[['tot', '总/集'], ['ai', 'AI/集'], ['hr', '人力/集'], ['fix', '固定/集']].map(([k, label]) => (
              <span key={k} className={`tag${seriesVis[k] ? ' on' : ''}`} onClick={() => toggleSeries(k)}>{label}</span>
            ))}
          </div>
        </div>
        <div style={{ position: 'relative', width: '100%', height: 250 }}>
          <canvas ref={curveRef} />
        </div>
      </div>

      <div className="card">
        <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
          <div style={{ position: 'relative', width: 160, height: 160, flexShrink: 0 }}>
            <canvas ref={pieRef} />
          </div>
          <div style={{ flex: 1 }}>
            {pl.map((l, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10, fontSize: 12, color: '#888' }}>
                <span style={{ width: 10, height: 10, borderRadius: 2, background: pc[i], flexShrink: 0 }} />
                <span style={{ flex: 1 }}>{l}</span>
                <span style={{ fontWeight: 500, color: '#1a1a1a' }}>{pt > 0 ? (pd[i] / pt * 100).toFixed(1) : 0}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

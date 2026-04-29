import useStore from '../../store';

export default function AIPointsConfig() {
  const globalConfig = useStore(s => s.globalConfig);
  const setGlobalConfig = useStore(s => s.setGlobalConfig);

  const set = (key, val) => setGlobalConfig({ ...globalConfig, [key]: val });

  const { aiRate, aiDur, shotRatio, aiImgPts, aiImgN, cSoft, cServer, cMisc } = globalConfig;
  const ratio = shotRatio || 1;
  const actualDur = Math.round(aiDur * ratio);
  const ptsPerEp = Math.round(aiRate * actualDur);

  return (
    <>
      <div className="card">
        <div className="stitle">分镜积分配置</div>
        <div className="g3">
          <div className="fld">
            <label>生成速率（积分/s）</label>
            <input type="number" value={aiRate} step="0.5"
              onChange={e => set('aiRate', Number(e.target.value))} />
          </div>
          <div className="fld">
            <label>每集成片时长（s）</label>
            <input type="number" value={aiDur}
              onChange={e => set('aiDur', Number(e.target.value))} />
          </div>
          <div className="fld">
            <label>片比（成片 : 素材）</label>
            <input type="number" value={shotRatio ?? 3.0} step="0.1" min="1.0"
              onChange={e => set('shotRatio', Math.round(Number(e.target.value) * 10) / 10)} />
          </div>
        </div>
        <div style={{ marginTop: 10, padding: '8px 12px', background: '#f7f7f5', borderRadius: 8, border: '1px solid #e8e8e8', fontSize: 12, color: '#888' }}>
          实际生成素材 <strong style={{ color: '#1a1a1a' }}>{actualDur}s</strong>（成片 {aiDur}s × 片比 {ratio.toFixed(1)}）→ 每集分镜积分 <strong style={{ color: '#185FA5' }}>{ptsPerEp.toLocaleString()} 积分</strong>
        </div>
        <div className="g2" style={{ marginTop: 10 }}>
          <div className="fld">
            <label>图像积分/张</label>
            <input type="number" value={aiImgPts}
              onChange={e => set('aiImgPts', Number(e.target.value))} />
          </div>
          <div className="fld">
            <label>每集图像数量（张）</label>
            <input type="number" value={aiImgN}
              onChange={e => set('aiImgN', Number(e.target.value))} />
          </div>
        </div>
      </div>
      <div className="card">
        <div className="stitle">固定成本（月）</div>
        <div className="g3">
          <div className="fld">
            <label>软件订阅（元）</label>
            <input type="number" value={cSoft}
              onChange={e => set('cSoft', Number(e.target.value))} />
          </div>
          <div className="fld">
            <label>服务器/云计算（元）</label>
            <input type="number" value={cServer}
              onChange={e => set('cServer', Number(e.target.value))} />
          </div>
          <div className="fld">
            <label>其他杂费（元）</label>
            <input type="number" value={cMisc}
              onChange={e => set('cMisc', Number(e.target.value))} />
          </div>
        </div>
      </div>
    </>
  );
}

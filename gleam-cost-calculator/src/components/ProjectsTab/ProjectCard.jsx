import useStore from '../../store';
import { calcProjectCost, fmt } from '../../calc';

export default function ProjectCard({ project, isOpen, onToggle, onUpdate, onDelete }) {
  const platforms = useStore(s => s.platforms);
  const globalConfig = useStore(s => s.globalConfig);
  const roles = useStore(s => s.roles);

  const c = calcProjectCost(project, platforms, globalConfig, roles);
  const profColor = c.net >= 0 ? '#3B6D11' : '#A32D2D';
  const profBg = c.net >= 0 ? '#EAF3DE' : '#FCEBEB';

  const handleDelete = (e) => {
    e.stopPropagation();
    if (confirm(`删除项目「${project.name}」？`)) onDelete();
  };

  return (
    <div className={`proj-card${isOpen ? ' open' : ''}`}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
        onClick={onToggle}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 14, fontWeight: 500 }}>{project.name}</span>
          <span className="badge b-gray">{project.eps}集 · {project.days}天</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <span className="badge b-amber">{fmt(c.total)}</span>
          <span className="badge" style={{ background: profBg, color: profColor }}>
            {c.net >= 0 ? '+' : ''}{fmt(c.net)}
          </span>
          <span style={{ color: '#bbb', fontSize: 12 }}>{isOpen ? '▲' : '▼'}</span>
          <button className="delbtn" onClick={handleDelete}>×</button>
        </div>
      </div>

      {isOpen && (
        <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid #eee' }}>
          <div className="g3" style={{ marginBottom: 10 }}>
            <div className="fld">
              <label>项目名称</label>
              <input className="si" value={project.name}
                onChange={e => onUpdate({ name: e.target.value })} />
            </div>
            <div className="fld">
              <label>总集数</label>
              <input className="si" type="number" value={project.eps} min="1"
                onChange={e => onUpdate({ eps: Math.max(1, Number(e.target.value)) })} />
            </div>
            <div className="fld">
              <label>制作周期（天）</label>
              <input className="si" type="number" value={project.days} min="1"
                onChange={e => onUpdate({ days: Math.max(1, Number(e.target.value)) })} />
            </div>
          </div>
          <div className="fld" style={{ marginBottom: 10, maxWidth: 220 }}>
            <label>脚本外包费用（元）</label>
            <input className="si" type="number" value={project.scriptCost || 0}
              onChange={e => onUpdate({ scriptCost: Number(e.target.value) })} />
          </div>
          <div style={{ fontSize: 10, color: '#aaa', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 8 }}>收入预测</div>
          <div className="g3" style={{ marginBottom: 10 }}>
            <div className="fld">
              <label>平台分成/集（元）</label>
              <input className="si" type="number" value={project.revPlat || 0}
                onChange={e => onUpdate({ revPlat: Number(e.target.value) })} />
            </div>
            <div className="fld">
              <label>品牌植入（元）</label>
              <input className="si" type="number" value={project.revBrand || 0}
                onChange={e => onUpdate({ revBrand: Number(e.target.value) })} />
            </div>
            <div className="fld">
              <label>版权/发行（元）</label>
              <input className="si" type="number" value={project.revLic || 0}
                onChange={e => onUpdate({ revLic: Number(e.target.value) })} />
            </div>
          </div>
          <div className="g3">
            <div className="fld">
              <label>IP衍生品（元）</label>
              <input className="si" type="number" value={project.revMerch || 0}
                onChange={e => onUpdate({ revMerch: Number(e.target.value) })} />
            </div>
            <div className="fld">
              <label>预估播放量（万次）</label>
              <input className="si" type="number" value={project.revViews || 0}
                onChange={e => onUpdate({ revViews: Number(e.target.value) })} />
            </div>
            <div className="fld">
              <label>广告CPM（元/千次）</label>
              <input className="si" type="number" value={project.revCpm || 0}
                onChange={e => onUpdate({ revCpm: Number(e.target.value) })} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

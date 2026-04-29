import useStore from '../../store';

export default function RoleTable() {
  const roles = useStore(s => s.roles);
  const updateRole = useStore(s => s.updateRole);
  const deleteRole = useStore(s => s.deleteRole);
  const addRole = useStore(s => s.addRole);

  return (
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div className="stitle" style={{ margin: 0 }}>人员资源池（公司标准工时）</div>
        <button className="addbtn"
          onClick={() => addRole({ name: '新岗位', count: 1, salary: 8000, hrsPerEp: 2, dayHrs: 8 })}>
          + 新增岗位
        </button>
      </div>
      <div className="res-hdr">
        <span style={{ fontSize: 10, color: '#aaa' }}>岗位名称</span>
        <span style={{ fontSize: 10, color: '#aaa', textAlign: 'center' }}>人数</span>
        <span style={{ fontSize: 10, color: '#aaa', textAlign: 'center' }}>月薪（元）</span>
        <span style={{ fontSize: 10, color: '#aaa', textAlign: 'center' }}>每集工时(h)</span>
        <span style={{ fontSize: 10, color: '#aaa', textAlign: 'center' }}>日工时(h)</span>
        <span></span>
      </div>
      {roles.map((r, i) => (
        <div className="res-row" key={i}>
          <input className="si" value={r.name}
            onChange={e => updateRole(i, { name: e.target.value })} />
          <input className="si" type="number" value={r.count} min="0" style={{ textAlign: 'center' }}
            onChange={e => updateRole(i, { count: Number(e.target.value) })} />
          <input className="si" type="number" value={r.salary}
            onChange={e => updateRole(i, { salary: Number(e.target.value) })} />
          <input className="si" type="number" value={r.hrsPerEp} step="0.5" style={{ textAlign: 'center' }}
            onChange={e => updateRole(i, { hrsPerEp: Number(e.target.value) })} />
          <input className="si" type="number" value={r.dayHrs} style={{ textAlign: 'center' }}
            onChange={e => updateRole(i, { dayHrs: Number(e.target.value) })} />
          <button className="delbtn" onClick={() => deleteRole(i)}>×</button>
        </div>
      ))}
      <div style={{ marginTop: 8, fontSize: 11, color: '#bbb' }}>
        产能逻辑：所有岗位协作完成每集内容，工时需求汇总后对比供给，瓶颈岗位决定整体进度
      </div>
    </div>
  );
}

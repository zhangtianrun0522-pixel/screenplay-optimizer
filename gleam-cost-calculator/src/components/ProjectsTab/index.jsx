import { useState } from 'react';
import useStore from '../../store';
import ProjectCard from './ProjectCard';

export default function ProjectsTab() {
  const projects = useStore(s => s.projects);
  const addProject = useStore(s => s.addProject);
  const updateProject = useStore(s => s.updateProject);
  const deleteProject = useStore(s => s.deleteProject);

  const [openIndex, setOpenIndex] = useState(-1);

  const handleAdd = () => {
    const p = {
      name: '新项目 ' + (projects.length + 1),
      eps: 20, days: 30, scriptCost: 0,
      revPlat: 0, revBrand: 0, revLic: 0, revMerch: 0, revViews: 0, revCpm: 0,
    };
    addProject(p);
    setOpenIndex(projects.length);
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div style={{ fontSize: 13, color: '#888' }}>点击项目卡片展开编辑</div>
        <button className="addbtn" onClick={handleAdd}>+ 新增项目</button>
      </div>
      {projects.length === 0 && (
        <div style={{ padding: '20px 0', textAlign: 'center', color: '#aaa', fontSize: 13 }}>
          暂无项目，点击上方「新增项目」
        </div>
      )}
      {projects.map((project, i) => (
        <ProjectCard
          key={i}
          project={project}
          isOpen={openIndex === i}
          onToggle={() => setOpenIndex(openIndex === i ? -1 : i)}
          onUpdate={(patch) => updateProject(i, patch)}
          onDelete={() => { deleteProject(i); if (openIndex === i) setOpenIndex(-1); }}
        />
      ))}
    </div>
  );
}

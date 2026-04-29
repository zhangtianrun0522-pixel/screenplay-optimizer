import { useState } from 'react';
import Header from './components/Header';
import TabBar from './components/TabBar';
import GlobalConfig from './components/GlobalConfig';
import ProjectsTab from './components/ProjectsTab';
import PoolTab from './components/PoolTab';
import CurveTab from './components/CurveTab';

const tabs = [
  { id: 'global', label: '全局配置' },
  { id: 'projects', label: '项目管理' },
  { id: 'pool', label: '资源池' },
  { id: 'curve', label: '成本曲线' },
];

export default function App() {
  const [activeTab, setActiveTab] = useState('global');

  return (
    <div className="wrap">
      <Header />
      <TabBar activeTab={activeTab} onChange={setActiveTab} tabs={tabs} />
      {activeTab === 'global' && <GlobalConfig onNext={() => setActiveTab('projects')} />}
      {activeTab === 'projects' && <ProjectsTab />}
      {activeTab === 'pool' && <PoolTab />}
      {activeTab === 'curve' && <CurveTab />}
    </div>
  );
}

import PlatformTable from './PlatformTable';
import AIPointsConfig from './AIPointsConfig';
import RoleTable from './RoleTable';

export default function GlobalConfig({ onNext }) {
  return (
    <div>
      <PlatformTable />
      <AIPointsConfig />
      <RoleTable />
      <button className="cbtn" onClick={onNext}>保存配置，管理项目 →</button>
    </div>
  );
}

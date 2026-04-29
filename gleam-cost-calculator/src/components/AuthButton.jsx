import { useState, useEffect, useRef } from 'react';
import supabase from '../supabase';
import useStore from '../store';
import { saveToCloud, loadFromCloud } from '../sync';

export default function AuthButton() {
  const [user, setUser] = useState(null);
  const [email, setEmail] = useState('');
  const [teamName, setTeamName] = useState('');
  const [tab, setTab] = useState('login');
  const [loading, setLoading] = useState(false);
  const [showInput, setShowInput] = useState(false);
  const [sent, setSent] = useState(false);
  const [syncStatus, setSyncStatus] = useState('idle');

  const platforms = useStore((s) => s.platforms);
  const roles = useStore((s) => s.roles);
  const globalConfig = useStore((s) => s.globalConfig);
  const projects = useStore((s) => s.projects);
  const setPlatforms = useStore((s) => s.setPlatforms);
  const setRoles = useStore((s) => s.setRoles);
  const setGlobalConfig = useStore((s) => s.setGlobalConfig);
  const setProjects = useStore((s) => s.setProjects);

  const debounceRef = useRef(null);

  useEffect(() => {
    const { data: listener } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === 'SIGNED_IN' && session?.user) {
          setUser(session.user);
          const { data } = await loadFromCloud(supabase, session.user.id);
          if (data) {
            if (data.platforms) setPlatforms(data.platforms);
            if (data.roles) setRoles(data.roles);
            if (data.globalConfig) setGlobalConfig(data.globalConfig);
            if (data.projects) setProjects(data.projects);
          }
          setSyncStatus('saved');
        } else if (event === 'SIGNED_OUT') {
          setUser(null);
          setSyncStatus('idle');
        }
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) setUser(session.user);
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    setSyncStatus('syncing');
    debounceRef.current = setTimeout(async () => {
      const { error } = await saveToCloud(supabase, user.id, { platforms, roles, globalConfig, projects });
      setSyncStatus(error ? 'error' : 'saved');
    }, 1500);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [platforms, roles, globalConfig, projects, user]);

  const handleLogin = async () => {
    if (!email.trim()) return;
    setLoading(true);
    const options = {
      email: email.trim(),
      options: { emailRedirectTo: window.location.origin },
    };
    if (tab === 'register') {
      options.options.data = { team_name: teamName.trim() };
    }
    const { error } = await supabase.auth.signInWithOtp(options);
    setLoading(false);
    if (!error) setSent(true);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  const resetState = () => {
    setShowInput(false);
    setSent(false);
    setEmail('');
    setTeamName('');
    setTab('login');
  };

  const btnStyle = {
    fontSize: 11, padding: '3px 10px', border: '1px solid #e0e0e0',
    borderRadius: 20, background: 'none', cursor: 'pointer', color: '#888',
  };

  const tabStyle = (isActive) => ({
    fontSize: 11, padding: '3px 10px', border: 'none', borderBottom: isActive ? '2px solid #333' : '2px solid transparent',
    background: 'none', cursor: 'pointer', color: isActive ? '#333' : '#888',
  });

  if (!user && !showInput) {
    return <button style={btnStyle} onClick={() => setShowInput(true)}>☁ 云同步</button>;
  }

  if (!user && showInput) {
    return (
      <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
        {!sent ? (
          <>
            <div style={{ display: 'flex', width: '100%', marginBottom: 4 }}>
              <button style={tabStyle(tab === 'login')} onClick={() => setTab('login')}>登录</button>
              <button style={tabStyle(tab === 'register')} onClick={() => setTab('register')}>注册</button>
            </div>
            <input
              style={{ fontSize: 12, padding: '4px 8px', border: '1px solid #e0e0e0', borderRadius: 6, width: 180 }}
              placeholder="输入邮箱"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
            />
            {tab === 'register' && (
              <input
                style={{ fontSize: 12, padding: '4px 8px', border: '1px solid #e0e0e0', borderRadius: 6, width: 140 }}
                placeholder="输入团队名称"
                value={teamName}
                onChange={(e) => setTeamName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
              />
            )}
            <button style={btnStyle} onClick={handleLogin} disabled={loading}>
              {loading ? '发送中...' : '发送'}
            </button>
            <button style={btnStyle} onClick={resetState}>✕</button>
          </>
        ) : (
          <>
            <span style={{ fontSize: 11, color: '#3B6D11' }}>✓ 已发送，请查收邮件点击链接完成登录</span>
            <button style={btnStyle} onClick={resetState}>关闭</button>
          </>
        )}
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
      <span style={{ fontSize: 11, color: syncStatus === 'error' ? '#A32D2D' : '#888' }}>
        {syncStatus === 'syncing' ? '同步中...' : syncStatus === 'saved' ? '✓ 已同步' : '✗ 同步失败'}
      </span>
      <span style={{ fontSize: 11, color: '#aaa' }}>{user?.user_metadata?.team_name || user?.email}</span>
      <button style={btnStyle} onClick={handleLogout}>退出</button>
    </div>
  );
}

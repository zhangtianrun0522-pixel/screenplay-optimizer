export async function saveToCloud(supabase, userId, state) {
  try {
    const { data, error } = await supabase
      .from('user_data')
      .upsert(
        {
          user_id: userId,
          platforms: state.platforms,
          roles: state.roles,
          global_config: state.globalConfig,
          projects: state.projects,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id' }
      )
      .select()
      .single();

    if (error) return { data: null, error };
    return { data, error: null };
  } catch (err) {
    return { data: null, error: err };
  }
}

export async function loadFromCloud(supabase, userId) {
  try {
    const { data, error } = await supabase
      .from('user_data')
      .select('platforms, roles, global_config, projects')
      .eq('user_id', userId)
      .single();

    if (error) return { data: null, error };
    if (!data) return { data: null, error: null };

    return {
      data: {
        platforms: data.platforms,
        roles: data.roles,
        globalConfig: data.global_config,
        projects: data.projects,
      },
      error: null,
    };
  } catch (err) {
    return { data: null, error: err };
  }
}

// e2e/fakeSupabase.js
// 브라우저 테스트용 가짜 Supabase: 네트워크 요청을 가로채 메모리 상태로 응답
// (실제 서버·비밀값 없이 동기화·그룹·교환·계정 흐름을 검증)

const b64url = (obj) => Buffer.from(JSON.stringify(obj)).toString('base64url');
const tokenFor = (userId) => `${b64url({ alg: 'none' })}.${b64url({ sub: userId, exp: 9999999999, role: 'authenticated' })}.sig`;
const userIdFrom = (auth) => {
  try {
    const payload = auth.replace(/^Bearer /, '').split('.')[1];
    return JSON.parse(Buffer.from(payload, 'base64url').toString()).sub;
  } catch (e) {
    return null;
  }
};

export function createFakeState(overrides = {}) {
  return {
    users: {}, // id → { id, email, new_email, is_anonymous, password }
    profiles: {}, // id → { id, auth_user_id, display_name }
    shifts: {}, // profileId → { date: code }
    notes: {}, // profileId → { date: body }
    groups: [], // { id, code, name, color, members: [profileId] }
    posts: [], // { id, group_id, author_id, body, created_at }
    swaps: [], // shift_swaps rows
    types: {}, // profileId → { code: 종류(서버 행 형식) }
    settings: {}, // profileId → { settings, updated_at }
    confirmEmail: true, // true: 이메일 인증 필요(링크 클릭 전 new_email 대기)
    providers: {}, // Supabase 에서 켠 소셜 로그인 (예: { kakao: true })
    oauthAccount: { sub: 'social-1', name: '카카오간호' }, // 브라우저에 로그인된 소셜 계정 (제공자 화면 대신)
    identities: {}, // 'kakao:social-1' → userId
    offline: false,
    seq: 1,
    ...overrides
  };
}

const newId = (state, prefix) => `${prefix}-${state.seq++}`;

function sessionFor(state, user) {
  return {
    access_token: tokenFor(user.id),
    token_type: 'bearer',
    expires_in: 3600,
    expires_at: 9999999999,
    refresh_token: `refresh-${user.id}`,
    user: publicUser(user)
  };
}
const publicUser = (u) => ({
  id: u.id,
  aud: 'authenticated',
  role: 'authenticated',
  email: u.email || '',
  new_email: u.new_email || undefined,
  is_anonymous: Boolean(u.is_anonymous),
  email_confirmed_at: u.email ? '2026-01-01T00:00:00Z' : null,
  app_metadata: {},
  user_metadata: u.meta || {},
  identities: (u.identities || []).map((provider) => ({ provider, identity_id: `${provider}-${u.id}` }))
});

const profileOf = (state, userId) => Object.values(state.profiles).find((p) => p.auth_user_id === userId);

/** 테스트에서 직접 쓰는 헬퍼: 이메일 계정(+프로필) 만들기 */
export function seedAccount(state, { email, password, name, shifts = {} }) {
  const user = { id: newId(state, 'user'), email, password, is_anonymous: false };
  state.users[user.id] = user;
  const profile = { id: newId(state, 'profile'), auth_user_id: user.id, display_name: name };
  state.profiles[profile.id] = profile;
  state.shifts[profile.id] = { ...shifts };
  return { user, profile };
}

/** 테스트에서 직접 쓰는 헬퍼: 소셜 계정이 연결된 계정(+프로필) 만들기 */
export function seedSocialAccount(state, { provider, sub, name, shifts = {} }) {
  const user = { id: newId(state, 'user'), is_anonymous: false, identities: [provider], meta: { full_name: name } };
  state.users[user.id] = user;
  state.identities[`${provider}:${sub}`] = user.id;
  const profile = { id: newId(state, 'profile'), auth_user_id: user.id, display_name: name };
  state.profiles[profile.id] = profile;
  state.shifts[profile.id] = { ...shifts };
  return { user, profile };
}

/** 테스트에서 직접 쓰는 헬퍼: 이메일 인증 링크 클릭 */
export function confirmPendingEmail(state) {
  Object.values(state.users).forEach((u) => {
    if (u.new_email) {
      u.email = u.new_email;
      delete u.new_email;
      u.is_anonymous = false;
    }
  });
}

function filtersOf(url) {
  const f = {};
  url.searchParams.forEach((v, k) => {
    if (['select', 'order', 'limit', 'on_conflict', 'columns'].includes(k)) return;
    if (v.startsWith('eq.')) f[k] = (x) => String(x) === v.slice(3);
    else if (v.startsWith('in.(')) {
      const set = new Set(v.slice(4, -1).split(',').map((s) => s.replace(/"/g, '')));
      f[k] = (x) => set.has(String(x));
    }
  });
  return (row) => Object.entries(f).every(([k, test]) => test(row[k]));
}

export async function installFakeSupabase(context, state) {
  await context.route(/supabase\.co\//, async (route) => {
    if (state.offline) return route.abort('internetdisconnected');
    const req = route.request();
    const url = new URL(req.url());
    const path = url.pathname;
    const method = req.method();
    let body = null;
    try {
      body = req.postDataJSON();
    } catch (e) {
      body = null;
    }
    const json = (data, status = 200) =>
      route.fulfill({ status, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(data) });
    const fail = (message, status = 400) => json({ message, code: 'P0001', error: message, msg: message }, status);

    if (method === 'OPTIONS') {
      return route.fulfill({
        status: 204,
        headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' }
      });
    }

    // ---------------- auth ----------------
    if (path.startsWith('/auth/v1/')) {
      const userId = userIdFrom(req.headers()['authorization'] || '');
      const me = state.users[userId];
      if (path.endsWith('/settings')) return json({ external: { email: true, ...state.providers } });
      if (path.endsWith('/user/identities/authorize')) {
        const next = new URL(`${url.origin}/auth/v1/authorize`);
        next.searchParams.set('provider', url.searchParams.get('provider'));
        next.searchParams.set('redirect_to', url.searchParams.get('redirect_to'));
        next.searchParams.set('link_user', userId);
        return json({ url: next.toString() });
      }
      if (path.endsWith('/authorize')) {
        // 제공자 로그인 화면을 건너뛰고 바로 앱으로 되돌려 보냄 (토큰은 주소 # 뒤)
        const provider = url.searchParams.get('provider');
        const back = url.searchParams.get('redirect_to');
        const linkUser = url.searchParams.get('link_user');
        const key = `${provider}:${state.oauthAccount.sub}`;
        const redirect = (hash) => route.fulfill({ status: 302, headers: { location: `${back}#${hash}` }, body: '' });
        let user;
        if (linkUser) {
          if (state.identities[key] && state.identities[key] !== linkUser) {
            return redirect('error=server_error&error_code=identity_already_exists&error_description=Identity+is+already+linked+to+another+user');
          }
          user = state.users[linkUser];
          user.is_anonymous = false;
        } else {
          user = state.users[state.identities[key]];
          if (!user) {
            user = { id: newId(state, 'user'), is_anonymous: false };
            state.users[user.id] = user;
          }
        }
        state.identities[key] = user.id;
        user.identities = [...new Set([...(user.identities || []), provider])];
        user.meta = { full_name: state.oauthAccount.name };
        const ses = sessionFor(state, user);
        return redirect(
          `access_token=${ses.access_token}&expires_in=3600&expires_at=${ses.expires_at}&refresh_token=${ses.refresh_token}&token_type=bearer&provider_token=x`
        );
      }
      if (path.endsWith('/signup')) {
        const user = { id: newId(state, 'user'), is_anonymous: true };
        state.users[user.id] = user;
        return json(sessionFor(state, user));
      }
      if (path.endsWith('/token')) {
        const grant = url.searchParams.get('grant_type');
        if (grant === 'password') {
          const u = Object.values(state.users).find((x) => x.email === body.email && x.password === body.password);
          if (!u) return json({ error: 'invalid_grant', error_description: 'Invalid login credentials', msg: 'Invalid login credentials' }, 400);
          return json(sessionFor(state, u));
        }
        if (grant === 'refresh_token') {
          const id = String(body.refresh_token || '').replace('refresh-', '');
          if (!state.users[id]) return json({ msg: 'Invalid Refresh Token' }, 400);
          return json(sessionFor(state, state.users[id]));
        }
      }
      if (path.endsWith('/user') && method === 'GET') {
        if (!me) return json({ msg: 'User not found' }, 401);
        return json(publicUser(me));
      }
      if (path.endsWith('/user') && method === 'PUT') {
        if (!me) return json({ msg: 'User not found' }, 401);
        if (body.email) {
          if (Object.values(state.users).some((u) => u.email === body.email && u.id !== me.id)) {
            return json({ msg: 'A user with this email address has already been registered', code: 'email_exists' }, 422);
          }
          if (state.confirmEmail) me.new_email = body.email;
          else {
            me.email = body.email;
            me.is_anonymous = false;
          }
        }
        if (body.password) {
          if (body.password.length < 6) return json({ msg: 'Password should be at least 6 characters', code: 'weak_password' }, 422);
          me.password = body.password;
        }
        return json(publicUser(me));
      }
      if (path.endsWith('/recover')) return json({});
      if (path.endsWith('/logout')) return route.fulfill({ status: 204, body: '' });
      return json({});
    }

    const userId = userIdFrom(req.headers()['authorization'] || '');
    const myProfile = profileOf(state, userId);

    // ---------------- RPC ----------------
    const rpc = path.split('/rpc/')[1];
    if (rpc) {
      switch (rpc) {
        case 'ensure_profile': {
          if (myProfile) return json(myProfile);
          const p = { id: newId(state, 'profile'), auth_user_id: userId, display_name: body.p_display_name };
          state.profiles[p.id] = p;
          state.shifts[p.id] = {};
          return json(p);
        }
        case 'get_my_shifts':
          return json(Object.entries(state.shifts[myProfile.id] || {}).map(([work_date, code]) => ({ work_date, code })));
        case 'set_my_shifts': {
          const mine = (state.shifts[myProfile.id] ||= {});
          Object.entries(body.p_changes).forEach(([k, v]) => (v ? (mine[k] = v) : delete mine[k]));
          return json({ upserted: 0, deleted: 0, skipped: [] });
        }
        case 'get_my_shift_types':
          return json(Object.values(state.types[myProfile.id] || {}));
        case 'upsert_my_shift_type': {
          (state.types[myProfile.id] ||= {})[body.p_code] = {
            code: body.p_code,
            label: body.p_label,
            kind: body.p_kind,
            bg_color: body.p_bg,
            text_color: body.p_fg,
            start_time: body.p_start ? `${body.p_start}:00` : null,
            end_time: body.p_end ? `${body.p_end}:00` : null,
            night_hours: body.p_night_hours,
            leave_days: body.p_leave_days
          };
          return json(null);
        }
        case 'delete_my_shift_type':
          delete state.types[myProfile.id]?.[body.p_code];
          return json(null);
        case 'get_my_settings':
          return json(state.settings[myProfile.id] || { settings: {}, updated_at: null });
        case 'set_my_settings': {
          const cur = state.settings[myProfile.id];
          if (!cur?.updated_at || Date.parse(cur.updated_at) <= Date.parse(body.p_updated_at)) {
            state.settings[myProfile.id] = { settings: body.p_settings, updated_at: body.p_updated_at };
          }
          return json(state.settings[myProfile.id]);
        }
        case 'get_my_groups':
          return json(
            state.groups
              .filter((g) => g.members.includes(myProfile.id))
              .map((g) => ({
                id: g.id,
                code: g.code,
                name: g.name,
                color: g.color,
                is_owner: false,
                can_delete: false,
                members: g.members.map((id) => ({ id, name: state.profiles[id].display_name }))
              }))
          );
        case 'get_group_schedule': {
          const g = state.groups.find((x) => x.id === body.p_group_id);
          const rows = [];
          g.members.forEach((pid) =>
            Object.entries(state.shifts[pid] || {}).forEach(([work_date, code]) => {
              if (work_date >= body.p_from && work_date <= body.p_to) {
                rows.push({ profile_id: pid, work_date, code, bg_color: '#F1F5F9', text_color: '#475569' });
              }
            })
          );
          return json(rows);
        }
        case 'create_shift_swap': {
          const snapshot = {};
          body.p_dates.forEach((d) => {
            snapshot[d] = { requester: state.shifts[myProfile.id]?.[d] || null, target: state.shifts[body.p_target_id]?.[d] || null };
          });
          const row = {
            id: newId(state, 'swap'),
            group_id: body.p_group_id,
            requester_id: myProfile.id,
            target_id: body.p_target_id,
            dates: [...body.p_dates].sort(),
            snapshot,
            message: body.p_message,
            status: 'pending',
            created_at: new Date().toISOString(),
            decided_at: null
          };
          state.swaps.unshift(row);
          return json(row);
        }
        case 'respond_shift_swap': {
          const s = state.swaps.find((x) => x.id === body.p_swap_id);
          if (!s || s.status !== 'pending') return fail('이미 처리된 요청입니다');
          if (body.p_action === 'accept') {
            if (s.target_id !== myProfile.id) return fail('요청받은 사람만 응답할 수 있습니다', 403);
            s.dates.forEach((d) => {
              const set = (pid, code) => (code ? ((state.shifts[pid] ||= {})[d] = code) : delete state.shifts[pid]?.[d]);
              set(s.requester_id, s.snapshot[d].target);
              set(s.target_id, s.snapshot[d].requester);
            });
          }
          s.status = { accept: 'accepted', decline: 'declined', cancel: 'cancelled' }[body.p_action];
          s.decided_at = new Date().toISOString();
          return json(s);
        }
        case 'delete_my_account': {
          if (myProfile) {
            const pid = myProfile.id;
            delete state.profiles[pid];
            delete state.shifts[pid];
            delete state.notes[pid];
            delete state.types[pid];
            delete state.settings[pid];
            state.posts = state.posts.filter((p) => p.author_id !== pid);
            state.swaps = state.swaps.filter((x) => x.requester_id !== pid && x.target_id !== pid);
            state.groups.forEach((g) => (g.members = g.members.filter((m) => m !== pid)));
            state.groups = state.groups.filter((g) => g.members.length);
          }
          delete state.users[userId];
          return json(null);
        }
        default:
          return json(null);
      }
    }

    // ---------------- REST 테이블 ----------------
    const table = path.split('/rest/v1/')[1];
    const match = filtersOf(url);
    if (table === 'day_notes') {
      const mine = (state.notes[myProfile.id] ||= {});
      if (method === 'GET') return json(Object.entries(mine).map(([note_date, b]) => ({ note_date, body: b })));
      if (method === 'POST') {
        (Array.isArray(body) ? body : [body]).forEach((r) => (mine[r.note_date] = r.body));
        return route.fulfill({ status: 201, body: '' });
      }
      if (method === 'DELETE') {
        Object.keys(mine).forEach((d) => match({ note_date: d, profile_id: myProfile.id }) && delete mine[d]);
        return route.fulfill({ status: 204, body: '' });
      }
    }
    if (table === 'group_posts') {
      if (method === 'GET') return json(state.posts.filter(match).sort((a, b) => b.created_at.localeCompare(a.created_at)));
      if (method === 'POST') {
        state.posts.push({ id: newId(state, 'post'), created_at: new Date().toISOString(), ...body });
        return route.fulfill({ status: 201, body: '' });
      }
      if (method === 'DELETE') {
        state.posts = state.posts.filter((p) => !match(p));
        return route.fulfill({ status: 204, body: '' });
      }
    }
    if (table === 'shift_swaps' && method === 'GET') return json(state.swaps.filter(match));
    return json([]);
  });
}

/** 테스트용 그룹: 나 + 동료 1명 */
export function seedGroupWithMate(state, myProfileId, { mateName = '박동료', mateShifts = {} } = {}) {
  const mate = { id: newId(state, 'profile'), auth_user_id: null, display_name: mateName };
  state.profiles[mate.id] = mate;
  state.shifts[mate.id] = { ...mateShifts };
  const group = { id: newId(state, 'group'), code: 'ABC123', name: '7병동', color: '#6366F1', members: [myProfileId, mate.id] };
  state.groups.push(group);
  return { mate, group };
}

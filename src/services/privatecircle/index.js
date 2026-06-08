import axiosInstance from '..';

/** POST /private-circle/setup — create or return the authenticated user's private circle */
export const privateSetup = async () => {
  return axiosInstance.post('/private-circle/setup');
};

/** GET /private-circle/dashboard — limits, slots, and members */
export const getPrivateCircleDashboard = async () => {
  return axiosInstance.get('/private-circle/dashboard');
};

/** POST /private-circle/members — body: { userIds: string[] } */
export const addPrivateCircleMembers = async (memberIds) => {
  const userIds = (Array.isArray(memberIds) ? memberIds : [])
    .map(String)
    .filter(Boolean);
  return axiosInstance.post('/private-circle/members', { userIds });
};

/** DELETE /private-circle/members/{userId} */
export const removePrivateCircleMember = async (userId) => {
  const id = String(userId ?? '').trim();
  if (!id) {
    return Promise.reject(new Error('userId is required'));
  }
  return axiosInstance.delete(`/private-circle/members/${id}`);
};

/** DELETE /private-circle */
export const deletePrivateCircle = async () => {
  return axiosInstance.delete('/private-circle');
};

export const isPrivateCircleApiSuccess = (response) => {
  if (!response || response.error === true) return false;
  const code = response?.statusCode;
  if (code === undefined || code === null) return true;
  return code === 200 || code === 201;
};

export const shapePrivateCircleMember = (member) => {
  const user = member?.user || member?.member || member;
  return {
    id: String(user?.id ?? user?._id ?? user?.userId ?? member?.memberId ?? member?.userId ?? ''),
    username:
      user?.displayName ||
      user?.userName ||
      user?.username ||
      member?.username ||
      'unknown',
    avatar:
      user?.image ||
      user?.avatar ||
      member?.avatar ||
      'https://cdn-icons-png.flaticon.com/512/149/149071.png',
  };
};

const extractMembersRaw = (data) => {
  if (!data || typeof data !== 'object') return [];

  if (Array.isArray(data.members)) return data.members;
  if (Array.isArray(data.privateCircleMembers)) return data.privateCircleMembers;
  if (Array.isArray(data.circleMembers)) return data.circleMembers;

  const circle = data.privateCircle ?? data.circle;
  if (circle && Array.isArray(circle.members)) return circle.members;

  if (Array.isArray(data.slots)) {
    return data.slots
      .map((slot) => slot?.member ?? slot?.user ?? slot)
      .filter(Boolean);
  }

  return [];
};

export const parsePrivateCircleMembers = (response) => {
  const root = response?.data ?? response ?? {};
  const data = root?.privateCircle ?? root?.circle ?? root;
  const membersRaw = extractMembersRaw(data);
  const membersFromRoot = extractMembersRaw(root);
  const combined = membersRaw.length > 0 ? membersRaw : membersFromRoot;

  const members = (Array.isArray(combined) ? combined : [])
    .map(shapePrivateCircleMember)
    .filter((m) => m.id);

  const count = Number(
    data?.memberCount ??
      data?.membersCount ??
      root?.memberCount ??
      root?.membersCount ??
      data?.totalMembers ??
      root?.totalMembers ??
      members.length,
  );

  return {
    members,
    count: Number.isFinite(count) ? count : members.length,
  };
};

/** Parse POST /private-circle/setup response */
export const parsePrivateCircleSetup = (response) => {
  const { members, count } = parsePrivateCircleMembers(response);
  return {
    members,
    count,
    setupData: response?.data ?? response ?? {},
  };
};

/** Parse GET /private-circle/dashboard response */
export const parsePrivateCircleDashboard = (response) => {
  const root = response?.data ?? response ?? {};
  const { members, count } = parsePrivateCircleMembers(response);
  const data = root?.privateCircle ?? root?.circle ?? root;

  const isActive = (() => {
    if (typeof data?.isActive === 'boolean') return data.isActive;
    if (typeof root?.isActive === 'boolean') return root.isActive;
    const status = String(
      data?.status ?? root?.status ?? data?.accessStatus ?? root?.accessStatus ?? '',
    ).toUpperCase();
    if (status === 'ACTIVE') return true;
    if (status === 'INACTIVE') return false;
    return null;
  })();

  const postCount = Number(
    data?.postCount ??
      data?.postsCount ??
      data?.totalPosts ??
      data?.postsAdded ??
      root?.postCount ??
      root?.postsCount ??
      root?.totalPosts ??
      root?.postsAdded ??
      (Array.isArray(data?.posts) ? data.posts.length : undefined) ??
      0,
  );

  return {
    members,
    count,
    postCount: Number.isFinite(postCount) ? postCount : 0,
    isActive,
    limits: data?.limits ?? root?.limits ?? null,
    slots: data?.slots ?? root?.slots ?? [],
    dashboardData: root,
  };
};

export const getPvtCircleMembers = async (userid) => {
  return axiosInstance.get(`/private-circle/users/${userid}/members`);
};

export const recentActivity = async () => {
  return axiosInstance.get('/private-circle/owner-post-interactions');
};
 
 
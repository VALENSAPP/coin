export const continuePrivateMint = (navigation, memberIds = []) => {
  navigation.reset({
    index: 0,
    routes: [
      {
        name: 'Add',
        params: {
          privateCircleReady: true,
          privateCircleMemberIds: memberIds,
        },
      },
    ],
  });
};

export const goToPrivateCircleSuccess = (navigation, params) => {
  if (navigation?.replace) {
    navigation.replace('PrivateCircleSuccess', params);
    return;
  }
  navigation.navigate('PrivateCircleSuccess', params);
};

/** After success screen — mint opens post composer; setup returns to main app. */
export const finishPrivateCircleFlow = (navigation, { mode = 'setup', selectedIds = [] } = {}) => {
  if (mode === 'mint') {
    continuePrivateMint(navigation, selectedIds);
    return;
  }

  navigation.reset({
    index: 0,
    routes: [{ name: 'Add' }],
  });
};

export const buildSelectedMembers = (selectedIds, poolMembers) =>
  selectedIds
    .map((id) => poolMembers.find((m) => String(m.id) === String(id)))
    .filter(Boolean);

/** Navigate to Review summary (after Select Access, before / after picking members). */
export const goToPrivateCircleReview = (navigation, params) => {
  navigation.navigate('PrivateCircleReview', params);
};

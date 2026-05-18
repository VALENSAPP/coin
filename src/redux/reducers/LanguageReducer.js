const initialState = {
  currentLanguage: 'en',
};

const LanguageReducer = (state = initialState, action) => {
  switch (action.type) {
    case 'SET_LANGUAGE':
      return {
        ...state,
        currentLanguage: action.payload,
      };
    default:
      return state;
  }
};

export default LanguageReducer;


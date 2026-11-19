// Account screens (SCRUM-97). Each screen lives in its own file; this module keeps the old
// import path.
export { AccountButton } from '../AccountButton';
export { GoogleNewView } from './GoogleNewView';
export { PrivacyView } from './PrivacyView';
export { ProfileView } from './ProfileView';
export { SignInView } from './SignInView';
export { SignUpView } from './SignUpView';
export { errorText } from './problems';

export type AccountScreen = 'signin' | 'signup' | 'profile' | 'google-new' | 'privacy';

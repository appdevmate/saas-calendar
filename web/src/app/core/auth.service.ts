import { Injectable } from '@angular/core';
import {
  signIn,
  signUp,
  signOut,
  confirmSignUp,
  getCurrentUser,
  fetchAuthSession,
} from 'aws-amplify/auth';

@Injectable({ providedIn: 'root' })
export class AuthService {
  async register(email: string, password: string) {
    return signUp({
      username: email,
      password,
      options: { userAttributes: { email } },
    });
  }

  async confirmRegistration(email: string, code: string) {
    return confirmSignUp({ username: email, confirmationCode: code });
  }

  async login(email: string, password: string) {
    try {
      // Sign out any existing session first
      await signOut({ global: false });
    } catch {
      // ignore if no session
    }
    return signIn({ username: email, password });
  }

  async logout() {
    return signOut();
  }

  async getCurrentUser() {
    return getCurrentUser();
  }

  async getToken(): Promise<string> {
    const session = await fetchAuthSession();
    return session.tokens?.idToken?.toString() || '';
  }
}

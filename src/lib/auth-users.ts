import type { Domain } from "./domains";

export type AuthUser = {
  id: string;
  username: string;
  displayName: string;
  domain: Domain;
  subtitle: string;
};

/** Demo accounts — one user per portal */
export const AUTH_USERS: AuthUser[] = [
  {
    id: "patient-1",
    username: "margaret",
    displayName: "Margaret Chen",
    domain: "patient",
    subtitle: "patient · talk with evora",
  },
  {
    id: "caretaker-1",
    username: "james",
    displayName: "James Rivera",
    domain: "caretaker",
    subtitle: "caretaker · clinical oversight",
  },
  {
    id: "family-1",
    username: "sarah",
    displayName: "Sarah Chen",
    domain: "family",
    subtitle: "family · daughter of Margaret",
  },
];

export function findUserByUsername(username: string): AuthUser | undefined {
  return AUTH_USERS.find((u) => u.username === username.toLowerCase().trim());
}

export function findUserById(id: string): AuthUser | undefined {
  return AUTH_USERS.find((u) => u.id === id);
}

import { hash, verify } from "@node-rs/argon2";

export const hashPassword = (password: string) => hash(password);
export const verifyPassword = (stored: string, password: string) => verify(stored, password);

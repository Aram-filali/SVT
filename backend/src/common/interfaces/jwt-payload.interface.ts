import { Role } from '../enums/role.enum.js';

export interface JwtPayload {
  sub: string;
  role: Role;
}

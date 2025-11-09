// types/express.d.ts
import { IUser } from "../models/user";

declare global {
  namespace Express {
    interface Request {
      user?: IUser;
    }
  }
}

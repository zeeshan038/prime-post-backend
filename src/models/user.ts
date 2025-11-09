//NPM Pacakage
import mongoose from "mongoose";

//@types
import { IUser } from "../types/user.types";

const userSchema = new mongoose.Schema<IUser>({
    name: {
        type: String,
        required: true
    },
    email: {
        type: String,
        required: true
    },
    password: {
        type: String,
        required: true,
        select: false
    },
    role: {
        type: String,
        enum: ['user', 'admin'],
        default: 'user'
    },
    refreshToken: {
        type: String
    },
},
    {
        timestamps: true
    });

const User = mongoose.model<IUser>("User", userSchema);

export default User;

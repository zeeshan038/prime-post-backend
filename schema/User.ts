// NPM package
import Joi from 'joi';
import { IUser } from '../types/user.types';

interface RegisterPayload {
  name: string;
  email: string;
  password: string;
  role?: 'admin' | 'user';
}

export interface LoginPayload {
  email: string;
  password: string;
}

export const registerSchema = (payload: RegisterPayload) => {
  const schema = Joi.object<RegisterPayload>({
    name: Joi.string()
      .required()
      .messages({
        'string.empty': 'Name is required',
        'any.required': 'Name is a required field',
      }),
    email: Joi.string()
      .email()
      .required()
      .messages({
        'string.email': 'Please provide a valid email address',
        'string.empty': 'Email is required',
        'any.required': 'Email is a required field',
      }),
    password: Joi.string()
      .min(8)
      .max(200)
      .required()
      .messages({
        'string.min': 'Password must be at least 8 characters long',
        'string.max': 'Password cannot exceed 200 characters',
        'string.empty': 'Password is required',
        'any.required': 'Password is a required field',
      }),
    role: Joi.string()
      .valid('user', 'admin')
      .default('user')
      .messages({
        'any.only': 'Role must be either "user" or "admin"',
      })
  })
  .unknown(false);

  return schema.validate(payload, { abortEarly: false });
};


export const loginSchema = (payload: LoginPayload) => {
  const schema = Joi.object<LoginPayload>({
    email: Joi.string()
      .email()
      .required()
      .messages({
        'string.email': 'Please provide a valid email address',
        'string.empty': 'Email is required',
        'any.required': 'Email is a required field',
      }),
    password: Joi.string()
      .required()
      .messages({
        'string.empty': 'Password is required',
        'any.required': 'Password is a required field',
      }),
  });

  return schema.validate(payload, { abortEarly: false });
};
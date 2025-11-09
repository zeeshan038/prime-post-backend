import Joi from 'joi';

export type Platform = 'twitter' | 'facebook' | 'instagram' | 'linkedin';
export type PostStatus = 'draft' | 'scheduled' | 'published' | 'failed';

export interface CreatePostPayload {
    content: string;
    platform: Platform;
    scheduledAt?: Date | string;
    status?: PostStatus;
    metadata?: {
        hashtags?: string[];
        wordCount?: number;
    };
}

export interface UpdatePostPayload {
    content?: string;
    platform?: Platform;
    scheduledAt?: Date | string;
    publishedAt?: Date | string;
    status?: PostStatus;
    metadata?: {
        hashtags?: string[];
        wordCount?: number;
    };
    analytics?: {
        views?: number;
        clicks?: number;
        likes?: number;
    };
}

// Shared sub-schemas
const platformSchema = Joi.string().valid('twitter', 'facebook', 'instagram', 'linkedin');

const metadataSchema = Joi.object({
    hashtags: Joi.array().items(Joi.string().trim()).default([]),
    wordCount: Joi.number().integer().min(0).default(0),
}).default(undefined);

const analyticsSchema = Joi.object({
    views: Joi.number().integer().min(0).default(0),
    clicks: Joi.number().integer().min(0).default(0),
    likes: Joi.number().integer().min(0).default(0),
}).default(undefined);

// Create Post schema
export const createPostSchema = (payload: CreatePostPayload) => {
    const schema = Joi.object<CreatePostPayload>({
        content: Joi.string().trim().max(1000).required().messages({
            'string.empty': 'Content is required',
        }),
        platform: platformSchema.required().messages({
            'any.only': 'Platform must be one of twitter, facebook, instagram, linkedin',
            'any.required': 'Platform is required',
        }),
        scheduledAt: Joi.alternatives().try(Joi.date().iso(), Joi.date()).optional(),
        status: Joi.string().valid('draft', 'scheduled', 'published', 'failed').optional(),
        metadata: metadataSchema,
    }).unknown(false);

    return schema.validate(payload, { abortEarly: false });
};

// Update Post schema
export const updatePostSchema = (payload: UpdatePostPayload) => {
    const schema = Joi.object<UpdatePostPayload>({
        content: Joi.string().trim().max(1000).optional(),
        platform: platformSchema.optional(),
        scheduledAt: Joi.alternatives().try(Joi.date().iso(), Joi.date()).optional(),
        publishedAt: Joi.alternatives().try(Joi.date().iso(), Joi.date()).optional(),
        status: Joi.string().valid('draft', 'scheduled', 'published', 'failed').optional(),
        metadata: metadataSchema,
        analytics: analyticsSchema,
    })
        .min(1)
        .unknown(false);

    return schema.validate(payload, { abortEarly: false });
};
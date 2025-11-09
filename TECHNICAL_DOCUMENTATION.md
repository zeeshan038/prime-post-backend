# Social Media Analytics Backend - Technical Documentation

## System Architecture Overview

The social media analytics backend is built using a modern monolithic architecture that emphasizes scalability, maintainability, and performance. The system follows a layered architecture pattern with a clear separation of concerns:

**Technology Stack:**
- **Runtime**: Node.js with TypeScript for type safety and enhanced developer experience
- **Web Framework**: Express.js for robust HTTP server capabilities
- **Database**: MongoDB with Mongoose ODM for flexible document storage
- **Caching**: Redis for high-performance data caching and session management
- **Authentication**: JWT (JSON Web Tokens) with dual-token system (access + refresh tokens)
- **Validation**: Joi for comprehensive input validation and sanitization
- **Background Jobs**: node-cron for scheduled engagement simulation

**Architecture Layers:**
1. **API Layer** (`/routes`): RESTful endpoints with middleware authentication
2. **Controller Layer** (`/controller`): Business logic orchestration and request handling
3. **Service Layer** (`/services`): Core business logic and data processing algorithms
4. **Model Layer** (`/models`): Data access and database schema definitions
5. **Middleware Layer** (`/middlewares`): Cross-cutting concerns like authentication
6. **Utility Layer** (`/utils`): Reusable functions for JWT, caching, and helpers

## Database Schema Design Rationale

### User Model Design
The User schema employs strategic field selection and indexing for optimal performance:

```typescript
const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true, select: false }, // Security: excluded by default
  role: { type: String, enum: ['user', 'admin'], default: 'user' },
  refreshToken: { type: String, select: false }
}, { timestamps: true });
```

**Design Rationale:**
- **Password Security**: `select: false` prevents accidental password exposure in queries
- **Role-Based Access**: Enum-based roles enable future authorization features
- **Refresh Token Storage**: Allows secure token revocation and session management
- **Timestamps**: Automatic createdAt/updatedAt tracking for audit trails

### Post Model Design
The Post schema balances flexibility with structured data requirements:

```typescript
const postSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  content: { type: String, required: true },
  platform: { type: String, enum: ['twitter', 'facebook', 'instagram', 'linkedin'], required: true },
  scheduledAt: Date,
  publishedAt: Date,
  status: { type: String, enum: ['draft', 'scheduled', 'published', 'failed'], default: 'draft' },
  metadata: {
    hashtags: [{ type: String }],
    wordCount: { type: Number, default: 0 }
  },
  analytics: {
    views: { type: Number, default: 0 },
    clicks: { type: Number, default: 0 },
    likes: { type: Number, default: 0 }
  }
}, { timestamps: true });
```

**Design Rationale:**
- **Platform Flexibility**: Enum-based platform selection ensures data consistency
- **Status Management**: Clear post lifecycle tracking from draft to published/failed
- **Embedded Analytics**: Denormalized analytics data for query performance
- **Metadata Structure**: Flexible nested object for platform-specific data

### Engagement Model Design
The Engagement schema optimizes for time-series analytics with intelligent indexing:

```typescript
const engagementSchema = new mongoose.Schema({
  postId: { type: mongoose.Schema.Types.ObjectId, ref: 'Post', required: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  platform: { type: String, enum: ['twitter', 'facebook', 'instagram', 'linkedin'], required: true },
  timestamp: { type: Date, required: true },
  metrics: {
    likes: { type: Number, default: 0 },
    comments: { type: Number, default: 0 },
    shares: { type: Number, default: 0 },
    clicks: { type: Number, default: 0 },
    impressions: { type: Number, default: 0 }
  },
  hourOfDay: { type: Number, min: 0, max: 23 },
  dayOfWeek: { type: Number, min: 0, max: 6 }
}, { timestamps: true });

// Strategic indexes for analytics queries
engagementSchema.index({ postId: 1, timestamp: -1 });
engagementSchema.index({ userId: 1, timestamp: -1 });
engagementSchema.index({ timestamp: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 }); 
```

**Design Rationale:**
- **Pre-computed Time Fields**: hourOfDay/dayOfWeek enable efficient aggregation queries
- **TTL Index**: Automatic data expiration maintains database size
- **Compound Indexes**: Optimized for common query patterns (post+time, user+time)
- **Metric Flexibility**: Nested metrics object allows easy addition of new engagement types

## Algorithm Explanations

### Optimal Posting Time Algorithm
The optimal posting time calculation uses a sophisticated weighted engagement analysis:

```typescript
private async calculateOptimalPostingTimes(userId: string): Promise<OptimalTime[]> {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  
  // Aggregate engagement by hour and day of week
  const engagementData = await Engagement.aggregate([
    { $match: { userId: new mongoose.Types.ObjectId(userId), timestamp: { $gte: thirtyDaysAgo } } },
    {
      $group: {
        _id: { hour: '$hourOfDay', day: '$dayOfWeek' },
        totalEngagement: { $sum: { $add: ['$metrics.likes', '$metrics.comments', '$metrics.shares', '$metrics.clicks'] } },
        avgEngagement: { $avg: { $add: ['$metrics.likes', '$metrics.comments', '$metrics.shares', '$metrics.clicks'] } },
        postCount: { $sum: 1 }
      }
    },
    { $sort: { totalEngagement: -1 } },
    { $limit: 10 }
  ]);

  // Apply statistical filtering and weighting
  return engagementData
    .filter(data => data.postCount >= 3) // Statistical significance threshold
    .map(data => ({
      hour: data._id.hour,
      day: data._id.day,
      score: data.totalEngagement * (data.avgEngagement * 0.3) * (Math.log(data.postCount) * 0.2),
      confidence: Math.min(data.postCount / 10, 1.0)
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);
}
```

**Algorithm Logic:**
1. **Time Window**: Analyzes last 30 days for recent behavioral relevance
2. **Engagement Aggregation**: Groups by hour/day combinations
3. **Statistical Filtering**: Requires minimum 3 posts for significance
4. **Weighted Scoring**: Combines total engagement, average engagement, and post volume
5. **Confidence Calculation**: Based on sample size (max confidence at 10+ posts)

### Performance Score Algorithm
The performance score provides a normalized metric for post comparison:

```typescript
private calculatePerformanceScore(post: IPost, engagement: IEngagement[]): number {
  const totalEngagement = engagement.reduce((sum, e) => 
    sum + e.metrics.likes + e.metrics.comments + e.metrics.shares + e.metrics.clicks, 0
  );
  
  const impressions = engagement.reduce((sum, e) => sum + e.metrics.impressions, 1); // Avoid division by zero
  const engagementRate = totalEngagement / impressions;
  
  // Platform-specific weighting
  const platformWeights = {
    twitter: { likes: 1, comments: 3, shares: 5, clicks: 4 },
    facebook: { likes: 1, comments: 4, shares: 6, clicks: 3 },
    instagram: { likes: 1, comments: 3, shares: 4, clicks: 2 },
    linkedin: { likes: 1, comments: 5, shares: 7, clicks: 6 }
  };
  
  const weights = platformWeights[post.platform] || platformWeights.twitter;
  const weightedScore = engagement.reduce((score, e) => {
    return score + (e.metrics.likes * weights.likes) + 
                   (e.metrics.comments * weights.comments) + 
                   (e.metrics.shares * weights.shares) + 
                   (e.metrics.clicks * weights.clicks);
  }, 0);
  
  // Normalize to 0-100 scale
  const maxPossibleScore = impressions * Math.max(...Object.values(weights));
  return Math.min((weightedScore / maxPossibleScore) * 100, 100);
}
```

**Algorithm Logic:**
1. **Multi-Metric Analysis**: Considers likes, comments, shares, clicks, and impressions
2. **Platform-Specific Weighting**: Different platforms emphasize different engagement types
3. **Engagement Rate Calculation**: Normalizes by reach (impressions)
4. **Weighted Scoring**: Applies platform-specific importance to each metric
5. **Normalization**: Converts to 0-100 scale for easy interpretation

## Performance Optimization Strategies

### Database Query Optimization
1. **Strategic Indexing**: Compound indexes on frequently queried fields (userId+timestamp, postId+timestamp)
2. **Aggregation Pipelines**: Efficient server-side data processing reduces network overhead
3. **Field Selection**: Explicit field inclusion/exclusion minimizes data transfer
4. **TTL Indexes**: Automatic data expiration prevents unbounded growth

### Caching Architecture
Multi-level caching strategy maximizes performance:

```typescript
class CacheManager {
  private redis: Redis;
  private cacheDurations = {
    analytics: 300, // 5 minutes
    trends: 600,    // 10 minutes
    performance: 180 // 3 minutes
  };

  async getOrSet<T>(key: string, factory: () => Promise<T>, duration: number): Promise<T> {
    const cached = await this.redis.get(key);
    if (cached) return JSON.parse(cached);
    
    const value = await factory();
    await this.redis.setex(key, duration, JSON.stringify(value));
    return value;
  }
}
```

**Cache Strategy:**
- **Analytics Data**: 5-minute cache (balances freshness with performance)
- **Trend Data**: 10-minute cache (less frequently changing)
- **Performance Metrics**: 3-minute cache (frequently accessed)
- **Cache Invalidation**: Smart invalidation on data updates

### Background Job Optimization
The engagement simulation job uses efficient bulk operations:

```typescript
private async simulateEngagement(): Promise<void> {
  const posts = await Post.find({ status: 'published' }).limit(100);
  const bulkOps = posts.map(post => ({
    updateOne: {
      filter: { postId: post._id },
      update: {
        $inc: {
          'metrics.likes': this.calculateWeightedEngagement(post, 'likes'),
          'metrics.comments': this.calculateWeightedEngagement(post, 'comments'),
          'metrics.shares': this.calculateWeightedEngagement(post, 'shares'),
          'metrics.clicks': this.calculateWeightedEngagement(post, 'clicks'),
          'metrics.impressions': this.calculateWeightedEngagement(post, 'impressions')
        }
      }
    }
  }));
  
  await Engagement.bulkWrite(bulkOps);
}
```

**Optimization Techniques:**
- **Bulk Operations**: Single database round-trip for multiple updates
- **Limited Processing**: 100 posts per batch prevents memory overflow
- **Weighted Randomization**: Realistic engagement patterns without complex calculations
- **Scheduled Execution**: Every 30 seconds balances realism with resource usage

## Security Measures

### Authentication Security
1. **Dual Token System**: Access tokens (15 min) + Refresh tokens (7 days)
2. **HTTP-Only Cookies**: Prevents XSS attacks on refresh tokens
3. **Password Hashing**: bcrypt with salt rounds for strong password protection
4. **Token Expiration**: Short-lived access tokens limit exposure window

### Data Protection
1. **Input Validation**: Joi schemas prevent injection attacks
2. **Field Exclusion**: Sensitive fields (password, refreshToken) excluded from queries
3. **Role-Based Access**: Enum-based roles enable future authorization features
4. **HTTPS Enforcement**: Production-ready security headers

### API Security
1. **Rate Limiting Ready**: Middleware structure supports rate limiting
2. **CORS Configuration**: Proper cross-origin request handling
3. **Error Sanitization**: Detailed errors for development, sanitized for production
4. **Request Validation**: Comprehensive input sanitization and validation

## Caching Strategy

### Multi-Level Caching
1. **Application-Level**: In-memory caching for frequently accessed data
2. **Redis Caching**: Distributed caching for multi-instance deployments
3. **Database Query Cache**: MongoDB's built-in query result caching
4. **CDN Ready**: Static asset caching preparation

### Cache Key Design
```typescript
private generateCacheKey(type: string, userId: string, params: any): string {
  const paramHash = crypto.createHash('md5').update(JSON.stringify(params)).digest('hex');
  return `analytics:${type}:${userId}:${paramHash}`;
}
```

**Key Design Principles:**
- **Hierarchical Namespacing**: Prevents key collisions
- **Parameter Hashing**: Handles complex parameter combinations
- **User Isolation**: User-specific cache keys prevent data leakage
- **TTL Integration**: Automatic expiration prevents stale data

### Cache Invalidation
Smart invalidation strategies maintain data consistency:
- **Write-Through**: Updates cache on data modification
- **TTL Expiration**: Time-based automatic invalidation
- **Event-Driven**: Invalidation on specific business events
- **Selective Invalidation**: Targeted cache clearing for related data

## Background Job Implementation

### Engagement Simulation Architecture
The engagement simulation job creates realistic social media engagement patterns:

```typescript
export class EngagementSimulator {
  private calculateWeightedEngagement(post: IPost, metric: string): number {
    const now = new Date();
    const postAge = (now.getTime() - post.publishedAt.getTime()) / (1000 * 60 * 60); // Hours
    
    // Time-based multipliers
    const timeMultiplier = this.getTimeMultiplier(now.getHours(), now.getDay());
    
    // Post age decay (engagement decreases over time)
    const ageMultiplier = Math.max(0.1, 1 / (1 + postAge / 24)); // 50% after 24 hours
    
    // Platform-specific base rates
    const baseRates = {
      twitter: { likes: 0.05, comments: 0.01, shares: 0.02, clicks: 0.03, impressions: 1.0 },
      facebook: { likes: 0.08, comments: 0.02, shares: 0.04, clicks: 0.05, impressions: 1.2 },
      instagram: { likes: 0.12, comments: 0.015, shares: 0.01, clicks: 0.02, impressions: 0.8 },
      linkedin: { likes: 0.06, comments: 0.025, shares: 0.03, clicks: 0.08, impressions: 1.1 }
    };
    
    const baseRate = baseRates[post.platform][metric];
    const randomFactor = 0.8 + Math.random() * 0.4; // ±20% randomization
    
    return Math.round(baseRate * timeMultiplier * ageMultiplier * randomFactor);
  }
}
```

**Implementation Features:**
- **Time-Based Multipliers**: Peak engagement during business hours and weekends
- **Age Decay**: Engagement decreases logarithmically over time
- **Platform Differences**: Different engagement patterns per platform
- **Randomization**: Realistic variation in engagement numbers
- **Bulk Processing**: Efficient database updates

### Job Scheduling and Monitoring
```typescript
export function startEngagementSimulation(): void {
  // Run every 30 seconds for realistic simulation
  cron.schedule('*/30 * * * * *', async () => {
    try {
      await simulateEngagement();
      console.log('Engagement simulation completed');
    } catch (error) {
      console.error('Engagement simulation failed:', error);
      // Could add alerting here for production monitoring
    }
  });
}
```

**Scheduling Strategy:**
- **Frequent Execution**: 30-second intervals provide smooth engagement curves
- **Error Handling**: Graceful failure with logging for monitoring
- **Resource Management**: Efficient processing prevents resource exhaustion
- **Scalability Ready**: Architecture supports horizontal scaling

## Trade-offs Made

### Performance vs. Consistency
1. **Eventual Consistency**: Cache layers provide speed over immediate consistency
2. **Denormalized Data**: Embedded analytics improve read performance but require careful update management
3. **Approximate Analytics**: Sampling and estimation provide fast insights over perfect accuracy
4. **Background Processing**: Async job processing improves responsiveness but introduces eventual consistency

### Scalability vs. Complexity
1. **Redis Dependency**: Adds infrastructure complexity but enables horizontal scaling
2. **Document Database**: MongoDB provides flexibility but requires careful schema design
3. **Microservices Ready**: Modular architecture supports future service separation
4. **Caching Strategy**: Multi-level caching adds complexity but dramatically improves performance

### Development Speed vs. Robustness
1. **TypeScript Adoption**: Adds development overhead but prevents runtime errors
2. **Comprehensive Validation**: Joi schemas require maintenance but prevent invalid data
3. **Error Handling**: Detailed error handling adds code but improves debugging
4. **Documentation**: Extensive documentation requires effort but reduces onboarding time

## Future Improvements

### Scalability Enhancements
1. **Database Sharding**: Horizontal partitioning for user data at scale
2. **Read Replicas**: MongoDB replica sets for read-heavy analytics workloads
3. **Microservices Architecture**: Service separation for independent scaling
4. **Event Sourcing**: Event-driven architecture for complex analytics workflows

### Performance Optimizations
1. **GraphQL API**: More efficient data fetching for complex client queries
2. **Data Pre-aggregation**: Pre-computed analytics tables for common queries
3. **Machine Learning**: ML-powered optimal posting time predictions
4. **Edge Caching**: CDN integration for global performance

### Feature Expansions
1. **Multi-tenant Support**: Organization-based data isolation
2. **Real-time Analytics**: WebSocket integration for live engagement tracking
3. **Advanced Algorithms**: Sentiment analysis and content optimization
4. **Third-party Integrations**: Direct platform API connections

### Security Enhancements
1. **OAuth Integration**: Third-party authentication providers
2. **Advanced Rate Limiting**: Per-user and per-endpoint rate limiting
3. **Audit Logging**: Comprehensive security event logging
4. **Data Encryption**: At-rest encryption for sensitive data

### Operational Improvements
1. **Health Checks**: Comprehensive system health monitoring
2. **Automated Testing**: Unit, integration, and load testing suites


This architecture provides a solid foundation for a social media analytics platform while maintaining flexibility for future enhancements and scaling requirements.
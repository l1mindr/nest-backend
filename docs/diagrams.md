# Diagrams

This document collects diagrams for the current implementation.

## Module Composition

```mermaid
flowchart TD
  AppModule --> CoreModule
  AppModule --> InfrastructureModule
  AppModule --> FeaturesModule

  CoreModule --> ClockModule

  InfrastructureModule --> EnvModule
  InfrastructureModule --> DatabasesModule
  InfrastructureModule --> ValidationPipe
  InfrastructureModule --> DataResponseInterceptor

  DatabasesModule --> PostgresModule
  DatabasesModule --> RedisModule

  FeaturesModule --> AuthModule
  FeaturesModule --> SecurityModule
  FeaturesModule --> SessionsModule
  FeaturesModule --> TokenModule
  FeaturesModule --> UsersModule
```

## Authentication Flow

```mermaid
sequenceDiagram
  participant Client
  participant AuthController
  participant AuthService
  participant UsersService
  participant SessionsService
  participant TokenService
  participant Cookies as AuthCookieInterceptor

  Client->>AuthController: POST /v1/auth/login
  AuthController->>AuthService: loginUser(dto, ip, device)
  AuthService->>UsersService: findByIdentifierForAuth()
  UsersService-->>AuthService: user with password
  AuthService->>AuthService: bcrypt compare
  AuthService->>SessionsService: issue()
  SessionsService-->>AuthService: session
  AuthService->>TokenService: issuePair()
  TokenService-->>AuthService: access + refresh
  AuthService->>SessionsService: updateRefreshState()
  AuthService-->>Cookies: tokens
  Cookies-->>Client: Set-Cookie headers
```

## Authenticated Request Flow

```mermaid
sequenceDiagram
  participant Client
  participant JwtGuard
  participant JwtStrategy
  participant TokenService
  participant UsersService
  participant SessionsService
  participant Controller

  Client->>JwtGuard: Request with access_token cookie
  JwtGuard->>JwtStrategy: authenticate(req)
  JwtStrategy->>TokenService: validatePayload(payload)
  TokenService->>UsersService: findByIdForSessionValidation(sub)
  UsersService-->>TokenService: user
  TokenService->>SessionsService: getActive(user.id, sessionId)
  SessionsService-->>TokenService: session
  TokenService-->>JwtStrategy: user + session
  JwtStrategy-->>JwtGuard: user + session
  JwtGuard->>Controller: request.user and request.session attached
```

## Refresh Rotation

```mermaid
sequenceDiagram
  participant Client
  participant AuthService
  participant TokenService
  participant SessionsService
  participant DB as PostgreSQL

  Client->>AuthService: refresh(refreshToken)
  AuthService->>TokenService: verifyRefreshToken()
  TokenService-->>AuthService: sub, sessionId, iat
  AuthService->>SessionsService: getActive(sub, sessionId)
  SessionsService->>DB: SELECT active session
  DB-->>SessionsService: session
  AuthService->>AuthService: compare refresh token hash
  AuthService->>TokenService: issuePair()
  AuthService->>SessionsService: rotateAtomic()
  SessionsService->>DB: UPDATE session WHERE id + hash + version
  DB-->>SessionsService: affected row count
  SessionsService-->>AuthService: boolean
  AuthService-->>Client: new tokens or error
```

## Entity Relationship

```mermaid
erDiagram
  USER ||--o{ SESSION : owns
  USER {
    uuid id
    string name
    string email
    string username
    string password
    enum status
    enum role
    timestamp createdAt
    timestamp updatedAt
    timestamp deleteAt
  }
  SESSION {
    uuid id
    string refreshTokenHash
    jsonb device
    string ipAddress
    boolean isRevoked
    timestamp expiresAt
    timestamp lastUsedAt
    integer version
    timestamp rotatedAt
    timestamp createdAt
    timestamp updatedAt
  }
```

## Request Lifecycle

```mermaid
flowchart LR
  HTTP[HTTP request] --> Middleware[Device middleware]
  Middleware --> Guards[JWT / Roles / RateLimit / CSRF guards]
  Guards --> Pipes[Validation pipe]
  Pipes --> Controller
  Controller --> Service
  Service --> Persistence[PostgreSQL or Redis]
  Persistence --> Service
  Service --> Interceptors[Serialize and data wrappers]
  Interceptors --> HTTPResponse[HTTP response]
```

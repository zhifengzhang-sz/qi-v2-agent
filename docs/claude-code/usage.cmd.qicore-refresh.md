Based on the hybrid knowledge access, here are the available QiCore modules for the /qicore-refresh [module] command:

Available Modules:

1. Core Modules
   - `qi/base` - Functional foundation with Result and QiError types
   - `qi/core` - Infrastructure services (Config, Logger, Cache)
2. Infrastructure Services
   - `Config` - Multi-source configuration management with validation
   - `Logger` - Structured logging with context accumulation
   - `Cache` - Performance optimization with memory/Redis backends
3. Core Types
   - `Result<T>` - Discriminated union for explicit error handling
   - `QiError` - Structured error types with categories
4. Patterns
   - FunctionalComposition - `map`, `flatMap`, `match` patterns
   - ErrorCategories - `VALIDATION`, `NETWORK`, `BUSINESS`, etc.


Usage Examples:
```bash
  # General refresh
  /qicore-refresh

  # Module-specific refresh
  /qicore-refresh qi/base
  /qicore-refresh qi/core
  /qicore-refresh Config
  /qicore-refresh Logger
  /qicore-refresh Cache
  /qicore-refresh Result<T>
  /qicore-refresh FunctionalComposition
```

Module Hierarchy:

```
  QiCore Framework
  ├── qi/base Module
  │   ├── Result<T> Type
  │   ├── QiError Type
  │   └── Functional Composition Pattern
  └── qi/core Module
      ├── Config Service
      ├── Logger Service
      └── Cache Service
```

Each module provides specific expertise when used with the /qicore-refresh [module] command, combining both structured
  relationships from the memory graph and complete documentation from the Qdrant RAG system.

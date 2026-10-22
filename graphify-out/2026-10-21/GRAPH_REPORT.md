# Graph Report - pablo-herrera  (2026-10-21)

## Corpus Check
- 77 files · ~3,394,249 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 28 file(s) not represented in the graph (top: .scss 22, (none) 2, .ico 1)

## Summary
- 533 nodes · 985 edges · 17 communities (9 shown, 8 thin omitted)
- Extraction: 97% EXTRACTED · 3% INFERRED · 0% AMBIGUOUS · INFERRED: 33 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `dc58ecc1`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- @angular/core
- AdminPanelComponent
- AuthService
- package.json
- options
- ServicePackage
- BlogService
- Suplementos
- app.config.server.ts
- PanelComponent
- PabloHerrera
- Home
- Navbar
- FaqComponent
- EjerciciosService
- user.model.ts
- AuthCallbackComponent

## God Nodes (most connected - your core abstractions)
1. `AdminPanelComponent` - 71 edges
2. `@angular/core` - 52 edges
3. `AuthService` - 46 edges
4. `BlogService` - 31 edges
5. `PanelComponent` - 31 edges
6. `BlogPost` - 30 edges
7. `ServicePackage` - 28 edges
8. `Suplementos` - 27 edges
9. `ServicePackagesService` - 26 edges
10. `@angular/router` - 17 edges

## Surprising Connections (you probably didn't know these)
- `AdminPanelComponent` --references--> `BlogPost`  [EXTRACTED]
  src/app/features/admin/admin-panel/admin-panel.ts → src/app/core/models/blog-post.model.ts
- `PanelComponent` --references--> `DiaEntrenamiento`  [EXTRACTED]
  src/app/features/panel/panel.ts → src/app/core/models/entrenamiento.models.ts
- `AdminPanelComponent` --references--> `ServicePackage`  [EXTRACTED]
  src/app/features/admin/admin-panel/admin-panel.ts → src/app/core/models/service-package.model.ts
- `BlogComponent` --references--> `BlogPost`  [EXTRACTED]
  src/app/features/blog/blog.ts → src/app/core/models/blog-post.model.ts
- `BlogDetail` --references--> `BlogPost`  [EXTRACTED]
  src/app/features/blog-detail/blog-detail.ts → src/app/core/models/blog-post.model.ts

## Import Cycles
- None detected.

## Communities (17 total, 8 thin omitted)

### Community 0 - "@angular/core"
Cohesion: 0.05
Nodes (27): @angular/common, @angular/core, @angular/forms, @angular/router, @supabase/supabase-js, BLOG_POSTS, authGuard(), oauthRootRedirectGuard() (+19 more)

### Community 2 - "AuthService"
Cohesion: 0.06
Nodes (4): AuthService, AuthComponent, UpdatePasswordComponent, Onboarding

### Community 3 - "package.json"
Cohesion: 0.04
Nodes (48): dependencies, @angular/common, @angular/compiler, @angular/core, @angular/forms, @angular/platform-browser, @angular/platform-server, @angular/router (+40 more)

### Community 4 - "options"
Cohesion: 0.05
Nodes (44): build, serve, test, builder, configurations, defaultConfiguration, options, cli (+36 more)

### Community 5 - "ServicePackage"
Cohesion: 0.14
Nodes (6): rxjs, SERVICE_PACKAGES, ServicePackage, ServicePackagePayload, ServicePackagesService, Servicios

### Community 6 - "BlogService"
Cohesion: 0.13
Nodes (4): BlogPost, BlogService, BlogComponent, BlogDetail

### Community 8 - "app.config.server.ts"
Cohesion: 0.12
Nodes (13): @angular/platform-browser, @angular/ssr, express, App, appConfig, config, serverConfig, routes (+5 more)

### Community 9 - "PanelComponent"
Cohesion: 0.05
Nodes (6): Alimento, Comida, PlanNutricional, EntrenamientoService, PlanNutricionalService, PanelComponent

### Community 11 - "PabloHerrera"
Cohesion: 0.25
Nodes (7): Additional Resources, Building, Code scaffolding, Development server, PabloHerrera, Running end-to-end tests, Running unit tests

## Knowledge Gaps
- **11 isolated node(s):** `@angular/compiler`, `@angular/platform-server`, `tslib`, `@angular/build`, `@angular/cli` (+6 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 207 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **8 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `@angular/core` connect `@angular/core` to `app.config.server.ts`, `PanelComponent`, `package.json`, `ServicePackage`?**
  _High betweenness centrality (0.294) - this node is a cross-community bridge._
- **What connects `@angular/compiler`, `@angular/platform-server`, `tslib` to the rest of the system?**
  _11 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `@angular/core` be split into smaller, more focused modules?**
  _Cohesion score 0.05107252298263534 - nodes in this community are weakly interconnected._
- **Why does `AdminPanelComponent` connect `AdminPanelComponent` to `@angular/core`, `ServicePackage`, `BlogService`?**
  _High betweenness centrality (0.201) - this node is a cross-community bridge._
- **Should `AdminPanelComponent` be split into smaller, more focused modules?**
  _Cohesion score 0.05134575569358178 - nodes in this community are weakly interconnected._
- **Why does `AuthService` connect `AuthService` to `@angular/core`, `PanelComponent`, `ServicePackage`?**
  _High betweenness centrality (0.141) - this node is a cross-community bridge._
- **Should `AuthService` be split into smaller, more focused modules?**
  _Cohesion score 0.05889724310776942 - nodes in this community are weakly interconnected._
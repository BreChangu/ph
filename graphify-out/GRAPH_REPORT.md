# Graph Report - pablo-herrera  (2026-10-13)

## Corpus Check
- cluster-only mode — file stats not available

## Summary
- 492 nodes · 913 edges · 19 communities (9 shown, 10 thin omitted)
- Extraction: 97% EXTRACTED · 3% INFERRED · 0% AMBIGUOUS · INFERRED: 30 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `442b8c49`
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
- PlanNutricionalService
- panel.ts
- EntrenamientoService
- Home
- Navbar
- FaqComponent
- EjerciciosService
- user.model.ts

## God Nodes (most connected - your core abstractions)
1. `AdminPanelComponent` - 55 edges
2. `@angular/core` - 50 edges
3. `AuthService` - 42 edges
4. `BlogService` - 31 edges
5. `BlogPost` - 30 edges
6. `ServicePackage` - 28 edges
7. `Suplementos` - 27 edges
8. `PanelComponent` - 27 edges
9. `ServicePackagesService` - 26 edges
10. `@angular/router` - 15 edges

## Surprising Connections (you probably didn't know these)
- `AdminPanelComponent` --references--> `BlogPost`  [EXTRACTED]
  src/app/features/admin/admin-panel/admin-panel.ts → src/app/core/models/blog-post.model.ts
- `AdminPanelComponent` --references--> `ServicePackage`  [EXTRACTED]
  src/app/features/admin/admin-panel/admin-panel.ts → src/app/core/models/service-package.model.ts
- `PanelComponent` --references--> `DiaEntrenamiento`  [EXTRACTED]
  src/app/features/panel/panel.ts → src/app/core/models/entrenamiento.models.ts
- `Servicios` --references--> `ServicePackage`  [EXTRACTED]
  src/app/features/servicios/servicios.ts → src/app/core/models/service-package.model.ts
- `BlogComponent` --references--> `BlogPost`  [EXTRACTED]
  src/app/features/blog/blog.ts → src/app/core/models/blog-post.model.ts

## Import Cycles
- None detected.

## Communities (19 total, 10 thin omitted)

### Community 0 - "@angular/core"
Cohesion: 0.06
Nodes (19): @angular/common, @angular/core, @angular/forms, @angular/router, @supabase/supabase-js, BLOG_POSTS, authGuard(), BlogPostPayload (+11 more)

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

### Community 10 - "PlanNutricionalService"
Cohesion: 0.25
Nodes (4): Alimento, Comida, PlanNutricional, PlanNutricionalService

### Community 11 - "panel.ts"
Cohesion: 0.20
Nodes (6): DiaEntrenamiento, Ejercicio, Rutina, MeasurementDefinition, PanelSection, PhotoKind

## Knowledge Gaps
- **11 isolated node(s):** `@angular/build`, `@angular/cli`, `@angular/compiler`, `@angular/compiler-cli`, `@angular/platform-server` (+6 more)
  These have ≤1 connection - possible missing edges. (Counts symbols only; 188 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **10 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `@angular/core` connect `@angular/core` to `package.json`, `ServicePackage`, `app.config.server.ts`, `PlanNutricionalService`, `panel.ts`?**
  _High betweenness centrality (0.288) - this node is a cross-community bridge._
- **What connects `@angular/build`, `@angular/cli`, `@angular/compiler` to the rest of the system?**
  _11 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `@angular/core` be split into smaller, more focused modules?**
  _Cohesion score 0.06126331811263318 - nodes in this community are weakly interconnected._
- **Why does `AdminPanelComponent` connect `AdminPanelComponent` to `@angular/core`, `ServicePackage`, `BlogService`?**
  _High betweenness centrality (0.166) - this node is a cross-community bridge._
- **Should `AdminPanelComponent` be split into smaller, more focused modules?**
  _Cohesion score 0.06429070580013976 - nodes in this community are weakly interconnected._
- **Why does `AuthService` connect `AuthService` to `@angular/core`, `ServicePackage`, `PanelComponent`, `PlanNutricionalService`, `panel.ts`, `EntrenamientoService`?**
  _High betweenness centrality (0.141) - this node is a cross-community bridge._
- **Should `AuthService` be split into smaller, more focused modules?**
  _Cohesion score 0.06184012066365008 - nodes in this community are weakly interconnected._
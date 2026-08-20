# Novustrix Hybrid Path: Curated Client + Matrix Standardization
*Version: 1.0*
*Date: 2025-08-20*
*Status: Proposal for Claude Review*

---

## 🎯 Executive Summary
**Goal:** Build Novustrix as a **curated Matrix client** for Cognitive Cosmos *while simultaneously* pushing its collaborative features into **Matrix standards** to prevent fediverse fragmentation.

**Approach:**
1. Validate Novustrix features with real users (Cognitive Cosmos) **first**.
2. Standardize successful features via **Matrix Specification Changes (MSCs)**.
3. Maintain backward compatibility—Novustrix works as a standalone client *and* a reference implementation for new Matrix standards.

**Timeline:** ~3–5 years (aligned with Discord migration hypothesis).
**Priority:** Safety net for Cognitive Cosmos (Novustrix-first) + long-term decentralization (standardization).

---

---

## 📅 Phases

---

### Phase 0: Foundations (0–3 Months)
**Goal:** Validate core technical bets and establish the Novustrix platform.

#### 0.1. Widget Host + SDK (Critical Path)
| Task | Owner | Output | Success Criteria |
|------|-------|--------|------------------|
| Implement Flutter widget host (web: `HtmlElementView`, mobile: `flutter_inappwebview`) | Dev | Fork of FluffyChat with widget host | Widgets render in all platforms |
| Define **postMessage protocol v1** | Dev | Protocol doc + implementation | Bidirectional communication works |
| Build **server-side proxy** for widgets | Dev | Proxy service (Go/Python) | Widgets sandboxed, qualified, and mediated |
| Integrate **Katrix as first widget** | Dev | Katrix runs in widget host | Basic IDE functionality works |
| **Security audit** of widget host | Security | Test suite | All malicious test cases blocked |

#### 0.2. Discord-Like UI
| Task | Owner | Output | Success Criteria |
|------|-------|--------|------------------|
| Rebuild FluffyChat UI: **Space rail → Channel list → Message pane → Member list** | Dev | UI mockups + implementation | Matches Discord’s layout |
| Map **Matrix Spaces → Servers**, **Rooms → Channels** | Dev | Data model doc | Users intuitively navigate |
| **Categories → Nested sub-spaces** (via `m.space.child`) | Dev | Space hierarchy implementation | 2-level nesting works |
| **Mobile/desktop parity** | Dev | Responsive layout | UI adapts to mobile/desktop |

#### 0.3. Mandatory Rooms
| Task | Owner | Output | Success Criteria |
|------|-------|--------|------------------|
| **Bug reporting room** + widget | Dev | Bug form widget + Great Repository integration | Bugs are logged and trackable |
| **Widget Workshop** (Basic tier only) | Dev | WYSIWYG widget creator | Non-coders can create simple widgets |
| **Provisioning bot** | Dev | Bot to auto-create rooms | New users get default rooms |

**Deliverable:** Novustrix **alpha** (internal testing with Cognitive Cosmos).

---

### Phase 1: Novustrix-First Validation (3–12 Months)
**Goal:** Ship a **fully functional Novustrix client** with all collaborative features for Cognitive Cosmos. *No standardization yet*—just validation.

#### 1.1. Collaborative Features (Novustrix-Only)
| Feature | Task | Output | Success Criteria |
|---------|------|--------|------------------|
| **Reaction Roles** | Implement client-side roles (colored names, grouped member list) | Role system + UI | Roles render in Novustrix |
| | Add **reaction-based role assignment** (access roles only) | Reaction bindings | Users can join roles via reactions |
| **Voice Captions** | VOSK server + consent UI | Captioning service | Live captions with per-speaker consent |
| **Studios** | **Visual Artistry** (NeoBoard canvas + tools) | Studio widget | Basic drawing/layers work |
| | **The Anvil** (Katrix IDE) | Studio widget | Code editing + live preview |
| | **Audio Studio** | Studio widget | Audio controls + effects |
| | **The Hearth** (poetry/spoken-word) | Studio widget | Teleprompter + open-mic queue |
| **Cross-Arts Bus** | Pub/sub system for inter-widget communication | Bus protocol + implementation | Audio → Visual studio works |
| **Modmail** | Matrix-native modmail (private rooms) | Modmail widget + routing | Staff can manage tickets |
| **Alexandria Snippet Import** | SearxNG integration + license provenance | Snippet import widget | Snippets import with attribution |

#### 1.2. Qualification Gate (Novustrix-Only)
| Task | Output | Success Criteria |
|------|--------|------------------|
| Define **qualification rules** (YAML schema) | `qualification_gate.yaml` | Rules are version-controlled |
| Implement **automated checks** (syntax, perf, security) | CI pipeline | Widgets pass/fail automatically |
| Build **Great Repository v1** (centralized) | Registry service | Widgets are searchable/listed |
| Add **operator override** | Admin UI | Operators can allow blocked widgets locally |
| **Public ledger** of widget submissions | Ledger API | All decisions are auditable |

#### 1.3. Deployment
| Task | Output | Success Criteria |
|------|--------|------------------|
| Deploy **testrix.stonegamingtable.net** (Synapse) | Homeserver | Federation works |
| Deploy **Novustrix client** (web + mobile) | Client builds | Cognitive Cosmos can use it |
| **Migration tools** for Cognitive Cosmos | Scripts + docs | Discord → Novustrix migration is smooth |

**Deliverable:** Novustrix **beta** (Cognitive Cosmos migration + public demo).

---

### Phase 2: Standardization Proposals (6–18 Months)
**Goal:** Start proposing Novustrix features as **Matrix standards** (MSCs). *Runs in parallel with Phase 1.*

#### 2.1. Standardization Strategy
| Step | Task | Output | Timeline |
|------|------|--------|----------|
| **Engage Matrix community** | Join [Matrix Spec Core Team](https://matrix.org/docs/spec/proposals), introduce Novustrix | Community relationships | Month 6 |
| **Identify standardizable features** | Audit Novustrix features for Matrix compatibility | MSC roadmap | Month 6 |
| **Draft MSC for Roles** | Propose `m.role` event type + fallback to `m.room.power_levels` | MSC-XXXX: Roles | Month 9 |
| **Draft MSC for Widgets** | Extend Widget API with sandboxing, capabilities, qualification | MSC-XXXX: Enhanced Widgets | Month 12 |
| **Draft MSC for Studios** | Propose `m.room.type: "com.novustrix.studio"` + metadata schema | MSC-XXXX: Studios | Month 15 |
| **Draft MSC for Cross-Arts Bus** | Propose `m.widget.bus` event type | MSC-XXXX: Widget Bus | Month 18 |

#### 2.2. MSC Template (Example: Roles)
```markdown
# MSC-XXXX: Matrix Role System
**Author:** Novustrix Team
**Status:** Proposal
**Created:** 2025-XX-XX

## Summary
Add a **native role system** to Matrix, enabling:
- Colored names
- Grouped member lists
- Reaction-based role assignment (access roles only)

## Background
Matrix lacks a role construct (unlike Discord). Current workarounds:
- Power levels (permissions only)
- Custom state events (no standard schema)
- Bot-based roles (fragile, non-federated)

## Proposal
### Event Types
#### `m.role`
```json
{
  "type": "m.role",
  "room_id": "!room:example.com",
  "content": {
    "role_id": "artist",
    "name": "Artist",
    "color": "#FF0000",
    "power_level": 50,
    "is_self_assignable": false,
    "assignable_by_reaction": true,
    "members": ["@user1:example.com", "@user2:example.com"]
  }
}
```

#### Fallback
- If a client doesn’t support `m.role`, it **ignores the event** but still renders the room using `m.room.power_levels` and `m.room.member`.

### Backward Compatibility
- `m.role` is **additive**—doesn’t break existing Matrix clients.
- Clients can **opt-in** to rendering roles.

### Security
- **No privilege escalation:** `assignable_by_reaction` only works for **access roles** (not permissions).
- **Operator control:** Homeserver admins can disable role assignments.

## Implementation
- **Novustrix:** Reference implementation.
- **Element:** Prototype support.
```

#### 2.3. Standardization Priorities
| Priority | Feature | MSC | Rationale |
|----------|---------|-----|-----------|
| **P0** | Widget API Extensions | MSC-XXXX | Core to Novustrix’s value prop |
| **P0** | Roles | MSC-XXXX | Needed for community management |
| **P1** | Studios | MSC-XXXX | Enables collaborative spaces |
| **P1** | Cross-Arts Bus | MSC-XXXX | Enables inter-widget comms |
| **P2** | Voice Captions | MSC-XXXX | Accessibility feature |
| **P2** | Modmail | MSC-XXXX | Already better than Discord’s |

---

### Phase 3: Hybrid Implementation (12–24 Months)
**Goal:** Implement **Matrix standards** in Novustrix *while* maintaining Novustrix-only features as **extensions**.

#### 3.1. Dual-Mode Features
| Feature | Standard Mode | Novustrix Mode | Fallback |
|---------|---------------|----------------|----------|
| **Roles** | `m.role` event | `com.novustrix.role` (extra metadata) | Ignore `com.novustrix.role` if `m.role` exists |
| **Widgets** | Matrix Widget API + extensions | Novustrix widget host | Render as link if Widget API unsupported |
| **Studios** | `m.room.type: "m.studio"` | `com.novustrix.studio` (extra features) | Treat as regular room |
| **Cross-Arts Bus** | `m.widget.bus` | `com.novustrix.bus` (extra channels) | Ignore bus messages |
| **Ping Roles** | `@role` → `m.mentions.user_ids` (Path A) | Novustrix-only | `@role` is plain text in other clients |

#### 3.2. Implementation Tasks
| Task | Output | Success Criteria |
|------|--------|------------------|
| **Refactor Novustrix** to use standard Matrix events where possible | Updated client | Works with Element/other clients |
| **Polyfill system** for unsupported clients | Polyfill library | Novustrix features degrade gracefully |
| **Test interoperability** with Element, FluffyChat, etc. | Test suite | Features work or fail gracefully |
| **Document extensions** | Extension registry | Clear what’s standard vs. Novustrix-only |

#### 3.3. Example: Hybrid Roles
```dart
// In Novustrix client:
void renderMember(MatrixMember member) {
  // Try standard role first
  final standardRole = getStandardRole(member.userId);
  if (standardRole != null) {
    return renderStandardRole(member, standardRole);
  }

  // Fall back to Novustrix role
  final novustrixRole = getNovustrixRole(member.userId);
  if (novustrixRole != null) {
    return renderNovustrixRole(member, novustrixRole);
  }

  // Default: no role
  return renderDefaultMember(member);
}
```

---

### Phase 4: Ecosystem Adoption (18–36 Months)
**Goal:** Drive adoption of Novustrix’s **Matrix standards** across the fediverse.

#### 4.1. Adoption Strategy
| Task | Output | Success Criteria |
|------|--------|------------------|
| **Reference implementations** | Example widgets/studios | Other devs can build on them |
| **Documentation** | MSC docs + tutorials | Easy for others to adopt |
| **Outreach to Matrix clients** | Element, FluffyChat, etc. | At least 2 other clients support MSCs |
| **Community building** | Novustrix Matrix space | Active contributor community |
| **Hackathons/Grants** | Funding for MSC implementations | External contributions |

#### 4.2. Adoption Metrics
| Metric | Target | Timeline |
|--------|--------|----------|
| **MSCs accepted** | 3+ (Roles, Widgets, Studios) | Month 24 |
| **Clients supporting MSCs** | 3+ (Novustrix, Element, 1 other) | Month 30 |
| **Widgets in Great Repository** | 50+ | Month 24 |
| **Active Novustrix instances** | 10+ | Month 36 |

---

---

## 🔗 Cross-Cutting Concerns

### 1. Backward Compatibility
- **Rule:** Every Novustrix feature must **degrade gracefully** in other clients.
- **Example:**
  - A studio room in Novustrix = **rich collaborative space**.
  - Same room in Element = **regular Matrix room** (users see messages but not the studio UI).
- **Implementation:**
  - Use **standard Matrix events** for core functionality.
  - Add **Novustrix-specific events** as extensions.

### 2. Security
- **Widget sandboxing:** Must work **even if other clients don’t sandbox**.
- **Qualification gate:** Novustrix’s gate is **stricter** than Matrix’s default.
- **Audit trail:** All widget actions are **logged server-side** (even if the client doesn’t).

### 3. Performance
- **Widget limits:** Enforce **per-client limits** (e.g., max 3 widgets/room).
- **Fallbacks:** If a widget fails, **show a static fallback** (e.g., "This widget requires Novustrix").
- **Lazy loading:** Load widgets **only when visible**.

### 4. Governance
- **Novustrix Foundation:** Legal entity to maintain the project.
- **MSC process:** Follow [Matrix’s MSC guidelines](https://matrix.org/docs/spec/proposals).
- **Community input:** Public Matrix room for feedback (`#novustrix:matrix.org`).

---

---

## ⚠️ Risk Mitigation
| Risk | Mitigation | Owner |
|------|------------|-------|
| **Matrix community rejects MSCs** | Start with **small, non-controversial MSCs** (e.g., Widget API extensions) | Dev + Community |
| **Standardization takes too long** | **Parallel tracks:** Novustrix-first + standardization | PM |
| **Novustrix becomes a silo** | **Prioritize interoperability** in every feature | Dev |
| **Performance issues with widgets** | **Server-side proxy** + **strict limits** | Dev |
| **Security vulnerabilities in widgets** | **Qualification gate** + **malicious test suite** | Security |
| **Cognitive Cosmos migration fails** | **Early alpha testing** with power users | Community |

---

---

## 📊 Success Metrics
| Category | Metric | Target | Timeline |
|----------|--------|--------|----------|
| **User Adoption** | Cognitive Cosmos fully migrated | 100% | Month 12 |
| **Technical** | Novustrix alpha | Feature-complete for Cognitive Cosmos | Month 6 |
| **Technical** | Novustrix beta | Public demo | Month 12 |
| **Technical** | Novustrix 1.0 | Stable release | Month 18 |
| **Standardization** | 1 MSC accepted | Roles or Widgets | Month 12 |
| **Standardization** | 3 MSCs accepted | Roles, Widgets, Studios | Month 24 |
| **Ecosystem** | 3+ clients support Novustrix MSCs | Element + 2 others | Month 30 |
| **Community** | 10+ active Novustrix instances | | Month 36 |

---

---

## 📝 Open Questions for Claude Review
1. **Standardization Priority:**
   - Should we **start with Widgets** (core to Novustrix) or **Roles** (simpler, more likely to be accepted)?

2. **Fallback Strategy:**
   - How should Novustrix **detect** if a client supports an MSC?
     - Option A: **Feature detection** (check for `m.role` events in room state).
     - Option B: **Client version** (maintain a list of supporting clients/versions).

3. **Qualification Gate:**
   - Should the **Great Repository** remain **centralized** (Novustrix-controlled) or become **decentralized** (Matrix-native)?
   - If decentralized, how? (e.g., a Matrix space with widget rooms?)

4. **Cross-Arts Bus:**
   - Should the bus be **room-scoped** (only widgets in the same room can communicate) or **global** (any widget can talk to any other)?

5. **Monetization:**
   - How to **fund development**?
     - Option A: **Donations** (Cognitive Cosmos, patrons).
     - Option B: **Hosted Novustrix** (paid instances for communities).
     - Option C: **Grants** (Matrix Foundation, NLnet, etc.).

6. **Timeline:**
   - Is **3–5 years** realistic for full standardization?
   - Should we **accelerate** by focusing on **1–2 key MSCs** first?

---

---

## 📚 Appendices

### A. Glossary
| Term | Definition |
|------|------------|
| **MSC** | Matrix Specification Change (proposal for new Matrix features) |
| **AGPL-3.0** | Affero General Public License (ensures hosted forks publish source) |
| **Widget Host** | Novustrix’s system for rendering widgets in rooms |
| **Qualification Gate** | Novustrix’s system for vetting widgets (security, perf, etc.) |
| **Great Repository** | Public registry of qualified widgets |
| **Studio** | Collaborative space (e.g., Visual Artistry, The Anvil) |
| **Cross-Arts Bus** | Pub/sub system for inter-widget communication |

### B. References
- [Matrix Specification](https://matrix.org/docs/spec)
- [Matrix Widget API](https://matrix.org/docs/spec/widget_api)
- [MSC Process](https://matrix.org/docs/spec/proposals)
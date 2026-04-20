-- Migration 030 — close remaining field gaps on KSCW Member `members.read`.
--
-- Found while auditing after migration 029 (consent-modal accept-loop fix).
-- Both read rows still miss columns that the frontend actively reads, producing
-- silent bugs on affected screens:
--
-- Row 7295 (self-read, permissions = $CURRENT_USER):
--   • is_spielplaner — useAuth.tsx:174,228 does `setIsSpielplaner(!!member.is_spielplaner)`.
--     7 members have is_spielplaner=true but the FE always sees `undefined`, so the
--     Spielplaner menu is invisible unless the user is also admin (admin policy returns *).
--   • kscw_membership_active — ProfileEditModal.tsx:569 displays "Aktiv/Passiv"; always "Passiv".
--   • beitragskategorie — ProfileEditModal.tsx:253,561 form default + display; always empty.
--
-- Row 7294 (cross-member read, no filter):
--   • kscw_membership_active — AssignmentEditor.tsx:63 + DelegationModal.tsx:72 filter
--     with `m.kscw_membership_active && …`. Field is undefined → filter returns [] →
--     coaches see no members in scorer/delegation modals. TRs/admins unaffected
--     (those policies have fields='*'). KSCW Coach policy has no members.read row of
--     its own, so coaches fall back to this one.
--   • shell, shell_expires — MemberRow.tsx:129,168,172 renders the shell-member amber
--     badge; never appears for coaches/members viewing rosters.
--
-- Idempotent (guard on fields NOT LIKE '%is_spielplaner%' for 7295 and
-- '%kscw_membership_active%' for 7294). Apply to prod + dev.
-- After applying, restart the target Directus container so the permissions
-- cache picks it up.

-- Self-read row (prod row 7295 / dev row 7046)
UPDATE directus_permissions
SET fields = fields
  || ',is_spielplaner'
  || ',kscw_membership_active'
  || ',beitragskategorie'
WHERE collection = 'members'
  AND action = 'read'
  AND permissions IS NOT NULL                   -- self-scoped row
  AND policy IN (SELECT id FROM directus_policies WHERE name ILIKE '%member%')
  AND fields NOT LIKE '%is_spielplaner%';

-- Cross-member read row (prod row 7294 / dev row 7045)
UPDATE directus_permissions
SET fields = fields
  || ',kscw_membership_active'
  || ',shell'
  || ',shell_expires'
WHERE collection = 'members'
  AND action = 'read'
  AND permissions IS NULL                       -- no filter = cross-member public row
  AND policy IN (SELECT id FROM directus_policies WHERE name ILIKE '%member%')
  AND fields NOT LIKE '%kscw_membership_active%';

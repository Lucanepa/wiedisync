/**
 * SV Licence — own row only (closes the audit's last open Critical).
 *
 * GET /kscw/sv-licence/me
 *   Returns the caller's own sv_vm_check row, joined by license_nr →
 *   association_id (the canonical FK chain since sv_vm_check has no
 *   members FK column).
 *
 * The intended fix in migration 043 was a Directus row filter on
 * sv_vm_check.read — blocked by Directus 11 generating invalid
 * `CASE WHEN 1` SQL. Pulling the access through this endpoint lets us
 * REVOKE direct sv_vm_check.read for KSCW Member entirely.
 *
 * Field whitelist mirrors the original VM_CHECK_FIELDS so PII surface
 * (email, birthday, name, phone, team_names) stays restricted — even
 * though it's the caller's own data, members already see those fields
 * via members.read on their own row, no need to redundantly carry.
 */

const VM_CHECK_FIELDS = [
  'id',
  'association_id',
  'licence_category',
  'licence_activated',
  'licence_validated',
  'is_locally_educated',
  'is_foreigner',
  'federation',
  'nationality_code',
  'licence_activation_date',
  'licence_validation_date',
]

export function registerSvLicence(router, { database, logger }) {
  const log = logger.child({ endpoint: 'sv-licence' })

  router.get('/sv-licence/me', async (req, res) => {
    try {
      const userId = req.accountability?.user
      if (!userId) return res.status(401).json({ error: 'Authentication required' })

      // Resolve caller's license_nr from members (Directus user UUID → members.license_nr)
      const member = await database('members')
        .where('user', userId)
        .select('license_nr')
        .first()

      if (!member?.license_nr) {
        return res.json({ data: null })
      }

      // Look up the matching sv_vm_check row by association_id = members.license_nr
      const row = await database('sv_vm_check')
        .where('association_id', member.license_nr)
        .select(VM_CHECK_FIELDS)
        .first()

      return res.json({ data: row || null })
    } catch (err) {
      log.error({ msg: `sv-licence/me: ${err.message}`, endpoint: 'sv-licence/me', userId: req.accountability?.user || null, stack: err.stack })
      res.status(500).json({ error: 'Internal error' })
    }
  })
}
